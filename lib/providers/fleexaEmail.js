// lib/providers/fleexaEmail.js
//
// Adapter for Fleexa "Email OTP": temporary email addresses that receive
// verification codes for a supported site (telegram, facebook, ...).
//
// From Fleexa's docs:
//   GET  /email/products               supported sites + price
//   GET  /email/domains?site=          domains for a site, each with its own
//                                      price (price_ngn) and stock (count)
//   POST /email/buy                    { domain, site } -> one address
//   POST /email/buy-batch              { domain, site, count } -> up to 10
//   GET  /email/check/:emailId         WAITING | RECEIVED | CANCELED | EXPIRED
//   POST /email/cancel                 { requestId } - only AFTER 2 minutes
//
// price_ngn everywhere is OUR reseller cost. The markup is added by the
// routes (lib/fleexaShared.js), never here, so this file only ever deals in
// Fleexa's numbers.
//
// The docs example for /email/check is odd: the STATUS comes back in a field
// called `code`, and the actual OTP in `code_received` (and `sms`). Fleexa's
// docs have been wrong before (see fleexaRent.js), so the normalizer below is
// deliberately tolerant and logs a warning when a response matches nothing it
// knows, instead of guessing silently.

import { log } from '@/lib/logger'
import { fleexaRequest, classifyFailure, failureMessage } from '@/lib/fleexaShared'

const toNumber = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : null
}

const normalizeDomain = (d) => {
  const raw = String(d || '').trim().toLowerCase()
  return raw.startsWith('@') ? raw : `@${raw}`
}

// Fleexa's buy endpoints add the "@" themselves: sending "@gmail.com" made
// them look up "@@gmail.com" and answer 404 "not available" (seen live).
// So the domain list keeps the "@" for display/matching, but it is stripped
// before any purchase request.
const domainForBuy = (d) => normalizeDomain(d).replace(/^@+/, '')

// ── Catalog ─────────────────────────────────────────────────────────────
export async function listEmailProducts() {
  const r = await fleexaRequest('/email/products')
  if (!r.ok || !Array.isArray(r.data?.data)) {
    return { ok: false, reason: 'FETCH_FAILED', message: failureMessage(r, 'Could not load email services.') }
  }
  const sites = r.data.data
    .map((p) => ({ id: String(p.id ?? p.name ?? ''), name: String(p.name ?? p.id ?? ''), costNgn: toNumber(p.price_ngn) }))
    .filter((p) => p.id)
  return { ok: true, sites }
}

export async function listEmailDomains(site) {
  const r = await fleexaRequest(`/email/domains?site=${encodeURIComponent(site)}`)
  if (!r.ok || !Array.isArray(r.data?.data)) {
    return { ok: false, reason: 'FETCH_FAILED', message: failureMessage(r, 'Could not load domains for this service.') }
  }
  const domains = r.data.data
    .map((d) => ({
      name: normalizeDomain(d.name),
      costNgn: toNumber(d.price_ngn),
      stock: Number.isFinite(Number(d.count)) ? Number(d.count) : null,
    }))
    .filter((d) => d.name !== '@' && d.costNgn !== null && d.costNgn > 0)
  return { ok: true, domains }
}

// ── Buy ─────────────────────────────────────────────────────────────────
// A failed buy returns { ok:false, kind, message }. kind is one of
// classifyFailure()'s reasons; the route refunds the wallet in every case,
// and BALANCE_ERROR additionally pages the admin (our Fleexa wallet is dry).
export async function buyEmail({ site, domain }) {
  const r = await fleexaRequest('/email/buy', { method: 'POST', body: { domain: domainForBuy(domain), site } })
  if (!r.ok) {
    return { ok: false, kind: classifyFailure(r), message: failureMessage(r, 'Could not get an email address right now.'), http: r.status, raw: r.data }
  }
  const d = r.data?.data || {}
  const emailId = d.emailId ?? d.email_id ?? d.id ?? null
  const email = d.email ?? null
  if (!emailId || !email) {
    await log('warning', 'number', 'Fleexa email/buy succeeded but the response has no emailId/email - field names need checking against the real response', null, null, {
      feature: 'email_otp', provider: 'fleexa_email', raw: r.data,
    }).catch(() => {})
    return { ok: false, kind: 'AMBIGUOUS', message: 'Unexpected response from the provider.', raw: r.data }
  }
  return {
    ok: true,
    items: [{ emailId: String(emailId), email }],
    amountPaidNgn: toNumber(d.amount_paid),
  }
}

