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

// Looks up a fixed package's own definition (including its real quantity)
// directly from the catalog, by package_id. This is the source of truth for
// how much a non-custom order actually delivers — the client's submitted
// `quantity` is never used for this branch, because trusting it would let
// someone pass a cheap package_id (which passes the price check) alongside
// an arbitrary large quantity, getting a big order at a small package's price.
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

    // Fetch user profile for richer logs
    const { data: profile } = await supabaseAdmin.from('profiles').select('email, full_name, wallet_balance').eq('id', user.id).single()
    const userEmail = profile?.email || user.email || null

    const { service_id, link, quantity, price_ngn, package_name, platform, package_id, is_custom, idempotency_key } = await request.json()

    if (!service_id || !link || !quantity || !price_ngn || !package_id) {
      await log('warning', 'boost', 'Boost order attempted with missing fields', user.id, userEmail, {
        service_id, link, quantity, price_ngn, package_id,
      })
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // ── Idempotency: if this exact checkout attempt already went through
    // (client retried after a dropped response, a double-tap slipped past
    // the disabled button, etc.), return the original result instead of
    // charging the wallet and placing a second order.
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
          jap_order_id: existing.details?.jap_order_id,
          message: 'Your boost has already been placed and is processing.',
        })
      }
    }

    // This is the client-submitted quantity. For custom orders it's the
    // real, authoritative quantity (fully bounded below by the tier range).
    // For fixed orders it's NOT trusted for the actual order — see
    // `orderQuantity` further down.
    const submittedQty = Number(quantity)
    if (!Number.isFinite(submittedQty) || submittedQty <= 0 || !Number.isInteger(submittedQty)) {
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
    // The quantity that will actually be sent to the supplier and stored.
    // Determined per-branch below — never taken directly from client input
    // for fixed packages.
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
      // Custom orders: the client's quantity IS the real quantity — it's
      // fully bounded above and price is derived directly from it.
      orderQuantity = submittedQty
    } else {
      const pkgDef = getPackageDefinition(TURBO_SERVICES, package_id)
      if (!pkgDef) {
        await log('warning', 'boost', 'Boost order references an unknown package', user.id, userEmail, { service_id, package_id })
        return NextResponse.json({ error: 'Unknown package. Please refresh and try again.' }, { status: 400 })
      }
      expectedPrice = getDefaultPackagePrice(TURBO_SERVICES, package_id, priceMap)
      // Fixed-package orders always use the catalog's own quantity for this
      // package_id — never the client's submitted value. See
      // getPackageDefinition's comment for why.
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

    // The actual charge is always the server-recomputed expectedPrice —
    // never the client-submitted price_ngn. price_ngn is only used above as
    // a floor to catch tampering (submitting less than expected).
    const priceNgn = expectedPrice

    // Check-and-deduct happen as a single atomic DB operation, so two
    // concurrent requests from the same user can't both read the same
    // starting balance and both succeed.
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

    // ── Place order on the panel. The fetch, the JSON parse, a non-2xx
    // response, an explicit `error` field, and a missing `order` id are ALL
    // treated as the same failure and refunded the same way — nothing here
    // is assumed to have succeeded just because it didn't throw. Previously
    // only an explicit `japData.error` triggered a refund, so a thrown
    // exception (timeout, dropped connection, non-JSON response during an
    // outage) skipped the refund entirely and fell through to the generic
    // catch-all below, which never refunds.
    let japData
    try {
      const formData = new URLSearchParams()
      formData.append('key', EXO_API_KEY)
      formData.append('action', 'add')
      formData.append('service', service_id)
      formData.append('link', link)
      formData.append('quantity', orderQuantity)

      const japRes = await fetch(EXO_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      })

      japData = await japRes.json()

      if (!japRes.ok || japData.error || !japData.order) {
        throw new Error(japData?.error || `Panel returned ${japRes.status} with no order id`)
      }
    } catch (panelError) {
      // Refund wallet — increments off the current balance rather than
      // overwriting with a stale snapshot, so it's safe regardless of
      // anything else that may have touched the balance in between.
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

    // Save order. At this point the wallet has already been debited and
    // the order has already been placed with the supplier — a failure here
    // is NOT the same as a normal validation failure. We must not let it
    // fall through to the generic catch block, which would tell the user
    // "order failed" while they were actually charged and the boost is
    // already running on EXO's side.
    const { data: order, error: orderInsertError } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: user.id,
        product_type: 'boost',
        product_name: `${platform} - ${package_name}`,
        amount: priceNgn,
        status: 'processing',
        idempotency_key: idempotency_key || null,
        details: { jap_order_id: japData.order, service_id, link, quantity: orderQuantity, platform, package_name }
      })
      .select()
      .single()

    if (orderInsertError || !order) {
      // Refund the wallet so the user isn't left out of pocket for an order
      // we have no record of, then log this loudly — it needs a human to
      // reconcile against the supplier order id, not just a warning.
      const { error: refundError } = await supabaseAdmin.rpc('refund_wallet_balance', { p_user_id: user.id, p_amount: priceNgn })

      await log('error', 'boost', `CRITICAL: order placed on EXO but failed to save locally — wallet refund ${refundError ? 'FAILED' : 'succeeded'}, needs manual reconciliation`, user.id, userEmail, {
        jap_order_id: japData.order, service_id, link, quantity: orderQuantity,
        platform, package_name, amount_ngn: priceNgn,
        db_error: orderInsertError?.message,
        refund_error: refundError?.message,
      })

      return NextResponse.json(
        { error: 'Your order was placed but we had trouble saving it. Your wallet has been refunded — please contact support if the boost still runs.' },
        { status: 500 }
      )
    }

    // Save transaction
    const { error: txnInsertError } = await supabaseAdmin.from('transactions').insert({
      user_id: user.id,
      type: 'debit',
      amount: priceNgn,
      description: `${platform} Boost - ${package_name}`,
      reference: `BOOST-${japData.order}-${Date.now()}`,
      status: 'success',
    })

    if (txnInsertError) {
      // The order itself is safely saved at this point, so we don't refund
      // or fail the request — we just need to know the audit trail has a gap.
      await log('error', 'boost', `Order saved but transaction record failed to save`, user.id, userEmail, {
        order_id: order.id, jap_order_id: japData.order, amount_ngn: priceNgn,
        db_error: txnInsertError.message,
      })
    }

    // ✅ Success log
    await log('info', 'boost', `Boost order placed — ${platform} · ${package_name}`, user.id, userEmail, {
      jap_order_id: japData.order,
      service_id, link, quantity: orderQuantity,
      platform, package_name,
      amount_ngn: priceNgn,
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