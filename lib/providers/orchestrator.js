// lib/providers/orchestrator.js
//
// Single entry point the routes talk to. Nothing in app/api/numbers/*
// should import a provider file directly — everything goes through here,
// so the fallback behavior lives in exactly one place.

import { fivesim } from './fivesim'
import { smspool } from './smspool'
import { fleexaSms4, fleexaSms5 } from './fleexa'
import { fleexaSms6 } from './fleexaSms6'
import { log } from '@/lib/logger'

const REGISTRY = {
  fivesim,
  smspool,
  fleexa_sms4: fleexaSms4,
  fleexa_sms5: fleexaSms5,
  fleexa_sms6: fleexaSms6,
}

// The actual routing table. Read top-to-bottom as "try this order for
// this pair, fall through on failure." This is the one place that should
// ever need editing when priorities change.
//
// FLEEXA IS THE PRIMARY PROVIDER for SMS OTP. Every chain starts with
// Fleexa sub-services; SMSPool and 5sim are only the backup chain, used
// when every Fleexa option for the pair is unsupported, out of stock, or
// failing. (A provider that reports itself unsupported is simply skipped,
// so unmapped pairs fall straight through to the backups.)
//
//   USA          sms4 / sms5 (service names, no ID mapping) then sms6
//   USA WhatsApp sms5 first (needs approval — skipped if not approved),
//                then sms4, sms6
//   Everything   sms6 only (Fleexa's multi-country service). It is inert
//   else         unless FLEEXA_SMS6_COUNTRIES lists the country — set it
//                to "*" to enable every country with an ISO mapping.
function priorityFor(country, service) {
  if (country === 'usa' && service === 'whatsapp') {
    return [fleexaSms5, fleexaSms4, fleexaSms6, smspool, fivesim]
  }
  if (country === 'usa') {
    return [fleexaSms4, fleexaSms5, fleexaSms6, smspool, fivesim]
  }
  return [fleexaSms6, smspool, fivesim]
}

// excludeProviderIds lets a caller (specifically the reissue-on-stall
// flow) skip whichever provider(s) already failed this order, instead
// of potentially landing right back on the same unreliable one.
function priorityForExcluding(country, service, excludeProviderIds = []) {
  return priorityFor(country, service).filter((p) => !excludeProviderIds.includes(p.id))
}

export function getProviderById(providerId) {
  return REGISTRY[providerId] || null
}

const isFleexa = (provider) => provider.id.startsWith('fleexa_')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Fleexa gets a couple of quick retries on TRANSIENT failures before the
// chain moves on, so a momentary 429/5xx/timeout on the primary doesn't
// push customers onto the backups. Backups are not retried — falling
// through is already their job.
//
// Quotes are read-only, so any transient failure is safe to retry.
// Purchases are different: only RATE_LIMITED (HTTP 429 — the request was
// rejected, nothing was bought) is retried. A buy that fails with a
// network error/timeout is ambiguous — it may have gone through — so it
// is NOT retried, to avoid buying a second number.
// Short-lived quote cache. A purchase asks for the same price twice in a
// row (the buy route's balance pre-check, then buyBestAvailable), and each
// ask can be a slow Fleexa round trip. Sharing one quote for 20 seconds
// halves that. Safe because the quote is never trusted blindly: the
// customer's price ceiling still vetoes a rise, and Fleexa purchases are
// capped (maxPrice) at the quoted USD price. Only successful quotes are
// cached, never failures.
const QUOTE_TTL_MS = 20_000
const quoteCache = new Map() // key -> { price, expiresAt }

// Test/ops hook: forget cached quotes.
export function clearQuoteCache() { quoteCache.clear() }

async function quoteWithRetry(provider, country, service, settings) {
  const key = `${provider.id}|${country}|${service}|${settings?.rate}|${settings?.multiplier}|${settings?.fleexaMarkupPercent}|${settings?.fleexaSms6MarkupPercent}`
  const hit = quoteCache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.price
  const price = await quoteWithRetryUncached(provider, country, service, settings)
  if (price.ok) quoteCache.set(key, { price, expiresAt: Date.now() + QUOTE_TTL_MS })
  return price
}

