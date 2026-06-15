// app/api/boost/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { log } from '@/lib/logger'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const JAP_API_URL = 'https://justanotherpanel.com/api/v2'
const JAP_API_KEY = process.env.JAP_API_KEY

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
      await log('warning', 'auth', 'Unauthorized attempt to place boost order', null, null, {})
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user profile for richer logs
    const { data: profile } = await supabaseAdmin.from('profiles').select('email, full_name, wallet_balance').eq('id', user.id).single()
    const userEmail = profile?.email || user.email || null

    const { service_id, link, quantity, price_ngn, package_name, platform, package_id } = await request.json()

    if (!service_id || !link || !quantity || !price_ngn || !package_id) {
      await log('warning', 'boost', 'Boost order attempted with missing fields', user.id, userEmail, {
        service_id, link, quantity, price_ngn, package_id,
      })
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate price server-side
    const { data: priceRow } = await supabaseAdmin
      .from('boost_prices')
      .select('price')
      .eq('package_id', package_id)
      .single()

    const expectedPrice = priceRow?.price ?? null

    if (expectedPrice !== null && Number(price_ngn) < expectedPrice) {
      await log('warning', 'boost', 'Possible price tampering detected on boost order', user.id, userEmail, {
        submitted_price: price_ngn, expected_price: expectedPrice, package_id, platform, package_name,
      })
      return NextResponse.json({ error: 'Invalid price. Please refresh and try again.' }, { status: 400 })
    }

    if (price_ngn < 100) {
      await log('warning', 'boost', 'Suspiciously low price on boost order', user.id, userEmail, { price_ngn, package_id })
      return NextResponse.json({ error: 'Invalid price.' }, { status: 400 })
    }

    const balance = profile?.wallet_balance || 0
    if (balance < price_ngn) {
      await log('warning', 'wallet', 'Insufficient balance for boost order', user.id, userEmail, {
        balance, attempted_amount: price_ngn, platform, package_name,
      })
      return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 })
    }

    // Deduct wallet
    await supabaseAdmin
      .from('profiles')
      .update({ wallet_balance: balance - price_ngn })
      .eq('id', user.id)

    // Place order on JAP
    const formData = new URLSearchParams()
    formData.append('key', JAP_API_KEY)
    formData.append('action', 'add')
    formData.append('service', service_id)
    formData.append('link', link)
    formData.append('quantity', quantity)

    const japRes = await fetch(JAP_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    })

    const japData = await japRes.json()

    if (japData.error) {
      // Refund wallet
      await supabaseAdmin.from('profiles').update({ wallet_balance: balance }).eq('id', user.id)

      await log('error', 'boost', `JAP panel rejected boost order — wallet refunded`, user.id, userEmail, {
        jap_error: japData.error, service_id, link, quantity,
        platform, package_name, amount_ngn: price_ngn,
      })

      return NextResponse.json({ error: 'Boost order failed. Please try again.' }, { status: 400 })
    }

    // Save order
    const { data: order } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: user.id,
        product_type: 'boost',
        product_name: `${platform} - ${package_name}`,
        amount: price_ngn,
        status: 'processing',
        details: { jap_order_id: japData.order, service_id, link, quantity, platform, package_name }
      })
      .select()
      .single()

    // Save transaction
    await supabaseAdmin.from('transactions').insert({
      user_id: user.id,
      type: 'debit',
      amount: price_ngn,
      description: `${platform} Boost - ${package_name}`,
      reference: `BOOST-${japData.order}-${Date.now()}`,
      status: 'success',
    })

    // ✅ Success log
    await log('info', 'boost', `Boost order placed — ${platform} · ${package_name}`, user.id, userEmail, {
      jap_order_id: japData.order,
      service_id, link, quantity,
      platform, package_name,
      amount_ngn: price_ngn,
      order_id: order.id,
    })

    return NextResponse.json({
      success: true,
      order_id: order.id,
      jap_order_id: japData.order,
      message: `Your ${platform} boost has been placed and is now processing.`
    })

  } catch (error) {
    console.error('Boost order error:', error)
    await log('error', 'boost', `Unhandled exception in boost route: ${error.message}`, null, null, {
      stack: error.stack,
    })
    return NextResponse.json({ error: 'Failed to place boost order' }, { status: 500 })
  }
}