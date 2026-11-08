// app/api/numbers/sms/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { log } from '@/lib/logger'
import { evaluateAndResolveOrder, claimPendingOrder, releaseOrderClaim } from '@/lib/numberOrders'
import { cancelOrder, checkOrderStatus } from '@/lib/providers/orchestrator'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function getAuthedUser(cookieStore) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { get(name) { return cookieStore.get(name)?.value } } }
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  return { user, error }
}

async function loadOwnedOrder(orderId, userId) {
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('id, user_id, amount, status, details')
    .eq('id', orderId)
    .single()
  if (error || !order) return { error: 'NOT_FOUND' }
  if (order.user_id !== userId) return { error: 'NOT_FOUND' } // don't leak existence
  return { order }
}

// ── GET: check for SMS ─────────────────────────────────────────────────
export async function GET(request) {
  try {
    const cookieStore = await cookies()
    const { user, error: authError } = await getAuthedUser(cookieStore)
    if (!user || authError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('order_id')
    if (!orderId) return NextResponse.json({ error: 'Missing order_id' }, { status: 400 })

    const { order, error } = await loadOwnedOrder(orderId, user.id)
    if (error) return NextResponse.json({ error: 'Order not found.' }, { status: 404 })

    if (order.status !== 'pending') {
      // Already resolved (completed/cancelled/expired/banned) — just
      // report the current state, nothing to evaluate.
      return NextResponse.json({
        status: order.status,
        sms: order.details?.sms_code ? [{ code: order.details.sms_code, text: order.details.sms_text }] : [],
        phone: order.details?.phone,
        expires_at: order.details?.expires,
      })
    }

    const result = await evaluateAndResolveOrder(supabaseAdmin, order)

    // Re-read for the freshest details (sms_code, etc.) if something changed.
    const { order: fresh } = result.action !== 'none'
      ? await loadOwnedOrder(orderId, user.id)
      : { order }

    return NextResponse.json({
      status: fresh.status === 'pending' ? 'pending' : fresh.status,
      sms: fresh.details?.sms_code ? [{ code: fresh.details.sms_code, text: fresh.details.sms_text }] : [],
      phone: fresh.details?.phone,
      // The authoritative deadline (order.details.expires), not a
      // client-side countdown seeded once at purchase time. This is what
      // lets the frontend re-derive its countdown from Date.now() vs a
      // real timestamp on every poll — including right after a reissue,
      // when this value actually changes to a fresh 20-minute window.
      // Previously the frontend never received this at all; the display
      // only looked correct because every provider happened to hardcode
      // the same 1200-second window, so resetting the local counter to
      // that same constant on reissue looked right by coincidence, not
      // because the server ever told it the real deadline.
      expires_at: fresh.details?.expires,
      refunded: result.action === 'refunded',
      refunded_amount: result.action === 'refunded' ? fresh.amount : undefined,
    })

  } catch (error) {
    console.error('[numbers/sms GET]', error)
    return NextResponse.json({ error: 'Failed to check SMS' }, { status: 500 })
  }
}

// ── DELETE: manual cancel ──────────────────────────────────────────────
export async function DELETE(request) {
  let claimedOrderId = null
  let refundIssued = false
  try {
    const cookieStore = await cookies()
    const { user, error: authError } = await getAuthedUser(cookieStore)
    if (!user || authError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { orderId } = await request.json()
    if (!orderId) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    // Cheap existence/ownership check first, so a bad id gets a clean
    // 404 instead of the generic "no longer cancellable" claim failure.
    const { order: existing, error: loadError } = await loadOwnedOrder(orderId, user.id)
    if (loadError) return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
    if (existing.status !== 'pending') {
      return NextResponse.json({ error: 'This order can no longer be cancelled.' }, { status: 400 })
    }

    // ── Atomic claim ──────────────────────────────────────────────────
    // The interactive poll (GET, above) and the cron sweep both call
    // evaluateAndResolveOrder, which can independently refund, complete,
    // or reissue this exact order at any moment — including the instant
    // between the ownership check above and the provider/wallet calls
    // below. Without claiming the order first, a manual cancel that
    // loses that race would cancel a stale (already-replaced) provider
    // number and/or refund a wallet that was just refunded by the other
    // path, i.e. pay the user twice for one order. This claim makes
    // this request the sole owner of the order before anything
    // irreversible happens, exactly like evaluateAndResolveOrder does.
    const { order, error: claimError } = await claimPendingOrder(supabaseAdmin, orderId, user.id)
    if (claimError) {
      return NextResponse.json({ error: 'This order was just resolved — refresh to see its status.' }, { status: 400 })
    }
    claimedOrderId = order.id

    const providerId = order.details?.provider
    const externalId = order.details?.external_id
    if (!providerId || !externalId) {
      await releaseOrderClaim(supabaseAdmin, orderId, 'pending')
      return NextResponse.json({ error: 'Order has no associated number.' }, { status: 400 })
    }

    const cancelResult = await cancelOrder(providerId, externalId)
      .catch((err) => ({ ok: false, message: err.message }))

    // ── Refund only when the number is CONFIRMED dead ────────────────
    // A provider-side cancel can fail for reasons that mean the number
    // is still live (SMSPool locks cancellation for a short period after
    // purchase; the provider may be unreachable). Refunding in that case
    // hands the user their money back while the number can still receive
    // — and be billed for — a code. So when cancel is not confirmed, ask
    // the provider what state the order is really in:
    //   - SMS received (with a code) -> complete the order, no refund
    //   - cancelled/expired/banned   -> number is dead, safe to refund
    //   - anything else (pending/unknown/provider unreachable) ->
    //     unconfirmed: do NOT refund, release the claim, ask them to
    //     retry. The order stays active, and if it is never used the
    //     normal expiry path refunds it automatically.
    if (!cancelResult.ok) {
      const check = await checkOrderStatus(providerId, externalId).catch(() => null)

      if (check?.status === 'received' && check.smsCode) {
        await supabaseAdmin
          .from('orders')
          .update({
            status: 'completed',
            details: { ...order.details, sms_code: check.smsCode, sms_text: check.smsText },
          })
          .eq('id', orderId)

        await log('warning', 'number', 'Cancel blocked — SMS already received', user.id, null, { order_id: orderId })
        return NextResponse.json({ error: 'SMS already received — no refund possible.' }, { status: 400 })
      }

      const confirmedDead = ['cancelled', 'expired', 'banned'].includes(check?.status)
      if (!confirmedDead) {
        await releaseOrderClaim(supabaseAdmin, orderId, 'pending')
        await log('warning', 'number', 'Manual cancel not confirmed by provider and number not confirmed dead — refund withheld, claim released', user.id, null, {
          order_id: orderId, provider: providerId, external_id: externalId, cancel_result: cancelResult, status_check: check?.status || 'unreachable',
        }).catch(() => {})
        return NextResponse.json({
          error: "We couldn't cancel this number with the provider yet — some providers lock cancellation for the first few minutes. Your order is still active; please try again shortly. If it isn't used, it will be refunded automatically when it expires.",
        }, { status: 409 })
      }

      await log('info', 'number', `Provider cancel failed but number is confirmed ${check.status} — proceeding with refund`, user.id, null, {
        order_id: orderId, provider: providerId, external_id: externalId, cancel_result: cancelResult,
      }).catch(() => {})
    }

    const { data: refundOk, error: refundError } = await supabaseAdmin
      .rpc('credit_wallet_balance', { p_user_id: user.id, p_amount: order.amount })

    if (refundError || !refundOk) {
      await log('error', 'wallet', 'Refund RPC failed after manual cancel', user.id, null, {
        order_id: orderId, amount: order.amount, rpc_error: refundError?.message,
      })
      // Deliberately NOT releasing the claim back to 'pending': the
      // number is already cancelled at the provider, so it must not
      // re-enter the normal poll/cron flow and get evaluated as if it
      // were still live. It stays in 'resolving' for support to resolve
      // manually rather than risk a second refund attempt racing this one.
      return NextResponse.json({ error: 'Refund failed. Please contact support.' }, { status: 500 })
    }

    // Wallet is credited as of here — if anything below throws, the
    // catch block must NOT put the order back to 'pending', or the
    // normal poll/cron flow could evaluate it as still-live and credit
    // it a second time.
    refundIssued = true

    const { error: txError } = await supabaseAdmin.from('transactions').insert({
      user_id: user.id,
      type: 'credit',
      amount: order.amount,
      description: 'Refund — Number cancelled',
      reference: `REFUND-${externalId}-${Date.now()}`,
      status: 'success',
    })

    if (txError) {
      // Same reasoning as the auto-refund path in numberOrders.js —
      // the wallet was already credited above via the checked RPC, this
      // is only the log entry. Don't fail the request over it (the
      // user's money is fine), but don't let it disappear silently either.
      await log('error', 'wallet', 'Transaction log insert failed after successful manual-cancel refund RPC', user.id, null, {
        order_id: orderId, amount: order.amount, tx_error: txError.message,
      }).catch(() => {})
    }

    const { error: cancelStatusError } = await supabaseAdmin.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
    if (cancelStatusError) {
      // Wallet is already credited: leave the order in 'resolving' (do
      // NOT release to pending — double refund) and make it visible.
      await log('error', 'wallet', 'CRITICAL: manual-cancel refund issued but order status update failed — order left in resolving, needs manual status fix', user.id, null, {
        order_id: orderId, amount: order.amount, db_error: cancelStatusError.message,
      }).catch(() => {})
    }

    await log('info', 'number', `Number cancelled — refunded ₦${order.amount?.toLocaleString()}`, user.id, null, {
      order_id: orderId, provider: providerId,
    })

    return NextResponse.json({ success: true, refunded_amount: order.amount })

  } catch (error) {
    console.error('[numbers/sms DELETE]', error)
    // Best-effort: if we'd already claimed the order before the
    // exception hit, don't leave it stuck in 'resolving' forever.
    // Only safe to release back to 'pending' if the wallet hasn't been
    // credited yet — otherwise the normal poll/cron flow would see a
    // "live" order and could refund it again. If the refund already
    // went through, leave it in 'resolving' for support to finish
    // (transaction log / status update) rather than risk a double-credit.
    if (claimedOrderId && !refundIssued) {
      await releaseOrderClaim(supabaseAdmin, claimedOrderId, 'pending').catch(() => {})
    }
    return NextResponse.json({ error: 'Failed to cancel' }, { status: 500 })
  }
}