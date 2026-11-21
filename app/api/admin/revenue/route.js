// app/api/admin/revenue/route.js
//
// GET /api/admin/revenue
//
// Admin-only. "Revenue" here means money actually paid in through Paystack:
// the sum of successful 'Wallet funding via Paystack' transactions (written
// by app/api/paystack/webhook/route.js). It deliberately EXCLUDES:
//   - manual balance adjustments made by an admin
//   - refunds (numbers, boosts, auto-refunds)
//   - what customers spend from their wallet (debits / completed orders)
// none of which is money that came in through Paystack.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const PAYSTACK_DESCRIPTION = 'Wallet funding via Paystack'
const PAGE_SIZE = 1000 // Supabase caps a single response at 1,000 rows

// Calendar day in Nigeria time (WAT, no daylight saving) as 'YYYY-MM-DD'.
// A timestamp with no timezone suffix is stored in UTC, so tag it as such.
const LAGOS_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' })
function lagosDay(value) {
  let d
  if (value instanceof Date) {
    d = value
  } else {
    const s = String(value)
    d = new Date(/[zZ]$|[+-]\d\d(:?\d\d)?$/.test(s) ? s : s.replace(' ', 'T') + 'Z')
  }
  return LAGOS_DAY.format(d)
}

export async function GET() {
  try {
    // Verify the requester is an admin
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { get(name) { return cookieStore.get(name)?.value } } }
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Page through every matching transaction so the total stays correct
    // once there are more than 1,000 of them. Also bucket by calendar day
    // (Nigeria time) so the admin page can show today / this week / this
    // month and a trend without a second request.
    let total = 0
    let count = 0
    const byDay = new Map() // 'YYYY-MM-DD' -> { total, count }
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabaseAdmin
        .from('transactions')
        .select('amount, created_at')
        .eq('type', 'credit')
        .eq('status', 'success')
        .eq('description', PAYSTACK_DESCRIPTION)
        .order('created_at', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      for (const row of data || []) {
        const amount = Number(row.amount) || 0
        total += amount
        count++
        const day = lagosDay(row.created_at)
        const bucket = byDay.get(day) || { total: 0, count: 0 }
        bucket.total += amount
        bucket.count++
        byDay.set(day, bucket)
      }
      if (!data || data.length < PAGE_SIZE) break
    }

    const daily = [...byDay.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, v]) => ({ date, total: v.total, count: v.count }))

    return NextResponse.json({ total, count, daily })
  } catch (err) {
    console.error('Admin revenue error:', err)
    return NextResponse.json({ error: 'Failed to compute revenue' }, { status: 500 })
  }
}