// app/api/admin/provider-profit/route.js
//
// Per-funding profit tracking for upstream providers.
//
//   GET    /api/admin/provider-profit             -> every provider, every funding window
//   POST   /api/admin/provider-profit             -> log a top-up
//   DELETE /api/admin/provider-profit?id=<uuid>   -> remove a mistaken entry
//
// A "funding window" starts when you log a top-up and ends when you log the
// next top-up for the same provider (or now, for the current one).
//
//   revenue = what customers paid (orders.amount, status 'completed') for that
//             provider's orders created inside the window
//   cost    = provider balance used up in the window, in naira:
//               start = balance right after this top-up (balance_after)
//               end   = balance just before the next top-up
//                       (next.balance_after - next.amount), or the live
//                       balance for the current window
//               cost  = (start - end) x rate     (rate = 1 for NGN providers)
//   profit  = revenue - cost
//
// Records: when the next top-up is logged, the finished window's result is
// frozen onto its row (final_* columns, closed_at) so history never changes
// afterwards. Balance snapshots (at most one per provider per 30 minutes,
// taken whenever this tab loads) give the log a balance trail.
//
// Nothing here touches orders, wallets or any other customer-facing table.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const PROVIDERS = {
  fleexa:  { label: 'Fleexa',    currency: 'NGN', balanceKey: 'fleexa' },
  jap:     { label: 'JAP Panel', currency: 'USD', balanceKey: 'jap' },
  exo:     { label: 'Exo Panel', currency: 'USD', balanceKey: 'exo' },
  fivesim: { label: '5sim',      currency: 'USD', balanceKey: 'fivesim' },
  smspool: { label: 'SMSPool',   currency: 'USD', balanceKey: 'smspool' },
}

const PAGE = 1000

function iso(v) {
  if (!v) return null
  const s = String(v)
  const d = new Date(/[zZ]$|[+-]\d\d(:?\d\d)?$/.test(s) ? s : s.replace(' ', 'T') + 'Z')
  return isNaN(d) ? null : d.toISOString()
}

const LAGOS_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' })
const lagosDay = (ms) => LAGOS_DAY.format(new Date(ms))

// Which provider served an order? Mirrors how the app tags orders.
function providerOfOrder(o) {
  const p = String(o.details?.provider || '').toLowerCase()
  if (p.startsWith('fleexa')) return 'fleexa'
  if (p.startsWith('fivesim')) return 'fivesim'
  if (p.startsWith('smspool')) return 'smspool'
  if (p === 'jap' || o.product_type === 'standard_boost') return 'jap'
  if (p.startsWith('exo') || o.product_type === 'boost') return 'exo'
  return null
}

async function requireAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { get(name) { return cookieStore.get(name)?.value } } }
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  if (!user || error) return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: me } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) return { res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { user }
}

