// lib/providers/smspool.js
//
// Adapter for SMSPool. Unlike 5sim, SMSPool speaks numeric/ID-based
// country and service identifiers, so every call goes through
// idMaps.js to translate MegaDen's canonical slugs first. If a pair
// has no mapping yet, `supports()` returns false and the orchestrator
// moves on to the next provider — this is the normal, expected path
// for any country/service you haven't added to idMaps.js yet.
//
// SMSPool also exposes real success-rate data (/request/success_rate),
// which 5sim does not — getPriceNgn surfaces it so the orchestrator can
// use it as a pre-purchase filter, not just an FYI.

import { smspoolCountryId, smspoolServiceId } from './idMaps'
import { log } from '@/lib/logger'

const BASE = 'https://api.smspool.net'

function authHeaders() {
  return { Authorization: `Bearer ${process.env.SMSPOOL_API_KEY}` }
}

function toForm(obj) {
  const form = new URLSearchParams()
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') form.append(k, String(v))
  }
  return form
}

// Minimum acceptable success rate before we'll even attempt a purchase
// here. SMSPool's own /request/success_rate can return very low numbers
// (e.g. 1-2%) for some country/service pairs — no point burning an
// attempt (and a fallback delay) on those.
const MIN_SUCCESS_RATE = 40

