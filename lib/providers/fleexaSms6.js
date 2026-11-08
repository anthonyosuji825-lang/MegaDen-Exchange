// lib/providers/fleexaSms6.js
//
// Adapter for Fleexa "SMS OTP 6" — their multi-country OTP service
// (200+ countries, thousands of services, all under /sms6). Unlike
// sms4/sms5 this is NOT US-only, which is why it lives in its own file
// instead of makeUsOnlyProvider() in fleexa.js.
//
// Facts taken from Fleexa's SMS OTP 6 docs that shape this adapter:
//   - Countries are numeric ids, services are SHORT ids ("wa", "tg").
//     Country ids are resolved live from /sms6/countries by ISO code
//     (see idMaps.js) instead of being hardcoded.
//   - price_ngn is YOUR reseller/wholesale cost, with no retail figure
//     to split against — so, exactly like sms4/sms5, we apply the flat
//     markup from fleexaPricing.js (setting: fleexa_sms6_markup_percent,
//     falling back to fleexa_markup_percent).
//   - /sms6/buy accepts maxPrice (USD). We always pass the band we just
//     quoted, so Fleexa can never sell us a pricier band than the price
//     we showed/charged the customer for.
//   - Numbers live 20 minutes; orders that never get a code are refunded
//     to OUR Fleexa wallet automatically.
//   - CANCELLATION IS LOCKED FOR THE FIRST 6 MINUTES (HTTP 400,
//     EARLY_CANCEL_LOCKED, number stays active, no refund). This
//     adapter reports that honestly as ok:false; the manual-cancel route
//     treats an unconfirmed cancel as "refund withheld, try again
//     shortly" rather than refunding a still-live number.
//   - No approval gate for any service (WhatsApp included).
//
// OFF BY DEFAULT. This provider only participates for countries listed
// in the FLEEXA_SMS6_COUNTRIES env var (comma-separated canonical slugs,
// e.g. "nigeria,ghana"; "*" = every country with an ISO mapping). Unset
// or empty = disabled everywhere. That is the kill switch AND the
// per-country rollout control — remove a country from the list and it
// stops being used on the next request, no deploy of code needed.

import { log } from '@/lib/logger'
import { computeSellPriceNgn } from './fleexaPricing'
import {
  fleexaSms6Iso,
  fleexaSms6SlugForIso,
  fleexaSms6ServiceId,
  fleexaSms6ServiceAliases,
  listCanonicalServices,
} from './idMaps'

const BASE = 'https://fleexa.com.ng/developer'
const PROVIDER_ID = 'fleexa_sms6'

// Small duplicate of the helpers in fleexa.js on purpose: keeps the
// already-working sms4/sms5 file untouched. no-store because Next.js
// would otherwise cache live price/stock fetches in Route Handlers.
function authHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${process.env.FLEEXA_API_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

async function fleexaJson(path, options = {}) {
  // Timeout so a hung Fleexa call can't hang the whole buy request (reads
  // 8s, POSTs 20s). An abort throws; every caller treats that as FETCH_FAILED.
  const timeoutMs = options.method === 'POST' ? 20000 : 8000
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders(), cache: 'no-store', signal: AbortSignal.timeout(timeoutMs), ...options })
  let data = null
  try {
    data = await res.json()
  } catch {
    // non-JSON error body — callers treat a null body as failure
  }
  return { res, data }
}

function isEnabledFor(country) {
  const raw = (process.env.FLEEXA_SMS6_COUNTRIES || '').trim().toLowerCase()
  if (!raw) return false
  const set = new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))
  if (set.has(country)) return true
  // "*" means every country EXCEPT the USA: Fleexa says USA numbers work
  // best on SMS OTP 4/5, so USA never falls onto this weaker service unless
  // 'usa' is listed explicitly.
  return set.has('*') && country !== 'usa'
}

// -- ISO code -> Fleexa numeric country id, cached per server instance --
// /sms6/countries returns an OBJECT keyed by id (not an array). The list
// is small and changes rarely; 10 minutes keeps it off the hot path.
const COUNTRY_CACHE_TTL_MS = 10 * 60 * 1000
let countryCache = null // { at, byIso }

async function resolveCountryId(iso) {
  if (!countryCache || Date.now() - countryCache.at > COUNTRY_CACHE_TTL_MS) {
    const { res, data } = await fleexaJson('/sms6/countries')
    if (!res.ok || !data?.success || !data.data) return { ok: false, reason: 'FETCH_FAILED' }
    const byIso = {}
    for (const entry of Object.values(data.data)) {
      if (!entry || entry.id == null || !entry.code) continue
      const code = String(entry.code).toLowerCase()
      if (!(code in byIso)) byIso[code] = String(entry.id)
    }
    countryCache = { at: Date.now(), byIso }
  }
  const id = countryCache.byIso[iso]
  return id ? { ok: true, id } : { ok: false, reason: 'NOT_AVAILABLE' }
}

