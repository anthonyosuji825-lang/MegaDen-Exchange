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

// Picks the best REAL operator for a country+service combo.
// Mirrors the logic in /api/5sim/countries — excludes 'any' and skips
// 0-stock / suspiciously cheap entries, then picks the operator with
// the highest stock among the well-priced ones (most reliable in practice).
async function pickBestOperator(country, service) {
  const res = await fetch(
    `https://5sim.net/v1/guest/prices?country=${country}&product=${service}`,
    { headers: { 'Authorization': `Bearer ${process.env.FIVESIM_API_KEY}`, 'Accept': 'application/json' } }
  )
  if (!res.ok) return null

  const data = await res.json()
  const operators = data?.[country]?.[service]
  if (!operators) return null

  let best = null
  for (const [operator, info] of Object.entries(operators)) {
    // Skip 'any' — lets 5sim pick randomly, often picks virtual
    if (operator === 'any') continue
    // Skip ALL virtual* operators — Virtual53, Virtual62, virtual21, etc.
    // These operators accept purchases but consistently fail to deliver SMS content.
    // They show high stock counts which makes them look attractive but they are unreliable.
    if (operator.toLowerCase().startsWith('virtual')) continue
    // Skip zero stock or suspiciously cheap
    if (!info || info.count === 0) continue
    if (info.cost < 0.10) continue

    // Pick the real operator with the most stock
    if (!best || info.count > best.count) {
      best = { operator, cost: info.cost, count: info.count }
    }
  }
  return best
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
      await log('warning', 'auth', 'Unauthorized attempt to buy number — no valid session', null, null, {})
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', user.id).single()
    const userEmail = profile?.email || user.email || null

    const { country, service, price_ngn } = await request.json()

    if (!country || !service || !price_ngn) {
      await log('warning', 'number', 'Number purchase attempted with missing fields', user.id, userEmail, { country, service, price_ngn })
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const priceNgn = Math.round(price_ngn)
    if (priceNgn < 100) {
      await log('warning', 'number', 'Suspicious low price submitted for number purchase', user.id, userEmail, { price_ngn, country, service })
      return NextResponse.json({ error: 'Invalid price.' }, { status: 400 })
    }

    // ── Pick a real, named operator instead of trusting "any" ──
    // "any" lets 5sim hand out thin "virtual*" operators that accept the
    // purchase but rarely deliver a real SMS — this is the #1 cause of
    // numbers that buy fine but never receive a code (common on USA/CA/UK).
    const chosenOperator = await pickBestOperator(country, service)
    const operatorToUse = chosenOperator?.operator || 'any' // graceful fallback if lookup fails

    if (!chosenOperator) {
      await log('warning', 'number', 'No reliable named operator found — falling back to "any"', user.id, userEmail, {
        country, service,
      })
    }

    // Atomic wallet deduction
    const { data: deductResult, error: deductError } = await supabaseAdmin
      .rpc('deduct_wallet_balance', { p_user_id: user.id, p_amount: priceNgn })

    if (deductError || !deductResult) {
      await log('warning', 'wallet', 'Insufficient wallet balance for number purchase', user.id, userEmail, {
        attempted_amount: priceNgn, country, service, rpc_error: deductError?.message,
      })
      return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 })
    }

    // Purchase number from 5SIM using the specific operator we picked
    const res = await fetch(
      `https://5sim.net/v1/user/buy/activation/${country}/${operatorToUse}/${service}`,
      { method: 'GET', headers: { 'Authorization': `Bearer ${process.env.FIVESIM_API_KEY}`, 'Accept': 'application/json' } }
    )

    if (!res.ok) {
      // If the specific operator failed (e.g. just sold out), retry once with "any"
      // as a last resort rather than failing the purchase outright
      if (operatorToUse !== 'any') {
        const retryRes = await fetch(
          `https://5sim.net/v1/user/buy/activation/${country}/any/${service}`,
          { method: 'GET', headers: { 'Authorization': `Bearer ${process.env.FIVESIM_API_KEY}`, 'Accept': 'application/json' } }
        )
        if (retryRes.ok) {
          const retryData = await retryRes.json()
          return await finalizeOrder({ retryData, country, service, priceNgn, user, userEmail, operatorUsed: 'any (fallback)' })
        }
      }

      // Refund wallet
      await supabaseAdmin.rpc('credit_wallet_balance', { p_user_id: user.id, p_amount: priceNgn })
      const errText = await res.text()

      await log('error', 'number', '5sim API failed to return a number — wallet refunded', user.id, userEmail, {
        country, service, operator_attempted: operatorToUse, price_ngn: priceNgn, http_status: res.status, fivesim_error: errText,
      })

      return NextResponse.json({ error: 'No numbers available. Try another country.' }, { status: 400 })
    }

    const numberData = await res.json()
    return await finalizeOrder({ retryData: numberData, country, service, priceNgn, user, userEmail, operatorUsed: operatorToUse })

  } catch (error) {
    console.error('Buy number error:', error)
    await log('error', 'number', `Unhandled exception in number buy route: ${error.message}`, null, null, {
      stack: error.stack,
    })
    return NextResponse.json({ error: 'Failed to purchase number' }, { status: 500 })
  }
}

// Shared finishing logic — saves order, transaction, and logs success
async function finalizeOrder({ retryData: numberData, country, service, priceNgn, user, userEmail, operatorUsed }) {
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
        country, service,
        operator: numberData.operator,
        expires: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
      }
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

  await log('info', 'number', `Number purchased successfully — ${formatCountryName(country)} (${service})`, user.id, userEmail, {
    phone: numberData.phone,
    fivesim_id: numberData.id,
    country, service,
    operator: numberData.operator,
    operator_chosen_by_us: operatorUsed,
    amount_ngn: priceNgn,
    order_id: order.id,
  })

  return NextResponse.json({
    success: true,
    order_id: order.id,
    phone: numberData.phone,
    fivesim_id: numberData.id,
    expires_in: 1200,
    price_ngn: priceNgn,
  })
}

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