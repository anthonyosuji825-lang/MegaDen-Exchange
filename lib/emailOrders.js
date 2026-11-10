// lib/emailOrders.js
//
// Lifecycle of an Email OTP order: waiting -> code received -> completed, or
// cancelled / expired -> refunded. One place for the logic, called by BOTH the
// interactive poll (app/api/email/status) and the background sweep
// (sweepEmailOrders, run from the existing number sweep route), exactly like
// lib/numberOrders.js does for SMS numbers.
//
// It deliberately reuses claimPendingOrder / releaseOrderClaim from
// numberOrders.js: moving an order 'pending' -> 'resolving' is what stops a
// poll tick, the sweep and a manual cancel from refunding the same order
// twice. Those two functions only touch the orders table by id, so they work
// for any product.
//
// Order statuses used (all already used by the number orders):
//   pending    waiting for the code (cancellable after 2 minutes)
//   resolving  briefly held while one caller acts on it
//   completed  code received
//   cancelled  cancelled, refunded
//   expired    expired with no code, refunded

import { log } from '@/lib/logger'
import { creditWallet, recordTransaction } from '@/lib/fleexaShared'
import { claimPendingOrder, releaseOrderClaim } from '@/lib/numberOrders'
import { checkEmail, cancelEmail } from '@/lib/providers/fleexaEmail'

// Fleexa will not cancel an email activation in the first 2 minutes
// ("Cancellation is only available after 2 minutes of purchase"). We unlock
// 30 seconds later than that: a cancel tapped right on the 2:00 mark was
// refused live because the clocks involved (customer's browser, our server,
// Fleexa) are never exactly in step. Keep this in sync with CANCEL_LOCK_MS in
// app/dashboard/email/page.js.
export const EMAIL_MIN_CANCEL_MS = 150 * 1000

// An email activation waits 20 minutes for a code (confirmed by the owner).
// This is what the customer's countdown timer shows. Keep in sync with
// EMAIL_LIFETIME_MS in app/dashboard/email/page.js.
export const EMAIL_LIFETIME_MS = 20 * 60 * 1000

// Fleexa's own EXPIRED status is the primary signal that an email is dead.
// This is only the safety net for an activation that stays WAITING past its
// lifetime: one minute after the 20 minutes are up we try to cancel it at
// Fleexa and refund. The extra minute stops us cancelling an address a few
// seconds before a late code lands.
export const EMAIL_SAFETY_WINDOW_MS = EMAIL_LIFETIME_MS + 60 * 1000

const ORDER_COLUMNS = 'id, user_id, amount, status, details, created_at'

export function emailDeadline(order) {
  const stored = order.details?.expires ? Date.parse(order.details.expires) : NaN
  if (Number.isFinite(stored)) return stored
  return Date.parse(order.created_at) + EMAIL_SAFETY_WINDOW_MS
}

export function emailCancelUnlockAt(order) {
  return new Date(Date.parse(order.created_at) + EMAIL_MIN_CANCEL_MS).toISOString()
}

// Claim the order (pending -> resolving). Returns the claimed row or null.
async function claim(admin, order, state) {
  const { order: claimed, error } = await claimPendingOrder(admin, order.id, order.user_id)
  if (error) return null
  state.claimed = true
  return claimed
}

async function completeOrder(admin, order, check, note) {
  const { error } = await admin
    .from('orders')
    .update({
      status: 'completed',
      details: {
        ...order.details,
        sms_code: check.code,
        sms_text: check.text,
        ...(note ? { resolved_note: note } : {}),
      },
    })
    .eq('id', order.id)
  // Throwing is intentional: the wrapper releases the claim back to
  // 'pending' and the next poll tries again (the code is still at Fleexa).
  if (error) throw new Error(`Failed to mark email order completed: ${error.message}`)
  await log('info', 'number', 'Email OTP received - order completed', order.user_id, null, {
    feature: 'email_otp', order_id: order.id,
  }).catch(() => {})
}

// Caller must hold the claim. Credits the wallet, writes the ledger line,
// and sets the final status.
//   - Wallet credit FAILED: no money moved, so the claim goes back to
//     'pending' and the next pass retries.
//   - Wallet credited but a later write fails: the order is left in
//     'resolving' on purpose (never back to 'pending', or it would be
//     refunded again) and logged for manual repair.
async function refundOrder(admin, order, finalStatus, reason, state) {
  const refund = await creditWallet(order.user_id, order.amount)
  if (!refund.ok) {
    await log('error', 'wallet', 'Email OTP auto-refund failed - claim released, will retry', order.user_id, null, {
      feature: 'email_otp', order_id: order.id, amount: order.amount, rpc_error: refund.error,
    }).catch(() => {})
    await releaseOrderClaim(admin, order.id, 'pending')
    return { ok: false }
  }
  state.moneyMoved = true

  await recordTransaction({
    userId: order.user_id,
    type: 'credit',
    amount: order.amount,
    description: `Refund - Email OTP ${finalStatus}`,
    reference: `REFUND-EMAIL-${order.id}`,
    feature: 'email_otp',
  })

  const { error } = await admin
    .from('orders')
    .update({ status: finalStatus, details: { ...order.details, resolved_note: reason } })
    .eq('id', order.id)
  if (error) {
    await log('error', 'wallet', 'CRITICAL: Email OTP refund issued but the final order status could not be saved - order left in resolving, needs manual status fix', order.user_id, null, {
      feature: 'email_otp', order_id: order.id, amount: order.amount, db_error: error.message,
    }).catch(() => {})
  }

  await log('warning', 'number', `Email OTP order ${finalStatus} - refunded ₦${Number(order.amount).toLocaleString()}`, order.user_id, null, {
    feature: 'email_otp', order_id: order.id, reason,
  }).catch(() => {})
  return { ok: true }
}

