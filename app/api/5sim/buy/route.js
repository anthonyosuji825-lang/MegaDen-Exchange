// app/api/5sim/buy/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { log } from '@/lib/logger'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Operator priority lists for problem countries ──────────────────────────
// USA and Canada are dominated by virtual operators on 5sim that accept
// purchases but don't deliver SMS. For these two countries only, we try
// known real carriers in priority order before falling back to 'any'.
// All other countries work fine with 'any' — don't touch them.

const OPERATOR_PRIORITY = {
  usa:    ['att', 'tmobile', 'verizon', 'sprint', 'metropcs'],
  canada: ['rogers', 'bell', 'telus', 'fido', 'koodo'],
}

// For USA/Canada: fetch available operators and pick the best real one.
// Returns the operator name string, or null if none found (caller falls back to 'any').
async function pickOperatorForCountry(country, service) {
  const priority = OPERATOR_PRIORITY[country]
  if (!priority) return null // Not a problem country — use 'any'

  let data
  try {
    const res = await fetch(
      `https://5sim.net/v1/guest/prices?country=${country}&product=${service}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.FIVESIM_API_KEY}`,
          'Accept': 'application/json',
        },
      }
    )
    if (!res.ok) return null
    data = await res.json()
  } catch {
    return null
  }

  const operators = data?.[country]?.[service]
  if (!operators) return null

  // Walk the priority list — first operator with stock wins
  for (const op of priority) {
    const info = operators[op]
    if (info && info.count > 0) {
      return op
    }
  }

  // None of our preferred operators had stock — let 5sim decide
  return null
}

// ── Purchase a number from 5sim ────────────────────────────────────────────
// Tries `operator` first. If that fails and operator wasn't already 'any',
// retries once with 'any'. Returns { ok, data, error, operatorUsed }.
async function purchaseNumber(country, operator, service) {
  const headers = {
    'Authorization': `Bearer ${process.env.FIVESIM_API_KEY}`,
    'Accept': 'application/json',
  }

  const res = await fetch(
    `https://5sim.net/v1/user/buy/activation/${country}/${operator}/${service}`,
    { method: 'GET', headers }
  )

  if (res.ok) {
    const data = await res.json()
    return { ok: true, data, operatorUsed: operator }
  }

  // First attempt failed — if we used a specific operator, retry with 'any'
  if (operator !== 'any') {
    const retryRes = await fetch(
      `https://5sim.net/v1/user/buy/activation/${country}/any/${service}`,
      { method: 'GET', headers }
    )
    if (retryRes.ok) {
      const data = await retryRes.json()
      return { ok: true, data, operatorUsed: 'any (fallback)' }
    }
    const retryErr = await retryRes.text()
    return { ok: false, error: retryErr, operatorUsed: 'any (fallback)' }
  }

  const err = await res.text()
  return { ok: false, error: err, operatorUsed: operator }
}

// ── Main handler ───────────────────────────────────────────────────────────

