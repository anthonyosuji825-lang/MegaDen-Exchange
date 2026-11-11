// lib/providers/fleexaEsim.js
//
// Adapter for Fleexa "Travel eSIM". From Fleexa's docs:
//   GET  /esim/destinations                  cheapest price per country/region/global
//   GET  /esim/catalog                       plans (filters: scope, country, region, type, search...)
//   GET  /esim/catalog/:planId               one plan
//   POST /esim/order                         { plan_id } + Idempotency-Key. Provisions
//                                            synchronously; returns ICCID, activation
//                                            code, SMDP address, install URLs
//   GET  /esim/orders/:id                    one order, refreshed from the carrier
//   GET  /esim/orders/:id/usage              remaining data
//   GET  /esim/orders/:id/qrcode             LPA string + PNG data URL
//   GET  /esim/orders/:id/topup-packages     compatible top-ups
//   POST /esim/orders/:id/topup              { topup_package_id } + Idempotency-Key
//
// price_ngn everywhere is OUR reseller cost. The markup is added by the
// routes (never here), so this file only deals in Fleexa's numbers.

import { fleexaRequest, classifyFailure, failureMessage } from '@/lib/fleexaShared'

const toNumber = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : null
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Provisioning is synchronous at Fleexa, so allow it more time than the
// default 20s - but two attempts must still fit in the route's 60s budget.
const ORDER_TIMEOUT_MS = 25000

// What we do with an order's status. Fleexa documents "issued", "active" and
// the terminal "expired", "cancelled", "failed"; anything else is treated as
// "still being set up" rather than guessed at.
//   ready    delivered - the customer can install it
//   expired  validity is over
//   dead     failed / cancelled - will never be delivered
//   waiting  not finished yet
export function normalizeEsimStatus(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'issued' || s === 'active' || s === 'activated' || s === 'completed' || s === 'success') return 'ready'
  if (s === 'expired') return 'expired'
  if (s === 'failed' || s === 'cancelled' || s === 'canceled' || s === 'refunded' || s === 'rejected') return 'dead'
  return 'waiting'
}

function normalizePlan(p) {
  return {
    id: String(p.id ?? ''),
    name: String(p.name ?? ''),
    scope: String(p.scope ?? ''),
    type: String(p.type ?? 'data'),
    countryCode: p.country_code ? String(p.country_code) : null,
    countryName: p.country_name ? String(p.country_name) : null,
    regionCode: p.region_code ? String(p.region_code) : null,
    dataMb: toNumber(p.data_mb),
    isUnlimited: Boolean(p.is_unlimited),
    validityDays: toNumber(p.validity_days),
    networks: Array.isArray(p.networks) ? p.networks.map(String) : [],
    supportsTopup: Boolean(p.supports_topup),
    costNgn: toNumber(p.price_ngn),
  }
}

function normalizeOrder(o) {
  if (!o || typeof o !== 'object') return null
  return {
    id: o.id ? String(o.id) : null,
    status: o.status ? String(o.status).toLowerCase() : null,
    kind: o.kind ? String(o.kind) : null,
    iccid: o.iccid ? String(o.iccid) : null,
    smdpAddress: o.smdp_address ? String(o.smdp_address) : null,
    activationCode: o.activation_code ? String(o.activation_code) : null,
    installUrls: o.install_urls && typeof o.install_urls === 'object'
      ? { ios: o.install_urls.ios ? String(o.install_urls.ios) : null, android: o.install_urls.android ? String(o.install_urls.android) : null }
      : null,
    amountNgn: toNumber(o.amount_ngn),
    confirmationPending: Boolean(o.confirmation_pending),
    expiresAt: o.expires_at ? String(o.expires_at) : null,
    activatedAt: o.activated_at ? String(o.activated_at) : null,
    trackingSupported: typeof o.tracking_supported === 'boolean' ? o.tracking_supported : null,
  }
}

const fail = (r, fallback) => ({ ok: false, kind: classifyFailure(r), http: r.status, message: failureMessage(r, fallback), raw: r.data, code: r.data?.error?.code || r.data?.code || null })

// ── Catalog ─────────────────────────────────────────────────────────────
const SCOPES = ['country', 'regional', 'global']
const TYPES = ['data', 'unlimited', 'calling']

export async function listEsimDestinations({ scope = 'country', type = 'data' } = {}) {
  const qs = new URLSearchParams({
    scope: SCOPES.includes(scope) ? scope : 'country',
    type: TYPES.includes(type) ? type : 'data',
  })
  const r = await fleexaRequest(`/esim/destinations?${qs}`)
  if (!r.ok) return fail(r, 'Could not load eSIM destinations.')
  const destinations = (Array.isArray(r.data?.data) ? r.data.data : [])
    .map((d) => ({
      key: String(d.key ?? ''),
      name: String(d.name ?? ''),
      code: d.code ? String(d.code) : null,
      continent: d.continent ? String(d.continent) : null,
      scope: String(d.scope ?? scope),
      planCount: toNumber(d.plan_count) || 0,
      fromCostNgn: toNumber(d.from_price_ngn),
    }))
    .filter((d) => d.key && d.name && d.fromCostNgn !== null && d.fromCostNgn > 0)
  return { ok: true, destinations }
}

// First page only (100 plans, cheapest first) - one destination rarely has
// more, and the page lets the customer filter what is shown.
export async function listEsimPlans({ scope, country, region, type = 'data' } = {}) {
  const qs = new URLSearchParams({ per_page: '100', sort: 'price', type: TYPES.includes(type) ? type : 'data' })
  if (scope && SCOPES.includes(scope)) qs.set('scope', scope)
  if (country) qs.set('country', country)
  if (region) qs.set('region', region)
  const r = await fleexaRequest(`/esim/catalog?${qs}`)
  if (!r.ok) return fail(r, 'Could not load eSIM plans.')
  const plans = (Array.isArray(r.data?.data) ? r.data.data : [])
    .map(normalizePlan)
    .filter((p) => p.id && p.costNgn !== null && p.costNgn > 0)
  return { ok: true, plans }
}

