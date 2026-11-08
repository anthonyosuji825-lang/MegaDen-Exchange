// app/api/admin/balances/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Shared fetch options for every balance call:
// - cache: 'no-store' — Next.js Route Handlers can cache fetch() results,
//   and a balance panel that shows a stale number defeats its purpose.
// - a 10s timeout — one slow provider must not hang the whole panel.
const FETCH_OPTS = () => ({ cache: 'no-store', signal: AbortSignal.timeout(10000) })

function describeNetworkError(err) {
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') return 'Timed out after 10s'
  const code = err?.cause?.code || err?.code
  return code ? `Network error (${code})` : `Network error: ${String(err?.message || 'unknown').slice(0, 80)}`
}

// Each provider: which env vars it needs, how to call it, and where the
// balance lives in the response. Adding a provider = adding one entry.
// Keys below are the exact keys the admin page already reads
// (fivesim, jap, vpn) plus smspool — unchanged.
const PROVIDERS = [
  {
    key: 'fivesim',
    env: ['FIVESIM_API_KEY'],
    request: () => fetch('https://5sim.net/v1/user/profile', {
      headers: { Authorization: `Bearer ${process.env.FIVESIM_API_KEY}`, Accept: 'application/json' },
      ...FETCH_OPTS(),
    }),
    extract: (d) => d?.balance,
  },
  {
    key: 'jap',
    env: ['JAP_API_KEY'],
    request: () => fetch('https://justanotherpanel.com/api/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ key: process.env.JAP_API_KEY, action: 'balance' }).toString(),
      ...FETCH_OPTS(),
    }),
    extract: (d) => d?.balance,
  },
  {
    key: 'vpn',
    env: ['VPNRESELLERS_API_TOKEN'],
    request: () => fetch('https://api.vpnresellers.com/v3/reseller', {
      headers: { Authorization: `Bearer ${process.env.VPNRESELLERS_API_TOKEN}`, Accept: 'application/json' },
      ...FETCH_OPTS(),
    }),
    // API returns data.balance or top-level balance
    extract: (d) => d?.data?.balance ?? d?.balance,
  },
  {
    // SMSPool: endpoint and {"balance": "1.00"} response shape come from
    // community API-wrapper docs, not SMSPool's own official article (which
    // doesn't cover balance). Their docs say requests work as GET or POST;
    // the key is sent as a Bearer header (what lib/providers/smspool.js
    // uses) AND as a form field, since this endpoint's auth style isn't
    // officially confirmed. If it's wrong, the card now shows SMSPool's
    // own error text instead of a silent blank.
    key: 'smspool',
    env: ['SMSPOOL_API_KEY'],
    request: () => fetch('https://api.smspool.net/request/balance', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SMSPOOL_API_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({ key: process.env.SMSPOOL_API_KEY }).toString(),
      ...FETCH_OPTS(),
    }),
    extract: (d) => d?.balance,
  },
  {
    // Exo (exosupplier.com): URL and env var name are copied from
    // app/api/boost/route.js, which already places orders there. It is a
    // standard SMM-panel v2 API like JAP, so the balance call is the same
    // form with action=balance. NOTE: the boost route only uses
    // action=add, so `balance` is the standard action, not something
    // confirmed against Exo's own docs. Check the `currency` it returns
    // in /api/admin/balances before trusting the $ on the card.
    key: 'exo',
    env: ['EXO_API_KEY'],
    request: () => fetch('https://exosupplier.com/api/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ key: process.env.EXO_API_KEY, action: 'balance' }).toString(),
      ...FETCH_OPTS(),
    }),
    extract: (d) => d?.balance,
  },
  {
    // Fleexa: GET /balance from their Account docs. Base URL and Bearer
    // auth match lib/providers/fleexa.js. Balance is an NGN string, e.g.
    // "5000.00", returned nested (data.balance) and at top level.
    key: 'fleexa',
    env: ['FLEEXA_API_KEY'],
    request: () => fetch('https://fleexa.com.ng/developer/balance', {
      headers: { Authorization: `Bearer ${process.env.FLEEXA_API_KEY}`, Accept: 'application/json' },
      ...FETCH_OPTS(),
    }),
    extract: (d) => d?.data?.balance ?? d?.balance,
  },
]

// Never throws. Always returns { balance, error } — and `error` now says
// WHY (missing env var, timeout, DNS, HTTP status, or the provider's own
// error message) instead of a generic "Failed to fetch".
//
// "HTTP 200 but no balance" is treated as an error on purpose: SMM-panel
// style APIs (like JAP) commonly answer 200 with {"error": "..."} on
// failure, which the old parsing silently turned into a blank dash.
async function fetchBalance(p) {
  const missing = (p.env || []).filter((name) => !process.env[name])
  if (missing.length) return { balance: null, error: `Missing env var: ${missing.join(', ')}` }

  let res
  try {
    res = await p.request()
  } catch (err) {
    return { balance: null, error: describeNetworkError(err) }
  }

  let body = null
  try { body = await res.json() } catch { /* non-JSON body */ }

  const providerMsg = body?.error || body?.message
  if (!res.ok) {
    return { balance: null, error: `HTTP ${res.status}${providerMsg ? `: ${String(providerMsg).slice(0, 120)}` : ''}` }
  }

  const raw = p.extract(body)
  const num = Number(raw)
  if (raw === null || raw === undefined || raw === '' || !Number.isFinite(num)) {
    return { balance: null, error: providerMsg ? String(providerMsg).slice(0, 120) : 'Unexpected response (no balance field)' }
  }
  // currency is passed through (when the provider reports one) so the
  // JSON shows what unit each balance is really in.
  return { balance: num, currency: body?.currency ?? body?.data?.currency ?? null, error: null }
}

export async function GET(request) {
  try {
    // Auth — admin only
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

    // Check admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // All providers in parallel; fetchBalance never throws.
    const results = await Promise.all(PROVIDERS.map(fetchBalance))
    const out = {}
    PROVIDERS.forEach((p, i) => { out[p.key] = results[i] })

    return NextResponse.json(out)

  } catch (error) {
    console.error('Admin balances error:', error)
    return NextResponse.json({ error: 'Failed to fetch balances' }, { status: 500 })
  }
}