// -- canonical service -> Fleexa short id, resolved LIVE from /sms6/products --
// Fleexa sells thousands of services under short ids ("wa", "tg", ...).
// Instead of hand-copying ids, match Fleexa's product NAMES against the
// strict alias lists in idMaps.js. Cached 10 minutes per server instance;
// if a refresh fails the previous list keeps being used (retried after 30s).
// Anything unmatched or ambiguous resolves to null -> the provider reports
// the pair unsupported and the chain moves on, rather than risking the
// wrong service's number.
const PRODUCTS_CACHE_TTL_MS = 10 * 60 * 1000
const PRODUCTS_RETRY_MS = 30 * 1000
let productsCache = null // { at, idsByName: Map<normalizedName, Set<id>> }
let productsLoggedOnce = false
const countryListCache = new Map() // `${service}:${markup}` -> { value, expiresAt }

const normalizeName = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

async function loadProducts() {
  if (productsCache && Date.now() - productsCache.at < PRODUCTS_CACHE_TTL_MS) return productsCache
  try {
    // The full catalog is thousands of items and slow — give it far more
    // time than the 8s default for small calls.
    const { res, data } = await fleexaJson('/sms6/products', { signal: AbortSignal.timeout(25000) })
    if (!res.ok || !data?.success || !Array.isArray(data.data)) throw new Error(`products fetch failed (HTTP ${res.status})`)
    const idsByName = new Map()
    for (const p of data.data) {
      if (!p || p.id == null) continue
      const key = normalizeName(p.name || p.title)
      if (!key) continue
      if (!idsByName.has(key)) idsByName.set(key, new Set())
      idsByName.get(key).add(String(p.id))
    }
    productsCache = { at: Date.now(), idsByName }

    if (!productsLoggedOnce) {
      productsLoggedOnce = true
      const unmatched = listCanonicalServices().filter((svc) => !fleexaServiceIdFromCache(svc, productsCache))
      if (unmatched.length) {
        // One-time evidence so unmatched services can be fixed by adding an
        // alias in idMaps.js — shows what Fleexa actually calls them.
        await log('warning', 'number', `Fleexa sms6: ${unmatched.length} service(s) have no strict name match in /sms6/products — they fall through to backup providers until an alias is added in idMaps.js`, null, null, {
          provider: PROVIDER_ID, unmatched, sample_fleexa_names: [...idsByName.keys()].slice(0, 80),
        }).catch(() => {})
      }
    }
  } catch (err) {
    if (productsCache) {
      productsCache = { ...productsCache, at: Date.now() - PRODUCTS_CACHE_TTL_MS + PRODUCTS_RETRY_MS }
    } else {
      // Nothing cached yet: remember the failure for 30s so the next calls
      // use the docs-confirmed wa/tg fallback immediately instead of each
      // waiting out another 8s timeout.
      productsCache = { at: Date.now() - PRODUCTS_CACHE_TTL_MS + PRODUCTS_RETRY_MS, idsByName: new Map() }
    }
  }
  return productsCache
}

function fleexaServiceIdFromCache(service, cache) {
  const ids = new Set()
  for (const alias of fleexaSms6ServiceAliases(service)) {
    for (const id of cache.idsByName.get(alias) || []) ids.add(id)
  }
  return ids.size === 1 ? [...ids][0] : null // 0 = no match, >1 = ambiguous
}

async function resolveServiceId(service) {
  const cache = await loadProducts()
  if (cache) {
    const id = fleexaServiceIdFromCache(service, cache)
    if (id) return id
  }
  return fleexaSms6ServiceId(service) // docs-confirmed wa/tg fallback, else null
}

function normalizePhone(phone) {
  const p = String(phone)
  return p.startsWith('+') ? p : `+${p}`
}

