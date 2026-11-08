// lib/boost/pricing.js
//
// SERVER-SIDE, fully dynamic pricing. No price is ever hardcoded here or
// anywhere in the codebase. Every quote is computed fresh from three
// live inputs, all owned by the database:
//
//   1. boost_services.rate_usd / min_qty / max_qty  — the provider's
//      current cost and limits (kept fresh by scripts/sync-provider-services.mjs)
//   2. app_settings.usd_to_ngn_rate                 — current exchange rate
//   3. app_settings.boost_markup_multiplier         — our margin
//
// price_ngn = ceil( rate_usd * quantity / 1000 * usd_to_ngn_rate * markup )
//
// The browser only ever sends a code + quantity. Everything about price,
// product name, and valid quantity range is decided here, never trusted
// from the client.

import { findService } from './catalog'

async function getSetting(admin, key) {
  const { data, error } = await admin.from('app_settings').select('value').eq('key', key).maybeSingle()
  if (error || !data) return null
  return data.value
}

// Loads the two pricing settings in one round trip.
export async function loadPricingSettings(admin) {
  const { data, error } = await admin
    .from('app_settings')
    .select('key, value')
    .in('key', ['usd_to_ngn_rate', 'boost_markup_multiplier'])

  if (error) return { ok: false, message: 'Could not load pricing settings' }

  const map = Object.fromEntries((data || []).map(r => [r.key, r.value]))
  const fxRate = Number(map.usd_to_ngn_rate)
  const markup = Number(map.boost_markup_multiplier)

  if (!Number.isFinite(fxRate) || fxRate <= 0) {
    return { ok: false, message: 'Exchange rate is not configured' }
  }
  if (!Number.isFinite(markup) || markup <= 0) {
    return { ok: false, message: 'Markup multiplier is not configured' }
  }
  return { ok: true, fxRate, markup }
}

// The authoritative quote for one code + quantity. Returns
// { ok: true, ... } or { ok: false, code, message, ... }.
export async function quoteBoost(admin, { serviceCode, quantity }) {
  const entry = findService(serviceCode)
  if (!entry) return { ok: false, code: 'invalid_service', message: 'Unknown service' }

  const qty = Number(quantity)
  if (!Number.isInteger(qty)) {
    return { ok: false, code: 'invalid_quantity', message: 'Quantity must be a whole number' }
  }

  const { data: svc, error } = await admin
    .from('boost_services')
    .select('rate_usd, min_qty, max_qty, active, label, platform, tier, quality, sync_error')
    .eq('code', serviceCode)
    .maybeSingle()

  if (error || !svc) {
    return { ok: false, code: 'service_unavailable', message: 'Service data not found — try syncing provider services' }
  }
  if (!svc.active) {
    return { ok: false, code: 'service_unavailable', message: 'This service is temporarily unavailable' }
  }
  if (svc.sync_error) {
    // Stale or unhealthy pricing data — refuse rather than quote a possibly
    // wrong price. The sync job's own log is where this gets diagnosed.
    return { ok: false, code: 'service_unavailable', message: 'Pricing for this service could not be verified — try again shortly' }
  }
  if (!(svc.rate_usd > 0) || !(svc.max_qty > 0)) {
    return { ok: false, code: 'service_unavailable', message: 'This service has no valid pricing data yet' }
  }

  const min = svc.min_qty || 1
  const max = svc.max_qty
  if (qty < min || qty > max) {
    return {
      ok: false,
      code: 'quantity_out_of_range',
      message: `Quantity must be between ${min.toLocaleString('en-US')} and ${max.toLocaleString('en-US')}`,
      min,
      max,
    }
  }

  const settings = await loadPricingSettings(admin)
  if (!settings.ok) return { ok: false, code: 'pricing_unavailable', message: settings.message }

  const costUsd = (svc.rate_usd * qty) / 1000
  const priceNgn = Math.ceil(costUsd * settings.fxRate * settings.markup)

  if (!Number.isFinite(priceNgn) || priceNgn <= 0) {
    return { ok: false, code: 'price_unavailable', message: 'Could not compute a price for this quantity' }
  }

  return {
    ok: true,
    serviceCode,
    tier: svc.tier,
    platform: svc.platform,
    label: svc.quality ? `${svc.label} (${svc.quality.toUpperCase()})` : svc.label,
    quantity: qty,
    price: priceNgn,     // NGN, integer, authoritative
    min,
    max,
    providerServiceId: entry.providerServiceId,
    provider: entry.provider,
  }
}