// Reuse the existing balances route so there is one source of truth.
async function liveBalances(request) {
  try {
    const res = await fetch(new URL('/api/admin/balances', request.url), {
      headers: { cookie: request.headers.get('cookie') || '' },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return {}
    return await res.json()
  } catch {
    return {}
  }
}

async function usdRate() {
  const { data } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'usd_to_ngn_rate').single()
  const n = Number(data?.value)
  return Number.isFinite(n) && n > 0 ? n : null
}

async function build(request, { persist = true } = {}) {
  const [{ data: fundings, error: fErr }, balances, rate, snapsRes] = await Promise.all([
    supabaseAdmin.from('provider_fundings').select('*').order('funded_at', { ascending: true }),
    liveBalances(request),
    usdRate(),
    supabaseAdmin.from('provider_balance_snapshots').select('provider, balance, recorded_at').order('recorded_at', { ascending: false }).limit(2000),
  ])
  if (fErr) throw new Error(fErr.message)

  // Orders since the earliest funding, bucketed by provider.
  const earliest = (fundings || [])[0]?.funded_at
  const ordersByProvider = {}
  if (earliest) {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabaseAdmin
        .from('orders')
        .select('product_type, amount, status, details, created_at')
        .eq('status', 'completed')
        .gte('created_at', earliest.replace('+00:00', '').replace('Z', ''))
        .order('created_at', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) break
      for (const o of data || []) {
        const k = providerOfOrder(o)
        if (!k) continue
        ;(ordersByProvider[k] ||= []).push({ at: new Date(iso(o.created_at)).getTime(), amount: Number(o.amount || 0) })
      }
      if (!data || data.length < PAGE) break
    }
  }

  // Exo records the provider's exact charge (USD) on each boost job.
  const exoJobs = []
  if (earliest && (fundings || []).some(f => f.provider === 'exo')) {
    const { data } = await supabaseAdmin
      .from('boost_jobs')
      .select('provider_charge_usd, status, created_at')
      .eq('provider', 'exobooster')
      .not('provider_charge_usd', 'is', null)
      .gte('created_at', earliest)
    for (const j of data || []) {
      if (['failed', 'canceled'].includes(j.status)) continue
      exoJobs.push({ at: new Date(j.created_at).getTime(), usd: Number(j.provider_charge_usd || 0) })
    }
  }

  const snapsAll = snapsRes?.data || []
  const toPersist = []
  const toSnapshot = []
  const out = {}

  for (const [key, meta] of Object.entries(PROVIDERS)) {
    const list = (fundings || []).filter(f => f.provider === key)
    const live = balances?.[meta.balanceKey]?.balance
    const liveBalance = live !== null && live !== undefined && Number.isFinite(Number(live)) ? Number(live) : null
    const orders = ordersByProvider[key] || []

    const windows = list.map((f, i) => {
      const next = list[i + 1]
      const startMs = new Date(f.funded_at).getTime()
      const endMs = next ? new Date(next.funded_at).getTime() : Date.now()
      const open = !next

      const fx = meta.currency === 'USD'
        ? (f.paid_ngn && f.amount ? Number(f.paid_ngn) / Number(f.amount) : (Number(f.rate) || rate))
        : 1
      const startBal = f.balance_after == null ? null : Number(f.balance_after)
      const beforeBal = startBal == null ? null : startBal - Number(f.amount)

      const base = {
        id: f.id,
        fundedAt: f.funded_at,
        endedAt: next ? next.funded_at : null,
        open,
        amount: Number(f.amount),
        paidNgn: f.paid_ngn == null ? null : Number(f.paid_ngn),
        rate: meta.currency === 'USD' ? fx : null,
        note: f.note,
        beforeBalance: beforeBal,
        startBalance: startBal,
        frozen: false,
      }

      // Closed and already frozen: use the saved record, never recompute.
      if (!open && f.final_profit != null) {
        const used = f.final_end_balance != null && startBal != null ? Math.max(startBal - Number(f.final_end_balance), 0) : null
        const rev = Number(f.final_revenue)
        const profit = Number(f.final_profit)
        return {
          ...base, frozen: true, closedAt: f.closed_at || next.funded_at,
          endBalance: f.final_end_balance == null ? null : Number(f.final_end_balance),
          used, orders: Number(f.final_orders || 0), revenue: rev, cost: Number(f.final_cost),
          recordedCost: null, profit, marginPct: rev > 0 ? (profit / rev) * 100 : null,
        }
      }

      const inWin = orders.filter(o => o.at >= startMs && o.at < endMs)
      const revenue = inWin.reduce((a, o) => a + o.amount, 0)

      let endBal = null
      if (next) endBal = next.balance_after == null ? null : Number(next.balance_after) - Number(next.amount)
      else endBal = liveBalance

      let costNgn = null
      let usedProvider = null
      if (startBal != null && endBal != null && fx) {
        usedProvider = Math.max(startBal - endBal, 0)
        costNgn = usedProvider * fx
      }

      let recordedNgn = null
      if (key === 'exo' && fx) {
        recordedNgn = exoJobs.filter(j => j.at >= startMs && j.at < endMs).reduce((a, j) => a + j.usd, 0) * fx
      }

      const profit = costNgn == null ? null : revenue - costNgn

      // Freeze finished windows the first time they can be computed.
      if (!open && profit != null && persist) {
        toPersist.push({
          id: f.id,
          patch: {
            closed_at: next.funded_at,
            final_revenue: revenue, final_cost: costNgn, final_profit: profit,
            final_orders: inWin.length, final_end_balance: endBal,
          },
        })
      }

      return {
        ...base, closedAt: next ? next.funded_at : null,
        endBalance: endBal, used: usedProvider, orders: inWin.length,
        revenue, cost: costNgn, recordedCost: recordedNgn, profit,
        marginPct: profit != null && revenue > 0 ? (profit / revenue) * 100 : null,
      }
    })

    // ---- Log events (newest first) ----
    const events = []
    windows.forEach((w, i) => {
      events.push({
        id: 'f-' + w.id, type: 'funding', at: w.fundedAt,
        amount: w.amount, paidNgn: w.paidNgn, rate: w.rate,
        beforeBalance: w.beforeBalance, afterBalance: w.startBalance,
        carried: i > 0 ? w.beforeBalance : null, note: w.note,
      })
      if (!w.open && w.profit != null) {
        events.push({
          id: 'c-' + w.id, type: 'closed', at: w.endedAt,
          fundedAt: w.fundedAt, orders: w.orders, revenue: w.revenue, cost: w.cost,
          profit: w.profit, marginPct: w.marginPct, endBalance: w.endBalance, frozen: w.frozen,
        })
      }
      const startMs = new Date(w.fundedAt).getTime()
      const endMs = w.endedAt ? new Date(w.endedAt).getTime() : Date.now()
      const days = {}
      for (const o of orders) {
        if (o.at < startMs || o.at >= endMs) continue
        const d = lagosDay(o.at)
        const x = days[d] || (days[d] = { date: d, orders: 0, revenue: 0, last: 0 })
        x.orders += 1; x.revenue += o.amount; x.last = Math.max(x.last, o.at)
      }
      for (const x of Object.values(days)) {
        events.push({ id: `d-${w.id}-${x.date}`, type: 'orders', at: new Date(x.last).toISOString(), date: x.date, orders: x.orders, revenue: x.revenue })
      }
    })

    // Balance trail (oldest first so each point can show its change).
    const firstFunding = list[0] ? new Date(list[0].funded_at).getTime() : null
    const snaps = snapsAll.filter(sn => sn.provider === key && firstFunding != null && new Date(sn.recorded_at).getTime() >= firstFunding).reverse()
    let prev = null
    for (const sn of snaps) {
      const b = Number(sn.balance)
      if (prev == null || b !== prev) {
        events.push({ id: 'b-' + sn.recorded_at, type: 'balance', at: sn.recorded_at, balance: b, change: prev == null ? null : b - prev })
      }
      prev = b
    }
    events.sort((a, b) => (a.at < b.at ? 1 : -1))

    // Take a snapshot at most every 30 minutes once a provider has fundings.
    if (liveBalance != null && list.length) {
      const last = snapsAll.find(sn => sn.provider === key)
      if (!last || Date.now() - new Date(last.recorded_at).getTime() > 30 * 60 * 1000) {
        toSnapshot.push({ provider: key, balance: liveBalance })
      }
    }

    const done = windows.filter(w => w.profit != null)
    out[key] = {
      label: meta.label,
      currency: meta.currency,
      liveBalance,
      windows: windows.slice().reverse(),
      events,
      totalProfit: done.reduce((a, w) => a + w.profit, 0),
      totalRevenue: done.reduce((a, w) => a + w.revenue, 0),
      totalCost: done.reduce((a, w) => a + w.cost, 0),
    }
  }

  if (persist) {
    for (const x of toPersist) await supabaseAdmin.from('provider_fundings').update(x.patch).eq('id', x.id)
    if (toSnapshot.length) await supabaseAdmin.from('provider_balance_snapshots').insert(toSnapshot)
  }

  return { providers: out, usdRate: rate, fetchedAt: new Date().toISOString() }
}