export async function buyEmailBatch({ site, domain, count }) {
  const r = await fleexaRequest('/email/buy-batch', { method: 'POST', body: { domain: domainForBuy(domain), site, count } })
  if (!r.ok) {
    return { ok: false, kind: classifyFailure(r), message: failureMessage(r, 'Could not get email addresses right now.'), http: r.status, raw: r.data }
  }
  const d = r.data?.data || {}
  const items = (Array.isArray(d.emails) ? d.emails : [])
    .map((e) => ({ emailId: String(e.emailId ?? e.email_id ?? e.id ?? ''), email: e.email || null }))
    .filter((e) => e.emailId && e.email)
  if (items.length === 0) {
    await log('warning', 'number', 'Fleexa email/buy-batch succeeded but returned no usable emails', null, null, {
      feature: 'email_otp', provider: 'fleexa_email', raw: r.data,
    }).catch(() => {})
    return { ok: false, kind: 'AMBIGUOUS', message: 'Unexpected response from the provider.', raw: r.data }
  }
  return { ok: true, items, amountPaidNgn: toNumber(d.total_paid) }
}

// ── Check ───────────────────────────────────────────────────────────────
// Normalized status vocabulary (lower-case):
//   waiting | received | cancelled | expired | unknown
// `ok:false` means Fleexa could not be reached - callers must NOT treat that
// as "dead", only as "ask again later".
export async function checkEmail(emailId) {
  const r = await fleexaRequest(`/email/check/${encodeURIComponent(emailId)}`)
  if (!r.ok) {
    // A 404 here can mean the activation is gone; anything else is just a
    // provider hiccup. Either way the caller gets ok:false and decides.
    return { ok: false, reason: classifyFailure(r), message: failureMessage(r, 'Could not check this email.') }
  }
  const d = r.data?.data || {}

  const statusWord = String(d.status ?? d.code ?? '').trim().toUpperCase()
  // The OTP: code_received is the explicit field; sms is the fallback.
  const received = d.code_received ?? d.sms ?? null
  const code = received !== null && String(received).trim() !== '' ? String(received).trim() : null
  const text = d.sms ?? d.code_received ?? null

  let status = 'unknown'
  if (statusWord === 'RECEIVED' || (statusWord !== 'WAITING' && code && !['CANCELED', 'CANCELLED', 'EXPIRED'].includes(statusWord))) status = 'received'
  else if (statusWord === 'WAITING' || statusWord === 'PENDING') status = 'waiting'
  else if (statusWord === 'CANCELED' || statusWord === 'CANCELLED') status = 'cancelled'
  else if (statusWord === 'EXPIRED') status = 'expired'

  if (status === 'unknown') {
    await log('warning', 'number', 'Fleexa email/check returned a status we do not recognise', null, null, {
      feature: 'email_otp', provider: 'fleexa_email', email_id: emailId, raw: r.data,
    }).catch(() => {})
  }

  return { ok: true, status, code, text: text ? String(text) : null, email: d.email || null }
}

// ── Cancel ──────────────────────────────────────────────────────────────
// Fleexa refuses this inside the first 2 minutes. Returned honestly as
// ok:false so the caller can keep the order alive instead of refunding a
// still-live address.
export async function cancelEmail(emailId) {
  const r = await fleexaRequest('/email/cancel', { method: 'POST', body: { requestId: emailId } })
  if (r.ok) return { ok: true }
  return { ok: false, kind: classifyFailure(r), message: failureMessage(r, 'This email cannot be cancelled yet.') }
}