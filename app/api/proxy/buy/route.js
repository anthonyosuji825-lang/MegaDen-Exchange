// app/api/proxy/buy/route.js
//
// Buy a residential proxy plan (1 or more IP slots). Each slot becomes its
// own order so it can be started, rotated and stopped independently.
//
// THIS IS THE RISKIEST PURCHASE WE SELL: Fleexa has no refund or cancel for
// a proxy once it is bought. So:
//   1. The wallet is debited FIRST (atomic). A refused debit = nothing bought.
//   2. Fleexa is called with an Idempotency-Key, and an ambiguous failure
//      (timeout / 5xx) is retried ONCE with the same key, so a retry can
//      never buy twice.
//   3. If Fleexa still cannot confirm, the customer is refunded and a
//      CRITICAL log row carries the idempotency key - the one case where we
//      might have paid Fleexa for something the customer did not get. The
//      amount at risk is one plan's wholesale cost, and the log says exactly
//      what to look up in Fleexa's order list.
//   4. If the order rows cannot be saved after a successful purchase, the
//      customer is refunded and the Fleexa slot ids are logged, so the slots
//      can be recovered by hand.
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { log } from '@/lib/logger'
import {
  supabaseAdmin, getAuthedUser, getWalletProfile, getMarkupPercent, sellPriceNgn,
  debitWallet, refundOrLog, recordTransaction, makeInFlightGuard,
} from '@/lib/fleexaShared'
import { listProxyPlans, orderProxy } from '@/lib/providers/fleexaProxy'

const guard = makeInFlightGuard()

