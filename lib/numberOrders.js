// lib/numberOrders.js
//
// This is the fix for the core bug we found: previously, a BANNED/
// CANCELED/expired-at-the-provider status just made the frontend stop
// polling with no refund, and the only refund path was a 20-minute
// timer. Now: ANY terminal bad status from the provider triggers an
// immediate cancel+refund, the same instant it's observed — whether
// that's a user's browser polling, or the cron sweep catching an order
// nobody's watching anymore.
//
// Both app/api/numbers/sms/route.js (interactive) and
// app/api/numbers/cron/sweep/route.js (background) call this same
// function. There is exactly one place this logic lives.
//
// claimPendingOrder/releaseOrderClaim are exported too: the manual
// cancel path (DELETE in app/api/numbers/sms/route.js) needs the exact
// same atomic guard against racing the poll/cron resolution — without
// it, a user hitting "Cancel" at the same instant the sweep auto-
// refunds or reissues the order can end up refunding the wallet twice,
// or cancelling a live reissued number nobody knew existed. There must
// be exactly one way to safely take ownership of a pending order, and
// this is it.

import { checkOrderStatus, cancelOrder, buyBestAvailable, resolveExpiresAt } from './providers/orchestrator'
import { log } from '@/lib/logger'
import { getNumberSettings } from './numberSettings'

const TERMINAL_BAD_STATUSES = ['banned', 'cancelled', 'expired']

// Cap how many times one order will auto-swap providers before we give
// up and just refund. Without this, a country/service combo that's dead
// across every provider today would otherwise retry forever.
const MAX_REISSUES = 2

/**
 * Atomically moves an order from 'pending' to 'resolving', scoped to
 * the given order id (and, if provided, its owning user). Only the
 * caller that wins this conditional update may act on the order —
 * every other concurrent caller (another poll tick, the cron sweep, a
 * manual cancel) sees 0 rows affected and must back off instead of
 * also refunding/reissuing/cancelling it.
 *
 * Returns the freshly-claimed row (guaranteed current as of the claim)
 * on success, or { error: 'NOT_CLAIMABLE' } if the claim was lost —
 * either because someone else claimed it a moment ago, or because it
 * was already resolved.
 */
export async function claimPendingOrder(supabaseAdmin, orderId, userId) {
  let query = supabaseAdmin
    .from('orders')
    .update({ status: 'resolving' })
    .eq('id', orderId)
    .eq('status', 'pending')

  if (userId) query = query.eq('user_id', userId)

  const { data: claimed, error } = await query.select().maybeSingle()

  if (error || !claimed) return { error: 'NOT_CLAIMABLE' }
  return { order: claimed }
}

/**
 * Releases a claimed order back to a given status (default 'pending')
 * when it turns out there was nothing to do, or a failure needs to
 * back out of the claim without silently re-entering the normal
 * poll/cron flow.
 */
export async function releaseOrderClaim(supabaseAdmin, orderId, status = 'pending') {
  // Guarded on status = 'resolving': a release may only undo OUR claim.
  // Without the guard, a late release could overwrite an order that has
  // since reached a terminal state (completed/refunded) back to
  // 'pending', putting an already-refunded order back into the poll/
  // cron flow where it could be refunded a second time.
  await supabaseAdmin.from('orders').update({ status }).eq('id', orderId).eq('status', 'resolving')
}

/**
 * Attempts to swap a dead/stalled order onto a fresh number from a
 * different provider, excluding every provider already tried on this
 * order. Returns null (not ok) if no other provider had one available,
 * or if MAX_REISSUES has already been reached — the caller should fall
 * through to a refund in either case.
 */
