// app/api/esim/topup/route.js
//
//   POST /api/esim/topup  { order_id, topup_package_id, expected_price_ngn }
//
// Adds data/validity to an eSIM the customer already owns. Recorded as its
// own order (details.kind = 'topup', details.parent_order_id = the eSIM).
//
// Same money rules as buy: debit first, idempotent Fleexa call with one
// retry on an ambiguous failure, refund when the top-up did not apply,
// refund + CRITICAL log if Fleexa never confirmed, refund on a crash.
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { log } from '@/lib/logger'
import {
  supabaseAdmin, getAuthedUser, getWalletProfile, getMarkupPercent, sellPriceNgn,
  debitWallet, refundOrLog, recordTransaction, makeInFlightGuard,
} from '@/lib/fleexaShared'
import { listTopupPackages, topupEsim, normalizeEsimStatus } from '@/lib/providers/fleexaEsim'

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

    const orderId = String(body.order_id || '').trim()
    const packageId = String(body.topup_package_id || '').trim()
    if (!orderId || orderId.length > 64 || !packageId || packageId.length > 80) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    const shown = Number(body.expected_price_ngn)
    const ceiling = Number.isFinite(shown) && shown > 0 ? shown : null

    // The eSIM being topped up: must be the caller's, delivered, and topup-able.
    const { data: parent } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, status, details')
      .eq('id', orderId)
      .eq('product_type', 'esim')
      .maybeSingle()
    if (!parent || parent.user_id !== user.id) return NextResponse.json({ error: 'eSIM not found.' }, { status: 404 })
    const pd = parent.details || {}
    if ((pd.kind || 'new') !== 'new' || !pd.external_id) return NextResponse.json({ error: 'This eSIM cannot be topped up.' }, { status: 400 })
    if (parent.status !== 'completed') return NextResponse.json({ error: 'You can only top up an eSIM that is active.' }, { status: 400 })
    if (!pd.supports_topup) return NextResponse.json({ error: 'This eSIM plan does not support top-ups.' }, { status: 400 })

    guardKey = `${user.id}:esim-topup`
    if (!guard.tryEnter(guardKey)) {
      guardKey = null
      return NextResponse.json({ error: 'Your previous purchase is still being processed. Please wait a moment.', code: 'PURCHASE_IN_PROGRESS' }, { status: 429 })
    }

    const wallet = await getWalletProfile(user.id)
    const userEmail = wallet.email || user.email || null

    // Real, uncached package list from Fleexa.
    const [markup, listed] = await Promise.all([getMarkupPercent('esim'), listTopupPackages(pd.external_id)])
    if (!listed.ok) return NextResponse.json({ error: 'Top-ups are unavailable right now. Please try again.' }, { status: 502 })
    const pkg = listed.packages.find((p) => p.id === packageId)
    if (!pkg) return NextResponse.json({ error: 'This top-up is no longer available.' }, { status: 400 })

    const total = sellPriceNgn(pkg.costNgn, markup)
    if (!total) return NextResponse.json({ error: 'Could not determine the price. Please try again.' }, { status: 400 })

    if (ceiling !== null && total > ceiling) {
      return NextResponse.json({
        error: `The price is now ₦${total.toLocaleString()} (it was ₦${ceiling.toLocaleString()}). Review it and tap Buy again to confirm.`,
        code: 'PRICE_CHANGED',
        price_ngn: total,
      }, { status: 409 })
    }

    if (wallet.balance < total) return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 })

    // ── 1. Debit ──
    money.userId = user.id
    money.userEmail = userEmail
    const debit = await debitWallet(user.id, total)
    if (!debit.ok) {
      if (debit.reason === 'INSUFFICIENT') return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 })
      await log('error', 'wallet', 'Wallet debit RPC failed for eSIM top-up', user.id, userEmail, { feature: 'esim', total_ngn: total, rpc_error: debit.error }).catch(() => {})
      return NextResponse.json({ error: 'Failed to complete purchase. Please try again.' }, { status: 500 })
    }
    money.debited = total

    // ── 2. Apply the top-up at Fleexa ──
    const idempotencyKey = `megaden-esim-topup-${user.id}-${randomUUID()}`
    money.idempotencyKey = idempotencyKey
    const purchase = await topupEsim({ orderId: pd.external_id, packageId, idempotencyKey })
    const failedAtOnce = purchase.ok && normalizeEsimStatus(purchase.order.status) === 'dead'

    if (!purchase.ok || failedAtOnce) {
      const kind = purchase.ok ? 'FAILED' : purchase.kind
      const refunded = await refundOrLog({ userId: user.id, userEmail, amount: total, feature: 'eSIM top-up', context: { parent_order_id: parent.id, package_id: packageId, provider_kind: kind, idempotency_key: idempotencyKey } })
      if (kind === 'AMBIGUOUS') {
        await log('error', 'number', 'CRITICAL: eSIM top-up could not be confirmed by Fleexa (timeout/5xx twice) - customer refunded. The top-up MAY have been applied and charged to us: check Fleexa eSIM orders for this idempotency key', user.id, userEmail, {
          feature: 'esim', parent_order_id: parent.id, package_id: packageId, package_cost_ngn: pkg.costNgn, idempotency_key: idempotencyKey, http: purchase.http, raw: purchase.raw, refunded,
        }).catch(() => {})
      } else {
        await log(kind === 'BALANCE_ERROR' ? 'error' : 'warning', kind === 'BALANCE_ERROR' ? 'wallet' : 'number',
          kind === 'BALANCE_ERROR'
            ? 'PROVIDER BALANCE: fleexa_esim refused a top-up because our Fleexa account is out of funds - top it up'
            : 'eSIM top-up failed at the provider - wallet refunded',
          user.id, userEmail, { feature: 'esim', parent_order_id: parent.id, package_id: packageId, kind, message: purchase.message, http: purchase.http, refunded },
        ).catch(() => {})
      }
      money.settled = true
      return NextResponse.json({
        error: kind === 'AMBIGUOUS' || kind === 'BALANCE_ERROR' || kind === 'RATE_LIMITED'
          ? 'The eSIM service is busy right now. You have not been charged - please try again shortly.'
          : 'This top-up could not be applied. You have not been charged.',
      }, { status: 502 })
    }

    // ── 3. Save the top-up as its own order ──
    const t = purchase.order
    const applied = normalizeEsimStatus(t.status) === 'ready' && !t.confirmationPending
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: user.id,
        product_type: 'esim',
        product_name: `eSIM top-up - ${pkg.name}`,
        amount: total,
        status: applied ? 'completed' : 'pending',
        details: {
          provider: 'fleexa_esim',
          kind: 'topup',
          external_id: t.id,
          parent_order_id: parent.id,
          package_id: pkg.id,
          package_name: pkg.name,
          country_name: pd.country_name || null,
          data_mb: pkg.dataMb,
          is_unlimited: pkg.isUnlimited,
          validity_days: pkg.validityDays,
          cost_ngn: t.amountNgn ?? pkg.costNgn,
          fleexa_reference: purchase.reference,
          idempotency_key: idempotencyKey,
        },
      })
      .select('id')
      .single()

    if (orderError || !order) {
      // Applied at Fleexa but we cannot record it. Refund the customer and log
      // so it is clear the top-up was applied.
      await refundOrLog({ userId: user.id, userEmail, amount: total, feature: 'eSIM top-up (order not saved)', context: { external_id: t.id } })
      money.settled = true
      await log('error', 'number', 'CRITICAL: eSIM top-up applied and debited but saving the order FAILED - customer refunded (they keep the extra data). Review', user.id, userEmail, {
        feature: 'esim', parent_order_id: parent.id, external_id: t.id, fleexa_reference: purchase.reference, db_error: orderError?.message, db_code: orderError?.code,
      }).catch(() => {})
      return NextResponse.json({ error: 'Your top-up was applied but could not be recorded. You have not been charged.' }, { status: 500 })
    }
    money.settled = true

    await recordTransaction({
      userId: user.id, userEmail, type: 'debit', amount: total,
      description: `eSIM top-up - ${pkg.name}`,
      reference: `ESIM-TOPUP-${t.id}-${Date.now()}`,
      feature: 'esim',
    })
    await log('info', 'number', `eSIM top-up purchased - ${pkg.name}`, user.id, userEmail, {
      feature: 'esim', parent_order_id: parent.id, package_id: packageId, price_ngn: total, order_id: order.id,
    }).catch(() => {})

    return NextResponse.json({ success: true, order_id: order.id, price_ngn: total, applied })
  } catch (error) {
    console.error('[esim/topup]', error)
    if (money.debited > 0 && !money.settled) {
      const refunded = await refundOrLog({ userId: money.userId, userEmail: money.userEmail, amount: money.debited, feature: 'eSIM top-up (unexpected error)', context: { idempotency_key: money.idempotencyKey } })
      await log('error', 'number', 'CRITICAL: exception during an eSIM top-up after the wallet was debited - customer refunded. The top-up MAY have been applied: check Fleexa eSIM orders for this idempotency key', money.userId, money.userEmail, {
        feature: 'esim', idempotency_key: money.idempotencyKey, refunded, error: error.message,
      }).catch(() => {})
    }
    await log('error', 'number', `Unhandled exception in esim/topup: ${error.message}`, null, null, { feature: 'esim', stack: error.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to apply top-up' }, { status: 500 })
  } finally {
    if (guardKey) guard.leave(guardKey)
  }
}