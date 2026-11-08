// app/api/numbers/rent/buy/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { log } from '@/lib/logger'
import { listRentDurations, buyRentNumber } from '@/lib/providers/fleexaRent'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const VALID_MONTHS = [1, 3, 12] // matches the thirtyDay/ninetyDay/oneYear tiers

async function getMarkupSettings() {
  const { data } = await supabaseAdmin.from('app_settings').select('key, value')
  const map = {}
  ;(data || []).forEach((s) => { map[s.key] = s.value })
  return {
    fleexaMarkupPercent: parseFloat(map.fleexa_markup_percent || '15'),
    fleexaRentMarginPercent: parseFloat(map.fleexa_rent_margin_percent || '50'),
  }
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, wallet_balance')
      .eq('id', user.id)
      .single()
    const userEmail = profile?.email || user.email || null
    const walletBalance = profile?.wallet_balance || 0

    const { appName, months, autoRenew } = await request.json()
    if (!appName || !months) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!VALID_MONTHS.includes(months)) {
      return NextResponse.json({ error: `months must be one of ${VALID_MONTHS.join(', ')}` }, { status: 400 })
    }

    // ── Quote (read-only, real tiered pricing) — this replaces the
    // earlier priceNgn * months estimate now that Fleexa confirmed
    // /rent/durations gives the actual tier price directly.
    const settings = await getMarkupSettings()
    const durationsResult = await listRentDurations(appName, settings)
    if (!durationsResult.ok) {
      return NextResponse.json({ error: 'Pricing is currently unavailable for this service.' }, { status: 400 })
    }
    const tier = durationsResult.tiers[months]
    if (!tier || tier.priceNgn === null) {
      return NextResponse.json({ error: 'Selected duration is not available for this service.' }, { status: 400 })
    }

    if (walletBalance < tier.priceNgn) {
      await log('warning', 'wallet', 'Insufficient wallet balance for rental (caught before provider purchase)', user.id, userEmail, {
        feature: 'rent_numbers', quoted_amount: tier.priceNgn, wallet_balance: walletBalance, appName, months,
      })
      return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 })
    }

    // ── Buy ──
    const purchase = await buyRentNumber({ appName, months, autoRenew: Boolean(autoRenew) })
    if (!purchase.ok) {
      await log('warning', 'number', 'Rental purchase failed', user.id, userEmail, {
        feature: 'rent_numbers', appName, months, errorType: purchase.errorType, message: purchase.errorMessage,
      })
      const status = purchase.errorType === 'BALANCE_ERROR' ? 502 : 400
      return NextResponse.json({ error: purchase.errorMessage || 'No rental available right now. Please try again.' }, { status })
    }

    // What Fleexa actually charges YOU should match tier.costNgn (the
    // raw wholesale price) — NOT tier.priceNgn, which now includes your
    // markup and is what the CUSTOMER pays. Comparing amountPaidNgn
    // against costNgn here validates Fleexa billed you what you
    // expected; the customer is always charged tier.priceNgn regardless
    // of what Fleexa's response says, since that's the price quoted to
    // them upfront.
    const chargeNgn = tier.priceNgn
    const actualCostNgn = purchase.amountPaidNgn ?? tier.costNgn
    if (purchase.amountPaidNgn !== null && purchase.amountPaidNgn !== tier.costNgn) {
      await log('warning', 'number', 'Rental cost mismatch — what Fleexa actually charged us does not match the /rent/durations quote', user.id, userEmail, {
        feature: 'rent_numbers', quoted_cost: tier.costNgn, actual_cost: purchase.amountPaidNgn, sell_price: chargeNgn, appName, months,
      }).catch(() => {})
    }

    // ── Deduct wallet (atomic) ──
    const { data: deductResult, error: deductError } = await supabaseAdmin
      .rpc('deduct_wallet_balance', { p_user_id: user.id, p_amount: chargeNgn })

    if (deductError || !deductResult) {
      // No confirmed refund path for a failed post-purchase deduction
      // — Fleexa's own email is contradictory on whether these
      // rentals can even be cancelled. Log at 'error' (with the phone,
      // Fleexa's rental id and the user, everything needed to resolve it
      // by hand) rather than guessing.
      await log('error', 'wallet', 'Rental purchased from Fleexa but wallet deduction failed — refund/cancel support is unconfirmed, needs manual resolution', user.id, userEmail, {
        feature: 'rent_numbers', attempted_amount: chargeNgn, appName, months, external_id: purchase.externalId, phone: purchase.phone,
      })

      // Deliberately NOT inserting a placeholder order row here (an earlier
      // version did, with status 'unresolved_billing'). The database has
      // AFTER INSERT triggers on orders that fire regardless of status:
      // notify_on_order would tell the customer "Order Placed Successfully"
      // right after this error, and process_referral_reward would treat the
      // row as the user's first-ever order and pay the referrer ₦500 for a
      // purchase that was never paid (and use up the user's real first
      // order). The error log above already carries the recovery details.

      return NextResponse.json({ error: 'Purchase could not be completed. Please contact support.' }, { status: 500 })
    }

    // ── Finalize ──
    const expiresAt = purchase.providerExpiresAt
      || new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: user.id,
        product_type: 'number_rental',
        product_name: `Rental — ${appName} (${months}mo)`,
        amount: chargeNgn,
        status: 'active',
        details: {
          provider: 'fleexa_rent',
          external_id: purchase.externalId,
          phone: purchase.phone,
          appName,
          months,
          auto_renew: Boolean(autoRenew),
          expires: expiresAt,
          cost_ngn: actualCostNgn, // what Fleexa charged you — for margin reporting; amount above is what the customer paid
          messages: [],
        },
      })
      .select()
      .single()

    if (orderError || !order) {
      // The number is already bought and the wallet already debited,
      // so this is the worst place to fail silently — previously the
      // insert's error was ignored and the route returned success with
      // no saved order (a paid-for number the user could never see or
      // poll). Most likely cause: a CHECK constraint or enum on
      // orders.status / orders.product_type that doesn't allow the new
      // 'active' / 'number_rental' values. Log everything needed to
      // recover this by hand, and tell the user the truth.
      await log('error', 'wallet', 'Rental purchased and wallet debited, but saving the order row FAILED — needs manual recovery', user.id, userEmail, {
        feature: 'rent_numbers', order_error: orderError?.message, order_error_code: orderError?.code,
        phone: purchase.phone, external_id: purchase.externalId, appName, months,
        charged_ngn: chargeNgn, cost_ngn: actualCostNgn, expires: expiresAt,
      }).catch(() => {})

      return NextResponse.json({
        error: `Your number was purchased (${purchase.phone || 'number pending'}) but we couldn't save it to your account. Please contact support right away and quote this number.`,
        phone: purchase.phone,
      }, { status: 500 })
    }

    const { error: txError } = await supabaseAdmin.from('transactions').insert({
      user_id: user.id,
      type: 'debit',
      amount: chargeNgn,
      description: `Number rental — ${appName} (${months}mo)`,
      reference: `RENT-${purchase.externalId}-${Date.now()}`,
      status: 'success',
    })

    if (txError) {
      await log('error', 'wallet', 'Transaction log insert failed after successful rental purchase debit', user.id, userEmail, {
        feature: 'rent_numbers', order_id: order?.id, amount: chargeNgn, tx_error: txError.message,
      }).catch(() => {})
    }

    // No notification is created here on purpose. Your database already has
    // AFTER INSERT triggers on orders (on_order_created -> notify_on_order) and
    // transactions (on_transaction_created -> notify_on_transaction), and this
    // purchase inserts into both, so the bell is populated by the database.
    // An explicit insert here would just produce duplicate notifications.

    await log('info', 'number', `Number rental purchased — ${appName} (${months}mo)`, user.id, userEmail, {
      feature: 'rent_numbers', phone: purchase.phone, appName, months, amount_ngn: chargeNgn, order_id: order?.id,
    })

    return NextResponse.json({
      success: true,
      order_id: order?.id,
      phone: purchase.phone,
      expires_at: expiresAt,
      price_ngn: chargeNgn,
    })

  } catch (error) {
    console.error('[numbers/rent/buy]', error)
    await log('error', 'number', `Unhandled exception in rent/buy route: ${error.message}`, null, null, { feature: 'rent_numbers', stack: error.stack })
    return NextResponse.json({ error: 'Failed to purchase rental' }, { status: 500 })
  }
}