// lib/providers/fleexaProxy.js
//
// Adapter for Fleexa "Residential Proxies": short-term (max 6 hours) proxy
// IPs. From Fleexa's docs:
//   GET  /proxy/plans                   plans (price_ngn = OUR cost), categories, countries
//   POST /proxy/order                   { plan_id, country, state?, proxy_type? }
//                                       + Idempotency-Key header. One SLOT per IP,
//                                       each starts as "purchased".
//   POST /proxy/orders/:id/extract      slot -> live proxy + credentials (6h clock
//                                       starts here). Second extract = 409.
//   POST /proxy/orders/:id/reveal       credentials again (active slots only)
//   POST /proxy/orders/:id/verify       is it still alive?
//   POST /proxy/orders/:id/rotate       new IP, same country/state (502 = slot stopped)
//   POST /proxy/orders/:id/stop         release it (409 unless active)
//   GET  /proxy/orders/:id              one slot
//
// There is NO refund or cancel endpoint for a purchased proxy. That is why
// the buy route is so careful (see app/api/proxy/buy/route.js).
//
// price_ngn is OUR reseller cost. The markup is added by the routes, never
// here, so this file only ever deals in Fleexa's numbers.

import { log } from '@/lib/logger'
import { fleexaRequest, classifyFailure, failureMessage } from '@/lib/fleexaShared'

const toNumber = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : null
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// credentials -> { host, port, username, password, url } or null
function normalizeCredentials(c) {
  if (!c || typeof c !== 'object') return null
  const host = c.host ?? null
  const port = c.port ?? null
  const username = c.username ?? null
  const password = c.password ?? null
  if (!host || port === null || !username || !password) return null
  return { host: String(host), port: String(port), username: String(username), password: String(password), url: c.url ? String(c.url) : null }
}

// ── Catalog ─────────────────────────────────────────────────────────────
export async function listProxyPlans() {
  const r = await fleexaRequest('/proxy/plans')
  if (!r.ok) return { ok: false, kind: classifyFailure(r), message: failureMessage(r, 'Could not load proxy plans.') }
  const d = r.data?.data || {}

  const plans = (Array.isArray(d.plans) ? d.plans : [])
    .map((p) => ({
      id: String(p.id ?? ''),
      label: String(p.label ?? ''),
      quantity: Number.isInteger(p.quantity) ? p.quantity : parseInt(p.quantity, 10) || 1,
      costNgn: toNumber(p.price_ngn),
    }))
    .filter((p) => p.id && p.costNgn !== null && p.costNgn > 0)

  const countries = (Array.isArray(d.countries) ? d.countries : [])
    .map((c) => ({
      code: String(c.code ?? '').toUpperCase(),
      name: String(c.name ?? c.code ?? ''),
      states: Array.isArray(c.states) ? c.states.map(String) : [],
    }))
    .filter((c) => c.code)

  const categories = (Array.isArray(d.categories) ? d.categories : [])
    .map((c) => ({ id: String(c.id ?? ''), name: String(c.name ?? ''), type: Number(c.type), description: String(c.description ?? '') }))
    .filter((c) => c.id && Number.isFinite(c.type))

  return { ok: true, plans, countries, categories, expiryHours: toNumber(d.expiry_hours) || 6 }
}

// ── Buy ─────────────────────────────────────────────────────────────────
// Sent WITH an Idempotency-Key, so repeating the exact same request cannot
// buy twice. That makes it safe to retry once when the first attempt ends in
// a timeout or a 5xx - the only way to find out whether it actually went
// through, short of listing orders afterwards.
//
// Returns { ok:true, reference, slots:[{ id, amountPaidNgn }], amountPaidNgn }
// or      { ok:false, kind, message, http, raw }
export async function orderProxy({ planId, country, state, proxyType, idempotencyKey }) {
  const body = { plan_id: planId, country }
  if (state) body.state = state
  if (proxyType) body.proxy_type = proxyType

  let r = null
  for (let attempt = 1; attempt <= 2; attempt++) {
    r = await fleexaRequest('/proxy/order', { method: 'POST', body, headers: { 'Idempotency-Key': idempotencyKey } })
    if (r.ok) break
    // Only a "we cannot tell" failure is worth repeating; a clean refusal is final.
    if (classifyFailure(r) !== 'AMBIGUOUS') break
    if (attempt === 1) await sleep(1500)
  }

  if (!r.ok) {
    return { ok: false, kind: classifyFailure(r), message: failureMessage(r, 'Could not buy a proxy right now.'), http: r.status, raw: r.data }
  }

  const d = r.data?.data || {}
  const slots = (Array.isArray(d.slots) ? d.slots : [])
    .map((s) => ({ id: String(s.id ?? ''), amountPaidNgn: toNumber(s.amount_paid), status: String(s.status ?? '') }))
    .filter((s) => s.id)

  if (slots.length === 0) {
    // Fleexa says success but gave us nothing to hold on to. The order may
    // exist at Fleexa - the caller logs this loudly with the idempotency key.
    await log('warning', 'number', 'Fleexa proxy/order succeeded but returned no slots - field names need checking against the real response', null, null, {
      feature: 'proxy', provider: 'fleexa_proxy', raw: r.data,
    }).catch(() => {})
    return { ok: false, kind: 'AMBIGUOUS', message: 'Unexpected response from the provider.', http: r.status, raw: r.data }
  }

  return {
    ok: true,
    reference: d.reference ? String(d.reference) : null,
    transactionId: d.transaction_id ? String(d.transaction_id) : null,
    slots,
    amountPaidNgn: toNumber(d.amount_paid),
  }
}

// ── Slot actions ────────────────────────────────────────────────────────
// Every action returns:
//   { ok:true,  status, credentials, expiresAt, raw }
// or{ ok:false, kind, http, message }
// `http` is kept because the route reacts to 409 (already extracted / not
// active) differently from a real failure.
function shapeSlot(r) {
  const d = r.data?.data || {}
  return {
    ok: true,
    status: d.status ? String(d.status).toLowerCase() : null,
    credentials: normalizeCredentials(d.credentials),
    expiresAt: d.expires_at ? String(d.expires_at) : null,
    alive: typeof d.alive === 'boolean' ? d.alive : null,
    checked: typeof d.checked === 'boolean' ? d.checked : null,
    raw: d,
  }
}

async function slotCall(path, method, fallbackMessage) {
  const r = await fleexaRequest(path, { method })
  if (!r.ok) {
    return { ok: false, kind: classifyFailure(r), http: r.status, message: failureMessage(r, fallbackMessage), raw: r.data }
  }
  return shapeSlot(r)
}

const slotPath = (id) => `/proxy/orders/${encodeURIComponent(id)}`

export const getProxySlot = (id) => slotCall(slotPath(id), 'GET', 'Could not load this proxy.')
export const extractProxy = (id) => slotCall(`${slotPath(id)}/extract`, 'POST', 'Could not start this proxy right now.')
export const revealProxy = (id) => slotCall(`${slotPath(id)}/reveal`, 'POST', 'Could not load this proxy.')
export const verifyProxy = (id) => slotCall(`${slotPath(id)}/verify`, 'POST', 'Could not check this proxy.')
export const rotateProxy = (id) => slotCall(`${slotPath(id)}/rotate`, 'POST', 'Could not rotate this proxy.')
export const stopProxy = (id) => slotCall(`${slotPath(id)}/stop`, 'POST', 'Could not stop this proxy.')