// app/api/email/buy/route.js
//
// Buy one (or up to 10) temporary email addresses for receiving OTP codes.
//
// Flow - the wallet is debited FIRST (atomically), then Fleexa is called,
// and the wallet is refunded if Fleexa fails. Email activations cannot be
// cancelled for the first 2 minutes, so "buy first, charge after" (the SMS
// number flow) would leave us unable to undo a purchase whose debit failed.
// See lib/fleexaShared.js for the full reasoning.
import { NextResponse } from 'next/server'
import { log } from '@/lib/logger'
import {
  supabaseAdmin, getAuthedUser, getWalletProfile, getMarkupPercent, sellPriceNgn,
  debitWallet, refundOrLog, recordTransaction, makeInFlightGuard,
} from '@/lib/fleexaShared'
import { listEmailDomains, buyEmail, buyEmailBatch } from '@/lib/providers/fleexaEmail'
import { EMAIL_SAFETY_WINDOW_MS } from '@/lib/emailOrders'

const MAX_COUNT = 10
const guard = makeInFlightGuard()

export async function POST(request) {
  let guardKey = null
  try {
    const user = await getAuthedUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let body
    try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }

    const site = String(body.site || '').trim()
    const domainRaw = String(body.domain || '').trim().toLowerCase()
    const count = body.count === undefined ? 1 : Number(body.count)
    if (!site || !domainRaw || site.length > 64 || domainRaw.length > 64) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
      return NextResponse.json({ error: `You can buy between 1 and ${MAX_COUNT} emails at a time.` }, { status: 400 })
    }
    const domain = domainRaw.startsWith('@') ? domainRaw : `@${domainRaw}`

    // The price the customer was SHOWN - used only as a ceiling, never as
    // the price (same rule as app/api/numbers/buy). A tampered value cannot
    // buy anything cheaper; a too-low one just gets the "price changed" reply.
    const shown = Number(body.expected_price_ngn)
    const ceiling = Number.isFinite(shown) && shown > 0 ? shown : null

    guardKey = `${user.id}:email`
    if (!guard.tryEnter(guardKey)) {
      guardKey = null // not ours - don't clear the first request's lock
      return NextResponse.json({ error: 'Your previous purchase is still being processed. Please wait a moment.', code: 'PURCHASE_IN_PROGRESS' }, { status: 429 })
    }

    const wallet = await getWalletProfile(user.id)
    const userEmail = wallet.email || user.email || null

    // ── Real, uncached price + stock from Fleexa ──
    const [markup, listed] = await Promise.all([getMarkupPercent('email'), listEmailDomains(site)])
    if (!listed.ok) return NextResponse.json({ error: 'Pricing is unavailable right now. Please try again.' }, { status: 502 })

    const d = listed.domains.find((x) => x.name === domain)
    if (!d) return NextResponse.json({ error: 'This email domain is no longer available for this service.' }, { status: 400 })
    if (d.stock !== null && d.stock < count) {
      return NextResponse.json({ error: d.stock <= 0 ? 'This domain is out of stock right now. Try another one.' : `Only ${d.stock} left for this domain.` }, { status: 400 })
    }

    const unit = sellPriceNgn(d.costNgn, markup)
    if (!unit) return NextResponse.json({ error: 'Could not determine the price. Please try again.' }, { status: 400 })

    if (ceiling !== null && unit > ceiling) {
      await log('info', 'number', 'Email OTP price rose since it was listed - asked the customer to confirm', user.id, userEmail, {
        feature: 'email_otp', site, domain, shown_price_ngn: ceiling, new_price_ngn: unit,
      }).catch(() => {})
      return NextResponse.json({
        error: `The price is now ₦${unit.toLocaleString()} (it was ₦${ceiling.toLocaleString()}). Review it and tap Buy again to confirm.`,
        code: 'PRICE_CHANGED',
        price_ngn: unit,
      }, { status: 409 })
    }

    const total = unit * count
    if (wallet.balance < total) {
      await log('warning', 'wallet', 'Insufficient wallet balance for Email OTP', user.id, userEmail, {
        feature: 'email_otp', total_ngn: total, wallet_balance: wallet.balance, site, domain, count,
      }).catch(() => {})
      return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 })
    }

    // ── 1. Debit (atomic). Refused = nothing was bought, nothing to undo. ──
    const debit = await debitWallet(user.id, total)
    if (!debit.ok) {
      if (debit.reason === 'INSUFFICIENT') return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 })
      await log('error', 'wallet', 'Wallet debit RPC failed for Email OTP', user.id, userEmail, { feature: 'email_otp', total_ngn: total, rpc_error: debit.error }).catch(() => {})
      return NextResponse.json({ error: 'Failed to complete purchase. Please try again.' }, { status: 500 })
    }

    // ── 2. Buy from Fleexa. Any failure = give the money back. ──
    const purchase = count === 1 ? await buyEmail({ site, domain }) : await buyEmailBatch({ site, domain, count })
    if (!purchase.ok) {
      const refunded = await refundOrLog({ userId: user.id, userEmail, amount: total, feature: 'Email OTP', context: { site, domain, count, provider_kind: purchase.kind } })
      await log(purchase.kind === 'BALANCE_ERROR' ? 'error' : 'warning', purchase.kind === 'BALANCE_ERROR' ? 'wallet' : 'number',
        purchase.kind === 'BALANCE_ERROR'
          ? 'PROVIDER BALANCE: fleexa_email refused a purchase because our Fleexa account is out of funds - top it up'
          : 'Email OTP purchase failed at the provider - wallet refunded',
        user.id, userEmail, { feature: 'email_otp', site, domain, count, kind: purchase.kind, message: purchase.message, http: purchase.http, refunded, raw: purchase.raw },
      ).catch(() => {})
      const msg = purchase.kind === 'AMBIGUOUS' || purchase.kind === 'BALANCE_ERROR' || purchase.kind === 'RATE_LIMITED'
        ? 'Email service is busy right now. You have not been charged - please try again shortly.'
        : 'No email addresses are available for this option right now. You have not been charged - try another domain.'
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    // Fleexa may hand back fewer than asked for. Only pay for what we got.
    const items = purchase.items.slice(0, count)
    const shortBy = count - items.length
    if (shortBy > 0) {
      await refundOrLog({ userId: user.id, userEmail, amount: unit * shortBy, feature: 'Email OTP (short batch)', context: { site, domain, requested: count, received: items.length } })
    }

    if (purchase.amountPaidNgn !== null && Math.abs(purchase.amountPaidNgn - d.costNgn * items.length) > 1) {
      await log('warning', 'number', 'Email OTP cost mismatch - what Fleexa charged us differs from the quote', user.id, userEmail, {
        feature: 'email_otp', quoted_cost: d.costNgn * items.length, actual_cost: purchase.amountPaidNgn, site, domain,
      }).catch(() => {})
    }

    // ── 3. Save an order per address, so each can be polled and cancelled
    //       on its own. ──
    const expires = new Date(Date.now() + EMAIL_SAFETY_WINDOW_MS).toISOString()
    const created = []
    const unsaved = []
    for (const item of items) {
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .insert({
          user_id: user.id,
          product_type: 'email_otp',
          product_name: `Email OTP - ${site}`,
          amount: unit,
          status: 'pending',
          details: {
            provider: 'fleexa_email',
            external_id: item.emailId,
            email: item.email,
            site,
            domain,
            expires,
            cost_ngn: d.costNgn,
          },
        })
        .select('id')
        .single()
      if (orderError || !order) unsaved.push({ item, error: orderError?.message, code: orderError?.code })
      else created.push({ order_id: order.id, email: item.email })
    }

    if (unsaved.length > 0) {
      // Bought and debited but the order could not be saved: the customer
      // could never see the address. Refund them and leave the details in
      // the log so the address can be cancelled at Fleexa by hand.
      // Most likely cause: a CHECK constraint on orders.product_type that
      // does not allow 'email_otp' yet (see INSTALL.md, SQL step).
      await refundOrLog({ userId: user.id, userEmail, amount: unit * unsaved.length, feature: 'Email OTP (order not saved)', context: { unsaved } })
      await log('error', 'number', 'CRITICAL: Email OTP bought and debited but saving the order FAILED - customer refunded, address needs cancelling at Fleexa', user.id, userEmail, {
        feature: 'email_otp', site, domain, unsaved,
      }).catch(() => {})
    }

    if (created.length === 0) {
      return NextResponse.json({ error: 'Failed to complete purchase. You have not been charged. Please try again.' }, { status: 500 })
    }

    await recordTransaction({
      userId: user.id, userEmail, type: 'debit', amount: unit * created.length,
      description: `Email OTP - ${site}${created.length > 1 ? ` x${created.length}` : ''}`,
      reference: `EMAIL-${items[0].emailId}-${Date.now()}`,
      feature: 'email_otp',
    })

    await log('info', 'number', `Email OTP purchased - ${site} (${domain}) x${created.length}`, user.id, userEmail, {
      feature: 'email_otp', site, domain, count: created.length, unit_price_ngn: unit, order_ids: created.map((c) => c.order_id),
    }).catch(() => {})

    return NextResponse.json({ success: true, orders: created, price_ngn: unit, total_ngn: unit * created.length })
  } catch (error) {
    console.error('[email/buy]', error)
    await log('error', 'number', `Unhandled exception in email/buy: ${error.message}`, null, null, { feature: 'email_otp', stack: error.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to purchase email' }, { status: 500 })
  } finally {
    if (guardKey) guard.leave(guardKey)
  }
}