export async function POST(request) {
  try {
    // ── Auth ──
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { get(name) { return cookieStore.get(name)?.value } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) {
      await log('warning', 'auth', 'Unauthorized attempt to buy number', null, null, {})
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .single()

    const userEmail = profile?.email || user.email || null

    // ── Validate body ──
    const { country, service, price_ngn } = await request.json()

    if (!country || !service || !price_ngn) {
      await log('warning', 'number', 'Purchase attempted with missing fields', user.id, userEmail, { country, service, price_ngn })
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const priceNgn = Math.round(price_ngn)
    if (priceNgn < 100) {
      await log('warning', 'number', 'Suspiciously low price submitted', user.id, userEmail, { price_ngn, country, service })
      return NextResponse.json({ error: 'Invalid price.' }, { status: 400 })
    }

    // ── Decide operator ──
    // For USA/Canada: try to find a known real carrier with stock.
    // For everywhere else: use 'any' — it works reliably for most countries.
    const pickedOperator = await pickOperatorForCountry(country, service)
    const operator = pickedOperator || 'any'

    if (OPERATOR_PRIORITY[country] && !pickedOperator) {
      await log('warning', 'number', `No preferred operator found for ${country} — using 'any'`, user.id, userEmail, { country, service })
    }

    // ── Deduct wallet (atomic) ──
    const { data: deductResult, error: deductError } = await supabaseAdmin
      .rpc('deduct_wallet_balance', { p_user_id: user.id, p_amount: priceNgn })

    if (deductError || !deductResult) {
      await log('warning', 'wallet', 'Insufficient wallet balance', user.id, userEmail, {
        attempted_amount: priceNgn, country, service, rpc_error: deductError?.message,
      })
      return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 })
    }

    // ── Buy number ──
    const result = await purchaseNumber(country, operator, service)

    if (!result.ok) {
      // Refund wallet — purchase failed
      await supabaseAdmin.rpc('credit_wallet_balance', { p_user_id: user.id, p_amount: priceNgn })

      await log('error', 'number', '5sim failed to return a number — wallet refunded', user.id, userEmail, {
        country, service, operator_attempted: operator,
        price_ngn: priceNgn, fivesim_error: result.error,
      })

      return NextResponse.json({ error: 'No numbers available for this country. Try another.' }, { status: 400 })
    }

    // ── Finalize ──
    return await finalizeOrder({
      numberData: result.data,
      country,
      service,
      priceNgn,
      user,
      userEmail,
      operatorUsed: result.operatorUsed,
    })

  } catch (error) {
    console.error('[5sim/buy]', error)
    await log('error', 'number', `Unhandled exception in buy route: ${error.message}`, null, null, { stack: error.stack })
    return NextResponse.json({ error: 'Failed to purchase number' }, { status: 500 })
  }
}

// ── Finalize: save order + transaction, return response ───────────────────

async function finalizeOrder({ numberData, country, service, priceNgn, user, userEmail, operatorUsed }) {
  const { data: order } = await supabaseAdmin
    .from('orders')
    .insert({
      user_id: user.id,
      product_type: 'number',
      product_name: `${getFlag(country)} ${formatCountryName(country)} Number (${service})`,
      amount: priceNgn,
      status: 'pending',
      details: {
        fivesim_id: numberData.id,
        phone: numberData.phone,
        country,
        service,
        operator: numberData.operator,
        operator_chosen_by_us: operatorUsed,
        expires: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
      },
    })
    .select()
    .single()

  await supabaseAdmin.from('transactions').insert({
    user_id: user.id,
    type: 'debit',
    amount: priceNgn,
    description: `${formatCountryName(country)} Number - ${service}`,
    reference: `NUM-${numberData.id}-${Date.now()}`,
    status: 'success',
  })

  await log('info', 'number', `Number purchased — ${formatCountryName(country)} (${service})`, user.id, userEmail, {
    phone: numberData.phone,
    fivesim_id: numberData.id,
    country,
    service,
    operator_actual: numberData.operator,
    operator_chosen_by_us: operatorUsed,
    amount_ngn: priceNgn,
    order_id: order?.id,
  })

  return NextResponse.json({
    success: true,
    order_id: order?.id,
    phone: numberData.phone,
    fivesim_id: numberData.id,
    expires_in: 1200,
    price_ngn: priceNgn,
  })
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatCountryName(code) {
  const names = {
    usa: 'United States', uk: 'United Kingdom', russia: 'Russia',
    ukraine: 'Ukraine', canada: 'Canada', indonesia: 'Indonesia',
    india: 'India', brazil: 'Brazil', germany: 'Germany',
    france: 'France', philippines: 'Philippines', vietnam: 'Vietnam',
    nigeria: 'Nigeria', ghana: 'Ghana',
  }
  return names[code] || code.charAt(0).toUpperCase() + code.slice(1)
}

function getFlag(code) {
  const flags = {
    usa: '🇺🇸', uk: '🇬🇧', russia: '🇷🇺', ukraine: '🇺🇦', canada: '🇨🇦',
    indonesia: '🇮🇩', india: '🇮🇳', brazil: '🇧🇷', germany: '🇩🇪',
    france: '🇫🇷', philippines: '🇵🇭', vietnam: '🇻🇳', nigeria: '🇳🇬',
    ghana: '🇬🇭',
  }
  return flags[code] || '🌍'
}