export const smspool = {
  id: 'smspool',

  supports(country, service) {
    return smspoolCountryId(country) !== null && smspoolServiceId(service) !== null
  },

  async getPriceNgn(country, service, { rate, multiplier }) {
    const countryId = smspoolCountryId(country)
    const serviceId = smspoolServiceId(service)
    if (countryId === null || serviceId === null) return { ok: false, reason: 'UNSUPPORTED' }

    try {
      const res = await fetch(`${BASE}/request/success_rate`, {
        signal: AbortSignal.timeout(10000), // never let an unfunded/slow backup stall an order
        method: 'POST',
        headers: authHeaders(),
        body: toForm({ service: serviceId }),
      })
      if (!res.ok) return { ok: false, reason: 'FETCH_FAILED' }
      const rows = await res.json()
      const row = Array.isArray(rows) ? rows.find((r) => r.country === countryId || r.country_id === countryId) : null
      if (!row) return { ok: false, reason: 'NOT_AVAILABLE' }

      const successRate = parseFloat(row.success_rate)
      if (!Number.isNaN(successRate) && successRate < MIN_SUCCESS_RATE) {
        return { ok: false, reason: 'LOW_SUCCESS_RATE', successRate }
      }

      const priceUsd = parseFloat(row.price)
      if (!priceUsd || priceUsd <= 0) return { ok: false, reason: 'NOT_AVAILABLE' }

      const priceNgn = Math.ceil(priceUsd * rate * multiplier)
      return { ok: true, priceNgn, priceUsd, successRate }
    } catch (err) {
      return { ok: false, reason: 'FETCH_FAILED', error: err.message }
    }
  },

  async buy(country, service) {
    const countryId = smspoolCountryId(country)
    const serviceId = smspoolServiceId(service)
    if (countryId === null || serviceId === null) {
      return { ok: false, errorType: 'UNSUPPORTED', errorMessage: 'No SMSPool mapping for this country/service.' }
    }

    try {
      const res = await fetch(`${BASE}/purchase/sms`, {
        signal: AbortSignal.timeout(10000), // never let an unfunded/slow backup stall an order
        method: 'POST',
        headers: authHeaders(),
        // pricing_option: 1 = highest success rate over cheapest — this is
        // the whole reason SMSPool is worth having in the fallback chain.
        body: toForm({ country: countryId, service: serviceId, pricing_option: 1, quantity: 1 }),
      })
      const data = await res.json()

      if (!res.ok || data.success === 0) {
        const type = data?.type || (res.status === 422 ? 'OUT_OF_STOCK' : 'UNKNOWN')
        return { ok: false, errorType: type, errorMessage: data?.message || 'SMSPool purchase failed.' }
      }

      return {
        ok: true,
        externalId: String(data.order_id),
        phone: `${data.cc}${data.phonenumber}`,
        meta: { pool: data.pool },
        // SMSPool's own docs confirm `expiration` is an absolute unix
        // timestamp (seconds) alongside the `expires_in` duration —
        // prefer the absolute one where present, since it's immune to
        // any processing delay between when SMSPool computed it and
        // when we read this response (resolveExpiresAt in
        // orchestrator.js prefers providerExpiresAt over the duration).
        providerExpiresAt: data.expiration ? new Date(data.expiration * 1000).toISOString() : null,
        providerExpiresInSeconds: data.expires_in || 1200,
      }
    } catch (err) {
      return { ok: false, errorType: 'FETCH_FAILED', errorMessage: err.message }
    }
  },

  async checkStatus(externalId) {
    try {
      const res = await fetch(`${BASE}/sms/check`, {
        signal: AbortSignal.timeout(10000), // never let an unfunded/slow backup stall an order
        method: 'POST',
        headers: authHeaders(),
        body: toForm({ orderid: externalId }),
      })
      if (!res.ok) return { status: 'unknown', raw: { httpStatus: res.status } }
      const data = await res.json()

      // Confirmed via SMSPool's official API docs: 1 = pending
      // ("no code yet"), 3 = complete/code received, 6 = "Refunded"
      // (SMSPool's own system auto-refunds OUR SMSPool account balance
      // once an order's window lapses with no code). We map 6 to our
      // canonical 'cancelled' rather than a literal "refunded" status —
      // that's a reseller-side refund to us, not the same thing as
      // MegaDen refunding the end customer's wallet, which is a
      // separate operation numberOrders.js still performs regardless.
      // Mapping to 'cancelled' is correct either way: both routes lead
      // to the same TERMINAL_BAD_STATUSES handling (reissue-or-refund
      // the customer), so the exact label doesn't change behavior.
      if (data.status === 3 && data.sms) {
        return { status: 'received', smsCode: data.sms, smsText: data.full_sms, raw: data }
      }
      if (data.status === 1) return { status: 'pending', raw: data }
      if (data.status === 6) return { status: 'cancelled', raw: data }

      // Unrecognized status code — this is exactly the evidence Issue 4
      // needs. We don't yet know what SMSPool actually sends when a
      // destination service blocks/flags a number, as opposed to a
      // normal still-pending or genuinely-timed-out order — so today
      // that case is indistinguishable from "still waiting" and just
      // rides out the full 20-minute window before the generic timeout
      // refund kicks in. Logging the full raw body here means the next
      // time this happens for real, there's an actual example to read
      // instead of needing to reproduce it deliberately.
      await log('warning', 'number', `SMSPool returned unrecognized status code ${data.status} for order ${externalId}`, null, null, {
        provider: 'smspool', external_id: externalId, raw: data,
      }).catch(() => {})

      return { status: 'unknown', raw: data }
    } catch (err) {
      return { status: 'unknown', raw: { error: err.message } }
    }
  },

  async cancel(externalId) {
    try {
      // Check the REAL status first — confirmed via SMSPool's own docs
      // (status 3 + sms field means a code already arrived). This is
      // the same pattern fivesim.js's cancel() already uses, and for
      // the same reason: we previously tried to detect "already
      // received" by pattern-matching cancel's response TEXT for the
      // word "already" — but SMSPool's own documented failure messages
      // ("We could not find this order!", "Your order cannot be
      // cancelled yet, please try again later.") don't contain that
      // word at all, and there's no documented example of what they
      // actually say for "you already got your code." That regex was
      // never verified against anything real. Checking status directly
      // removes the guesswork entirely.
      const checkRes = await fetch(`${BASE}/sms/check`, {
        signal: AbortSignal.timeout(10000), // never let an unfunded/slow backup stall an order
        method: 'POST',
        headers: authHeaders(),
        body: toForm({ orderid: externalId }),
      })
      if (checkRes.ok) {
        const checkData = await checkRes.json()
        if (checkData.status === 3 && checkData.sms) {
          return { ok: false, alreadyReceived: true, message: 'SMS already received — no refund possible.' }
        }
      }

      const res = await fetch(`${BASE}/sms/cancel`, {
        signal: AbortSignal.timeout(10000), // never let an unfunded/slow backup stall an order
        method: 'POST',
        headers: authHeaders(),
        body: toForm({ orderid: externalId }),
      })
      const data = await res.json()
      if (data.success === 1) return { ok: true }
      // Any other failure here is something else — order not found, or
      // the short cancellation time-lock SMSPool documents. Neither is
      // an "already received" case (we already ruled that out above),
      // so it's surfaced as a plain failure, same as before.
      return { ok: false, alreadyReceived: false, message: data.message }
    } catch (err) {
      // Report the truth (cancel unconfirmed) instead of claiming
      // success. Callers decide whether that blocks a refund.
      return { ok: false, alreadyReceived: false, message: err.message }
    }
  },
}