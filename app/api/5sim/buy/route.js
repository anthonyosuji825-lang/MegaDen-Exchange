// app/api/5sim/buy/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { log } from '@/lib/logger'
import { formatCountryName, getFlag } from '@/lib/countries'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const OPERATOR_PRIORITY = {
  usa:    ['att', 'tmobile', 'verizon', 'sprint', 'metropcs'],
  canada: ['rogers', 'bell', 'telus', 'fido', 'koodo'],
}

async function getExpectedPriceNgn(country, service) {
  const [priceRes, settingsRes] = await Promise.all([
    fetch(`https://5sim.net/v1/guest/prices?country=${country}&product=${service}`, {
      headers: {
        'Authorization': `Bearer ${process.env.FIVESIM_API_KEY}`,
        'Accept': 'application/json',
      },
    }),
    supabaseAdmin.from('app_settings').select('key, value'),
  ])

  if (!priceRes.ok) return null
  const data = await priceRes.json()
  const operators = data?.[country]?.[service]
  if (!operators) return null

  let bestPrice = 0
  let totalStock = 0
  for (const [, info] of Object.entries(operators)) {
    if (!info || info.count === 0) continue
    totalStock += info.count
    if (info.cost > bestPrice) bestPrice = info.cost
  }
  if (totalStock === 0 || bestPrice === 0) return null

  const settingsMap = {}
  ;(settingsRes.data || []).forEach(s => { settingsMap[s.key] = s.value })
  const rate = parseFloat(settingsMap.usd_to_ngn_rate || process.env.USD_TO_NGN_RATE || '1600')
  const multiplier = parseFloat(settingsMap.markup_multiplier || '3.5')

  const displayPrice = Math.max(bestPrice, 0.50)
  return Math.ceil(displayPrice * rate * multiplier)
}

async function pickOperatorForCountry(country, service) {
  const priority = OPERATOR_PRIORITY[country]
  if (!priority) return null

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

  for (const op of priority) {
    const info = operators[op]
    if (info && info.count > 0) {
      return op
    }
  }

  return null
}

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

export async function POST(request) {
  try {
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

    const { country, service, price_ngn } = await request.json()

    if (!country || !service || !price_ngn) {
      await log('warning', 'number', 'Purchase attempted with missing fields', user.id, userEmail, { country, service, price_ngn })
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const expectedPriceNgn = await getExpectedPriceNgn(country, service)

    if (expectedPriceNgn === null) {
      await log('warning', 'number', 'Purchase attempted for a country/service with no live pricing', user.id, userEmail, { country, service, price_ngn })
      return NextResponse.json({ error: 'This number is no longer available. Please refresh and try again.' }, { status: 400 })
    }

    const submittedPriceNgn = Math.round(price_ngn)

    if (submittedPriceNgn < expectedPriceNgn) {
      await log('warning', 'number', 'Possible price tampering detected on number purchase', user.id, userEmail, {
        submitted_price: submittedPriceNgn, expected_price: expectedPriceNgn, country, service,
      })
      return NextResponse.json({ error: 'Invalid price. Please refresh and try again.' }, { status: 400 })
    }

    const priceNgn = expectedPriceNgn

    // ── Decide operator ──
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
      // ── FIXED: previously this refund call's result was never checked —
      // if it failed, the log said "wallet refunded" regardless, and the
      // user just saw a generic error while their money silently stayed
      // deducted. Now we branch on the actual result. ──────────────────────
      const { data: refundResult, error: refundError } = await supabaseAdmin
        .rpc('credit_wallet_balance', { p_user_id: user.id, p_amount: priceNgn })

      if (refundError || !refundResult) {
        const failRef = `FAILREFUND-${user.id}-${Date.now()}`
        await log('error', 'wallet', 'CRITICAL: refund failed after purchase failure — wallet NOT restored', user.id, userEmail, {
          attempted_amount: priceNgn, country, service, operator_attempted: operator,
          fivesim_error: result.error, rpc_error: refundError?.message, failure_reference: failRef,
        })
        return NextResponse.json({
          error: `Purchase failed and we could not automatically refund your wallet. Please contact support with reference ${failRef}.`,
        }, { status: 500 })
      }

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