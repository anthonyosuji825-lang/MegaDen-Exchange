// app/api/numbers/buy/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { log } from '@/lib/logger'
import { formatCountryName, getFlag } from '@/lib/countries'
import { getNumberSettings } from '@/lib/numberSettings'
import { buyBestAvailable, getBestPriceNgn, resolveExpiresAt, cancelOrder } from '@/lib/providers/orchestrator'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// One purchase per user+country+service at a time. A slow purchase invites
// repeat taps/reloads, and each extra request would buy (and charge for)
// another number. The first request keeps running; later identical ones are
// refused until it finishes. Per server instance (best effort on serverless),
// but it covers the common case of one user hammering Buy.
const buyInFlight = new Set()

export async function POST(request) {
  let guardKey = null
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
      .select('email, wallet_balance')
      .eq('id', user.id)
      .single()
    const userEmail = profile?.email || user.email || null
    const walletBalance = profile?.wallet_balance || 0

    const { country, service, expected_price_ngn } = await request.json()
    if (!country || !service) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // The price the customer was SHOWN. It is only ever used as a ceiling
    // — a veto on providers that would now charge more — and never as the
    // price itself: what gets charged is still whatever the winning
    // provider quotes, decided server-side. So a tampered value can't
    // buy anything cheaper than the real price; a too-low one just gets
    // the "price changed" response below. Missing/invalid (older clients)
    // = no ceiling, exactly the previous behaviour.
    const shownPriceNgn = Number(expected_price_ngn)
    const expectedPriceNgn = Number.isFinite(shownPriceNgn) && shownPriceNgn > 0 ? shownPriceNgn : null

    guardKey = `${user.id}:${country}:${service}`
    if (buyInFlight.has(guardKey)) {
      guardKey = null // not ours — don't clear the original request's lock
      return NextResponse.json({ error: 'Your previous purchase for this number is still being processed. Please wait — check your Orders before trying again.', code: 'PURCHASE_IN_PROGRESS' }, { status: 429 })
    }
    buyInFlight.add(guardKey)

    const settings = await getNumberSettings(supabaseAdmin)

    // ── Pre-purchase balance check against a REAL quote ──────────────
    // The country picker's displayed price can differ from what actually
    // gets charged — it's built from 5sim's catalog for most countries,
    // while the real purchase below can land on SMSPool or Fleexa, whose
    // pricing has no fixed relationship to 5sim's (SMSPool applies the
    // same rate/multiplier to a different USD quote; Fleexa's price_ngn
    // is a separate, already-marked-up figure with no multiplier at
    // all). That gap can run either direction and be several times
    // larger than any reasonable safety margin — so instead of trying to
    // make the display price universally accurate, get the same
    // provider-priority quote buyBestAvailable is about to use, and
    // check it BEFORE spending real money with a provider.
    //
    // This is read-only — getBestPriceNgn never purchases anything —
    // so it costs a little latency, not money, and it protects the
    // platform regardless of which provider ends up winning the buy.
    const quote = await getBestPriceNgn(country, service, settings)
    // With a ceiling, the most this purchase can possibly cost is the lower
    // of the two: a quote above what they were shown is vetoed below, not
    // charged. (If it is, they get a "price changed" prompt, not a
    // misleading "insufficient balance".)
    const maxPossibleCost = quote.ok && expectedPriceNgn !== null ? Math.min(quote.priceNgn, expectedPriceNgn) : quote.priceNgn
    if (quote.ok && walletBalance < maxPossibleCost) {
      await log('warning', 'wallet', 'Insufficient wallet balance (caught before provider purchase)', user.id, userEmail, {
        quoted_amount: quote.priceNgn, expected_price_ngn: expectedPriceNgn, wallet_balance: walletBalance, country, service, provider: quote.providerId,
      })
      return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 })
    }
    // If the quote itself failed (quote.ok === false), don't block the
    // purchase on it — that's usually a transient provider hiccup, and
    // buyBestAvailable below will either succeed with a fresh attempt or
    // fail on its own terms. The deduct-after-purchase check further
    // down remains as the backstop either way — this pre-check narrows
    // the window where it's needed, it doesn't replace it.

    // ── Find + buy in one pass across the provider priority list ──
    // Note: unlike the old 5sim-only route, we do NOT trust a client-
    // submitted price at all here — the price charged is always whatever
    // the winning provider actually quoted, decided server-side.
    const result = await buyBestAvailable(country, service, settings, expectedPriceNgn !== null ? { maxPriceNgn: expectedPriceNgn } : {})

    if (!result.ok) {
      // Nothing was bought. If the reason is that the remaining providers
      // now charge MORE than the customer was shown, say so and let them
      // confirm the new price, instead of silently charging it (or
      // reporting a misleading "no numbers available").
      const aboveLimit = (result.attempts || []).filter((a) => a.reason === 'PRICE_ABOVE_LIMIT' && Number.isFinite(a.priceNgn))
      if (aboveLimit.length > 0) {
        const newPriceNgn = Math.min(...aboveLimit.map((a) => a.priceNgn))
        await log('info', 'number', 'Price rose since it was listed — asked the customer to confirm instead of charging', user.id, userEmail, {
          country, service, shown_price_ngn: expectedPriceNgn, new_price_ngn: newPriceNgn, attempts: result.attempts,
        }).catch(() => {})
        return NextResponse.json({
          error: `The price for this number is now ₦${newPriceNgn.toLocaleString()} (it was ₦${expectedPriceNgn.toLocaleString()}). Review it and tap Buy again to confirm.`,
          code: 'PRICE_CHANGED',
          price_ngn: newPriceNgn,
        }, { status: 409 })
      }

      await log('warning', 'number', 'All providers failed for purchase attempt', user.id, userEmail, {
        country, service, attempts: result.attempts,
      })
      return NextResponse.json({ error: 'No numbers available for this country right now. Please try another.' }, { status: 400 })
    }

    // ── Deduct wallet (atomic) — only now that we know the real price ──
    // deduct_wallet_balance is declared RETURNS TABLE(success boolean,
    // new_balance numeric) and does NOT raise when funds are short — it
    // returns one row with success = false. Without .single(), supabase-js
    // hands back an ARRAY of rows, and an array is truthy even when it is
    // [{ success: false }]. The old check (`!deductResult`) could therefore
    // never fire: a refused deduction let the purchase through un-debited,
    // i.e. a free number that we had already paid the provider for.
    // .single() + .success is how app/api/boost/route.js reads this same
    // function (verified against its definition in Postgres).
    const { data: deductResult, error: deductError } = await supabaseAdmin
      .rpc('deduct_wallet_balance', { p_user_id: user.id, p_amount: result.priceNgn })
      .single()

    if (deductError || !deductResult?.success) {
      // We already bought the number from the provider at this point, and
      // the user has not paid for it — cancel it back immediately so we're
      // not left holding a number nobody paid for.
      const cancelResult = await cancelOrder(result.providerId, result.externalId)
        .catch((err) => ({ ok: false, message: err.message }))

      await log('warning', 'wallet', deductError
        ? 'Wallet deduction RPC failed after provider purchase'
        : 'Insufficient wallet balance (checked after provider purchase)', user.id, userEmail, {
        attempted_amount: result.priceNgn, balance: deductResult?.new_balance, country, service,
        provider: result.providerId, external_id: result.externalId,
        cancel_result: cancelResult, db_error: deductError?.message,
      })

      if (!cancelResult?.ok) {
        // Bought, unpaid, and the provider-side cancel did not go through
        // (or an SMS had already arrived). Make it impossible to miss.
        await log('error', 'wallet', 'CRITICAL: unpaid number could not be cancelled at the provider — needs manual cancel', user.id, userEmail, {
          provider: result.providerId, external_id: result.externalId, phone: result.phone,
          amount_ngn: result.priceNgn, cancel_result: cancelResult,
        })
      }

      if (deductError) {
        return NextResponse.json({ error: 'Failed to complete purchase. Please try again.' }, { status: 500 })
      }
      return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 })
    }

    // ── Finalize ──
    // Trust whatever the winning provider actually reported, instead of
    // assuming every provider gives the same 20 minutes. Fleexa's own
    // docs example shows a 5-minute window for a real purchase — if
    // that's genuine (not just an example), a hardcoded 20-minute
    // countdown here would show the user 15 more minutes than the
    // number actually has left.
    const expiresAt = resolveExpiresAt(result)

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: user.id,
        product_type: 'number',
        product_name: `${getFlag(country)} ${formatCountryName(country)} Number (${service})`,
        amount: result.priceNgn,
        status: 'pending',
        details: {
          provider: result.providerId,
          external_id: result.externalId,
          phone: result.phone,
          country,
          service,
          expires: expiresAt,
          provider_meta: result.meta,
        },
      })
      .select()
      .single()

    if (orderError || !order) {
      // The user has been DEBITED and a number has been BOUGHT, but there
      // is no order row — so the user can never see or poll the number
      // (the response below would carry order_id: undefined). Undo both:
      // cancel the number, and refund the wallet. Unlike a manual cancel,
      // the user was never shown this number (we return an error, no
      // phone), so refunding even if the provider-side cancel fails is
      // correct — a still-live number is then OUR cost to chase, not
      // theirs, and it's logged CRITICAL so it can't be missed.
      const cancelResult = await cancelOrder(result.providerId, result.externalId)
        .catch((err) => ({ ok: false, message: err.message }))

      const { data: refundOk, error: refundError } = await supabaseAdmin
        .rpc('credit_wallet_balance', { p_user_id: user.id, p_amount: result.priceNgn })

      if (refundError || !refundOk) {
        await log('error', 'wallet', 'CRITICAL: order insert failed AFTER wallet debit and the automatic refund ALSO failed — user is charged with no order, needs manual refund', user.id, userEmail, {
          amount_ngn: result.priceNgn, provider: result.providerId, external_id: result.externalId, phone: result.phone,
          order_error: orderError?.message, refund_error: refundError?.message, cancel_result: cancelResult,
        })
        return NextResponse.json({ error: 'Purchase could not be completed and your refund needs manual review. Please contact support.' }, { status: 500 })
      }

      const { error: refundTxError } = await supabaseAdmin.from('transactions').insert({
        user_id: user.id,
        type: 'credit',
        amount: result.priceNgn,
        description: `Refund — ${formatCountryName(country)} Number could not be recorded`,
        reference: `REFUND-${result.externalId}-${Date.now()}`,
        status: 'success',
      })
      if (refundTxError) {
        await log('error', 'wallet', 'Transaction log insert failed after order-insert-failure refund', user.id, userEmail, {
          amount: result.priceNgn, tx_error: refundTxError.message,
        }).catch(() => {})
      }

      await log('error', 'number', cancelResult?.ok
        ? 'Order insert failed after purchase — number cancelled and wallet refunded'
        : 'CRITICAL: order insert failed after purchase — wallet refunded but the provider-side cancel did NOT go through; number may still be live and billed, needs manual cancel', user.id, userEmail, {
        provider: result.providerId, external_id: result.externalId, phone: result.phone,
        amount_ngn: result.priceNgn, order_error: orderError?.message, cancel_result: cancelResult,
      })

      return NextResponse.json({ error: 'Failed to complete purchase. You have not been charged. Please try again.' }, { status: 500 })
    }

    const { error: txError } = await supabaseAdmin.from('transactions').insert({
      user_id: user.id,
      type: 'debit',
      amount: result.priceNgn,
      description: `${formatCountryName(country)} Number - ${service}`,
      reference: `NUM-${result.externalId}-${Date.now()}`,
      status: 'success',
    })

    if (txError) {
      // The wallet was already debited above via the checked RPC — this
      // is only the log entry. Don't fail a successful purchase over a
      // logging hiccup, but don't let the ledger silently drift either.
      await log('error', 'wallet', 'Transaction log insert failed after successful purchase debit', user.id, userEmail, {
        order_id: order.id, amount: result.priceNgn, tx_error: txError.message,
      }).catch(() => {})
    }

    await log('info', 'number', `Number purchased via ${result.providerId} — ${formatCountryName(country)} (${service})`, user.id, userEmail, {
      phone: result.phone, provider: result.providerId, country, service, amount_ngn: result.priceNgn, order_id: order.id,
      fallback_attempts: result.attempts,
    })

    return NextResponse.json({
      success: true,
      order_id: order.id,
      phone: result.phone,
      // Real remaining seconds as of right now, derived from the same
      // expiresAt used above — not a hardcoded 1200. Kept only as a
      // fallback/progress-bar-denominator value; expires_at (below) is
      // what actually drives the frontend's countdown.
      expires_in: Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000)),
      // Absolute deadline, not just a duration — this is what lets the
      // frontend derive its countdown from Date.now() vs a real
      // timestamp instead of a locally-decremented counter seeded once
      // at purchase time. Same value the GET poll route now also
      // returns on every tick, including after a reissue moves it.
      expires_at: expiresAt,
      price_ngn: result.priceNgn,
    })

  } catch (error) {
    console.error('[numbers/buy]', error)
    await log('error', 'number', `Unhandled exception in buy route: ${error.message}`, null, null, { stack: error.stack })
    return NextResponse.json({ error: 'Failed to purchase number' }, { status: 500 })
  } finally {
    if (guardKey) buyInFlight.delete(guardKey)
  }
}