// lib/providers/fleexa.js
//
// Fleexa runs two SMS-OTP sub-services under one account, both US-only:
//   sms4 — no approval gate. Pricing endpoint is /sms4/prices.
//   sms5 — mirrors sms4, but WhatsApp requires prior approval via
//          /sms5/access-status + /sms5/access-request. Pricing endpoint
//          is /sms5/pricing (singular — NOT /prices; the two services
//          genuinely differ here, confirmed live and in their docs).
//
// Each is exported as its own provider so the priority config in
// orchestrator.js can order them independently per country/service.
//
// REMOVED 2026-09-18: there used to be a third sub-service here, sms3
// ("Server 3 · All Countries"), which was the only non-US Fleexa path.
// Fleexa has permanently retired it — their support confirmed the same
// retirement for the matching rental engine, their docs now list only
// SMS OTP 4 and SMS OTP 5 under SMS OTP, and their own marketing says
// they are "focused exclusively on USA numbers". Calls to /sms3/* just
// return {success: true, data: {}, message: "Service currently not
// available"}. Do not re-add it. sms4/sms5 (this file) are US-only; Fleexa's
// separate multi-country service, SMS OTP 6, is its own provider with its
// own adapter — see lib/providers/fleexaSms6.js.

import { log } from '@/lib/logger'
import { computeSellPriceNgn } from './fleexaPricing'

const BASE = 'https://fleexa.com.ng/developer'

function authHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${process.env.FLEEXA_API_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

async function fleexaJson(path, options = {}) {
  // FIX (2026-09-19): see the matching fix + comment in
  // lib/providers/fleexaRent.js's fleexaJson — Next.js caches fetch()
  // in Route Handlers by default, which must never happen for live
  // pricing/stock data like this.
  //
  // Timeout: without one, a hung Fleexa call would hang the whole buy
  // request instead of letting the chain move on. Reads get 8s; POSTs
  // (buy/cancel) get longer since they can legitimately be slower. An
  // abort throws, which every caller already treats as FETCH_FAILED.
  const timeoutMs = options.method === 'POST' ? 20000 : 8000
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders(), cache: 'no-store', signal: AbortSignal.timeout(timeoutMs), ...options })
  let data = null
  try {
    data = await res.json()
  } catch {
    // non-JSON error body — treat as failure below
  }
  return { res, data }
}

// -- sms4 / sms5 share almost everything; only the path prefix and the
//    WhatsApp approval gate differ, so one factory builds both. --------
const accessCache = new Map() // prefix -> { approved, expiresAt }

