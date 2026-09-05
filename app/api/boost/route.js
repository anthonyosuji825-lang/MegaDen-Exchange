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

function getPackageDefinition(services, packageId) {
  for (const platform of services) {
    const pkg = platform.packages?.find(p => String(p.id) === String(packageId))
    if (pkg) return pkg
  }
  return null
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
      await log('warning', 'auth', 'Unauthorized attempt to place boost order', null, null, {})
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabaseAdmin.from('profiles').select('email, full_name, wallet_balance').eq('id', user.id).single()
    const userEmail = profile?.email || user.email || null

    const { service_id, link, quantity, price_ngn, package_name, platform, package_id, is_custom, idempotency_key } = await request.json()

    if (!service_id || !link || !quantity || !price_ngn || !package_id) {
      await log('warning', 'boost', 'Boost order attempted with missing fields', user.id, userEmail, {
        service_id, link, quantity, price_ngn, package_id,
      })
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (idempotency_key) {
      const { data: existing } = await supabaseAdmin
        .from('orders')
        .select('id, status, details')
        .eq('user_id', user.id)
        .eq('idempotency_key', idempotency_key)
        .maybeSingle()

      if (existing) {
        if (existing.status === 'failed') {
          return NextResponse.json({ error: 'Boost order failed. Please try again.' }, { status: 400 })
        }
        return NextResponse.json({
          success: true,
          order_id: existing.id,
          exo_order_id: existing.details?.exo_order_id,
          message: 'Your boost has already been placed and is processing.',
        })
      }
    }

    const submittedQty = Number(quantity)
    if (!Number.isFinite(submittedQty) || submittedQty <= 0 || !Number.isInteger(submittedQty)) {
      await log('warning', 'boost', 'Invalid quantity on boost order', user.id, userEmail, { quantity, package_id })
      return NextResponse.json({ error: 'Invalid quantity.' }, { status: 400 })
    }

    const { data: priceRows } = await supabaseAdmin.from('boost_prices').select('package_id, price')
    const priceMap = {}
    ;(priceRows || []).forEach(r => { priceMap[r.package_id] = r.price })

    let expectedPrice = null
    let orderQuantity = null

    if (is_custom || String(package_id).startsWith('custom_')) {
      const tiers = getFamilyTiers(TURBO_SERVICES, service_id, priceMap)
      if (tiers.length < 2) {
        await log('warning', 'boost', 'Custom amount attempted on a service with no valid tier range', user.id, userEmail, { service_id, package_id })
        return NextResponse.json({ error: 'Custom amount is not available for this service.' }, { status: 400 })
      }
      const min = tiers[0].quantity, max = tiers[tiers.length - 1].quantity
      if (submittedQty < min || submittedQty > max) {
        await log('warning', 'boost', 'Custom quantity outside allowed range', user.id, userEmail, { service_id, package_id, quantity: submittedQty, min, max })
        return NextResponse.json({ error: `Quantity must be between ${min} and ${max}.` }, { status: 400 })
      }
      expectedPrice = interpolatePrice(tiers, submittedQty)
      orderQuantity = submittedQty
    } else {
      const pkgDef = getPackageDefinition(TURBO_SERVICES, package_id)
      if (!pkgDef) {
        await log('warning', 'boost', 'Boost order references an unknown package', user.id, userEmail, { service_id, package_id })
        return NextResponse.json({ error: 'Unknown package. Please refresh and try again.' }, { status: 400 })
      }
      expectedPrice = getDefaultPackagePrice(TURBO_SERVICES, package_id, priceMap)
      orderQuantity = pkgDef.quantity
    }

    if (expectedPrice === null) {
      await log('warning', 'boost', 'Boost order references an unknown package', user.id, userEmail, { service_id, package_id })
      return NextResponse.json({ error: 'Unknown package. Please refresh and try again.' }, { status: 400 })
    }

    if (orderQuantity === null || orderQuantity === undefined) {
      await log('error', 'boost', 'Resolved package has no quantity defined — refusing to place order', user.id, userEmail, { service_id, package_id })
      return NextResponse.json({ error: 'Unknown package. Please refresh and try again.' }, { status: 400 })
    }

    if (Number(price_ngn) < expectedPrice) {
      await log('warning', 'boost', 'Possible price tampering detected on boost order', user.id, userEmail, {
        submitted_price: price_ngn, expected_price: expectedPrice, package_id, platform, package_name,
      })
      return NextResponse.json({ error: 'Invalid price. Please refresh and try again.' }, { status: 400 })
    }

    if (expectedPrice < 100) {
      await log('warning', 'boost', 'Suspiciously low price on boost order', user.id, userEmail, { expected_price: expectedPrice, package_id })
      return NextResponse.json({ error: 'Invalid price.' }, { status: 400 })
    }

    const priceNgn = expectedPrice

    const { data: deductResult, error: deductError } = await supabaseAdmin
      .rpc('deduct_wallet_balance', { p_user_id: user.id, p_amount: priceNgn })
      .single()

    if (deductError) {
      await log('error', 'wallet', 'Wallet deduction RPC failed', user.id, userEmail, {
        db_error: deductError.message, attempted_amount: priceNgn, platform, package_name,
      })
      return NextResponse.json({ error: 'Failed to place boost order' }, { status: 500 })
    }

    if (!deductResult.success) {
      await log('warning', 'wallet', 'Insufficient balance for boost order', user.id, userEmail, {
        balance: deductResult.new_balance, attempted_amount: priceNgn, platform, package_name,
      })
      return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 })
    }

    // ── Place order on Exosupplier. The fetch, the JSON parse, a non-2xx
    // response, an explicit `error` field, and a missing `order` id are ALL
    // treated as the same failure and refunded the same way.
    let exoData
    try {
      const formData = new URLSearchParams()
      formData.append('key', EXO_API_KEY)
      formData.append('action', 'add')
      formData.append('service', service_id)
      formData.append('link', link)
      formData.append('quantity', orderQuantity)

      const exoRes = await fetch(EXO_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      })

      exoData = await exoRes.json()

      if (!exoRes.ok || exoData.error || !exoData.order) {
        throw new Error(exoData?.error || `Panel returned ${exoRes.status} with no order id`)
      }
    } catch (panelError) {
      const { error: refundError } = await supabaseAdmin.rpc('refund_wallet_balance', { p_user_id: user.id, p_amount: priceNgn })
      if (refundError) {
        await log('error', 'wallet', 'CRITICAL: refund RPC failed after panel failure — user was charged with no order placed', user.id, userEmail, {
          db_error: refundError.message, amount_ngn: priceNgn, service_id, link,
        })
      }

      await log('error', 'boost', `Boost panel order failed — wallet refunded`, user.id, userEmail, {
        panel_error: panelError.message, service_id, link, quantity: orderQuantity,
        platform, package_name, amount_ngn: priceNgn,
      })

      return NextResponse.json({ error: 'Boost order failed. Please try again.' }, { status: 400 })
    }

    const { data: order, error: orderInsertError } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: user.id,
        product_type: 'boost',
        product_name: `${platform} - ${package_name}`,
        amount: priceNgn,
        status: 'processing',
        idempotency_key: idempotency_key || null,
        details: { exo_order_id: exoData.order, service_id, link, quantity: orderQuantity, platform, package_name }
      })
      .select()
      .single()

    if (orderInsertError || !order) {
      const { error: refundError } = await supabaseAdmin.rpc('refund_wallet_balance', { p_user_id: user.id, p_amount: priceNgn })

      await log('error', 'boost', `CRITICAL: order placed on EXO but failed to save locally — wallet refund ${refundError ? 'FAILED' : 'succeeded'}, needs manual reconciliation`, user.id, userEmail, {
        exo_order_id: exoData.order, service_id, link, quantity: orderQuantity,
        platform, package_name, amount_ngn: priceNgn,
        db_error: orderInsertError?.message,
        refund_error: refundError?.message,
      })

      return NextResponse.json(
        { error: 'Your order was placed but we had trouble saving it. Your wallet has been refunded — please contact support if the boost still runs.' },
        { status: 500 }
      )
    }

    const { error: txnInsertError } = await supabaseAdmin.from('transactions').insert({
      user_id: user.id,
      type: 'debit',
      amount: priceNgn,
      description: `${platform} Boost - ${package_name}`,
      reference: `BOOST-${exoData.order}-${Date.now()}`,
      status: 'success',
    })

    if (txnInsertError) {
      await log('error', 'boost', `Order saved but transaction record failed to save`, user.id, userEmail, {
        order_id: order.id, exo_order_id: exoData.order, amount_ngn: priceNgn,
        db_error: txnInsertError.message,
      })
    }

    await log('info', 'boost', `Boost order placed — ${platform} · ${package_name}`, user.id, userEmail, {
      exo_order_id: exoData.order,
      service_id, link, quantity: orderQuantity,
      platform, package_name,
      amount_ngn: priceNgn,
      order_id: order.id,
    })

    return NextResponse.json({
      success: true,
      order_id: order.id,
      exo_order_id: exoData.order,
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