async function quoteWithRetryUncached(provider, country, service, settings) {
  let price = await provider.getPriceNgn(country, service, settings)
  if (!isFleexa(provider)) return price
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (price.ok || !['FETCH_FAILED', 'THROTTLED'].includes(price.reason)) break
    await sleep(400 * attempt)
    price = await provider.getPriceNgn(country, service, settings)
  }
  return price
}

async function buyWithRetry(provider, country, service, ctx) {
  let purchase = await provider.buy(country, service, ctx)
  if (!isFleexa(provider)) return purchase
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (purchase.ok || purchase.errorType !== 'RATE_LIMITED') break
    await sleep(800 * attempt)
    purchase = await provider.buy(country, service, ctx)
  }
  return purchase
}

// True if at least one Fleexa sub-service would handle this pair. Used by
// the /countries listing to decide which prices to quote live (so the
// price shown matches what Fleexa will actually charge at buy time).
export async function hasFleexaCoverage(country, service) {
  for (const provider of priorityFor(country, service)) {
    if (!isFleexa(provider)) continue
    const supported = typeof provider.supports === 'function' ? await provider.supports(country, service) : true
    if (supported) return true
  }
  return false
}

// Countries Fleexa currently sells for one service, with OUR sell price —
// used to build the country picker from Fleexa's own data (SMS OTP 6's
// reverse lookup is one call per service). USA is added separately by the
// route since it is priced via sms4/sms5.
export async function listFleexaCountries(service, settings) {
  return fleexaSms6.listCountries(service, settings)
}

// Returns the best available price across the priority list without
// purchasing anything — used by the /countries listing endpoint.
export async function getBestPriceNgn(country, service, settings, options = {}) {
  const providers = priorityForExcluding(country, service, options.excludeProviderIds)
  const attempts = []

  for (const provider of providers) {
    const supported = typeof provider.supports === 'function' ? await provider.supports(country, service) : true
    if (!supported) {
      attempts.push({ provider: provider.id, reason: 'UNSUPPORTED' })
      continue
    }
    const price = await quoteWithRetry(provider, country, service, settings)
    if (price.ok) {
      return { ok: true, providerId: provider.id, priceNgn: price.priceNgn, attempts }
    }
    attempts.push({ provider: provider.id, reason: price.reason })
  }

  return { ok: false, attempts }
}

