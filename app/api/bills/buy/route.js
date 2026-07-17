// app/api/bills/buy/route.js
import { NextResponse } from 'next/server'
import { vtugate } from '@/lib/vtugate'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { log } from '@/lib/logger'

export async function POST(req) {
  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { type } = body
  if (!['airtime', 'data', 'cable', 'electricity', 'education'].includes(type)) {
    return NextResponse.json({ error: 'Invalid or missing type' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // All reads/writes from here on go through the service-role client —
  // matching the pattern your other /api/*/buy routes already use, and
  // sidestepping the fact that `orders` currently has no INSERT policy
  // for the regular (RLS-respecting) client.
  const admin = createAdminClient()

  // ── 1. Resolve the canonical price server-side wherever possible ─────────
  // Never trust a price the client sends for anything driven by a fixed
  // plan/pin cost — only amount-based products (airtime top-up, electricity
  // prepaid) are legitimately client-chosen numbers.
  let price
  let purchaseArgs

  try {
    if (type === 'airtime') {
      const { serviceId, phone, amount } = body
      if (!serviceId || !phone || !amount) {
        return NextResponse.json({ error: 'serviceId, phone and amount are required' }, { status: 400 })
      }
      price = Number(amount)
      purchaseArgs = { serviceId, phone, amount: price }

    } else if (type === 'data') {
      const { serviceId, phone, planCode } = body
      if (!serviceId || !phone || !planCode) {
        return NextResponse.json({ error: 'serviceId, phone and planCode are required' }, { status: 400 })
      }
      const plansData = await vtugate.fetchDataPlans(serviceId)
      const plan = (plansData.data_plans || []).find(p => String(p.code) === String(planCode))
      if (!plan) {
        return NextResponse.json({ error: 'Selected plan is no longer available' }, { status: 400 })
      }
      price = Number(plan.price)
      purchaseArgs = { serviceId, phone, planCode, amount: price }

    } else if (type === 'cable') {
      const { serviceId, phone, smartcardNumber, planCode } = body
      if (!serviceId || !phone || !smartcardNumber || !planCode) {
        return NextResponse.json({ error: 'serviceId, phone, smartcardNumber and planCode are required' }, { status: 400 })
      }
      const verifyData = await vtugate.verifyCableTv({ serviceId, phone, smartcardNumber })
      const plan = (verifyData.cable_plans || []).find(p => String(p.code) === String(planCode))
      if (!plan) {
        return NextResponse.json({ error: 'Selected package is no longer available' }, { status: 400 })
      }
      price = Number(plan.price)
      purchaseArgs = {
        serviceId, phone, smartcardNumber, amount: price,
        planCode: plan.code, planName: plan.name,
      }

    } else if (type === 'electricity') {
      const { serviceId, meterNo, disco, amount, phone } = body
      if (!serviceId || !meterNo || !disco || !amount || !phone) {
        return NextResponse.json({ error: 'serviceId, meterNo, disco, amount and phone are required' }, { status: 400 })
      }
      price = Number(amount)
      purchaseArgs = { serviceId, meterNo, disco, amount: price, phone }

    } else if (type === 'education') {
      const { serviceId, phone, quantity, productCode } = body
      if (!serviceId || !phone || !quantity || !productCode) {
        return NextResponse.json({ error: 'serviceId, phone, quantity and productCode are required' }, { status: 400 })
      }
      const priceData = await vtugate.getEducationPrice(serviceId)
      price = Number(priceData.price) * Number(quantity)
      purchaseArgs = { serviceId, phone, quantity, productCode }
    }
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }

  if (!price || price <= 0) {
    return NextResponse.json({ error: 'Could not determine a valid price' }, { status: 400 })
  }

  // ── 2. Check balance (advisory — the real guard is the conditional
  //      update below, which prevents a race between two simultaneous
  //      requests both passing this check) ─────────────────────────────────
  const { data: profile } = await admin
    .from('profiles')
    .select('wallet_balance')
    .eq('id', user.id)
    .single()

  if (!profile || Number(profile.wallet_balance || 0) < price) {
    await log('warning', 'bills', `Insufficient balance for ${type} purchase`, user.id, user.email, {
      type, price, walletBalance: profile?.wallet_balance,
    })
    return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 })
  }

  // ── 3. Call VTUGATE. Only touch the wallet/orders table on confirmed
  //      success — a failed external call must never cost the user money. ──
  let providerResult
  try {
    if (type === 'airtime') providerResult = await vtugate.buyAirtime(purchaseArgs)
    else if (type === 'data') providerResult = await vtugate.buyData(purchaseArgs)
    else if (type === 'cable') providerResult = await vtugate.buyCableTv(purchaseArgs)
    else if (type === 'electricity') providerResult = await vtugate.buyElectricity(purchaseArgs)
    else if (type === 'education') providerResult = await vtugate.buyEducation(purchaseArgs)
  } catch (e) {
    await log('error', 'bills', `VTUGATE ${type} purchase failed: ${e.message}`, user.id, user.email, {
      type, price, purchaseArgs, vtugateError: e.vtugate || null,
    })
    return NextResponse.json({ error: e.message }, { status: 400 })
  }

  // ── 4. Atomic-ish debit — the WHERE clause means this only succeeds if
  //      the balance is still sufficient at write time, closing the race
  //      window from step 2. If this returns no rows, VTUGATE has already
  //      been charged — that edge case needs manual reconciliation/refund,
  //      logged clearly below rather than silently swallowed. ─────────────
  const { data: updatedRows, error: debitError } = await admin
    .from('profiles')
    .update({ wallet_balance: Number(profile.wallet_balance) - price })
    .eq('id', user.id)
    .gte('wallet_balance', price)
    .select('wallet_balance')

  if (debitError || !updatedRows || updatedRows.length === 0) {
    await log('error', 'bills', `CRITICAL: VTUGATE charged but wallet debit failed for ${type}`, user.id, user.email, {
      type, price, providerResult, debitError: debitError?.message,
    })
    console.error('[bills/buy] VTUGATE charged but wallet debit failed', {
      userId: user.id, type, price, providerResult,
    })
    return NextResponse.json({
      error: 'Purchase succeeded with the provider but your wallet could not be updated. Contact support with this reference: ' +
        (providerResult.external_reference || providerResult.transaction_id),
    }, { status: 500 })
  }

  // ── 5. Log the order. ADJUST COLUMN NAMES to match your actual `orders`
  //      table schema — these are best-guess names based on what I could
  //      see referenced in your dashboard page (amount, status). ──────────
  await admin.from('orders').insert({
    user_id: user.id,
    type: `bills_${type}`,
    description: providerResult.description || providerResult.message || type,
    amount: price,
    status: 'completed',
    reference: providerResult.external_reference || null,
    transaction_id: providerResult.transaction_id || null,
    metadata: providerResult,
  })

  await log('info', 'bills', `${type} purchase successful — ₦${price}`, user.id, user.email, {
    type, price, reference: providerResult.external_reference, transactionId: providerResult.transaction_id,
  })

  return NextResponse.json({
    success: true,
    price_ngn: price,
    result: providerResult,
  })
}