function makeUsOnlyProvider(prefix, { gateWhatsapp, pricingPath } = {}) {
  return {
    id: `fleexa_${prefix}`,

    async supports(country, service) {
      if (country !== 'usa') return false
      if (gateWhatsapp && service === 'whatsapp') {
        // Approval changes rarely; cache it so every quote/picker call
        // doesn't pay a network round trip. A failed lookup is cached
        // briefly too (as "not approved") so a slow Fleexa can't add 8s to
        // every call.
        const cached = accessCache.get(prefix)
        if (cached && cached.expiresAt > Date.now()) return cached.approved
        let approved = false
        let ttl = 60_000
        try {
          const { data } = await fleexaJson(`/${prefix}/access-status?service=whatsapp`)
          approved = Boolean(data?.data?.approved)
        } catch {
          ttl = 15_000
        }
        accessCache.set(prefix, { approved, expiresAt: Date.now() + ttl })
        return approved
      }
      return true
    },

    async getPriceNgn(country, service, settings) {
      try {
        const { res, data } = await fleexaJson(`/${prefix}/${pricingPath}?serviceName=${encodeURIComponent(service)}`)
        // 429/5xx is Fleexa being briefly unwell, not "this service isn't
        // sold" — report it as FETCH_FAILED so the orchestrator retries
        // Fleexa instead of treating the pair as unavailable.
        if (res.status === 429 || res.status >= 500) return { ok: false, reason: 'FETCH_FAILED' }
        if (!res.ok || !data?.success) return { ok: false, reason: 'NOT_AVAILABLE' }
        const costNgn = Math.ceil(parseFloat(data.data.price_ngn))
        if (!costNgn) return { ok: false, reason: 'NOT_AVAILABLE' }
        // FIXED (2026-09-19): Fleexa's price_ngn here is YOUR wholesale
        // cost as an API reseller, not a price with margin for you
        // built in — confirmed via Rent Numbers' /rent/durations, which
        // exposes cost vs. full_price_ngn side by side and shows
        // price_ngn sitting exactly at the reseller-discounted cost.
        // sms4/sms5's /prices and /pricing endpoints don't expose an
        // equivalent full_price_ngn to split against, so this uses the
        // flat-markup fallback lib/providers/fleexaPricing.js applies
        // whenever no retail ceiling is available — admin-configurable
        // via the "Flat Markup — SMS OTP 4/5" setting. Previously this
        // returned costNgn directly as priceNgn — charging your own
        // users exactly your own cost, zero margin on every Fleexa-
        // sourced OTP number.
        const priceNgn = computeSellPriceNgn(costNgn, null, { flatMarkupPercent: settings?.fleexaMarkupPercent })
        // Handed back to buy() by the orchestrator: the purchase is capped
        // at exactly the USD price that was just quoted (Fleexa's buy
        // accepts maxPrice), so a price rise between quote and buy can
        // never sell a number to a customer below our cost.
        const maxPriceUsd = Number(data.data.price_usd)
        return { ok: true, priceNgn, priceUsd: data.data.price_usd, quote: { maxPriceUsd, costNgn } }
      } catch (err) {
        return { ok: false, reason: 'FETCH_FAILED', error: err.message }
      }
    },

    async buy(country, service, ctx = {}) {
      try {
        const maxPriceUsd = Number(ctx?.quote?.maxPriceUsd)
        const cap = Number.isFinite(maxPriceUsd) && maxPriceUsd > 0 ? maxPriceUsd : null

        const post = (withCap) => fleexaJson(`/${prefix}/buy`, {
          method: 'POST',
          body: JSON.stringify({ serviceName: service, ...(withCap ? { maxPrice: maxPriceUsd } : {}) }),
        })

        let { res, data } = await post(cap !== null)

        // Safety net for the cap itself. Fleexa's docs describe maxPrice
        // as "max USD price to pay" but don't say which price it is
        // compared against, so a capped buy that fails with a plain 400 is
        // checked against a FRESH price: if the price has not risen above
        // what we quoted, the cap wasn't the problem (or isn't measured
        // the way we assumed) and we retry once without it — still safe,
        // because the price is verified unchanged. If the price HAS risen,
        // we stop here and let the chain move on instead of selling at a loss.
        const fundingFailure = /balance|insufficient|fund|wallet|top.?up/i.test(data?.message || '')
        if (cap !== null && (!res.ok || !data?.success) && res.status === 400 && !fundingFailure) {
          const { res: pres, data: pdata } = await fleexaJson(`/${prefix}/${pricingPath}?serviceName=${encodeURIComponent(service)}`)
          const freshCostNgn = pres.ok && pdata?.success ? Math.ceil(parseFloat(pdata.data.price_ngn)) : NaN
          const quotedCostNgn = ctx?.quote?.costNgn
          if (Number.isFinite(freshCostNgn) && Number.isFinite(quotedCostNgn) && freshCostNgn <= quotedCostNgn) {
            ;({ res, data } = await post(false))
          }
        }

        if (!res.ok || !data?.success) {
          // Same caveat as 5sim: no confirmed example of Fleexa's actual
          // "insufficient wallet balance" response yet, so this is a
          // best-effort keyword check on their message field, layered
          // on top of (not replacing) the existing status-code guess —
          // a message match takes priority since it's more specific
          // than a bare HTTP status.
          const looksLikeFunding = /balance|insufficient|fund|wallet|top.?up/i.test(data?.message || '')
          const type = looksLikeFunding
            ? 'BALANCE_ERROR'
            : res.status === 429 ? 'RATE_LIMITED' : res.status === 400 ? 'OUT_OF_STOCK' : 'UNKNOWN'

          if (type === 'UNKNOWN') {
            // This is the one buy-failure bucket in this file that's a
            // genuine "we don't know what this is" — RATE_LIMITED/
            // OUT_OF_STOCK/BALANCE_ERROR are all specific guesses, but
            // UNKNOWN only fires when none of those matched anything.
            // Log the raw body so a real occurrence leaves evidence,
            // same as the checkStatus unrecognized-code logging above.
            await log('warning', 'number', `Fleexa ${prefix} buy failed with unrecognized error (HTTP ${res.status})`, null, null, {
              provider: `fleexa_${prefix}`, http_status: res.status, raw: data,
            }).catch(() => {})
          }

          return { ok: false, errorType: type, errorMessage: data?.message || 'Fleexa purchase failed.' }
        }
        // Cost check: what Fleexa actually charged vs the cost we quoted
        // (and priced the customer's sale from). Detection only — the buy
        // has already happened — but a mismatch means margin is leaking.
        const paid = parseFloat(data.data.amount_paid)
        const quotedCost = ctx?.quote?.costNgn
        if (Number.isFinite(paid) && Number.isFinite(quotedCost) && paid > quotedCost + 1) {
          await log('warning', 'number', `Fleexa ${prefix} charged more than quoted (paid ₦${paid}, quoted cost ₦${quotedCost})`, null, null, {
            provider: `fleexa_${prefix}`, external_id: String(data.data.id), paid, quotedCost, country, service,
          }).catch(() => {})
        }

        return {
          ok: true,
          externalId: String(data.data.id),
          phone: data.data.phone,
          meta: { activationId: data.data.activation_id },
          // Fleexa's buy response includes a real expires_at timestamp
          // (their docs example: bought 12:00, expires 12:05 — a 5-minute
          // window, not the 20 minutes this used to hardcode). Pass the
          // absolute timestamp through when present; providerExpiresInSeconds
          // stays as a fallback for the rare case Fleexa omits it.
          providerExpiresAt: data.data.expires_at || null,
          providerExpiresInSeconds: 1200,
        }
      } catch (err) {
        return { ok: false, errorType: 'FETCH_FAILED', errorMessage: err.message }
      }
    },

    async checkStatus(externalId) {
      try {
        const { res, data } = await fleexaJson(`/${prefix}/check/${externalId}`)
        if (!res.ok || !data?.success) return { status: 'unknown', raw: data }
        const map = { RECEIVED: 'received', WAITING: 'pending', CANCELED: 'cancelled', EXPIRED: 'expired' }
        const code = data.data.code
        const status = map[code] || 'unknown'

        if (!(code in map)) {
          // Same gap as SMSPool: no known mapping for a destination-
          // service block/flag, distinct from a normal timeout. Capture
          // the raw body so a real occurrence leaves evidence instead of
          // silently becoming 'unknown' and riding out the full window.
          await log('warning', 'number', `Fleexa ${prefix} returned unrecognized status code "${code}" for order ${externalId}`, null, null, {
            provider: `fleexa_${prefix}`, external_id: externalId, raw: data,
          }).catch(() => {})
        }

        return { status, smsCode: data.data.sms_code, smsText: data.data.sms_text, raw: data }
      } catch (err) {
        return { status: 'unknown', raw: { error: err.message } }
      }
    },

    async cancel(externalId) {
      try {
        const { data } = await fleexaJson(`/${prefix}/cancel`, {
          method: 'POST',
          body: JSON.stringify({ requestId: externalId }),
        })
        if (data?.success) return { ok: true }
        return { ok: false, alreadyReceived: /already|received/i.test(data?.message || ''), message: data?.message }
      } catch (err) {
        // Report the truth (cancel unconfirmed) instead of claiming
        // success. Callers decide whether that blocks a refund.
        return { ok: false, alreadyReceived: false, message: err.message }
      }
    },
  }
}

export const fleexaSms4 = makeUsOnlyProvider('sms4', { pricingPath: 'prices' })
export const fleexaSms5 = makeUsOnlyProvider('sms5', { gateWhatsapp: true, pricingPath: 'pricing' })