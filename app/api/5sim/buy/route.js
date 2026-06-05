// app/api/5sim/buy/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const { country, service, userId, priceNgn } = await request.json()

    if (!country || !service || !userId || !priceNgn) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check user wallet balance
    const { data: profile } = await supabase
      .from('profiles')
      .select('wallet_balance, email, full_name')
      .eq('id', userId)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (profile.wallet_balance < priceNgn) {
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
      const err = await res.text()
      console.error('5SIM buy error:', err)
      return NextResponse.json({ error: 'No numbers available. Try another country.' }, { status: 400 })
    }

    const numberData = await res.json()

    // Deduct from wallet
    const newBalance = profile.wallet_balance - priceNgn
    await supabase
      .from('profiles')
      .update({ wallet_balance: newBalance })
      .eq('id', userId)

    // Save order
    const { data: order } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
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
          expires: new Date(Date.now() + 20 * 60 * 1000).toISOString(), // 20 min expiry
        }
      })
      .select()
      .single()

    // Save transaction
    await supabase.from('transactions').insert({
      user_id: userId,
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
      expires_in: 1200, // 20 minutes in seconds
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