/**
 * Looks at one pending email order and does whatever its state calls for.
 * Safe to call repeatedly; no-ops on anything that is not pending.
 *
 * @returns {{ action: 'none'|'completed'|'refunded'|'refund_failed'|'error', status: string }}
 */
export async function resolveEmailOrder(admin, order) {
  const state = { claimed: false, moneyMoved: false }
  try {
    return await resolveInner(admin, order, state)
  } catch (err) {
    if (!state.claimed) throw err
    if (state.moneyMoved) {
      await log('error', 'wallet', 'CRITICAL: exception after an Email OTP refund - order left in resolving (not released, to avoid a double refund); needs manual review', order.user_id, null, {
        feature: 'email_otp', order_id: order.id, error: err.message,
      }).catch(() => {})
      return { action: 'error', status: 'resolving' }
    }
    await releaseOrderClaim(admin, order.id, 'pending').catch(() => {})
    await log('error', 'number', `Exception while resolving an Email OTP order - claim released for retry: ${err.message}`, order.user_id, null, {
      feature: 'email_otp', order_id: order.id, stack: err.stack,
    }).catch(() => {})
    return { action: 'error', status: 'pending' }
  }
}

async function resolveInner(admin, orderIn, state) {
  if (orderIn.status !== 'pending') return { action: 'none', status: orderIn.status }

  // Fresh unclaimed read, so a slow provider call below cannot act on stale
  // data. The order stays 'pending' (and cancellable) during that call.
  const { data: fresh } = await admin.from('orders').select(ORDER_COLUMNS).eq('id', orderIn.id).maybeSingle()
  if (!fresh || fresh.status !== 'pending') return { action: 'none', status: fresh?.status || 'unknown' }
  let order = fresh

  const externalId = order.details?.external_id
  if (!externalId) {
    await log('error', 'number', 'Email OTP order has no external_id - cannot check it', order.user_id, null, {
      feature: 'email_otp', order_id: order.id,
    }).catch(() => {})
    return { action: 'none', status: 'unknown' }
  }

  const check = await checkEmail(externalId)

  // 1. Code arrived (also if Fleexa already flipped to EXPIRED but did
  //    capture a code - the customer should get the code, not a refund).
  if (check.ok && check.code && (check.status === 'received' || check.status === 'expired')) {
    const claimed = await claim(admin, order, state)
    if (!claimed) return { action: 'none', status: 'pending' }
    await completeOrder(admin, claimed, check)
    return { action: 'completed', status: 'completed' }
  }

  // 2. Fleexa says it is dead and no code ever came: refund.
  if (check.ok && (check.status === 'cancelled' || check.status === 'expired')) {
    const claimed = await claim(admin, order, state)
    if (!claimed) return { action: 'none', status: 'pending' }
    const r = await refundOrder(admin, claimed, check.status, `Provider reported ${check.status.toUpperCase()}`, state)
    return r.ok ? { action: 'refunded', status: check.status } : { action: 'refund_failed', status: 'pending' }
  }

  // 3. Still waiting past our safety net: try to cancel it at Fleexa, and
  //    only refund once the address is confirmed dead.
  if (Date.now() > emailDeadline(order)) {
    const claimed = await claim(admin, order, state)
    if (!claimed) return { action: 'none', status: 'pending' }
    order = claimed

    const cancel = await cancelEmail(externalId)
    if (cancel.ok) {
      const r = await refundOrder(admin, order, 'expired', 'No code before the time limit - cancelled at the provider', state)
      return r.ok ? { action: 'refunded', status: 'expired' } : { action: 'refund_failed', status: 'pending' }
    }

    const recheck = await checkEmail(externalId)
    if (recheck.ok && recheck.code && recheck.status === 'received') {
      await completeOrder(admin, order, recheck, 'Code arrived while cancelling - completed instead of refunded.')
      return { action: 'completed', status: 'completed' }
    }
    if (recheck.ok && (recheck.status === 'cancelled' || recheck.status === 'expired')) {
      const r = await refundOrder(admin, order, recheck.status, `Provider reported ${recheck.status.toUpperCase()}`, state)
      return r.ok ? { action: 'refunded', status: recheck.status } : { action: 'refund_failed', status: 'pending' }
    }

    // Could not cancel and not confirmed dead: do NOT refund a live
    // address. Release the claim; the next pass tries again.
    await releaseOrderClaim(admin, order.id, 'pending')
    await log('warning', 'number', 'Email OTP is past its time limit but could not be cancelled or confirmed dead - refund withheld, will retry', order.user_id, null, {
      feature: 'email_otp', order_id: order.id, external_id: externalId, cancel_result: cancel, status_check: recheck.ok ? recheck.status : 'unreachable',
    }).catch(() => {})
    return { action: 'none', status: 'pending' }
  }

  // Still waiting (or Fleexa unreachable): nothing to do this pass.
  return { action: 'none', status: 'pending' }
}

