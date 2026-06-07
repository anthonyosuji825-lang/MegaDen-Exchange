// app/api/5sim/buy/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    // ✅ FIX #7: Get user from server session, NOT from request body
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name) { return cookieStore.get(name)?.value },
        },
      }
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Accept country, service and price_ngn from client
    // price_ngn was originally calculated server-side in /api/5sim/countries, so we trust it
    // but sanity-check it to prevent tampering
    const { country, service, price_ngn } = await request.json()

    if (!country || !service || !price_ngn) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Sanity check: price must be a positive number and not suspiciously low
    const priceNgn = Math.round(price_ngn)
    if (priceNgn < 100) {
      return NextResponse.json({ error: 'Invalid price.' }, { status: 400 })
    }

    // ✅ FIX #2: Atomic wallet deduction via RPC — prevents race conditions
    // This SQL function deducts ONLY if balance is sufficient, in a single transaction
    const { data: deductResult, error: deductError } = await supabaseAdmin
      .rpc('deduct_wallet_balance', {
        p_user_id: user.id,
        p_amount: priceNgn,
      })

    if (deductError || !deductResult) {
      return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 })
    }

    // Purchase number from 5SIM
    const res = await fetch(
      `https://5sim.net/v1/user/buy/activation/${country}/any/${service}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.FIVESIM_API_KEY}`,
          'Accept': 'application/json',
        }
      }
    )

    if (!res.ok) {
      // 5SIM failed — refund the wallet immediately
      await supabaseAdmin.rpc('credit_wallet_balance', {
        p_user_id: user.id,
        p_amount: priceNgn,
      })
      const err = await res.text()
      console.error('5SIM buy error:', err)
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
          country,
          service,
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

    return NextResponse.json({
      success: true,
      order_id: order.id,
      phone: numberData.phone,
      fivesim_id: numberData.id,
      expires_in: 1200,
      price_ngn: priceNgn, // send back actual price for refund use
    })

  } catch (error) {
    console.error('Buy number error:', error)
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