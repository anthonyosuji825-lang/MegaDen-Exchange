// app/api/admin/user-history/route.js
//
// GET /api/admin/user-history?userId=<uuid>
//
// Admin-only, read-only. Builds one chronological timeline for a single user
// from: sign-up, wallet transactions, orders, boost jobs, referral rewards and
// activity logs. Every event carries a UTC ISO timestamp ('at').
// Columns of type "timestamp without time zone" are stored in UTC, so they are
// tagged with a Z before being returned.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function iso(v) {
  if (!v) return null
  const s = String(v)
  const d = new Date(/[zZ]$|[+-]\d\d(:?\d\d)?$/.test(s) ? s : s.replace(' ', 'T') + 'Z')
  return isNaN(d) ? null : d.toISOString()
}

function classifyTx(t) {
  const d = t.description || ''
  if (t.type === 'credit') {
    if (/paystack/i.test(d)) return { kind: 'funding', title: 'Wallet funded' }
    if (/refund/i.test(d)) return { kind: 'refund', title: d }
    if (/adjust/i.test(d)) return { kind: 'adjustment', title: 'Balance adjusted by admin' }
    return { kind: 'credit', title: d || 'Wallet credit' }
  }
  return { kind: 'spend', title: d || 'Wallet debit' }
}

export async function GET(request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { get(name) { return cookieStore.get(name)?.value } } }
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: me } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!me?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const userId = new URL(request.url).searchParams.get('userId') || ''
    if (!UUID.test(userId)) return NextResponse.json({ error: 'Invalid userId' }, { status: 400 })

    const [profileR, txR, orderR, boostR, refR, logR] = await Promise.all([
      supabaseAdmin.from('profiles').select('id, full_name, email, phone, wallet_balance, created_at, is_admin').eq('id', userId).single(),
      supabaseAdmin.from('transactions').select('id, type, amount, description, reference, status, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(500),
      supabaseAdmin.from('orders').select('id, product_type, product_name, amount, status, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(500),
      supabaseAdmin.from('boost_jobs').select('id, tier, link, quantity, price_ngn, status, error, refunded_ngn, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(200),
      supabaseAdmin.from('referral_rewards').select('id, referrer_id, referred_user_id, amount, created_at').or(`referrer_id.eq.${userId},referred_user_id.eq.${userId}`).order('created_at', { ascending: false }).limit(100),
      supabaseAdmin.from('logs').select('id, level, category, message, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(200),
    ])

    if (profileR.error || !profileR.data) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const profile = profileR.data

    const events = []

    if (profile.created_at) {
      events.push({ id: 'signup', group: 'activity', kind: 'signup', title: 'Joined MegaDen', detail: profile.email, at: iso(profile.created_at) })
    }

    for (const t of txR.data || []) {
      const c = classifyTx(t)
      events.push({
        id: 'tx-' + t.id, group: 'wallet', kind: c.kind, title: c.title,
        detail: t.reference || null,
        amount: Number(t.amount || 0), sign: t.type === 'credit' ? '+' : '-',
        status: t.status || null, at: iso(t.created_at),
      })
    }

    for (const o of orderR.data || []) {
      events.push({
        id: 'order-' + o.id, group: 'orders', kind: 'order',
        title: o.product_name || o.product_type || 'Order',
        detail: o.product_type || null,
        amount: Number(o.amount || 0), status: o.status, at: iso(o.created_at),
      })
    }

    for (const b of boostR.data || []) {
      events.push({
        id: 'boost-' + b.id, group: 'orders', kind: 'boost',
        title: `Boost x${b.quantity} (${b.tier || 'standard'})`,
        detail: b.error ? `${b.link} - ${b.error}` : b.link,
        amount: Number(b.price_ngn || 0), status: b.status, at: iso(b.created_at),
      })
    }

    for (const r of refR.data || []) {
      const earned = r.referrer_id === userId
      events.push({
        id: 'ref-' + r.id, group: 'wallet', kind: 'referral',
        title: earned ? 'Referral reward earned' : 'Joined through a referral',
        detail: null, amount: Number(r.amount || 0), sign: earned ? '+' : null, at: iso(r.created_at),
      })
    }

    for (const l of logR.data || []) {
      events.push({
        id: 'log-' + l.id, group: 'activity', kind: 'log',
        title: l.message, detail: l.category, level: l.level, at: iso(l.created_at),
      })
    }

    const valid = events.filter(e => e.at).sort((a, b) => (a.at < b.at ? 1 : -1))

    const txs = txR.data || []
    const sum = (arr) => arr.reduce((a, t) => a + Number(t.amount || 0), 0)
    const summary = {
      funded: sum(txs.filter(t => t.type === 'credit' && /paystack/i.test(t.description || ''))),
      spent: sum(txs.filter(t => t.type === 'debit')),
      refunded: sum(txs.filter(t => t.type === 'credit' && /refund/i.test(t.description || ''))),
      orders: (orderR.data || []).length,
      lastActive: valid.length ? valid[0].at : null,
    }

    const truncated = [txR, orderR, boostR, logR].some(r => (r.data || []).length >= (r === boostR ? 200 : r === logR ? 200 : 500))

    return NextResponse.json({
      profile: { id: profile.id, name: profile.full_name, email: profile.email, phone: profile.phone, wallet: Number(profile.wallet_balance || 0), joined: iso(profile.created_at) },
      summary, events: valid, truncated,
    })
  } catch (e) {
    console.error('admin/user-history error:', e)
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 })
  }
}