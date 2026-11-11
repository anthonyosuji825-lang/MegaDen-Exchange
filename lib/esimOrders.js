// lib/esimOrders.js
//
// Lifecycle of a travel eSIM order. An eSIM is normally delivered the moment
// it is bought ("provisioned synchronously"), so most orders are saved as
// 'completed' straight away. The exceptions are orders Fleexa marks
// confirmation_pending - those are saved as 'pending' and resolved here:
// delivered -> completed, or failed/cancelled -> customer refunded.
//
// Order statuses used (all already used elsewhere in the app):
//   pending    bought, delivery not confirmed yet
//   resolving  briefly held while one caller refunds it
//   completed  delivered - the customer can install it
//   expired    its validity is over (no refund)
//   failed     could not be delivered, customer refunded
//
// Reuses claimPendingOrder / releaseOrderClaim from numberOrders.js so the
// poll and the background sweep can never refund the same order twice.

import { log } from '@/lib/logger'
import { creditWallet, recordTransaction } from '@/lib/fleexaShared'
import { claimPendingOrder, releaseOrderClaim } from '@/lib/numberOrders'
import { getEsimOrder, normalizeEsimStatus } from '@/lib/providers/fleexaEsim'

// After this long still 'pending', the sweep logs it for a human to look at.
// Nothing is refunded automatically: we only refund when Fleexa says failed.
export const ESIM_STUCK_AFTER_MS = 60 * 60 * 1000

const ORDER_COLUMNS = 'id, user_id, amount, status, details, created_at'

// Caller must hold the claim. Credits the wallet and sets the final status.
//   - credit FAILED: nothing moved, claim goes back to 'pending', retried later
//   - credited but a later write fails: left in 'resolving' on purpose (never
//     back to 'pending', or it would be refunded twice) and logged
async function refundOrder(admin, order, reason, state) {
  const refund = await creditWallet(order.user_id, order.amount)
  if (!refund.ok) {
    await log('error', 'wallet', 'eSIM auto-refund failed - claim released, will retry', order.user_id, null, {
      feature: 'esim', order_id: order.id, amount: order.amount, rpc_error: refund.error,
    }).catch(() => {})
    await releaseOrderClaim(admin, order.id, 'pending')
    return { ok: false }
  }
  state.moneyMoved = true

  await recordTransaction({
    userId: order.user_id,
    type: 'credit',
    amount: order.amount,
    description: 'Refund - eSIM could not be delivered',
    reference: `REFUND-ESIM-${order.id}`,
    feature: 'esim',
  })

  const { error } = await admin
    .from('orders')
    .update({ status: 'failed', details: { ...order.details, resolved_note: reason } })
    .eq('id', order.id)
  if (error) {
    await log('error', 'wallet', 'CRITICAL: eSIM refund issued but the final order status could not be saved - order left in resolving, needs manual status fix', order.user_id, null, {
      feature: 'esim', order_id: order.id, amount: order.amount, db_error: error.message,
    }).catch(() => {})
  }
  await log('warning', 'number', `eSIM order failed - refunded ₦${Number(order.amount).toLocaleString()}`, order.user_id, null, {
    feature: 'esim', order_id: order.id, reason,
  }).catch(() => {})
  return { ok: true }
}

// Looks at one 'pending' eSIM order and does whatever its state calls for.
// Safe to call repeatedly; does nothing for any other status.
// @returns {{ action: 'none'|'completed'|'refunded'|'expired'|'refund_failed'|'error' }}
export async function resolveEsimOrder(admin, orderIn) {
  const state = { claimed: false, moneyMoved: false }
  try {
    return await resolveInner(admin, orderIn, state)
  } catch (err) {
    if (!state.claimed) throw err
    if (state.moneyMoved) {
      await log('error', 'wallet', 'CRITICAL: exception after an eSIM refund - order left in resolving (not released, to avoid a double refund); needs manual review', orderIn.user_id, null, {
        feature: 'esim', order_id: orderIn.id, error: err.message,
      }).catch(() => {})
      return { action: 'error' }
    }
    await releaseOrderClaim(admin, orderIn.id, 'pending').catch(() => {})
    await log('error', 'number', `Exception while resolving an eSIM order - claim released for retry: ${err.message}`, orderIn.user_id, null, {
      feature: 'esim', order_id: orderIn.id, stack: err.stack,
    }).catch(() => {})
    return { action: 'error' }
  }
}