async function tryReissue(supabaseAdmin, order, deadProviderId) {
  // .filter(Boolean) drops undefined entries from backward-compat orders
  // that predate the provider/external_id fields (see the fallback
  // below) — without it, 'undefined' would linger in tried_providers
  // forever, harmlessly but messily.
  const triedProviders = (order.details?.tried_providers || [order.details?.provider]).filter(Boolean)
  const reissueCount = order.details?.reissue_count || 0

  if (reissueCount >= MAX_REISSUES) return null

  const excludeProviderIds = [...new Set([...triedProviders, deadProviderId])]
  const settings = await getNumberSettings(supabaseAdmin)
  const result = await buyBestAvailable(order.details.country, order.details.service, settings, {
    excludeProviderIds,
  })

  if (!result.ok) return null

  // Same fix as the initial buy in app/api/numbers/buy/route.js: trust
  // whatever the new (replacement) provider actually reports, instead
  // of assuming every provider — including whichever one this order
  // just got reissued to — gives the same 20 minutes.
  const expiresAt = resolveExpiresAt(result)
  const newDetails = {
    ...order.details,
    provider: result.providerId,
    external_id: result.externalId,
    phone: result.phone,
    expires: expiresAt,
    provider_meta: result.meta,
    // excludeProviderIds is already the deduped "everyone tried so far,
    // including the one that just died" set — that IS the new
    // tried_providers list, no further filtering/re-appending needed.
    tried_providers: excludeProviderIds,
    reissue_count: reissueCount + 1,
    // Note: the customer keeps their original order.amount regardless of
    // whether the replacement provider's price differs — we absorb the
    // difference rather than re-touching the wallet mid-order.
  }

  // status: 'pending' is essential here, not optional — the claim in
  // evaluateAndResolveOrder moved this order to 'resolving' before
  // calling tryReissue, and nothing else releases it. Without this,
  // a successful reissue leaves the order permanently stuck in
  // 'resolving': invisible to the cron sweep (which only queries
  // status='pending'), and treated by the GET poll route as already
  // terminal — which stops the frontend's poll loop entirely, even
  // though the reissued number is live and could still receive an SMS.
  const { error: reissueSaveError } = await supabaseAdmin
    .from('orders')
    .update({ details: newDetails, status: 'pending' })
    .eq('id', order.id)

  if (reissueSaveError) {
    // We just BOUGHT a replacement number but could not record it on the
    // order. If we returned success the order would keep pointing at the
    // dead number while a paid one sits unreferenced; if we threw, the
    // claim would be released and the next pass would buy yet another
    // number. Instead: cancel the unrecorded one, and report "no reissue
    // possible" so the caller falls through to the normal refund path.
    const cancelNew = await cancelOrder(result.providerId, result.externalId)
      .catch((err) => ({ ok: false, message: err.message }))
    await log('error', 'number', 'Reissue bought a replacement number but saving it to the order failed — cancelled the unrecorded number, falling back to refund', order.user_id, null, {
      order_id: order.id, new_provider: result.providerId, new_external_id: result.externalId,
      cancel_result: cancelNew, db_error: reissueSaveError.message,
    }).catch(() => {})
    return null
  }

  return { providerId: result.providerId, phone: result.phone, expiresAt }
}

/**
 * Evaluates one pending order against its provider's live status and
 * takes whatever action that status calls for. Safe to call repeatedly —
 * it no-ops on orders that are already resolved (status !== 'pending').
 *
 * Crash safety: once this function has claimed an order ('resolving'),
 * an unexpected exception must not leave it there — nothing else ever
 * picks 'resolving' orders back up. So any throw AFTER the claim
 * releases the order to 'pending' for the next poll/sweep to retry,
 * with ONE exception: if the wallet refund has already gone through,
 * the order is deliberately left in 'resolving' (and logged as an
 * error), because putting it back in the normal flow could refund it
 * a second time. A throw BEFORE any claim is rethrown unchanged — no
 * claim is held, so there is nothing to clean up.
 *
 * @returns {{ action: 'none'|'completed'|'reissued'|'refunded'|'refund_failed'|'error', status: string }}
 */
export async function evaluateAndResolveOrder(supabaseAdmin, order) {
  const state = { claimed: false, moneyMoved: false }
  try {
    return await evaluateAndResolveOrderInner(supabaseAdmin, order, state)
  } catch (err) {
    if (!state.claimed) throw err

    if (state.moneyMoved) {
      await log('error', 'wallet', 'CRITICAL: exception after wallet refund — order left in resolving (not released, to avoid a double refund); needs manual review', order.user_id, null, {
        order_id: order.id, amount: order.amount, error: err.message, stack: err.stack,
      }).catch(() => {})
      return { action: 'error', status: 'resolving' }
    }

    await releaseOrderClaim(supabaseAdmin, order.id, 'pending').catch(() => {})
    await log('error', 'number', `Exception while resolving order — claim released back to pending for retry: ${err.message}`, order.user_id, null, {
      order_id: order.id, stack: err.stack,
    }).catch(() => {})
    return { action: 'error', status: 'pending' }
  }
}

