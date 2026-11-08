// app/api/boost/order/route.js
//
// The single order endpoint for both Turbo (Exobooster) and Standard (JAP)
// boosts. The browser sends only { serviceCode, link, quantity }. Every
// other fact — price, provider, product name, quantity limits — is looked
// up server-side. Nothing the client says about price or product name is
// ever trusted (see lib/boost/pricing.js).
//
// Flow, each step only proceeds if the one before it succeeded:
//   1. Verify the caller is signed in.
//   2. Get an authoritative quote (price, provider, provider service id).
//   3. Validate the link matches the platform.
//   4. Debit the wallet + create order + job atomically (idempotent by key).
//      If this was a replay of an already-processed request, skip straight
//      to step 6 with the existing result — never call the provider twice.
//   5. Call the provider exactly once. Never retried automatically.
//   6. Resolve the outcome:
//        provider accepted           -> mark job 'submitted', done
//        provider explicitly rejected -> full refund via boost_settle('failed')
//        timeout / unreadable reply   -> leave as 'needs_review', NO refund,
//                                         a human checks it against the
//                                         provider's order history later
//
// This route never reads the client's idempotency key blindly — it
// requires one, so a double-click or a retried request can't double-charge.

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/boost/supabase-admin'
import { quoteBoost } from '@/lib/boost/pricing'
import { validateLink } from '@/lib/boost/links'
import { addOrder } from '@/lib/boost/providers'
import { findService } from '@/lib/boost/catalog'

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { serviceCode, link: rawLink, quantity, idempotencyKey } = body || {}

  if (!serviceCode || typeof serviceCode !== 'string') {
    return NextResponse.json({ error: 'serviceCode is required' }, { status: 400 })
  }
  if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.length < 8) {
    return NextResponse.json({ error: 'A valid idempotencyKey is required' }, { status: 400 })
  }

  const admin = getAdminClient()

  // ---- 1. Auth ---------------------------------------------------------
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }
  const { data: userData, error: authError } = await admin.auth.getUser(token)
  if (authError || !userData?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }
  const userId = userData.user.id

  // ---- 2. Authoritative quote -------------------------------------------
  const quote = await quoteBoost(admin, { serviceCode, quantity })
  if (!quote.ok) {
    return NextResponse.json({ error: quote.message, code: quote.code, min: quote.min, max: quote.max }, { status: 400 })
  }

  // ---- 3. Link validation -------------------------------------------
  const linkCheck = validateLink(quote.platform, rawLink)
  if (!linkCheck.ok) {
    return NextResponse.json({ error: linkCheck.message, code: linkCheck.code }, { status: 400 })
  }

  const entry = findService(serviceCode)
  const productName = `${quote.label} — ${quote.platform} (${quote.quantity.toLocaleString('en-US')})`

  // ---- 4. Atomic debit + order + job creation ---------------------------
  const { data: debitRows, error: debitError } = await admin.rpc('boost_debit', {
    p_user_id: userId,
    p_idempotency_key: idempotencyKey,
    p_provider: quote.provider,
    p_tier: quote.tier,
    p_service_id: quote.providerServiceId,
    p_link: linkCheck.link,
    p_quantity: quote.quantity,
    p_price_ngn: quote.price,
    p_package_id: serviceCode,
    p_product_name: productName,
    p_platform: quote.platform,
  })

  if (debitError) {
    const message = debitError.message.includes('insufficient_funds')
      ? 'Insufficient wallet balance'
      : 'Could not process order'
    const status = debitError.message.includes('insufficient_funds') ? 402 : 500
    return NextResponse.json({ error: message }, { status })
  }

  const debit = Array.isArray(debitRows) ? debitRows[0] : debitRows
  if (!debit) {
    return NextResponse.json({ error: 'Could not process order' }, { status: 500 })
  }

  // Replay of an already-fully-processed request: the job may already be
  // past 'debited', so re-check its current state and DON'T call the
  // provider again — that would risk placing the order twice.
  if (debit.r_replayed) {
    const { data: job } = await admin
      .from('boost_jobs')
      .select('status, provider_order_id')
      .eq('id', debit.r_job_id)
      .maybeSingle()

    return NextResponse.json({
      orderId: debit.r_order_id,
      jobId: debit.r_job_id,
      status: job?.status || 'debited',
      balance: debit.r_balance,
      replayed: true,
    })
  }

  // ---- 5. Call the provider exactly once ---------------------------
  const result = await addOrder(quote.provider, {
    service: quote.providerServiceId,
    link: linkCheck.link,
    quantity: quote.quantity,
  })

  // ---- 6. Resolve the outcome -------------------------------------------
  if (result.ok) {
    await admin
      .from('boost_jobs')
      .update({
        status: 'submitted',
        provider_order_id: result.providerOrderId,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', debit.r_job_id)

    return NextResponse.json({
      orderId: debit.r_order_id,
      jobId: debit.r_job_id,
      status: 'submitted',
      balance: debit.r_balance,
    })
  }

  if (result.kind === 'rejected' || result.kind === 'config') {
    // Provider explicitly said no, or we never sent anything (bad config).
    // Either way it's certain no order was placed — safe to refund in full.
    const { data: settleRows, error: settleError } = await admin.rpc('boost_settle', {
      p_job_id: debit.r_job_id,
      p_status: 'failed',
      p_refund: quote.price,
      p_error: result.message,
    })
    const settle = Array.isArray(settleRows) ? settleRows[0] : settleRows

    return NextResponse.json({
      orderId: debit.r_order_id,
      jobId: debit.r_job_id,
      status: 'failed',
      balance: settleError ? debit.r_balance : settle?.r_balance,
      error: 'The provider could not accept this order. You have been refunded in full.',
    }, { status: 502 })
  }

  // result.kind === 'unknown': a timeout or unreadable reply. The order
  // MAY have gone through on the provider's side — never guess. Leave the
  // job as 'debited' with the error noted; a human (or the status sync,
  // once it can look this order up) resolves it. No refund, no retry.
  await admin
    .from('boost_jobs')
    .update({ status: 'needs_review', error: result.message, updated_at: new Date().toISOString() })
    .eq('id', debit.r_job_id)

  return NextResponse.json({
    orderId: debit.r_order_id,
    jobId: debit.r_job_id,
    status: 'needs_review',
    balance: debit.r_balance,
    error: 'Your order is being confirmed with the provider — this can take a few minutes. Check your order history shortly.',
  }, { status: 202 })
}