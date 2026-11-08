// lib/providers/fleexaRent.js
//
// Adapter for Fleexa's Rent Numbers service.
//
// ── HISTORY (why this looks the way it does) ────────────────────────
// Our first round of testing (2026-09-14/15) hit Fleexa's *retired*
// default rental engine — calls with no `provider` param. That engine
// returns success:true with empty data and "Service currently not
// available", which we initially mistook for a temporary outage. It
// is not coming back; Fleexa confirmed by email (2026-09-16) that
// Rent Numbers now always requires a `provider` param:
//   provider=us       -> month-based rentals (1-12 months), same
//                         underlying engine as SMS OTP 4
//   provider=duration  -> short duration-based rentals (their email
//                         called this both "SMS 5" and "the GetAText
//                         duration engine" inconsistently — exact
//                         name unconfirmed, but the mechanics — short
//                         fixed windows like 1d/3d/7d/14d/30d — were
//                         consistent across both explanations)
//
// This file only implements `provider=us` (month-based), matching
// what was actually asked for (long-term monthly rental) and what the
// dashboard's 1/3/12-month tiers correspond to. provider=duration is
// NOT implemented here — add it later if short-window rentals are
// ever wanted as a separate product.
//
// ── STILL UNVERIFIED ─────────────────────────────────────────────────
// Everything below is built from Fleexa support's email description,
// not a live test call (they confirmed there is no sandbox — the
// first real POST /rent/buy IS the test). Field names are normalized
// defensively and log a warning on a near-miss, same approach as
// every other provider adapter in this codebase.
//
// Fleexa's own docs were wrong about this until 2026-09-16 (their
// words: "our docs show the buy example without a provider, which
// defaults to the retired engine... we're fixing that") — so some
// caution about trusting docs at face value going forward is
// warranted even post-fix.

import { log } from '@/lib/logger'
import { computeSellPriceNgn } from './fleexaPricing'