export async function getEsimPlan(planId) {
  const r = await fleexaRequest(`/esim/catalog/${encodeURIComponent(planId)}`)
  if (!r.ok) return fail(r, 'This eSIM plan is not available.')
  const plan = normalizePlan(r.data?.data || {})
  if (!plan.id || plan.costNgn === null || plan.costNgn <= 0) return { ok: false, kind: 'NOT_FOUND', http: r.status, message: 'This eSIM plan is not available.', raw: r.data }
  return { ok: true, plan }
}

// ── Buying (new eSIM and top-up share the retry rule) ───────────────────
// Sent WITH an Idempotency-Key, so repeating the same request cannot buy
// twice. That makes it safe to retry once after a timeout or 5xx.
async function postWithRetry(path, body, idempotencyKey) {
  let r = null
  for (let attempt = 1; attempt <= 2; attempt++) {
    r = await fleexaRequest(path, { method: 'POST', body, headers: { 'Idempotency-Key': idempotencyKey }, timeoutMs: ORDER_TIMEOUT_MS })
    if (r.ok) break
    if (classifyFailure(r) !== 'AMBIGUOUS') break
    if (attempt === 1) await sleep(1500)
  }
  return r
}

// Returns { ok:true, order, reference } or { ok:false, kind, message, http, raw }
export async function orderEsim({ planId, idempotencyKey }) {
  const r = await postWithRetry('/esim/order', { plan_id: planId }, idempotencyKey)
  if (!r.ok) return fail(r, 'Could not buy this eSIM right now.')
  const order = normalizeOrder(r.data?.data?.order)
  if (!order || !order.id) return { ok: false, kind: 'AMBIGUOUS', http: r.status, message: 'Unexpected response from the provider.', raw: r.data }
  return { ok: true, order, reference: r.data?.data?.reference ? String(r.data.data.reference) : null }
}

export async function topupEsim({ orderId, packageId, idempotencyKey }) {
  const r = await postWithRetry(`/esim/orders/${encodeURIComponent(orderId)}/topup`, { topup_package_id: packageId }, idempotencyKey)
  if (!r.ok) return fail(r, 'Could not apply this top-up right now.')
  const order = normalizeOrder(r.data?.data?.order)
  if (!order || !order.id) return { ok: false, kind: 'AMBIGUOUS', http: r.status, message: 'Unexpected response from the provider.', raw: r.data }
  return { ok: true, order, reference: r.data?.data?.reference ? String(r.data.data.reference) : null }
}

// ── Reading an order ────────────────────────────────────────────────────
export async function getEsimOrder(orderId) {
  const r = await fleexaRequest(`/esim/orders/${encodeURIComponent(orderId)}`)
  if (!r.ok) return fail(r, 'Could not load this eSIM.')
  const order = normalizeOrder(r.data?.data)
  if (!order) return { ok: false, kind: 'AMBIGUOUS', http: r.status, message: 'Unexpected response from the provider.', raw: r.data }
  return { ok: true, order }
}

export async function getEsimUsage(orderId) {
  const r = await fleexaRequest(`/esim/orders/${encodeURIComponent(orderId)}/usage`)
  if (!r.ok) return fail(r, 'Could not load usage.')
  const d = r.data?.data || {}
  return {
    ok: true,
    trackingSupported: d.tracking_supported === false ? false : true,
    reason: d.reason ? String(d.reason) : null,
    remainingMb: toNumber(d.remaining_mb),
    totalMb: toNumber(d.total_mb),
    expiresAt: d.expires_at ? String(d.expires_at) : null,
  }
}

export async function getEsimQr(orderId) {
  const r = await fleexaRequest(`/esim/orders/${encodeURIComponent(orderId)}/qrcode`)
  if (!r.ok) return fail(r, 'Could not load the QR code.')
  const d = r.data?.data || {}
  if (!d.lpa_string && !d.qr_data_url) return { ok: false, kind: 'AMBIGUOUS', http: r.status, message: 'Unexpected response from the provider.', raw: r.data }
  return {
    ok: true,
    lpaString: d.lpa_string ? String(d.lpa_string) : null,
    qrDataUrl: typeof d.qr_data_url === 'string' && d.qr_data_url.startsWith('data:image/') ? d.qr_data_url : null,
    smdpAddress: d.smdp_address ? String(d.smdp_address) : null,
    activationCode: d.activation_code ? String(d.activation_code) : null,
    installUrls: d.install_urls && typeof d.install_urls === 'object'
      ? { ios: d.install_urls.ios ? String(d.install_urls.ios) : null, android: d.install_urls.android ? String(d.install_urls.android) : null }
      : null,
  }
}

export async function listTopupPackages(orderId) {
  const r = await fleexaRequest(`/esim/orders/${encodeURIComponent(orderId)}/topup-packages`)
  if (!r.ok) return fail(r, 'Could not load top-up packages.')
  const packages = (Array.isArray(r.data?.data) ? r.data.data : [])
    .map((p) => ({
      id: String(p.id ?? ''),
      name: String(p.name ?? ''),
      dataMb: toNumber(p.data_mb),
      isUnlimited: Boolean(p.is_unlimited),
      validityDays: toNumber(p.validity_days),
      costNgn: toNumber(p.price_ngn),
    }))
    .filter((p) => p.id && p.costNgn !== null && p.costNgn > 0)
  return { ok: true, supportsTopup: r.data?.supports_topup !== false && packages.length > 0, packages }
}