export async function POST(request) {
  let guardKey = null
  // Crash safety: if anything throws AFTER the wallet was debited and BEFORE
  // the purchase is settled, the customer is refunded in the catch block.
  const money = { userId: null, userEmail: null, debited: 0, settled: false, idempotencyKey: null }
  try {
    const user = await getAuthedUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let body
    try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }

    const planId = String(body.plan_id || '').trim()
    const country = String(body.country || '').trim().toUpperCase()
    const stateRaw = body.state === undefined || body.state === null ? '' : String(body.state).trim()
    const proxyType = body.proxy_type === undefined || body.proxy_type === null ? 2 : Number(body.proxy_type)

    if (!planId || planId.length > 64 || !/^[A-Z]{2}$/.test(country) || stateRaw.length > 64) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!Number.isInteger(proxyType)) return NextResponse.json({ error: 'Invalid proxy type' }, { status: 400 })

    // The price the customer was SHOWN - a ceiling only, never the price.
    const shown = Number(body.expected_price_ngn)
    const ceiling = Number.isFinite(shown) && shown > 0 ? shown : null

    guardKey = `${user.id}:proxy`
    if (!guard.tryEnter(guardKey)) {
      guardKey = null // not ours - don't clear the first request's lock
      return NextResponse.json({ error: 'Your previous purchase is still being processed. Please wait a moment.', code: 'PURCHASE_IN_PROGRESS' }, { status: 429 })
    }

    const wallet = await getWalletProfile(user.id)
    const userEmail = wallet.email || user.email || null

    // ── Real, uncached plan list from Fleexa: validates the plan, country,
    //    state and format, and gives the true price right now. ──
    const [markup, catalog] = await Promise.all([getMarkupPercent('proxy'), listProxyPlans()])
    if (!catalog.ok) return NextResponse.json({ error: 'Pricing is unavailable right now. Please try again.' }, { status: 502 })

    const plan = catalog.plans.find((p) => p.id === planId)
    if (!plan) return NextResponse.json({ error: 'This proxy plan is no longer available.' }, { status: 400 })

    const countryInfo = catalog.countries.find((c) => c.code === country)
    if (!countryInfo) return NextResponse.json({ error: 'This country is not available.' }, { status: 400 })

    let state = null
    if (stateRaw && stateRaw.toLowerCase() !== 'random') {
      if (!countryInfo.states.some((s) => s === stateRaw)) return NextResponse.json({ error: 'This state is not available for the selected country.' }, { status: 400 })
      state = stateRaw
    }

    const allowedTypes = catalog.categories.length > 0 ? catalog.categories.map((c) => c.type) : [2, 3]
    if (!allowedTypes.includes(proxyType)) return NextResponse.json({ error: 'This proxy format is not available.' }, { status: 400 })

    const total = sellPriceNgn(plan.costNgn, markup)
    if (!total) return NextResponse.json({ error: 'Could not determine the price. Please try again.' }, { status: 400 })

    if (ceiling !== null && total > ceiling) {
      await log('info', 'number', 'Proxy price rose since it was listed - asked the customer to confirm', user.id, userEmail, {
        feature: 'proxy', plan_id: planId, shown_price_ngn: ceiling, new_price_ngn: total,
      }).catch(() => {})
      return NextResponse.json({
        error: `The price is now ₦${total.toLocaleString()} (it was ₦${ceiling.toLocaleString()}). Review it and tap Buy again to confirm.`,
        code: 'PRICE_CHANGED',
        price_ngn: total,
      }, { status: 409 })
    }

    if (wallet.balance < total) {
      await log('warning', 'wallet', 'Insufficient wallet balance for Proxy', user.id, userEmail, {
        feature: 'proxy', total_ngn: total, wallet_balance: wallet.balance, plan_id: planId,
      }).catch(() => {})
      return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 })
    }

    // ── 1. Debit (atomic). Refused = nothing was bought, nothing to undo. ──
    money.userId = user.id
    money.userEmail = userEmail
    const debit = await debitWallet(user.id, total)
    if (!debit.ok) {
      if (debit.reason === 'INSUFFICIENT') return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 })
      await log('error', 'wallet', 'Wallet debit RPC failed for Proxy', user.id, userEmail, { feature: 'proxy', total_ngn: total, rpc_error: debit.error }).catch(() => {})
      return NextResponse.json({ error: 'Failed to complete purchase. Please try again.' }, { status: 500 })
    }

    money.debited = total
    // ── 2. Buy from Fleexa (idempotent, one retry on an ambiguous failure). ──
    const idempotencyKey = `megaden-proxy-${user.id}-${randomUUID()}`
    money.idempotencyKey = idempotencyKey
    const purchase = await orderProxy({ planId, country, state, proxyType, idempotencyKey })

    if (!purchase.ok) {
      const refunded = await refundOrLog({
        userId: user.id, userEmail, amount: total, feature: 'Proxy',
        context: { plan_id: planId, country, state, provider_kind: purchase.kind, idempotency_key: idempotencyKey },
      })
      if (purchase.kind === 'AMBIGUOUS') {
        // Fleexa never confirmed - but the order MAY exist on their side.
        await log('error', 'number', 'CRITICAL: Proxy purchase could not be confirmed by Fleexa (timeout/5xx twice) - customer refunded. The order MAY exist at Fleexa: check Fleexa proxy orders for this idempotency key / time to see if we paid for it', user.id, userEmail, {
          feature: 'proxy', plan_id: planId, plan_cost_ngn: plan.costNgn, country, state, idempotency_key: idempotencyKey, http: purchase.http, raw: purchase.raw, refunded,
        }).catch(() => {})
      } else {
        await log(purchase.kind === 'BALANCE_ERROR' ? 'error' : 'warning', purchase.kind === 'BALANCE_ERROR' ? 'wallet' : 'number',
          purchase.kind === 'BALANCE_ERROR'
            ? 'PROVIDER BALANCE: fleexa_proxy refused a purchase because our Fleexa account is out of funds - top it up'
            : 'Proxy purchase failed at the provider - wallet refunded',
          user.id, userEmail, { feature: 'proxy', plan_id: planId, country, state, kind: purchase.kind, message: purchase.message, http: purchase.http, refunded, raw: purchase.raw },
        ).catch(() => {})
      }
      money.settled = true // refunded above
      const msg = purchase.kind === 'AMBIGUOUS' || purchase.kind === 'BALANCE_ERROR' || purchase.kind === 'RATE_LIMITED'
        ? 'The proxy service is busy right now. You have not been charged - please try again shortly.'
        : 'This proxy is not available right now. You have not been charged - try another country or plan.'
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    // Split what the customer paid across the slots. Remainder naira go on the
    // first slots, so the slot amounts always add up to the total exactly.
    const qty = Math.max(1, plan.quantity)
    const baseShare = Math.floor(total / qty)
    const remainder = total - baseShare * qty
    const shareFor = (i) => baseShare + (i < remainder ? 1 : 0)

    const slots = purchase.slots.slice(0, qty)
    const charged = slots.reduce((sum, _, i) => sum + shareFor(i), 0)
    if (charged < total) {
      // Fleexa gave fewer slots than the plan promised - only pay for those.
      await refundOrLog({ userId: user.id, userEmail, amount: total - charged, feature: 'Proxy (short order)', context: { plan_id: planId, expected_slots: qty, received_slots: slots.length } })
      money.debited = charged // the rest has been given back already
      await log('warning', 'number', 'Proxy order returned fewer slots than the plan quantity - customer refunded the difference', user.id, userEmail, {
        feature: 'proxy', plan_id: planId, expected_slots: qty, received_slots: slots.length,
      }).catch(() => {})
    }

    if (purchase.amountPaidNgn !== null && Math.abs(purchase.amountPaidNgn - plan.costNgn) > 1) {
      await log('warning', 'number', 'Proxy cost mismatch - what Fleexa charged us differs from the quote', user.id, userEmail, {
        feature: 'proxy', quoted_cost: plan.costNgn, actual_cost: purchase.amountPaidNgn, plan_id: planId,
      }).catch(() => {})
    }

    // ── 3. One order per slot. ──
    const where = state ? `${country} (${state})` : country
    const created = []
    const unsaved = []
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .insert({
          user_id: user.id,
          product_type: 'proxy',
          product_name: `Proxy - ${where}`,
          amount: shareFor(i),
          status: 'pending', // bought, not started yet (needs "Get proxy")
          details: {
            provider: 'fleexa_proxy',
            external_id: slot.id,
            country,
            state,
            proxy_type: proxyType,
            plan_id: planId,
            plan_label: plan.label,
            cost_ngn: slot.amountPaidNgn ?? Math.round(plan.costNgn / qty),
            fleexa_reference: purchase.reference,
            idempotency_key: idempotencyKey,
          },
        })
        .select('id')
        .single()
      if (orderError || !order) unsaved.push({ slot_id: slot.id, share_ngn: shareFor(i), error: orderError?.message, code: orderError?.code })
      else created.push({ order_id: order.id })
    }

    if (unsaved.length > 0) {
      const unsavedAmount = unsaved.reduce((sum, u) => sum + u.share_ngn, 0)
      await refundOrLog({ userId: user.id, userEmail, amount: unsavedAmount, feature: 'Proxy (order not saved)', context: { unsaved } })
      money.debited -= unsavedAmount
      await log('error', 'number', 'CRITICAL: Proxy bought and debited but saving the order FAILED - customer refunded. The slot(s) exist at Fleexa and can still be used or extracted by hand', user.id, userEmail, {
        feature: 'proxy', plan_id: planId, country, state, fleexa_reference: purchase.reference, unsaved,
      }).catch(() => {})
    }

    money.settled = true // from here every naira is either on an order or refunded

    if (created.length === 0) {
      return NextResponse.json({ error: 'Failed to complete purchase. You have not been charged. Please try again.' }, { status: 500 })
    }

    const savedAmount = slots.reduce((sum, s, i) => (unsaved.some((u) => u.slot_id === s.id) ? sum : sum + shareFor(i)), 0)

    await recordTransaction({
      userId: user.id, userEmail, type: 'debit', amount: savedAmount,
      description: `Proxy - ${where}${created.length > 1 ? ` x${created.length}` : ''}`,
      reference: `PROXY-${slots[0].id}-${Date.now()}`,
      feature: 'proxy',
    })

    await log('info', 'number', `Proxy purchased - ${where} x${created.length}`, user.id, userEmail, {
      feature: 'proxy', plan_id: planId, country, state, count: created.length, total_ngn: savedAmount, order_ids: created.map((c) => c.order_id),
    }).catch(() => {})

    return NextResponse.json({ success: true, orders: created, total_ngn: savedAmount })
  } catch (error) {
    console.error('[proxy/buy]', error)
    if (money.debited > 0 && !money.settled) {
      const refunded = await refundOrLog({ userId: money.userId, userEmail: money.userEmail, amount: money.debited, feature: 'Proxy (unexpected error)', context: { idempotency_key: money.idempotencyKey } })
      await log('error', 'number', 'CRITICAL: exception during a Proxy purchase after the wallet was debited - customer refunded. The order MAY exist at Fleexa: check Fleexa proxy orders for this idempotency key', money.userId, money.userEmail, {
        feature: 'proxy', idempotency_key: money.idempotencyKey, refunded, error: error.message,
      }).catch(() => {})
    }
    await log('error', 'number', `Unhandled exception in proxy/buy: ${error.message}`, null, null, { feature: 'proxy', stack: error.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to purchase proxy' }, { status: 500 })
  } finally {
    if (guardKey) guard.leave(guardKey)
  }
}