// Shared by cancel() and the wrong-country safety path in buy().
async function cancelRequest(externalId) {
  try {
    const { res, data } = await fleexaJson('/sms6/cancel', {
      method: 'POST',
      body: JSON.stringify({ requestId: externalId }),
    })
    if (data?.success) return { ok: true }

    // Fleexa documents HTTP 400 + code EARLY_CANCEL_LOCKED for the 6-minute
    // lock but not where `code` sits in the body, so look in the likely
    // places and fall back to the message text. `locked` is informational
    // only — nothing below depends on it being detected correctly.
    const message = String(data?.message || data?.error?.message || (typeof data?.error === 'string' ? data.error : '') || '')
    const code = String(data?.code || data?.error?.code || data?.errorCode || '')
    const locked = code === 'EARLY_CANCEL_LOCKED' || /EARLY_CANCEL_LOCKED|cancel\w*\s+(is\s+)?lock|lock\w*.*cancel/i.test(message)

    return {
      ok: false,
      locked,
      // Fleexa: "A completed order (code already received) ... cannot be
      // canceled." The manual-cancel route re-verifies this against the
      // real status before acting on it, so a loose match is safe.
      alreadyReceived: !locked && /already|received|complet/i.test(message),
      message: message || `Fleexa sms6 cancel failed (HTTP ${res.status})`,
    }
  } catch (err) {
    return { ok: false, locked: false, alreadyReceived: false, message: err.message }
  }
}

