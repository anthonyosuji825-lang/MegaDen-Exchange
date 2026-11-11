// app/api/esim/buy/route.js
//
// Buy a travel eSIM plan. Fleexa provisions it synchronously and answers with
// the activation details, so on success the customer has their eSIM at once.
//
// Money flow (same careful pattern as app/api/proxy/buy - an eSIM cannot be
// cancelled once issued):
//   1. The wallet is debited FIRST (atomic). A refused debit = nothing bought.
//   2. Fleexa is called with an Idempotency-Key and one retry on an ambiguous
//      failure (timeout / 5xx), so a retry can never buy twice.
//   3. Any failure that leaves the customer without an eSIM = refund. If
//      Fleexa never confirmed (ambiguous), the order MAY exist on their side,
//      so a CRITICAL log carries the idempotency key to check.
//   4. If an unexpected error is thrown after the debit, the customer is
//      refunded in the catch block.
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { log } from '@/lib/logger'
import {
  supabaseAdmin, getAuthedUser, getWalletProfile, getMarkupPercent, sellPriceNgn,
  debitWallet, refundOrLog, recordTransaction, makeInFlightGuard,
} from '@/lib/fleexaShared'
import { getEsimPlan, orderEsim, normalizeEsimStatus } from '@/lib/providers/fleexaEsim'

// Provisioning is synchronous at Fleexa: allow up to two attempts of 25s.
export const maxDuration = 60

const guard = makeInFlightGuard()