const BASE = 'https://fleexa.com.ng/developer'
const PROVIDER = 'us' // month-based engine; see file header

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.FLEEXA_API_KEY}`,
    'Content-Type': 'application/json',
    // Fleexa's email says provider can be sent as a header instead of
    // a query param/body field — included on every call as a belt-
    // and-suspenders measure in case any single endpoint only reads
    // it from here.
    'x-rent-provider': PROVIDER,
  }
}

async function fleexaJson(path, options = {}) {
  // FIX (2026-09-19): Next.js caches fetch() calls inside Route
  // Handlers by default unless told not to. Live pricing/inventory
  // from Fleexa must never be cached this way — a stale snapshot could
  // silently keep showing outdated services, prices, or stock forever
  // (this is the likely cause of "allservices" disappearing from the
  // rentable list in the running app while a fresh PowerShell call to
  // the same endpoint showed all 5 services correctly).
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders(), cache: 'no-store', ...options })
  let data = null
  try {
    data = await res.json()
  } catch {
    // non-JSON error body
  }
  return { res, data }
}

// ── List services available to rent (provider=us) ──────────────────
// Guessed shape mirrors sms4/apps (id, name, quantity) since Fleexa's
// email didn't give an exact /rent/apps response example under
// provider=us — only said "appName is the service name from
// /rent/apps." Normalized defensively; logs if nothing matches.
export async function listRentApps(countryId = 'US') {
  try {
    // CONFIRMED LIVE (2026-09-19): Fleexa added a filter param at our
    // request — has_durations=true (aliases: rentable=true,
    // has_rental=true) — that returns ONLY services with real rental
    // support, instead of the full several-hundred-service catalog
    // most of which don't support rental at all. Verified this
    // actually filters (5 entries came back, not hundreds) rather than
    // just decorating every entry. Each entry also carries has_rental
    // and rental_known booleans, but since this filtered call already
    // excludes anything not confirmed rentable, every entry here is
    // has_rental:true by construction.
    //
    // Note: rental_known:false ("cold cache, not yet checked") entries
    // are excluded from this filtered response entirely — they aren't
    // returned as false, they're just absent. Fleexa's guidance is
    // that a service not showing up here isn't necessarily permanently
    // unsupported, just not yet confirmed. Given only ~5 services are
    // confirmed rentable at any given time, this app only offers what
    // this filtered list returns rather than trying to surface
    // "maybe" services from the full catalog.
    const { res, data } = await fleexaJson(`/rent/apps?countryId=${encodeURIComponent(countryId)}&provider=${PROVIDER}&has_durations=true`)
    if (!res.ok || !data?.success) {
      return { ok: false, reason: 'FETCH_FAILED', message: data?.message }
    }
    const list = Array.isArray(data.data) ? data.data : []
    if (!list.length) return { ok: false, reason: 'NOT_AVAILABLE' }

    const apps = list.map((a) => {
      const appName = a.name ?? a.id ?? a.appName ?? null
      if (appName === null) {
        log('warning', 'number', 'Fleexa rent/apps entry missing a recognizable name field', null, null, {
          feature: 'rent_numbers', provider: 'fleexa_rent', raw: a,
        }).catch(() => {})
      }
      return {
        appName,
        description: a.description || appName,
        qty: a.qty ?? a.quantity ?? null,
        // Baseline monthly price, per the support email — NOT the
        // tiered price. Use listRentDurations() for actual 1/3/12
        // month pricing before buying.
        baselinePriceNgn: a.price_ngn ? Math.ceil(parseFloat(a.price_ngn)) : null,
      }
    })
    return { ok: true, apps }
  } catch (err) {
    return { ok: false, reason: 'FETCH_FAILED', error: err.message }
  }
}

// ── Tiered duration pricing ──────────────────────────────────────────
// CONFIRMED LIVE (2026-09-18) via a real call for appName=whatsapp.
// data.durations is an ARRAY (not an object keyed by duration name, as
// first guessed) — each entry:
//   { duration: "thirtyDay", duration_months: 1, total_usd, monthly_usd,
//     provider_cost_ngn, full_price_ngn, price_ngn: "7768.00",
//     exact: true, api_discount_percent: 50 }
//
// price_ngn is the one to charge — it's the API/reseller-discounted
// rate. full_price_ngn (8768) is what a regular (non-API) user pays on
// the dashboard; provider_cost_ngn (6768) is Fleexa's own upstream
// cost. Confirmed by comparing against the dashboard screenshot's
// 1/3/12-month prices, which matched full_price_ngn exactly, not
// price_ngn — using full_price_ngn here would overcharge your users
// by the reseller-discount margin that's supposed to be yours to keep.
//
// Also confirmed live: not every service supports rental — telegram
// returned an empty durations array while whatsapp returned all three
// tiers. Check this per-service, don't assume every /rent/apps entry
// is rentable.
//
// IMPORTANT (per Fleexa support, 2026-09-18): an empty durations array
// does NOT always mean "unsupported." /rent/durations fans out to 3
// separate pricing checks on their SMS 4 backend, which they queue and
// throttle — a rate-limited attempt returns the SAME empty-array shape
// but with a top-level `throttled: true`:
//   { success: true, data: { serviceName, durations: [] }, throttled: true }
// Empty + throttled:true means "try again shortly," NOT "this service
// doesn't support rental" — conflating the two would incorrectly tell
// a user a real, rentable service isn't available just because of a
// transient rate limit. Their responses cache successful lookups for
// 2 hours on their end, so a retry a few seconds later is cheap.
const DURATION_KEY_BY_MONTHS = { 1: 'thirtyDay', 3: 'ninetyDay', 12: 'oneYear' }

export async function listRentDurations(appName, settings) {
  try {
    const { res, data } = await fleexaJson(`/rent/durations?provider=${PROVIDER}&appName=${encodeURIComponent(appName)}`)
    if (!res.ok || !data?.success || !data.data) {
      return { ok: false, reason: 'FETCH_FAILED', message: data?.message }
    }
    const list = Array.isArray(data.data.durations) ? data.data.durations : []
    if (!list.length) {
      // throttled is a top-level field, sibling to `data` — not nested
      // inside data.data, per Fleexa's example response.
      return { ok: false, reason: data.throttled ? 'THROTTLED' : 'NOT_AVAILABLE' }
    }

    const tiers = {}
    for (const entry of list) {
      const months = entry.duration_months
      if (!months || !entry.price_ngn) continue
      const costNgn = Math.ceil(parseFloat(entry.price_ngn))
      const fullPriceNgn = entry.full_price_ngn ? Math.ceil(parseFloat(entry.full_price_ngn)) : null
      tiers[months] = {
        durationKey: entry.duration, // e.g. "thirtyDay" — sent back verbatim on buy
        // priceNgn is the FINAL price to charge your own customer
        // (cost + margin) — matches the convention every other
        // provider adapter in this codebase follows (fivesim.js,
        // smspool.js, fleexa.js all return a final sell price from
        // getPriceNgn, not a raw upstream cost). Margin share is
        // admin-configurable via the "Margin Share — Rent Numbers"
        // setting; falls back to the flat markup setting if Fleexa
        // ever omits full_price_ngn for some tier.
        priceNgn: computeSellPriceNgn(costNgn, fullPriceNgn, {
          gapMarginPercent: settings?.fleexaRentMarginPercent,
          flatMarkupPercent: settings?.fleexaMarkupPercent,
        }),
        // Kept for buy-time reconciliation only (comparing against
        // what Fleexa's /rent/buy response actually charges you) —
        // never charge a customer this amount directly.
        costNgn,
      }
    }
    if (!Object.keys(tiers).length) {
      log('warning', 'number', 'Fleexa rent/durations returned entries but none had a usable duration_months + price_ngn', null, null, {
        feature: 'rent_numbers', provider: 'fleexa_rent', appName, raw: list,
      }).catch(() => {})
      return { ok: false, reason: 'NOT_AVAILABLE' }
    }
    return { ok: true, tiers }
  } catch (err) {
    return { ok: false, reason: 'FETCH_FAILED', error: err.message }
  }
}

// ── Buy (UNVERIFIED — no sandbox exists, first real call IS the test) ──
export async function buyRentNumber({ appName, months, autoRenew = false }) {
  const durationKey = DURATION_KEY_BY_MONTHS[months]
  try {
    const { res, data } = await fleexaJson('/rent/buy', {
      method: 'POST',
      body: JSON.stringify({
        provider: PROVIDER,
        appName,
        time: months, // confirmed field name is "time", NOT "months"
        ...(durationKey ? { duration: durationKey } : {}),
        ...(autoRenew ? { auto_renew: true } : {}),
      }),
    })

    if (!res.ok || !data?.success) {
      const looksLikeFunding = /balance|insufficient|fund|wallet|top.?up/i.test(data?.message || '')
      const errorType = looksLikeFunding ? 'BALANCE_ERROR'
        : res.status === 429 ? 'RATE_LIMITED'
        : res.status === 400 ? 'BAD_REQUEST'
        : 'UNKNOWN'

      await log('warning', 'number', `Fleexa rent/buy failed (HTTP ${res.status}) — confirm this against the redeployed docs, request shape came from a support email not a live test`, null, null, {
        feature: 'rent_numbers', provider: 'fleexa_rent', http_status: res.status, sent: { appName, months, durationKey }, raw: data,
      }).catch(() => {})

      return { ok: false, errorType, errorMessage: data?.message || 'Fleexa rental purchase failed.' }
    }

    return normalizeBuyResponse(data, { appName, months })
  } catch (err) {
    return { ok: false, errorType: 'FETCH_FAILED', errorMessage: err.message }
  }
}

function normalizeBuyResponse(res, requested) {
  const d = res.data || {}
  const rentalId = d.rental_id ?? d.rentalId ?? d.id ?? null
  const phone = d.phone ?? d.phone_number ?? d.mobileNumber ?? null
  const costNgn = res.cost_ngn ?? d.cost_ngn ?? null
  // "expiry under provider fields" per the support email — no exact
  // key confirmed, try the usual suspects.
  const providerExpiresAt = d.expires_at ?? d.expiry ?? d.expiresAt ?? null

  if (rentalId === null || phone === null) {
    log('warning', 'number', 'Fleexa rent/buy succeeded but response is missing rental_id or phone — field-name guess needs correcting against the real response', null, null, {
      feature: 'rent_numbers', provider: 'fleexa_rent', raw: res, requested,
    }).catch(() => {})
  }

  return {
    ok: true,
    externalId: rentalId !== null ? String(rentalId) : null,
    phone,
    amountPaidNgn: costNgn !== null ? Math.ceil(parseFloat(costNgn)) : null,
    providerExpiresAt,
    meta: { raw: res },
  }
}

// ── Messages ─────────────────────────────────────────────────────────
// Confirmed: GET /rent/sms?rentalId=... returns the LATEST message
// only ({success, data: <object|null>}) — full history is a separate
// call, GET /rent/sms/list ({success, data: {list, total}}).
// checkRentSms() below calls both and merges, so callers get the full
// picture in one function rather than having to know about the split.
export async function checkRentSms(rentalId) {
  try {
    const [latestRes, historyRes] = await Promise.all([
      fleexaJson(`/rent/sms?rentalId=${encodeURIComponent(rentalId)}&provider=${PROVIDER}`),
      fleexaJson(`/rent/sms/list?rentalId=${encodeURIComponent(rentalId)}&provider=${PROVIDER}`),
    ])

    if (!historyRes.res.ok || !historyRes.data?.success) {
      // Fall back to just the latest-message call if /list fails —
      // better to show one message than none.
      const single = latestRes.data?.data
      return { ok: true, messages: single ? [normalizeMessage(single)] : [] }
    }

    const list = historyRes.data.data?.list
    if (!Array.isArray(list)) {
      log('warning', 'number', 'Fleexa rent/sms/list response missing expected data.list array', null, null, {
        feature: 'rent_numbers', provider: 'fleexa_rent', external_id: rentalId, raw: historyRes.data,
      }).catch(() => {})
      return { ok: true, messages: [] }
    }

    return { ok: true, messages: list.map(normalizeMessage) }
  } catch (err) {
    return { ok: false, reason: 'FETCH_FAILED', error: err.message }
  }
}

function normalizeMessage(m) {
  return {
    text: m.text ?? m.sms_text ?? m.message ?? '',
    code: m.code ?? m.sms_code ?? null,
    from: m.from ?? m.sender ?? null,
    receivedAt: m.received_at ?? m.createdAt ?? m.date ?? null,
  }
}

// ── Cancel ───────────────────────────────────────────────────────────
// Fleexa's own email contradicts itself on whether provider=us
// rentals can actually be cancelled ("can't be cancelled once
// purchased" vs "cancel where the provider allows it"). Rather than
// hardcode either claim, this just makes the call and reports back
// exactly what the API says — the UI should treat a failure here as
// possibly-expected, not necessarily a bug.
export async function cancelRentNumber(rentalId) {
  try {
    const { data } = await fleexaJson('/rent/cancel', {
      method: 'POST',
      body: JSON.stringify({ rentalId, provider: PROVIDER }),
    })
    if (data?.success) return { ok: true }
    return { ok: false, message: data?.message || 'This rental cannot be cancelled.' }
  } catch (err) {
    return { ok: false, message: err.message }
  }
}