// Tries providers in order until one successfully sells a number.
// Returns the price it actually charged (from whichever provider won)
// so the caller can deduct the wallet for the right amount.
//
// options.maxPriceNgn (optional): a CEILING on what the customer may be
// charged — the price they were shown. A provider whose price is above
// it is skipped BEFORE anything is bought (reason 'PRICE_ABOVE_LIMIT',
// with the price it would have charged, so the caller can ask the user
// to confirm), and the loop moves on: a later, cheaper provider within
// the limit is still used. The winner's own quote is still what gets
// charged — the limit never raises or sets a price, it only vetoes.
export async function buyBestAvailable(country, service, settings, options = {}) {
  const providers = priorityForExcluding(country, service, options.excludeProviderIds)
  const attempts = []
  let fleexaPriceRose = false

  for (const provider of providers) {
    // FLEEXA PRICE-RISE RULE: if a Fleexa service is in stock and working
    // but its price is now ABOVE what the customer was shown, do not quietly
    // sell them a backup provider's number. Stop here — the caller returns
    // the new Fleexa price for the customer to confirm. Backups are only
    // used when Fleexa is unsupported, out of stock, or failing.
    if (fleexaPriceRose && !isFleexa(provider)) break

    const supported = typeof provider.supports === 'function' ? await provider.supports(country, service) : true
    if (!supported) {
      attempts.push({ provider: provider.id, reason: 'UNSUPPORTED' })
      continue
    }

    const price = await quoteWithRetry(provider, country, service, settings)
    if (!price.ok) {
      attempts.push({ provider: provider.id, reason: price.reason })
      continue
    }

    // Price ceiling (see the comment above this function): veto this
    // provider BEFORE buying, and keep looking.
    if (Number.isFinite(options.maxPriceNgn) && price.priceNgn > options.maxPriceNgn) {
      attempts.push({ provider: provider.id, reason: 'PRICE_ABOVE_LIMIT', priceNgn: price.priceNgn })
      if (isFleexa(provider)) fleexaPriceRose = true
      continue
    }

    // The quote is passed through so a provider can cap the purchase at
    // exactly what it just quoted (fleexaSms6 sends it as maxPrice).
    // Providers that don't need it ignore the extra argument.
    const purchase = await buyWithRetry(provider, country, service, { quote: price.quote, maxPriceNgn: options.maxPriceNgn })
    if (!purchase.ok) {
      // The provider's cheaper tier was sold out and its next tier costs
      // more than the customer was shown: report it as a price rise (so
      // they are asked to confirm the real price) rather than a plain
      // failure that would quietly fall through to a backup.
      if (Number.isFinite(purchase.nextPriceNgn)) {
        attempts.push({ provider: provider.id, reason: 'PRICE_ABOVE_LIMIT', priceNgn: purchase.nextPriceNgn })
        if (isFleexa(provider)) fleexaPriceRose = true
        continue
      }
      attempts.push({ provider: provider.id, reason: purchase.errorType, message: purchase.errorMessage })

      // Our own provider account is out of funds. Customers just see
      // "no numbers available" while the chain falls through, so make it
      // loud here — for Fleexa this is the one to top up first.
      if (purchase.errorType === 'BALANCE_ERROR') {
        await log(
          'error',
          'wallet',
          `PROVIDER BALANCE: ${provider.id} refused a purchase because our account there is out of funds — top it up${isFleexa(provider) ? ' (PRIMARY provider)' : ''}`,
          null,
          null,
          { provider: provider.id, country, service, message: purchase.errorMessage },
        ).catch(() => {})
      }
      continue
    }

    return {
      ok: true,
      providerId: provider.id,
      priceNgn: purchase.priceNgnOverride ?? price.priceNgn,
      externalId: purchase.externalId,
      phone: purchase.phone,
      meta: purchase.meta || {},
      // providerExpiresAt (absolute timestamp) takes priority when a
      // provider gives one directly (Fleexa does) — it's ground truth
      // for when THAT number actually dies, which can genuinely differ
      // from our own 20-minute default. providerExpiresInSeconds is the
      // duration-based fallback (SMSPool gives a real one; 5sim's is
      // just our own policy value, since 5sim doesn't report one).
      providerExpiresAt: purchase.providerExpiresAt || null,
      providerExpiresInSeconds: purchase.providerExpiresInSeconds || 1200,
      attempts,
    }
  }

  return { ok: false, attempts }
}

// -- Canonical status vocabulary used everywhere downstream -------------
// 'pending' | 'received' | 'expired' | 'cancelled' | 'banned' | 'unknown'
// Every provider adapter already normalizes into this set in checkStatus().

export async function checkOrderStatus(providerId, externalId) {
  const provider = getProviderById(providerId)
  if (!provider) return { status: 'unknown', raw: { error: `Unknown provider: ${providerId}` } }
  return provider.checkStatus(externalId)
}

export async function cancelOrder(providerId, externalId) {
  const provider = getProviderById(providerId)
  if (!provider) return { ok: false, message: `Unknown provider: ${providerId}` }
  return provider.cancel(externalId)
}

// Turns a buyBestAvailable/tryReissue result into the actual deadline to
// store on the order. Providers that give a real absolute expiry
// (Fleexa) are trusted directly; providers that only give a duration
// (SMSPool's real data.expires_in, or 5sim/anyone's fallback default)
// get Date.now() + that duration. Centralized here so buy/route.js and
// tryReissue (lib/numberOrders.js) can't drift from each other on this
// — they used to each hardcode their own "20 minutes from now",
// ignoring whatever the provider actually reported.
export function resolveExpiresAt(result) {
  if (result.providerExpiresAt) {
    return new Date(result.providerExpiresAt).toISOString()
  }
  const seconds = result.providerExpiresInSeconds || 1200
  return new Date(Date.now() + seconds * 1000).toISOString()
}