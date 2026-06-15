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

    // Fetch user email for richer logs
    const { data: profile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', user.id).single()
    const userEmail = profile?.email || user.email || null
    const userName = profile?.full_name || 'Unknown'

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

    // Atomic wallet deduction
    const { data: deductResult, error: deductError } = await supabaseAdmin
      .rpc('deduct_wallet_balance', { p_user_id: user.id, p_amount: priceNgn })

    if (deductError || !deductResult) {
      await log('warning', 'wallet', 'Insufficient wallet balance for number purchase', user.id, userEmail, {
        attempted_amount: priceNgn, country, service, rpc_error: deductError?.message,
      })
      return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 })
    }

    // Purchase number from 5SIM
    const res = await fetch(
      `https://5sim.net/v1/user/buy/activation/${country}/any/${service}`,
      { method: 'GET', headers: { 'Authorization': `Bearer ${process.env.FIVESIM_API_KEY}`, 'Accept': 'application/json' } }
    )

    if (!res.ok) {
      // Refund wallet
      await supabaseAdmin.rpc('credit_wallet_balance', { p_user_id: user.id, p_amount: priceNgn })
      const errText = await res.text()

      await log('error', 'number', '5sim API failed to return a number — wallet refunded', user.id, userEmail, {
        country, service, price_ngn: priceNgn, http_status: res.status, fivesim_error: errText,
      })

      return NextResponse.json({ error: 'No numbers available. Try another country.' }, { status: 400 })
    }

    const numberData = await res.json()

    // Save order
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

    // Save transaction
    await supabaseAdmin.from('transactions').insert({
      user_id: user.id,
      type: 'debit',
      amount: priceNgn,
      description: `${formatCountryName(country)} Number - ${service}`,
      reference: `NUM-${numberData.id}-${Date.now()}`,
      status: 'success',
    })

    // ✅ Success log
    await log('info', 'number', `Number purchased successfully — ${formatCountryName(country)} (${service})`, user.id, userEmail, {
      phone: numberData.phone,
      fivesim_id: numberData.id,
      country, service,
      operator: numberData.operator,
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

  } catch (error) {
    console.error('Buy number error:', error)
    await log('error', 'number', `Unhandled exception in number buy route: ${error.message}`, null, null, {
      stack: error.stack,
    })
    return NextResponse.json({ error: 'Failed to purchase number' }, { status: 500 })
  }
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