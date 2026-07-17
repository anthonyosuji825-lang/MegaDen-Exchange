// app/api/boost/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { log } from '@/lib/logger'
import { TURBO_SERVICES, interpolatePrice, getFamilyTiers, getDefaultPackagePrice } from '@/lib/boost-catalog'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const EXO_API_URL = 'https://exosupplier.com/api/v2'
const EXO_API_KEY = process.env.EXO_API_KEY

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

    const { service_id, link, quantity, price_ngn, package_name, platform, package_id, is_custom } = await request.json()

    if (!service_id || !link || !quantity || !price_ngn || !package_id) {
      await log('warning', 'boost', 'Boost order attempted with missing fields', user.id, userEmail, {
        service_id, link, quantity, price_ngn, package_id,
      })
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const qty = Number(quantity)
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
      await log('warning', 'boost', 'Invalid quantity on boost order', user.id, userEmail, { quantity, package_id })
      return NextResponse.json({ error: 'Invalid quantity.' }, { status: 400 })
    }

    // Pull any admin price overrides so the curve/lookup below always
    // reflects live pricing, not just the hardcoded catalog defaults.
    const { data: priceRows } = await supabaseAdmin.from('boost_prices').select('package_id, price')
    const priceMap = {}
    ;(priceRows || []).forEach(r => { priceMap[r.package_id] = r.price })

    // Server always recomputes the expected price itself — it never just
    // checks whether a matching row exists, because a missing row (e.g. a
    // custom package_id, or a fixed package_id the admin never priced)
    // must NOT be treated as "no check needed".
    let expectedPrice = null

    if (is_custom || String(package_id).startsWith('custom_')) {
      const tiers = getFamilyTiers(TURBO_SERVICES, service_id, priceMap)
      if (tiers.length < 2) {
        await log('warning', 'boost', 'Custom amount attempted on a service with no valid tier range', user.id, userEmail, { service_id, package_id })
        return NextResponse.json({ error: 'Custom amount is not available for this service.' }, { status: 400 })
      }
      const min = tiers[0].quantity, max = tiers[tiers.length - 1].quantity
      if (qty < min || qty > max) {
        await log('warning', 'boost', 'Custom quantity outside allowed range', user.id, userEmail, { service_id, package_id, quantity: qty, min, max })
        return NextResponse.json({ error: `Quantity must be between ${min} and ${max}.` }, { status: 400 })
      }
      expectedPrice = interpolatePrice(tiers, qty)
    } else {
      expectedPrice = getDefaultPackagePrice(TURBO_SERVICES, package_id, priceMap)
    }

    if (expectedPrice === null) {
      await log('warning', 'boost', 'Boost order references an unknown package', user.id, userEmail, { service_id, package_id })
      return NextResponse.json({ error: 'Unknown package. Please refresh and try again.' }, { status: 400 })
    }

    if (Number(price_ngn) < expectedPrice) {
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
    formData.append('key', EXO_API_KEY)
    formData.append('action', 'add')
    formData.append('service', service_id)
    formData.append('link', link)
    formData.append('quantity', qty)

    const japRes = await fetch(EXO_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    })

    const japData = await japRes.json()

    if (japData.error) {
      // Refund wallet
      await supabaseAdmin.from('profiles').update({ wallet_balance: balance }).eq('id', user.id)

      await log('error', 'boost', `JAP panel rejected boost order — wallet refunded`, user.id, userEmail, {
        jap_error: japData.error, service_id, link, quantity: qty,
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
        details: { jap_order_id: japData.order, service_id, link, quantity: qty, platform, package_name }
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
      service_id, link, quantity: qty,
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