async function evaluateAndResolveOrderInner(supabaseAdmin, order, state) {
  if (order.status !== 'pending') {
    return { action: 'none', status: order.status }
  }

  // ── Fresh, unclaimed read ─────────────────────────────────────────
  // Re-read before doing anything, so provider/external_id can't be
  // stale (e.g. a reissue that happened between the caller's original
  // load and now). Deliberately NOT a claim: the slow part of this
  // function is the external provider status check just below, and
  // this used to be done AFTER claiming — meaning the order sat in
  // 'resolving' for the entire external call (often 2-3+ seconds).
  // That's more than enough time to eat a meaningful fraction of every
  // 5-second poll cycle, during which a manual cancel (DELETE, which
  // requires status === 'pending') would get wrongly rejected with
  // "this order can no longer be cancelled" — not because anything was
  // wrong, just because the order was mid-check. Now the order stays
  // 'pending' (and cancellable) for the whole external call, and only
  // flips to 'resolving' for the brief moment needed to actually write
  // a terminal state — see the two claimPendingOrder calls below.
  const { data: freshOrder, error: readError } = await supabaseAdmin
    .from('orders')
    .select('id, user_id, amount, status, details')
    .eq('id', order.id)
    .maybeSingle()

  if (readError || !freshOrder || freshOrder.status !== 'pending') {
    // Already resolved by someone else since the caller's original read.
    return { action: 'none', status: freshOrder?.status || 'unknown' }
  }
  order = freshOrder

  // Backward-compat: orders placed before this rebuild only have
  // details.fivesim_id, not provider/external_id. Treat those as 5sim
  // orders so in-flight orders at deploy time don't just silently break.
  const providerId = order.details?.provider || (order.details?.fivesim_id ? 'fivesim' : null)
  const externalId = order.details?.external_id || order.details?.fivesim_id
  if (!providerId || !externalId) {
    await log('error', 'number', 'Order missing provider/external_id — cannot check status', order.user_id, null, {
      order_id: order.id,
    })
    return { action: 'none', status: 'unknown' }
  }

  const result = await checkOrderStatus(providerId, externalId)

  // Case 1: SMS arrived — complete the order.
  if (result.status === 'received') {
    // ── Atomic claim, right before the write ──────────────────────
    // This is the ONE guarantee that still matters: only one caller
    // (this poll tick, another poll tick, the cron sweep, or a manual
    // cancel racing in) may actually act on a terminal-state decision.
    // See the file header for the full double-refund/double-reissue
    // reasoning — that protection is unchanged, it's just scoped to the
    // moment of the write instead of the whole function.
    const { order: claimed, error: claimError } = await claimPendingOrder(supabaseAdmin, order.id, order.user_id)
    if (claimError) {
      // Someone else claimed and resolved it a moment ago — not an
      // error, just nothing left for us to do.
      return { action: 'none', status: 'pending' }
    }
    order = claimed
    state.claimed = true

    const { error: completeError } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'completed',
        details: { ...order.details, sms_code: result.smsCode, sms_text: result.smsText },
      })
      .eq('id', order.id)
    // Throwing here is intentional: the wrapper releases the claim back
    // to 'pending', and the next poll re-reads the (still available) code
    // and tries again — better than silently leaving the order stuck.
    if (completeError) throw new Error(`Failed to mark order completed: ${completeError.message}`)

    await log('info', 'number', 'SMS received — order completed', order.user_id, null, {
      order_id: order.id, provider: providerId,
    })
    return { action: 'completed', status: 'received' }
  }

  // Case 2: provider reports a terminal bad status (banned/cancelled/
  // expired) OR our own 20-minute window has elapsed. Before refunding,
  // try to reissue a fresh number from a different provider — that's
  // the actual fix for "5sim sold a number but the OTP never came."
  const providerSaysDead = TERMINAL_BAD_STATUSES.includes(result.status)
  const ourWindowExpired = order.details?.expires && Date.now() > new Date(order.details.expires).getTime()

  if (providerSaysDead || ourWindowExpired) {
    // ── Atomic claim, right before any write or provider side effect ──
    const { order: claimed, error: claimError } = await claimPendingOrder(supabaseAdmin, order.id, order.user_id)
    if (claimError) {
      return { action: 'none', status: 'pending' }
    }
    order = claimed
    state.claimed = true

    // Best-effort cancel at the dead provider first — but this time we
    // actually READ the result. If the SMS landed in the gap between
    // "we decided this order is dead" and "we called cancel," that's a
    // real completed order, not a dead one — don't reissue or refund it.
    const cancelResult = await cancelOrder(providerId, externalId).catch(() => ({ ok: true }))

    if (cancelResult?.alreadyReceived) {
      // Providers that report this generally also include the code in
      // the same response, but not all of them do — re-check status
      // once more to try to capture it before marking complete.
      const recheck = await checkOrderStatus(providerId, externalId).catch(() => null)
      const corroborated = recheck?.status === 'received' && Boolean(recheck.smsCode)

      if (corroborated) {
        const { error: completeError } = await supabaseAdmin
          .from('orders')
          .update({
            status: 'completed',
            details: {
              ...order.details,
              sms_code: recheck.smsCode,
              sms_text: recheck.smsText,
              resolved_note: 'SMS arrived during cancel — order completed instead of refunded/reissued.',
            },
          })
          .eq('id', order.id)
        if (completeError) throw new Error(`Failed to mark order completed: ${completeError.message}`)

        await log('info', 'number', 'SMS arrived during cancel-before-reissue — order completed, not refunded', order.user_id, null, {
          order_id: order.id, provider: providerId,
        })
        return { action: 'completed', status: 'received' }
      }

      // The provider's own cancel-check claimed an SMS had already
      // arrived, but the immediate recheck couldn't confirm it — no
      // code, no 'received' status. Trusting the original signal
      // anyway is exactly how a single provider glitch turns into a
      // permanently unrefunded order: it would get marked 'completed'
      // with no code ever delivered, and no way back to pending. Log
      // the discrepancy as evidence, and fall through to the normal
      // dead/expired handling below (reissue-or-refund) instead of
      // short-circuiting on an uncorroborated claim.
      await log('warning', 'number', 'Provider reported alreadyReceived on cancel but recheck found no confirmed SMS — falling through to normal reissue/refund handling', order.user_id, null, {
        order_id: order.id, provider: providerId, external_id: externalId, cancel_result: cancelResult, recheck,
      }).catch(() => {})
    }

    if (order.details?.country && order.details?.service) {
      const reissue = await tryReissue(supabaseAdmin, order, providerId)
      if (reissue) {
        await log('info', 'number', `Order reissued via ${reissue.providerId} after ${providerId} went ${result.status}`, order.user_id, null, {
          order_id: order.id, previous_provider: providerId, new_provider: reissue.providerId,
        })
        return { action: 'reissued', status: 'pending', phone: reissue.phone, providerId: reissue.providerId }
      }
    }

    // No reissue possible (exhausted attempts, or no other provider had
    // stock) — fall back to the original refund behavior.
    const { data: refundOk, error: refundError } = await supabaseAdmin.rpc('credit_wallet_balance', {
      p_user_id: order.user_id,
      p_amount: order.amount,
    })

    if (refundError || !refundOk) {
      await log('error', 'wallet', 'Auto-refund RPC failed', order.user_id, null, {
        order_id: order.id, amount: order.amount, rpc_error: refundError?.message,
      })
      return { action: 'refund_failed', status: result.status }
    }

    // From here on the wallet HAS been credited. If anything below
    // throws, the wrapper must not release the order back to 'pending'.
    state.moneyMoved = true

    const { error: txError } = await supabaseAdmin.from('transactions').insert({
      user_id: order.user_id,
      type: 'credit',
      amount: order.amount,
      description: providerSaysDead
        ? `Auto-refund — number ${result.status} by provider, no alternate provider available`
        : 'Auto-refund — no SMS received before expiry, no alternate provider available',
      reference: `AUTOREFUND-${externalId}-${Date.now()}`,
      status: 'success',
    })

    if (txError) {
      // The wallet was already credited above via the checked RPC call —
      // this insert only writes the audit-trail row describing that. A
      // failure here doesn't cost the user anything, but it does mean
      // the transaction history silently stops matching the real wallet
      // balance, with nothing anywhere flagging that drift. Log it so
      // it's at least visible, rather than a mystery next time someone
      // reconciles the ledger.
      await log('error', 'wallet', 'Transaction log insert failed after successful auto-refund RPC', order.user_id, null, {
        order_id: order.id, amount: order.amount, tx_error: txError.message,
      }).catch(() => {})
    }

    const { error: finalStatusError } = await supabaseAdmin
      .from('orders')
      .update({ status: providerSaysDead ? result.status : 'expired' })
      .eq('id', order.id)

    if (finalStatusError) {
      // Wallet already credited, so do NOT release this order to
      // 'pending' — it would be refunded again. It stays 'resolving'
      // (visible to the sweep's stuck-order alert) until fixed by hand.
      await log('error', 'wallet', 'CRITICAL: refund issued but final order status update failed — order left in resolving, needs manual status fix', order.user_id, null, {
        order_id: order.id, amount: order.amount, db_error: finalStatusError.message,
      }).catch(() => {})
    }

    await log('warning', 'number', `Order auto-refunded (${result.status}) — ₦${order.amount?.toLocaleString()}`, order.user_id, null, {
      order_id: order.id, provider: providerId, reason: result.status,
    })

    return { action: 'refunded', status: result.status }
  }

  // Still pending at the provider — nothing was ever claimed for this
  // call (see above), so there's nothing to release either. Just
  // report the current status; the order was 'pending' the whole time.
  return { action: 'none', status: result.status }
}