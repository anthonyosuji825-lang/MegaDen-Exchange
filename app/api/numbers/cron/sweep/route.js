// app/api/numbers/cron/sweep/route.js
//
// Called by the Supabase Edge Function (supabase/functions/number-expiry)
// on a schedule. Not user-facing — protected by a shared secret, not a
// user session. This is what keeps the lifecycle logic in ONE place:
// the edge function is just a thin trigger that hits this endpoint,
// which in turn calls the exact same evaluateAndResolveOrder() that the
// interactive polling route uses. No second copy of the refund/expiry
// logic living in Deno.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'crypto'
import { evaluateAndResolveOrder } from '@/lib/numberOrders'
import { sweepEmailOrders } from '@/lib/emailOrders'
import { sweepEsimOrders } from '@/lib/esimOrders'
import { log } from '@/lib/logger'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Plain !== comparison on a secret leaks timing information (string
// comparison short-circuits on the first mismatched byte). Low-stakes
// for a cron trigger, but timing-safe is free — use it.
function isValidCronSecret(provided) {
  const expected = process.env.CRON_SECRET
  if (!provided || !expected) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// 'resolving' is a transient state that normally lasts seconds. An order
// is deliberately left there in two cases (refund RPC failed; refund went
// through but the final status write failed) because auto-retrying could
// double-refund — so nothing resumes them, and without this alert nobody
// would know. "Stuck" = still 'resolving' well after its own expiry
// (a reissue moves expiry into the future, so a live reissue never
// matches). Read-only: this reports, it never changes an order.
const STUCK_AFTER_MS = 10 * 60 * 1000

async function findStuckResolvingOrders() {
  try {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, amount, details')
      .eq('product_type', 'number')
      .eq('status', 'resolving')
    if (error || !data) return []
    const cutoff = Date.now() - STUCK_AFTER_MS
    return data
      .filter((o) => o.details?.expires && new Date(o.details.expires).getTime() < cutoff)
      .map((o) => ({ order_id: o.id, user_id: o.user_id, amount: o.amount, provider: o.details?.provider, external_id: o.details?.external_id }))
  } catch {
    return []
  }
}

export async function POST(request) {
  const secret = request.headers.get('x-cron-secret')
  if (!isValidCronSecret(secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: orders, error } = await supabaseAdmin
    .from('orders')
    .select('id, user_id, amount, status, details')
    .eq('product_type', 'number')
    .eq('status', 'pending')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let processed = 0
  let failed = 0
  const results = []
  for (const order of orders || []) {
    // One bad order must not abort the sweep and starve every order
    // after it. evaluateAndResolveOrder already releases its own claim
    // on a post-claim crash; this catches anything that still escapes
    // (e.g. a throw before any claim) so the loop keeps going.
    try {
      const result = await evaluateAndResolveOrder(supabaseAdmin, order)
      if (result.action !== 'none') {
        processed++
        results.push({ order_id: order.id, ...result })
      }
    } catch (err) {
      failed++
      results.push({ order_id: order.id, action: 'error', error: err.message })
      await log('error', 'number', `Sweep failed on order ${order.id}: ${err.message}`, order.user_id, null, {
        order_id: order.id, stack: err.stack,
      }).catch(() => {})
    }
  }

  const stuck = await findStuckResolvingOrders()
  if (stuck.length > 0) {
    await log('error', 'number', `${stuck.length} number order(s) stuck in 'resolving' — need manual review`, null, null, {
      orders: stuck,
    }).catch(() => {})
  }

  // Email OTP: refund emails that never received a code (same cron, same secret).
  let email = null
  try {
    email = await sweepEmailOrders(supabaseAdmin)
  } catch (err) {
    email = { error: err.message }
    await log('error', 'number', `Email OTP sweep failed: ${err.message}`, null, null, { stack: err.stack }).catch(() => {})
  }

  // eSIM: resolve any order Fleexa had not finished confirming (refund if it failed).
  let esim = null
  try {
    esim = await sweepEsimOrders(supabaseAdmin)
  } catch (err) {
    esim = { error: err.message }
    await log('error', 'number', `eSIM sweep failed: ${err.message}`, null, null, { stack: err.stack }).catch(() => {})
  }

  return NextResponse.json({ checked: orders?.length || 0, processed, failed, stuck_resolving: stuck.length, email, esim, results })
}