export async function GET(request) {
  try {
    const auth = await requireAdmin()
    if (auth.res) return auth.res
    return NextResponse.json(await build(request))
  } catch (e) {
    console.error('provider-profit GET error:', e)
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const auth = await requireAdmin()
    if (auth.res) return auth.res

    const body = await request.json().catch(() => ({}))
    const meta = PROVIDERS[body.provider]
    if (!meta) return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })

    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Enter the amount you funded' }, { status: 400 })

    const paidNgn = body.paidNgn === '' || body.paidNgn == null ? null : Number(body.paidNgn)
    if (paidNgn != null && (!Number.isFinite(paidNgn) || paidNgn <= 0)) return NextResponse.json({ error: 'Naira paid is not valid' }, { status: 400 })

    let balanceAfter = body.balanceAfter === '' || body.balanceAfter == null ? null : Number(body.balanceAfter)
    if (balanceAfter != null && !Number.isFinite(balanceAfter)) return NextResponse.json({ error: 'Balance is not valid' }, { status: 400 })
    if (balanceAfter == null) {
      const b = await liveBalances(request)
      const v = b?.[meta.balanceKey]?.balance
      if (v == null || !Number.isFinite(Number(v))) {
        return NextResponse.json({ error: 'Could not read the provider balance. Type it in manually.' }, { status: 400 })
      }
      balanceAfter = Number(v)
    }

    let fundedAt = new Date()
    if (body.fundedAt) {
      const d = new Date(body.fundedAt)
      if (isNaN(d)) return NextResponse.json({ error: 'Date is not valid' }, { status: 400 })
      fundedAt = d
    }

    const rate = meta.currency === 'USD' ? await usdRate() : null

    const { data, error } = await supabaseAdmin.from('provider_fundings').insert({
      provider: body.provider,
      currency: meta.currency,
      amount,
      paid_ngn: paidNgn,
      rate,
      balance_after: balanceAfter,
      note: body.note ? String(body.note).slice(0, 200) : null,
      funded_at: fundedAt.toISOString(),
      created_by: auth.user.id,
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // Freeze the window this top-up just closed (best effort).
    try { await build(request) } catch (e) { console.error('provider-profit freeze error:', e) }
    return NextResponse.json({ ok: true, funding: data })
  } catch (e) {
    console.error('provider-profit POST error:', e)
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const auth = await requireAdmin()
    if (auth.res) return auth.res
    const id = new URL(request.url).searchParams.get('id') || ''
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    const { data: row } = await supabaseAdmin.from('provider_fundings').select('provider, funded_at').eq('id', id).single()
    const { error } = await supabaseAdmin.from('provider_fundings').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (row) {
      // The window before the deleted entry now ends later: clear its frozen result so it is recalculated.
      const { data: prev } = await supabaseAdmin.from('provider_fundings').select('id').eq('provider', row.provider).lt('funded_at', row.funded_at).order('funded_at', { ascending: false }).limit(1)
      if (prev?.[0]) {
        await supabaseAdmin.from('provider_fundings').update({ closed_at: null, final_revenue: null, final_cost: null, final_profit: null, final_orders: null, final_end_balance: null }).eq('id', prev[0].id)
      }
      // The deleted entry's own window merged into the previous one; the next call re-freezes it.
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 })
  }
}