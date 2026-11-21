// app/api/admin/paystack/route.js
//
// GET /api/admin/paystack
//
// Admin-only. One call that returns everything the "Paystack" admin tab shows:
//   - balance            money available to send right now (Paystack GET /balance)
//   - payouts            settlements to your bank (GET /settlement)
//   - pendingPayouts     settlements still pending/processing + their total
//   - transactions       latest payments (GET /transaction) with a flag saying
//                        whether each one was credited to a wallet in our DB
//   - daily              per-day history of users who paid in (from our DB)
//   - notCredited        successful on Paystack but missing in our DB
//
// Paystack amounts are in kobo (we divide by 100). Each Paystack section fails
// independently, so one bad call never blanks the whole tab (see `errors`).
// Read-only: nothing here changes any data.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const PAYSTACK_DESCRIPTION = 'Wallet funding via Paystack'
const PAGE_SIZE = 1000
const PS = 'https://api.paystack.co'

const LAGOS_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' })
function lagosDay(value) {
  let d
  if (value instanceof Date) d = value
  else {
    const s = String(value)
    d = new Date(/[zZ]$|[+-]\d\d(:?\d\d)?$/.test(s) ? s : s.replace(' ', 'T') + 'Z')
  }
  return LAGOS_DAY.format(d)
}

const naira = (kobo) => Math.round(Number(kobo || 0)) / 100

async function ps(path) {
  const res = await fetch(PS + path, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    cache: 'no-store',
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || body.status === false) {
    throw new Error(body.message || `Paystack ${res.status}`)
  }
  return body
}

export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { get(name) { return cookieStore.get(name)?.value } } }
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: profile } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const errors = {}
    const hasKey = !!process.env.PAYSTACK_SECRET_KEY

    // ---- Paystack API (parallel, each section independent) ----
    const settle = async (key, fn) => {
      if (!hasKey) { errors[key] = 'PAYSTACK_SECRET_KEY is not set'; return null }
      try { return await fn() } catch (e) { errors[key] = e.message || 'failed'; return null }
    }

    const [balRes, payoutRes, pendRes, procRes, txRes] = await Promise.all([
      settle('balance', () => ps('/balance')),
      settle('payouts', () => ps('/settlement?perPage=50&page=1')),
      settle('pendingPayouts', () => ps('/settlement?perPage=50&status=pending')),
      settle('pendingPayouts', () => ps('/settlement?perPage=50&status=processing')),
      settle('transactions', () => ps('/transaction?perPage=100&page=1')),
    ])

    const ngnBal = (balRes?.data || []).find(b => b.currency === 'NGN') || (balRes?.data || [])[0]
    const balance = ngnBal ? naira(ngnBal.balance) : null

    const mapSettlement = (s) => ({
      id: s.id,
      status: s.status,
      amount: naira(s.total_amount),          // total settled
      effective: naira(s.effective_amount),   // after fees/deductions
      fees: naira(s.total_fees),
      processed: naira(s.total_processed),    // gross volume this settlement covers
      date: s.settlement_date || s.createdAt,
      createdAt: s.createdAt,
    })
    const payouts = (payoutRes?.data || []).map(mapSettlement)
    const pendingPayouts = [...(pendRes?.data || []), ...(procRes?.data || [])].map(mapSettlement)
    const pendingTotal = pendingPayouts.reduce((a, s) => a + s.effective, 0)

    // ---- Our DB: every Paystack wallet funding (for daily payers + reconcile) ----
    const rows = []
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabaseAdmin
        .from('transactions')
        .select('user_id, amount, reference, created_at')
        .eq('type', 'credit')
        .eq('description', PAYSTACK_DESCRIPTION)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1)
      if (error) { errors.daily = error.message; break }
      rows.push(...(data || []))
      if (!data || data.length < PAGE_SIZE) break
    }

    const ids = [...new Set(rows.map(r => r.user_id).filter(Boolean))]
    const emailById = {}
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await supabaseAdmin.from('profiles').select('id, email').in('id', ids.slice(i, i + 200))
      for (const p of data || []) emailById[p.id] = p.email
    }

    const byDay = {}
    for (const r of rows) {
      const day = lagosDay(r.created_at)
      const d = byDay[day] || (byDay[day] = { date: day, total: 0, count: 0, users: {} })
      const amt = Number(r.amount || 0)
      d.total += amt
      d.count += 1
      const u = d.users[r.user_id] || (d.users[r.user_id] = { email: emailById[r.user_id] || 'unknown', total: 0, count: 0 })
      u.total += amt
      u.count += 1
    }
    const daily = Object.values(byDay)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map(d => ({
        date: d.date,
        total: d.total,
        count: d.count,
        payers: Object.keys(d.users).length,
        users: Object.values(d.users).sort((a, b) => b.total - a.total),
      }))

    // ---- Paystack transactions + reconciliation ----
    const known = new Set(rows.map(r => r.reference).filter(Boolean))
    const transactions = (txRes?.data || []).map(t => ({
      id: t.id,
      reference: t.reference,
      status: t.status,
      amount: naira(t.amount),
      fees: naira(t.fees),
      channel: t.channel,
      email: t.customer?.email || null,
      paidAt: t.paid_at || t.created_at || t.createdAt,
      credited: known.has(t.reference),
    }))
    const notCredited = transactions.filter(t => t.status === 'success' && !t.credited)

    return NextResponse.json({
      balance,
      pendingTotal,
      payouts,
      pendingPayouts,
      transactions,
      notCredited,
      daily,
      errors,
      fetchedAt: new Date().toISOString(),
    })
  } catch (e) {
    console.error('admin/paystack error:', e)
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 })
  }
}