export const fleexaSms6 = {
  id: PROVIDER_ID,

  async supports(country, service) {
    if (!isEnabledFor(country) || fleexaSms6Iso(country) === null) return false
    return (await resolveServiceId(service)) !== null
  },

  // Countries Fleexa currently has stock in for one service, with OUR sell
  // price (Fleexa's lowest price for the service in that country, plus the
  // same flat markup getPriceNgn applies). Drives the country picker, so
  // what customers see comes from Fleexa rather than the 5sim catalog.
  // The buy path always re-quotes live (getPriceNgn); if the two ever
  // differ, the buy route's price ceiling stops the sale and asks the
  // customer to confirm the new price.
  async listCountries(service, settings) {
    // 45s cache per service+markup: the picker is hit on every page load
    // and service switch, and the underlying Fleexa call is slow.
    const cacheKey = `${service}:${settings?.fleexaSms6MarkupPercent}`
    const hit = countryListCache.get(cacheKey)
    if (hit && hit.expiresAt > Date.now()) return hit.value
    const value = await this._listCountriesUncached(service, settings)
    if (value.ok) countryListCache.set(cacheKey, { value, expiresAt: Date.now() + 45_000 })
    return value
  },

  async _listCountriesUncached(service, settings) {
    const serviceId = await resolveServiceId(service)
    if (serviceId === null) return { ok: false, reason: 'UNSUPPORTED' }
    try {
      const { res, data } = await fleexaJson(`/sms6/countries-with-services?appId=${encodeURIComponent(serviceId)}`)
      if (!res.ok || !data?.success || !Array.isArray(data.data)) return { ok: false, reason: 'FETCH_FAILED' }

      const countries = []
      for (const row of data.data) {
        const slug = fleexaSms6SlugForIso(row?.code)
        if (!slug || !isEnabledFor(slug)) continue
        const stock = Number(row.total_available) || 0
        const costNgn = Math.ceil(parseFloat(row.lowest_price_ngn))
        if (stock <= 0 || !(costNgn > 0)) continue
        countries.push({
          country: slug,
          stock,
          priceNgn: computeSellPriceNgn(costNgn, null, { flatMarkupPercent: settings?.fleexaSms6MarkupPercent }),
        })
      }
      return { ok: true, countries }
    } catch (err) {
      return { ok: false, reason: 'FETCH_FAILED', error: err.message }
    }
  },

  async getPriceNgn(country, service, settings) {
    const iso = fleexaSms6Iso(country)
    const serviceId = isEnabledFor(country) && iso !== null ? await resolveServiceId(service) : null
    if (!isEnabledFor(country) || iso === null || serviceId === null) return { ok: false, reason: 'UNSUPPORTED' }

    try {
      const resolved = await resolveCountryId(iso)
      if (!resolved.ok) return { ok: false, reason: resolved.reason }

      const { res, data } = await fleexaJson(
        `/sms6/country-offers?countryId=${encodeURIComponent(resolved.id)}&appId=${encodeURIComponent(serviceId)}`
      )
      if (!res.ok || !data?.success) return { ok: false, reason: 'FETCH_FAILED' }

      // Each band = one provider price tier with its own stock.
      const bands = (Array.isArray(data.data) ? data.data : [])
        .map((b) => ({
          priceUsd: parseFloat(b.price_usd),
          costNgn: parseFloat(b.price_ngn),
          quantity: Number(b.quantity) || 0,
        }))
        .filter((b) => b.quantity > 0 && b.costNgn > 0 && b.priceUsd > 0)

      if (bands.length === 0) return { ok: false, reason: 'OUT_OF_STOCK' }

      // Price ladder, cheapest first. Fleexa's listed stock for the cheapest
      // tier can be stale (UK WhatsApp: 64,191 "available" at $0.315 but a
      // capped buy answered "out of stock"), so buy() may need to step up to
      // the next tier — each with its own sell price computed here.
      const markup = { flatMarkupPercent: settings?.fleexaSms6MarkupPercent }
      const ladder = [...bands]
        .sort((a, b) => a.costNgn - b.costNgn)
        .map((b) => ({ priceUsd: b.priceUsd, costNgn: Math.ceil(b.costNgn), sellNgn: computeSellPriceNgn(Math.ceil(b.costNgn), null, markup) }))

      const cheapest = bands.reduce((a, b) => (b.costNgn < a.costNgn ? b : a))
      const stock = bands.reduce((n, b) => n + b.quantity, 0)
      const costNgn = Math.ceil(cheapest.costNgn)
      const priceNgn = computeSellPriceNgn(costNgn, null, { flatMarkupPercent: settings?.fleexaSms6MarkupPercent })

      return {
        ok: true,
        priceNgn,
        priceUsd: cheapest.priceUsd,
        stock,
        // Handed back to buy() by the orchestrator so the purchase is
        // capped at exactly the band that was quoted.
        quote: { countryId: resolved.id, serviceId, maxPriceUsd: cheapest.priceUsd, costNgn, bands: ladder },
      }
    } catch (err) {
      return { ok: false, reason: 'FETCH_FAILED', error: err.message }
    }
  },

  async buy(country, service, ctx = {}) {
    const iso = fleexaSms6Iso(country)
    const serviceId = isEnabledFor(country) && iso !== null ? await resolveServiceId(service) : null
    if (!isEnabledFor(country) || iso === null || serviceId === null) {
      return { ok: false, errorType: 'UNSUPPORTED', errorMessage: 'Fleexa SMS OTP 6 is not enabled for this country/service.' }
    }

    try {
      const resolved = await resolveCountryId(iso)
      if (!resolved.ok) {
        return { ok: false, errorType: resolved.reason, errorMessage: 'Could not resolve Fleexa country id.' }
      }

      // Try the quoted tier first. If Fleexa says that tier is sold out
      // (HTTP 400 "out of stock"), step up to the next tier — but ONLY while
      // that tier's sell price is still within the price the customer was
      // shown (ctx.maxPriceNgn). The first tier above their limit is
      // reported back as nextPriceNgn so the buy route can ask them to
      // confirm the real price, instead of silently charging more or
      // quietly switching to a backup provider.
      const quote = ctx?.quote
      const capUsd = Number(quote?.maxPriceUsd)
      const tiers = quote?.bands?.length
        ? quote.bands.slice(0, 4)
        : [{ priceUsd: Number.isFinite(capUsd) && capUsd > 0 ? capUsd : null, costNgn: quote?.costNgn, sellNgn: null }]
      const ceilingNgn = Number(ctx?.maxPriceNgn)
      const hasCeiling = Number.isFinite(ceilingNgn) && ceilingNgn > 0

      let body = null
      let res = null
      let data = null
      let chosen = null
      let nextPriceNgn = null
      for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i]
        if (i > 0 && hasCeiling && tier.sellNgn > ceilingNgn) { nextPriceNgn = tier.sellNgn; break }
        body = { countryId: resolved.id, serviceName: serviceId }
        if (tier.priceUsd) body.maxPrice = tier.priceUsd
        ;({ res, data } = await fleexaJson('/sms6/buy', { method: 'POST', body: JSON.stringify(body) }))
        if (res.ok && data?.success) { chosen = tier; break }
        const failMsg = String(data?.message || data?.error?.message || (typeof data?.error === 'string' ? data.error : '') || '')
        const soldOutTier = res.status === 400 && /out of stock|no numbers|unavailable|not available/i.test(failMsg)
        if (!soldOutTier) break
      }

      if (!res.ok || !data?.success) {
        // Fleexa's docs show no failure-response examples for sms6, so
        // the classification below is a best-effort guess (same shape as
        // sms4/sms5). Until real failures have been seen, EVERY failed
        // buy is logged with its raw body so the guesses can be corrected.
        const message = String(data?.message || data?.error?.message || (typeof data?.error === 'string' ? data.error : '') || '')
        const looksLikeFunding = /balance|insufficient|fund|wallet|top.?up/i.test(message)
        const type = looksLikeFunding
          ? 'BALANCE_ERROR'
          : res.status === 429 ? 'RATE_LIMITED' : res.status === 400 ? 'OUT_OF_STOCK' : 'UNKNOWN'

        await log('warning', 'number', `Fleexa sms6 buy failed (HTTP ${res.status}, classified ${type})`, null, null, {
          provider: PROVIDER_ID, http_status: res.status, country, service, request: body, raw: data,
        }).catch(() => {})

        return { ok: false, errorType: type, errorMessage: message || 'Fleexa sms6 purchase failed.', nextPriceNgn }
      }

      const d = data.data || {}
      if (d.id == null || !d.phone) {
        // Fleexa says success but gave us nothing to track the number by.
        // We can't poll or cancel what we can't identify — make it loud.
        await log('error', 'number', 'CRITICAL: Fleexa sms6 reported a successful purchase with no id/phone — number may be paid for but untracked', null, null, {
          provider: PROVIDER_ID, country, service, raw: data,
        }).catch(() => {})
        return { ok: false, errorType: 'UNKNOWN', errorMessage: 'Fleexa sms6 returned an unusable purchase response.' }
      }

      const externalId = String(d.id)

      // Defence in depth: the country id was resolved from the ISO code a
      // moment ago, so this should never trigger. If it ever does, do NOT
      // sell the customer a number in the wrong country. (The cancel will
      // normally be refused by the 6-minute lock; Fleexa auto-refunds an
      // unused order after 20 minutes.)
      if (d.country_code && String(d.country_code).toLowerCase() !== iso) {
        const cancel = await cancelRequest(externalId)
        await log('error', 'number', `Fleexa sms6 sold a number in the wrong country (wanted ${iso}, got ${d.country_code}) — not delivered to the customer`, null, null, {
          provider: PROVIDER_ID, external_id: externalId, phone: d.phone, cancel_result: cancel, raw: data,
        }).catch(() => {})
        return { ok: false, errorType: 'COUNTRY_MISMATCH', errorMessage: 'Provider returned a number for a different country.' }
      }

      const paid = parseFloat(d.amount_paid)
      const quotedCost = chosen?.costNgn ?? ctx?.quote?.costNgn
      if (Number.isFinite(paid) && Number.isFinite(quotedCost) && paid > quotedCost + 1) {
        await log('warning', 'number', `Fleexa sms6 charged more than quoted (paid ₦${paid}, quoted cost ₦${quotedCost})`, null, null, {
          provider: PROVIDER_ID, external_id: externalId, paid, quotedCost, country, service,
        }).catch(() => {})
      }

      // resolveExpiresAt() calls new Date(x).toISOString(), which THROWS on
      // an unparseable string — so only pass expires_at through if it parses.
      const expiresOk = d.expires_at && !Number.isNaN(Date.parse(d.expires_at))

      return {
        ok: true,
        externalId,
        phone: normalizePhone(d.phone),
        meta: { activationId: d.activation_id || d.requestId || null },
        providerExpiresAt: expiresOk ? d.expires_at : null,
        providerExpiresInSeconds: 1200, // Fleexa: numbers stay active 20 minutes
        // Set only when we had to step up to a pricier tier than the one
        // quoted: the orchestrator then charges THIS price (never above the
        // customer's limit) instead of the original quote.
        priceNgnOverride: chosen && chosen !== tiers[0] && Number.isFinite(chosen.sellNgn) ? chosen.sellNgn : undefined,
      }
    } catch (err) {
      return { ok: false, errorType: 'FETCH_FAILED', errorMessage: err.message }
    }
  },

  async checkStatus(externalId) {
    try {
      const { res, data } = await fleexaJson(`/sms6/check/${encodeURIComponent(externalId)}`)
      if (!res.ok || !data?.success) return { status: 'unknown', raw: data }

      const map = { RECEIVED: 'received', WAITING: 'pending', CANCELED: 'cancelled', EXPIRED: 'expired' }
      const code = data.data.code
      const status = map[code] || 'unknown'

      if (!(code in map)) {
        await log('warning', 'number', `Fleexa sms6 returned unrecognized status code "${code}" for order ${externalId}`, null, null, {
          provider: PROVIDER_ID, external_id: externalId, raw: data,
        }).catch(() => {})
      }

      return { status, smsCode: data.data.sms_code, smsText: data.data.sms_text, raw: data }
    } catch (err) {
      return { status: 'unknown', raw: { error: err.message } }
    }
  },

  // Reports the real outcome. During the first 6 minutes this returns
  // ok:false (locked:true) — the number is STILL LIVE then; callers must
  // not treat it as cancelled.
  async cancel(externalId) {
    return cancelRequest(externalId)
  },
}