export async function POST(request) {
  let guardKey = null
  const money = { userId: null, userEmail: null, debited: 0, settled: false, idempotencyKey: null }
  try {
    const user = await getAuthedUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let body
    try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }

    const planId = String(body.plan_id || '').trim()
    if (!planId || planId.length > 80) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    // The price the customer was SHOWN - a ceiling only, never the price.
    const shown = Number(body.expected_price_ngn)
    const ceiling = Number.isFinite(shown) && shown > 0 ? shown : null

    guardKey = `${user.id}:esim`
    if (!guard.tryEnter(guardKey)) {
      guardKey = null
      return NextResponse.json({ error: 'Your previous purchase is still being processed. Please wait a moment.', code: 'PURCHASE_IN_PROGRESS' }, { status: 429 })
    }

    const wallet = await getWalletProfile(user.id)
    const userEmail = wallet.email || user.email || null

    // ── Real, uncached plan from Fleexa: confirms it still exists and gives
    //    the true price right now. ──
    const [markup, found] = await Promise.all([getMarkupPercent('esim'), getEsimPlan(planId)])
    if (!found.ok) {
      if (found.kind === 'NOT_FOUND') return NextResponse.json({ error: 'This eSIM plan is no longer available.' }, { status: 400 })
      return NextResponse.json({ error: 'Pricing is unavailable right now. Please try again.' }, { status: 502 })
    }
    const plan = found.plan

    const total = sellPriceNgn(plan.costNgn, markup)
    if (!total) return NextResponse.json({ error: 'Could not determine the price. Please try again.' }, { status: 400 })

    if (ceiling !== null && total > ceiling) {
      await log('info', 'number', 'eSIM price rose since it was listed - asked the customer to confirm', user.id, userEmail, {
        feature: 'esim', plan_id: planId, shown_price_ngn: ceiling, new_price_ngn: total,
      }).catch(() => {})
      return NextResponse.json({
        error: `The price is now ₦${total.toLocaleString()} (it was ₦${ceiling.toLocaleString()}). Review it and tap Buy again to confirm.`,
        code: 'PRICE_CHANGED',
        price_ngn: total,
      }, { status: 409 })
    }

    if (wallet.balance < total) {
      await log('warning', 'wallet', 'Insufficient wallet balance for eSIM', user.id, userEmail, {
        feature: 'esim', total_ngn: total, wallet_balance: wallet.balance, plan_id: planId,
      }).catch(() => {})
      return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 })
    }

    // ── 1. Debit (atomic). ──
    money.userId = user.id
    money.userEmail = userEmail
    const debit = await debitWallet(user.id, total)
    if (!debit.ok) {
      if (debit.reason === 'INSUFFICIENT') return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 })
      await log('error', 'wallet', 'Wallet debit RPC failed for eSIM', user.id, userEmail, { feature: 'esim', total_ngn: total, rpc_error: debit.error }).catch(() => {})
      return NextResponse.json({ error: 'Failed to complete purchase. Please try again.' }, { status: 500 })
    }
    money.debited = total

    // ── 2. Buy from Fleexa. ──
    const idempotencyKey = `megaden-esim-${user.id}-${randomUUID()}`
    money.idempotencyKey = idempotencyKey
    const purchase = await orderEsim({ planId, idempotencyKey })

    // 'failed'/'cancelled' straight away is a clean failure too.
    const failedAtOnce = purchase.ok && normalizeEsimStatus(purchase.order.status) === 'dead'

    if (!purchase.ok || failedAtOnce) {
      const kind = purchase.ok ? 'FAILED' : purchase.kind
      const refunded = await refundOrLog({
        userId: user.id, userEmail, amount: total, feature: 'eSIM',
        context: { plan_id: planId, provider_kind: kind, idempotency_key: idempotencyKey },
      })
      if (kind === 'AMBIGUOUS') {
        await log('error', 'number', 'CRITICAL: eSIM purchase could not be confirmed by Fleexa (timeout/5xx twice) - customer refunded. The order MAY exist at Fleexa: check Fleexa eSIM orders for this idempotency key / time to see if we paid for it', user.id, userEmail, {
          feature: 'esim', plan_id: planId, plan_cost_ngn: plan.costNgn, idempotency_key: idempotencyKey, http: purchase.http, raw: purchase.raw, refunded,
        }).catch(() => {})
      } else {
        await log(kind === 'BALANCE_ERROR' ? 'error' : 'warning', kind === 'BALANCE_ERROR' ? 'wallet' : 'number',
          kind === 'BALANCE_ERROR'
            ? 'PROVIDER BALANCE: fleexa_esim refused a purchase because our Fleexa account is out of funds - top it up'
            : 'eSIM purchase failed at the provider - wallet refunded',
          user.id, userEmail, { feature: 'esim', plan_id: planId, kind, message: purchase.message, http: purchase.http, refunded, raw: purchase.ok ? purchase.order : purchase.raw },
        ).catch(() => {})
      }
      money.settled = true // refunded above
      const msg = kind === 'AMBIGUOUS' || kind === 'BALANCE_ERROR' || kind === 'RATE_LIMITED'
        ? 'The eSIM service is busy right now. You have not been charged - please try again shortly.'
        : 'This eSIM is not available right now. You have not been charged - try another plan.'
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    const esim = purchase.order
    if (esim.amountNgn !== null && Math.abs(esim.amountNgn - plan.costNgn) > 1) {
      await log('warning', 'number', 'eSIM cost mismatch - what Fleexa charged us differs from the quote', user.id, userEmail, {
        feature: 'esim', quoted_cost: plan.costNgn, actual_cost: esim.amountNgn, plan_id: planId,
      }).catch(() => {})
    }

    // ── 3. Save the order. Delivered -> 'completed'; Fleexa still confirming
    //       -> 'pending' (resolved by lib/esimOrders.js). ──
    const delivered = normalizeEsimStatus(esim.status) === 'ready' && !esim.confirmationPending
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: user.id,
        product_type: 'esim',
        product_name: `eSIM - ${plan.name}`,
        amount: total,
        status: delivered ? 'completed' : 'pending',
        details: {
          provider: 'fleexa_esim',
          kind: 'new',
          external_id: esim.id,
          plan_id: plan.id,
          plan_name: plan.name,
          country_code: plan.countryCode,
          country_name: plan.countryName,
          scope: plan.scope,
          data_mb: plan.dataMb,
          is_unlimited: plan.isUnlimited,
          validity_days: plan.validityDays,
          supports_topup: plan.supportsTopup,
          cost_ngn: esim.amountNgn ?? plan.costNgn,
          iccid: esim.iccid,
          smdp_address: esim.smdpAddress,
          activation_code: esim.activationCode,
          install_urls: esim.installUrls,
          expires_at: esim.expiresAt,
          fleexa_reference: purchase.reference,
          idempotency_key: idempotencyKey,
        },
      })
      .select('id')
      .single()

    if (orderError || !order) {
      // Issued and debited but we cannot show it to the customer: refund them
      // and keep the Fleexa order id so it can be recovered by hand.
      await refundOrLog({ userId: user.id, userEmail, amount: total, feature: 'eSIM (order not saved)', context: { external_id: esim.id } })
      money.settled = true
      await log('error', 'number', 'CRITICAL: eSIM bought and debited but saving the order FAILED - customer refunded. The eSIM exists at Fleexa and can be recovered by hand', user.id, userEmail, {
        feature: 'esim', plan_id: planId, external_id: esim.id, fleexa_reference: purchase.reference, db_error: orderError?.message, db_code: orderError?.code,
      }).catch(() => {})
      return NextResponse.json({ error: 'Failed to complete purchase. You have not been charged. Please try again.' }, { status: 500 })
    }
    money.settled = true // from here the money is on an order

    await recordTransaction({
      userId: user.id, userEmail, type: 'debit', amount: total,
      description: `eSIM - ${plan.name}`,
      reference: `ESIM-${esim.id}-${Date.now()}`,
      feature: 'esim',
    })

    await log('info', 'number', `eSIM purchased - ${plan.name}`, user.id, userEmail, {
      feature: 'esim', plan_id: planId, price_ngn: total, order_id: order.id, delivered,
    }).catch(() => {})

    return NextResponse.json({ success: true, order_id: order.id, price_ngn: total, delivered })
  } catch (error) {
    console.error('[esim/buy]', error)
    if (money.debited > 0 && !money.settled) {
      const refunded = await refundOrLog({ userId: money.userId, userEmail: money.userEmail, amount: money.debited, feature: 'eSIM (unexpected error)', context: { idempotency_key: money.idempotencyKey } })
      await log('error', 'number', 'CRITICAL: exception during an eSIM purchase after the wallet was debited - customer refunded. The eSIM MAY exist at Fleexa: check Fleexa eSIM orders for this idempotency key', money.userId, money.userEmail, {
        feature: 'esim', idempotency_key: money.idempotencyKey, refunded, error: error.message,
      }).catch(() => {})
    }
    await log('error', 'number', `Unhandled exception in esim/buy: ${error.message}`, null, null, { feature: 'esim', stack: error.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to purchase eSIM' }, { status: 500 })
  } finally {
    if (guardKey) guard.leave(guardKey)
  }
}