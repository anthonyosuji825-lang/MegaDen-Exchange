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
//      EXCEPTION: if the replayed job already FAILED (and was refunded in
//      full), the customer is deliberately trying again, so a fresh attempt
//      is made under a derived key instead of replaying the old failure.
//   5. Call the provider exactly once. Never retried automatically.
//   6. Resolve the outcome:
//        provider accepted           -> mark job 'submitted', done
//        provider explicitly rejected -> full refund via boost_settle('failed')
//        timeout / unreadable reply   -> leave as 'needs_review', NO refund,
//                                         a human checks it against the
//                                         provider's order history later
//
// Every meaningful outcome is written to the admin Logs page (category
// 'boost') through lib/logger.js, same as the numbers routes.

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/boost/supabase-admin'
import { quoteBoost } from '@/lib/boost/pricing'
import { validateLink } from '@/lib/boost/links'
import { addOrder } from '@/lib/boost/providers'
import { findService } from '@/lib/boost/catalog'
import { log } from '@/lib/logger'

export async function POST(request) {
  let userId = null
  let userEmail = null
  try {
    return await handleOrder(request, (id, email) => { userId = id; userEmail = email })
  } catch (err) {
    console.error('[boost/order]', err)
    await log('error', 'boost', `Unhandled exception in boost order route: ${err.message}`, userId, userEmail, { stack: err.stack })
    return NextResponse.json({ error: 'Could not process order' }, { status: 500 })
  }
}