/**
 * Manual "Cancel & Refund" for the signed-in user.
 * @returns {{ httpStatus: number, body: object }}
 */
export async function cancelEmailOrderForUser(admin, orderId, userId) {
  const { data: existing } = await admin.from('orders').select(ORDER_COLUMNS).eq('id', orderId).eq('product_type', 'email_otp').maybeSingle()
  // Same answer for "missing" and "someone else's" so existence never leaks.
  if (!existing || existing.user_id !== userId) return { httpStatus: 404, body: { error: 'Order not found.' } }
  if (existing.status !== 'pending') return { httpStatus: 400, body: { error: 'This order can no longer be cancelled.' } }

  const unlockAt = Date.parse(emailCancelUnlockAt(existing))
  if (Date.now() < unlockAt) {
    return { httpStatus: 400, body: { error: 'You can cancel an email a couple of minutes after buying it. The Cancel button unlocks automatically.', cancel_unlock_at: new Date(unlockAt).toISOString() } }
  }

  const state = { claimed: false, moneyMoved: false }
  let order
  try {
    order = await claim(admin, existing, state)
    if (!order) return { httpStatus: 400, body: { error: 'This order was just resolved - refresh to see its status.' } }

    const externalId = order.details?.external_id
    if (!externalId) {
      await releaseOrderClaim(admin, order.id, 'pending')
      return { httpStatus: 400, body: { error: 'This order has no associated email.' } }
    }

    const cancel = await cancelEmail(externalId)
    if (!cancel.ok) {
      // Refund only when the address is CONFIRMED dead (see the same
      // reasoning in app/api/numbers/sms DELETE).
      const check = await checkEmail(externalId)
      if (check.ok && check.code && check.status === 'received') {
        await completeOrder(admin, order, check, 'Code arrived before the cancel went through.')
        return { httpStatus: 400, body: { error: 'The code has already arrived - no refund possible.' } }
      }
      const dead = check.ok && (check.status === 'cancelled' || check.status === 'expired')
      if (!dead) {
        await releaseOrderClaim(admin, order.id, 'pending')
        // Fleexa says it is too early ("only available after 2 minutes").
        // Nothing is wrong and nothing was refunded - just ask them to wait.
        const tooEarly = /minute|too early|not yet|wait/i.test(String(cancel.message || '')) && check.ok && check.status === 'waiting'
        if (tooEarly) {
          return { httpStatus: 409, body: { error: 'This email is not ready to be cancelled yet. Please wait about 30 more seconds and tap Cancel & Refund again.', code: 'CANCEL_TOO_EARLY' } }
        }
        await log('warning', 'number', 'Manual Email OTP cancel not confirmed by the provider - refund withheld, claim released', userId, null, {
          feature: 'email_otp', order_id: order.id, external_id: externalId, cancel_result: cancel, status_check: check.ok ? check.status : 'unreachable',
        }).catch(() => {})
        return { httpStatus: 409, body: { error: "We couldn't cancel this email with the provider yet. Your order is still active - please try again shortly. If it isn't used it is refunded automatically when it expires." } }
      }
    }

    const r = await refundOrder(admin, order, 'cancelled', 'Cancelled by the customer', state)
    if (!r.ok) return { httpStatus: 500, body: { error: 'Refund failed. Please try again or contact support.' } }
    return { httpStatus: 200, body: { success: true, refunded_amount: order.amount } }
  } catch (err) {
    if (state.claimed && !state.moneyMoved) await releaseOrderClaim(admin, orderId, 'pending').catch(() => {})
    await log('error', 'number', `Email OTP cancel failed: ${err.message}`, userId, null, { feature: 'email_otp', order_id: orderId, stack: err.stack }).catch(() => {})
    return { httpStatus: 500, body: { error: 'Failed to cancel.' } }
  }
}

/**
 * Background pass over every pending email order. Called from the existing
 * number sweep route, so one scheduled trigger covers everything.
 */
export async function sweepEmailOrders(admin) {
  const { data: orders, error } = await admin
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('product_type', 'email_otp')
    .eq('status', 'pending')
  if (error) return { checked: 0, processed: 0, failed: 0, error: error.message }

  let processed = 0
  let failed = 0
  for (const order of orders || []) {
    try {
      const r = await resolveEmailOrder(admin, order)
      if (r.action !== 'none') processed++
    } catch (err) {
      failed++
      await log('error', 'number', `Email OTP sweep failed on order ${order.id}: ${err.message}`, order.user_id, null, {
        feature: 'email_otp', order_id: order.id, stack: err.stack,
      }).catch(() => {})
    }
  }
  return { checked: orders?.length || 0, processed, failed }
}