async function resolveInner(admin, orderIn, state) {
  if (orderIn.status !== 'pending') return { action: 'none' }

  const { data: order } = await admin.from('orders').select(ORDER_COLUMNS).eq('id', orderIn.id).maybeSingle()
  if (!order || order.status !== 'pending') return { action: 'none' }

  const externalId = order.details?.external_id
  if (!externalId) {
    await log('error', 'number', 'eSIM order has no external_id - cannot check it', order.user_id, null, { feature: 'esim', order_id: order.id }).catch(() => {})
    return { action: 'none' }
  }

  const r = await getEsimOrder(externalId)
  if (!r.ok) return { action: 'none' } // Fleexa unreachable - try again next pass
  const st = normalizeEsimStatus(r.order.status)

  // Delivered and confirmed.
  if (st === 'ready' && !r.order.confirmationPending) {
    const { data, error } = await admin
      .from('orders')
      .update({
        status: 'completed',
        details: {
          ...order.details,
          ...(r.order.iccid ? { iccid: r.order.iccid } : {}),
          ...(r.order.smdpAddress ? { smdp_address: r.order.smdpAddress } : {}),
          ...(r.order.activationCode ? { activation_code: r.order.activationCode } : {}),
          ...(r.order.installUrls ? { install_urls: r.order.installUrls } : {}),
          ...(r.order.expiresAt ? { expires_at: r.order.expiresAt } : {}),
        },
      })
      .eq('id', order.id)
      .eq('status', 'pending') // never undo a refund that just happened
      .select('id')
      .maybeSingle()
    if (error) throw new Error(`Failed to mark eSIM order completed: ${error.message}`)
    return data ? { action: 'completed' } : { action: 'none' }
  }

  // Fleexa says it will never be delivered: refund.
  if (st === 'dead') {
    const { order: claimed, error } = await claimPendingOrder(admin, order.id, order.user_id)
    if (error || !claimed) return { action: 'none' }
    state.claimed = true
    const res = await refundOrder(admin, claimed, `Provider reported ${r.order.status}`, state)
    return res.ok ? { action: 'refunded' } : { action: 'refund_failed' }
  }

  // Ran out its validity before we ever confirmed delivery - odd. No refund
  // (we cannot tell whether it was ever installed); flag it for a human.
  if (st === 'expired') {
    await admin.from('orders').update({ status: 'expired', details: { ...order.details, expired_before_confirmed: true } }).eq('id', order.id).eq('status', 'pending')
    await log('warning', 'number', 'eSIM order expired while still unconfirmed - not refunded automatically, needs a look', order.user_id, null, { feature: 'esim', order_id: order.id, external_id: externalId }).catch(() => {})
    return { action: 'expired' }
  }

  return { action: 'none' } // still being set up
}

// Moves a delivered eSIM to 'expired' once Fleexa says its validity is over.
// Called when the customer opens an eSIM, not from the sweep (one Fleexa call
// per eSIM would be wasteful in bulk).
export async function syncDeliveredEsim(admin, order) {
  if (order.status !== 'completed') return order.status
  const externalId = order.details?.external_id
  if (!externalId) return order.status
  const r = await getEsimOrder(externalId)
  if (!r.ok) return order.status
  const st = normalizeEsimStatus(r.order.status)
  const expiresMs = r.order.expiresAt ? Date.parse(r.order.expiresAt) : NaN
  const pastExpiry = Number.isFinite(expiresMs) && Date.now() > expiresMs
  if (st === 'expired' || pastExpiry) {
    const { error } = await admin
      .from('orders')
      .update({ status: 'expired', details: { ...order.details, expires_at: r.order.expiresAt || order.details?.expires_at || null } })
      .eq('id', order.id)
      .eq('status', 'completed')
    if (!error) return 'expired'
  } else if (r.order.expiresAt && r.order.expiresAt !== order.details?.expires_at) {
    await admin.from('orders').update({ details: { ...order.details, expires_at: r.order.expiresAt, ...(r.order.activatedAt ? { activated_at: r.order.activatedAt } : {}) } }).eq('id', order.id)
  }
  return order.status
}

/**
 * Background pass over every pending eSIM order. Called from the existing
 * number sweep route, so one scheduled trigger covers everything.
 */
export async function sweepEsimOrders(admin) {
  const { data: orders, error } = await admin
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('product_type', 'esim')
    .eq('status', 'pending')
  if (error) return { checked: 0, processed: 0, failed: 0, stuck: 0, error: error.message }

  let processed = 0
  let failed = 0
  let stuck = 0
  for (const order of orders || []) {
    try {
      const r = await resolveEsimOrder(admin, order)
      if (r.action !== 'none') processed++
      else if (Date.now() - Date.parse(order.created_at) > ESIM_STUCK_AFTER_MS) {
        stuck++
        await log('warning', 'number', 'eSIM order still pending after an hour - needs a look (not refunded automatically)', order.user_id, null, {
          feature: 'esim', order_id: order.id, external_id: order.details?.external_id,
        }).catch(() => {})
      }
    } catch (err) {
      failed++
      await log('error', 'number', `eSIM sweep failed on order ${order.id}: ${err.message}`, order.user_id, null, {
        feature: 'esim', order_id: order.id, stack: err.stack,
      }).catch(() => {})
    }
  }
  return { checked: orders?.length || 0, processed, failed, stuck }
}