async function handleOrder(request, setUser) {
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
    await log('warning', 'auth', 'Unauthorized attempt to place boost order (no token)', null, null, { serviceCode })
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }
  const { data: userData, error: authError } = await admin.auth.getUser(token)
  if (authError || !userData?.user) {
    await log('warning', 'auth', 'Unauthorized attempt to place boost order (invalid token)', null, null, { serviceCode })
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }
  const userId = userData.user.id
  const userEmail = userData.user.email || null
  setUser(userId, userEmail)

  // ---- 2. Authoritative quote -------------------------------------------
  const quote = await quoteBoost(admin, { serviceCode, quantity })
  if (!quote.ok) {
    await log('warning', 'boost', `Boost order refused at quote step: ${quote.message}`, userId, userEmail, {
      serviceCode, quantity, code: quote.code,
    })
    return NextResponse.json({ error: quote.message, code: quote.code, min: quote.min, max: quote.max }, { status: 400 })
  }

  // ---- 3. Link validation -------------------------------------------
  const linkCheck = validateLink(quote.platform, rawLink)
  if (!linkCheck.ok) {
    await log('info', 'boost', `Boost order refused: ${linkCheck.message}`, userId, userEmail, {
      serviceCode, platform: quote.platform, code: linkCheck.code,
      // What the customer actually pasted, so you can see why it was refused.
      pasted: String(rawLink ?? '').slice(0, 300),
    })
    return NextResponse.json({ error: linkCheck.message, code: linkCheck.code }, { status: 400 })
  }

  const productName = `${quote.label} — ${quote.platform} (${quote.quantity.toLocaleString('en-US')})`

  // ---- 4. Atomic debit + order + job creation ---------------------------
  const callDebit = (key) => admin.rpc('boost_debit', {
    p_user_id: userId,
    p_idempotency_key: key,
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

  // A replay whose job already FAILED was refunded in full, so the customer
  // pressing the button again means "try once more", not "show me the old
  // result". Each failed attempt chains to a fresh key derived from the
  // failed job, so repeated failures keep working. Capped as a safety net.
  let attemptKey = idempotencyKey
  let debitRows = null
  let debitError = null
  let debit = null
  let replayedFailedJob = false

  for (let attempt = 0; attempt < 10; attempt++) {
    ;({ data: debitRows, error: debitError } = await callDebit(attemptKey))
    debit = !debitError ? (Array.isArray(debitRows) ? debitRows[0] : debitRows) : null
    replayedFailedJob = false

    if (!debit || !debit.r_replayed) break

    const { data: prevJob } = await admin
      .from('boost_jobs')
      .select('status')
      .eq('id', debit.r_job_id)
      .maybeSingle()

    if (prevJob?.status !== 'failed') break
    replayedFailedJob = true
    attemptKey = `${attemptKey}:retry:${debit.r_job_id}`
  }

  if (replayedFailedJob) {
    return NextResponse.json({ error: 'This order already failed and was refunded. Please start a new order.' }, { status: 409 })
  }

  if (debitError) {
    const insufficient = debitError.message.includes('insufficient_funds')
    if (insufficient) {
      await log('warning', 'wallet', 'Insufficient wallet balance for boost order', userId, userEmail, {
        serviceCode, price_ngn: quote.price,
      })
    } else {
      await log('error', 'boost', `CRITICAL: boost_debit failed: ${debitError.message}`, userId, userEmail, {
        serviceCode, price_ngn: quote.price, provider: quote.provider, db_error: debitError.message,
      })
    }
    return NextResponse.json(
      { error: insufficient ? 'Insufficient wallet balance' : 'Could not process order' },
      { status: insufficient ? 402 : 500 }
    )
  }

  if (!debit) {
    await log('error', 'boost', 'boost_debit returned no row', userId, userEmail, { serviceCode })
    return NextResponse.json({ error: 'Could not process order' }, { status: 500 })
  }

  // Replay of an already-processed request (job not failed): report its
  // CURRENT state faithfully and DON'T call the provider again — that would
  // risk placing the order twice.
  if (debit.r_replayed) {
    const { data: job } = await admin
      .from('boost_jobs')
      .select('status, provider_order_id')
      .eq('id', debit.r_job_id)
      .maybeSingle()

    const jobStatus = job?.status || 'debited'
    const stillConfirming = jobStatus === 'needs_review' || jobStatus === 'debited'

    return NextResponse.json({
      orderId: debit.r_order_id,
      jobId: debit.r_job_id,
      status: jobStatus,
      balance: debit.r_balance,
      replayed: true,
    }, { status: stillConfirming ? 202 : 200 })
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

    await log('info', 'boost', `Boost order submitted via ${quote.provider} — ${quote.label} ${quote.platform} (${quote.quantity.toLocaleString('en-US')})`, userId, userEmail, {
      order_id: debit.r_order_id, job_id: debit.r_job_id, provider: quote.provider, tier: quote.tier,
      provider_order_id: result.providerOrderId, serviceCode, quantity: quote.quantity, amount_ngn: quote.price,
    })

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

    // 'Not enough funds' / key problems are OUR provider account's fault, not
    // the customer's — make those impossible to miss in the admin logs.
    await log('error', 'boost',
      settleError
        ? `CRITICAL: provider rejected boost order AND the refund failed: ${result.message}`
        : `Provider rejected boost order, customer refunded: ${result.message}`,
      userId, userEmail, {
        order_id: debit.r_order_id, job_id: debit.r_job_id, provider: quote.provider, tier: quote.tier,
        reason_kind: result.kind, provider_message: result.message, serviceCode, quantity: quote.quantity,
        amount_ngn: quote.price, refund_error: settleError?.message,
      })

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
  // job in 'needs_review' with the error noted; a human checks it against
  // the provider's order history. No refund, no retry.
  await admin
    .from('boost_jobs')
    .update({ status: 'needs_review', error: result.message, updated_at: new Date().toISOString() })
    .eq('id', debit.r_job_id)

  await log('error', 'boost', `CRITICAL: boost order outcome unknown (${result.message}) — check ${quote.provider} order history before refunding`, userId, userEmail, {
    order_id: debit.r_order_id, job_id: debit.r_job_id, provider: quote.provider, tier: quote.tier,
    provider_message: result.message, serviceCode, link: linkCheck.link, quantity: quote.quantity, amount_ngn: quote.price,
  })

  return NextResponse.json({
    orderId: debit.r_order_id,
    jobId: debit.r_job_id,
    status: 'needs_review',
    balance: debit.r_balance,
    error: 'Your order is being confirmed with the provider — this can take a few minutes. Check your order history shortly.',
  }, { status: 202 })
}