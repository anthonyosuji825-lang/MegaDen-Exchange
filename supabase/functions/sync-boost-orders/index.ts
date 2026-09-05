import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
)

const EXO_API_URL = 'https://exosupplier.com/api/v2'
const BATCH_SIZE = 100 // Exosupplier's documented max for the bulk status endpoint

// If a boost order has been sitting in a non-terminal state (or has no
// checkable supplier id at all) for this long, it's treated as stuck and
// auto-refunded rather than left to check forever. This is the same safety
// net every other product in the app already has (numbers: 20-min expiry,
// VPN: instant delivery) — boost was the one product with no ceiling at all.
const STUCK_ORDER_TIMEOUT_HOURS = 168

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function hoursSince(dateStr) {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60)
}

// Refunds the full order amount via the atomic RPC (increments off the
// current balance rather than overwriting a stale snapshot — same function
// used by the boost checkout route) and marks the order 'refunded'. We
// always refund the FULL amount here, even if the supplier reports partial
// delivery (`remains` < original quantity) — computing the correct partial
// refund isn't reliable from this response alone (price isn't linear
// per-unit across all packages, see interpolatePrice), so we favor not
// under-refunding the customer and leave the supplier-side numbers in
// `details` for manual reconciliation if needed.
async function refundStuckOrder(order, reason, exoResult) {
  const { error: refundError } = await supabase.rpc('refund_wallet_balance', {
    p_user_id: order.user_id,
    p_amount: order.amount,
  })

  await supabase.from('orders').update({
    status: 'refunded',
    details: {
      ...order.details,
      auto_refunded: true,
      refund_reason: reason,
      refund_error: refundError?.message || null,
      ...(exoResult ? { exo_status: exoResult.status, exo_remains: exoResult.remains, exo_charge: exoResult.charge } : {}),
    },
  }).eq('id', order.id)

  return { refundError }
}

Deno.serve(async () => {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, user_id, amount, created_at, details')
    .eq('product_type', 'boost')
    .eq('status', 'processing')

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  // Split orders into two groups up front: ones we CAN check on Exosupplier
  // (have an exo_order_id), and ones we CAN'T (missing/empty id — previously
  // these were silently dropped and never touched again by this function at
  // all). Both groups still get the stuck-order timeout applied.
  const checkable = []
  const uncheckable = []
  for (const order of orders || []) {
    const exoOrderId = order.details?.exo_order_id
    if (exoOrderId) checkable.push(order)
    else uncheckable.push(order)
  }

  let updated = 0
  let refunded = 0
  let skipped = 0
  let refundErrors = 0

  // ── Orders with no supplier id at all — we have no status to check, so
  // the only signal available is age. Refund once past the timeout.
  for (const order of uncheckable) {
    if (order.details?.auto_refunded) { skipped++; continue }

    if (hoursSince(order.created_at) >= STUCK_ORDER_TIMEOUT_HOURS) {
      const { refundError } = await refundStuckOrder(
        order,
        `No exo_order_id was ever recorded for this order — auto-refunded after ${STUCK_ORDER_TIMEOUT_HOURS}h with no way to check status.`,
        null
      )
      refunded++
      if (refundError) refundErrors++
    } else {
      await supabase.from('orders').update({
        details: { ...order.details, needs_review: true, review_reason: 'missing_exo_order_id' },
      }).eq('id', order.id)
      skipped++
    }
  }

  // ── Orders with a supplier id — check real status in batches, exactly as
  // before, but now with the timeout applied to anything still non-terminal.
  const byExoId = {}
  for (const order of checkable) byExoId[String(order.details.exo_order_id)] = order
  const exoIds = Object.keys(byExoId)

  for (const batch of chunk(exoIds, BATCH_SIZE)) {
    const statusRes = await fetch(EXO_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        key: Deno.env.get('EXO_API_KEY') ?? '',
        action: 'status',
        orders: batch.join(','),
      }).toString(),
    })

    if (!statusRes.ok) { skipped += batch.length; continue }
    const statusData = await statusRes.json()

    for (const exoId of batch) {
      const result = statusData[exoId]
      const order = byExoId[exoId]
      const alreadyRefunded = order.details?.auto_refunded
      const ageHours = hoursSince(order.created_at)

      // Exosupplier returns { "error": "Incorrect order ID" } per-id for bad
      // ids rather than failing the whole batch. If that persists past the
      // timeout, our stored id genuinely doesn't match anything on their
      // side and never will — refund rather than check forever.
      if (!result || result.error) {
        if (!alreadyRefunded && ageHours >= STUCK_ORDER_TIMEOUT_HOURS) {
          const { refundError } = await refundStuckOrder(
            order,
            `Supplier returned an error for this order id after ${STUCK_ORDER_TIMEOUT_HOURS}h: ${result?.error || 'No status returned'}`,
            null
          )
          refunded++
          if (refundError) refundErrors++
        } else {
          await supabase.from('orders').update({
            details: { ...order.details, needs_review: true, exo_error: result?.error || 'No status returned' },
          }).eq('id', order.id)
          skipped++
        }
        continue
      }

      const exoStatus = String(result.status || '').toLowerCase()

      // Only act on terminal states. Exosupplier's own order list shows
      // Pending, In progress, and Processing as distinct non-terminal
      // states (all still genuinely in flight) — leave those as-is UNLESS
      // they've been sitting long enough to hit the timeout.
      let newStatus = null
      if (exoStatus === 'completed') newStatus = 'completed'
      else if (exoStatus === 'partial') newStatus = 'partial'
      else if (exoStatus === 'canceled' || exoStatus === 'cancelled') newStatus = 'cancelled'

      if (!newStatus) {
        if (!alreadyRefunded && ageHours >= STUCK_ORDER_TIMEOUT_HOURS) {
          const { refundError } = await refundStuckOrder(
            order,
            `Still "${result.status}" on supplier after ${STUCK_ORDER_TIMEOUT_HOURS}h (remains ${result.remains}) — auto-refunded.`,
            result
          )
          refunded++
          if (refundError) refundErrors++
        } else {
          skipped++
        }
        continue
      }

      // NOTE: unlike cleanup-expired-numbers, this does NOT auto-refund on
      // 'partial' or 'cancelled'. A number's refund is always the full
      // order amount, computed with certainty. A partially-delivered boost
      // has no reliable way to compute the correct partial refund from
      // this response alone (remains tells us how much was NOT delivered,
      // but price isn't linear per-unit across all packages — see
      // interpolatePrice in lib/boost-catalog). Flagging these for manual
      // review is safer than auto-crediting a possibly wrong amount.
      await supabase.from('orders').update({
        status: newStatus,
        details: {
          ...order.details,
          exo_status: result.status,
          exo_remains: result.remains,
          exo_charge: result.charge,
          ...(newStatus !== 'completed' ? { needs_review: true } : {}),
        },
      }).eq('id', order.id)

      updated++
    }
  }

  return new Response(JSON.stringify({
    total: (orders || []).length,
    checkable: checkable.length,
    uncheckable: uncheckable.length,
    updated,
    refunded,
    refund_errors: refundErrors,
    skipped,
  }), {
    headers: { 'Content-Type': 'application/json' },
  })
})