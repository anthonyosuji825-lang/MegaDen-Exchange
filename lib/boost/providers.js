// lib/boost/providers.js
//
// One small client for both providers (JAP and Exobooster). They speak the
// same "SMM v2" protocol: POST form fields (key + action + params) to one URL.
//
// SERVER ONLY. Import this from route handlers / server code, never from a
// 'use client' file. API keys come from process.env and are never logged.
//
// Environment variables (set in .env.local AND in Vercel, never NEXT_PUBLIC_):
//   EXO_API_KEY          required for Turbo (Exobooster)
//   JAP_API_KEY          required for Standard
//   EXOBOOSTER_API_URL   optional override (default https://exosupplier.com/api/v2)
//   JAP_API_URL          optional override (default https://justanotherpanel.com/api/v2)
//
// Every function returns a plain object and never throws for provider
// problems. Failures carry a `kind` so the caller knows what is safe to do:
//
//   'config'   we never sent anything (missing key etc.)      -> safe to refund
//   'rejected' the provider replied with an explicit error    -> safe to refund
//   'unknown'  timeout, network drop, unreadable reply, 5xx   -> NOT safe to
//              assume anything: the order may or may not exist. Send to
//              manual review. Never retry an add automatically.

const PROVIDERS = {
  exobooster: {
    label: 'Exobooster',
    urlEnv: 'EXOBOOSTER_API_URL',
    defaultUrl: 'https://exosupplier.com/api/v2',
    keyEnv: 'EXO_API_KEY',
  },
  jap: {
    label: 'JAP',
    urlEnv: 'JAP_API_URL',
    defaultUrl: 'https://justanotherpanel.com/api/v2',
    keyEnv: 'JAP_API_KEY',
  },
}

export const PROVIDER_KEYS = Object.keys(PROVIDERS)

// Turbo tier uses Exobooster, Standard tier uses JAP.
export function providerForTier(tier) {
  return tier === 'turbo' ? 'exobooster' : 'jap'
}

// ---------------------------------------------------------------------------
// Core request helper
// ---------------------------------------------------------------------------
async function call(providerKey, action, params = {}, timeoutMs = 20000) {
  const cfg = PROVIDERS[providerKey]
  if (!cfg) {
    return { ok: false, kind: 'config', message: `Unknown provider: ${providerKey}` }
  }
  const apiKey = process.env[cfg.keyEnv]
  if (!apiKey) {
    return { ok: false, kind: 'config', message: `${cfg.label} API key is not configured` }
  }
  const url = process.env[cfg.urlEnv] || cfg.defaultUrl

  const body = new URLSearchParams({ key: apiKey, action })
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) body.append(k, String(v))
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let res
  let text
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal,
      cache: 'no-store',
    })
    text = await res.text()
  } catch (err) {
    return {
      ok: false,
      kind: 'unknown',
      message: err && err.name === 'AbortError' ? 'Provider timed out' : 'Could not reach provider',
    }
  } finally {
    clearTimeout(timer)
  }

  let data
  try {
    data = JSON.parse(text)
  } catch {
    return {
      ok: false,
      kind: 'unknown',
      message: `Provider sent an unreadable reply (HTTP ${res.status})`,
    }
  }

  // The SMM v2 protocol reports failures as a normal JSON body,
  // e.g. {"error": "Invalid API key"}, often with HTTP 200.
  // So an HTTP status alone can never be trusted.
  if (data && typeof data === 'object' && !Array.isArray(data) && data.error) {
    return { ok: false, kind: 'rejected', message: String(data.error) }
  }
  if (!res.ok) {
    return { ok: false, kind: 'unknown', message: `Provider returned HTTP ${res.status}` }
  }
  return { ok: true, data }
}

// ---------------------------------------------------------------------------
// Place an order. Called exactly once per job. Never retry it automatically:
// the API has no idempotency key and a timeout does not mean it failed.
// ---------------------------------------------------------------------------
export async function addOrder(providerKey, { service, link, quantity }) {
  const r = await call(providerKey, 'add', { service, link, quantity }, 20000)
  if (!r.ok) return r

  const id = r.data && r.data.order
  if (id === undefined || id === null || String(id).trim() === '') {
    // A reply that is not an error but has no order id is not something we
    // understand. Money may have been spent, so treat as unknown.
    return { ok: false, kind: 'unknown', message: 'Provider reply had no order id' }
  }
  return { ok: true, providerOrderId: String(id) }
}

// ---------------------------------------------------------------------------
// Status values.
// Neither provider publishes a full status list, so this table is deliberately
// strict. Anything not listed becomes 'unknown' and goes to manual review
// instead of triggering a refund. Add new raw values here as you see them in
// boost_jobs.provider_status.
// ---------------------------------------------------------------------------
const STATE_BY_RAW = {
  completed: 'completed',
  partial: 'partial',
  canceled: 'canceled',
  cancelled: 'canceled',
  refunded: 'canceled',
  pending: 'open',
  processing: 'open',
  'in progress': 'open',
  inprogress: 'open',
  'in_progress': 'open',
}

export function normalizeStatus(raw) {
  const key = String(raw || '').trim().toLowerCase()
  return STATE_BY_RAW[key] || 'unknown'
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// Providers return the multi-status result in slightly different shapes:
//   { "123": {...}, "124": {...} }          object keyed by order id (common)
//   [ { "order": 123, ... }, ... ]           array
//   { charge, status, ... }                  single order, when one id was asked
function indexMultiStatus(data, ids) {
  const byId = new Map()
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item && item.order !== undefined) byId.set(String(item.order), item)
    }
  } else if (data && typeof data === 'object') {
    if (ids.length === 1 && ('status' in data || 'charge' in data) && !(ids[0] in data)) {
      byId.set(ids[0], data)
    } else {
      for (const id of ids) {
        if (data[id] !== undefined) byId.set(id, data[id])
      }
    }
  }
  return byId
}

// ---------------------------------------------------------------------------
// Check many orders at once (batches of 100). Returns a Map keyed by
// providerOrderId. Each value is either:
//   { ok: true, rawStatus, state, remains, startCount, chargeUsd, currency }
//   { ok: false, kind, message }
// `state` is one of: open | completed | partial | canceled | unknown
// ---------------------------------------------------------------------------
export async function getStatuses(providerKey, providerOrderIds) {
  const ids = providerOrderIds.map(String)
  const out = new Map()

  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const r = await call(providerKey, 'status', { orders: chunk.join(',') }, 25000)

    if (!r.ok) {
      for (const id of chunk) out.set(id, { ok: false, kind: r.kind, message: r.message })
      continue
    }

    const byId = indexMultiStatus(r.data, chunk)
    for (const id of chunk) {
      const item = byId.get(id)
      if (!item) {
        out.set(id, { ok: false, kind: 'unknown', message: 'Order missing from provider reply' })
      } else if (item.error) {
        // Provider says it does not know this order. Suspicious: review it.
        out.set(id, { ok: false, kind: 'unknown', message: String(item.error) })
      } else {
        out.set(id, {
          ok: true,
          rawStatus: String(item.status ?? ''),
          state: normalizeStatus(item.status),
          remains: num(item.remains),
          startCount: num(item.start_count),
          chargeUsd: num(item.charge),
          currency: item.currency ? String(item.currency) : null,
        })
      }
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Provider wallet balance (for low-balance alerts and pre-checks).
// ---------------------------------------------------------------------------
export async function getBalance(providerKey) {
  const r = await call(providerKey, 'balance', {}, 15000)
  if (!r.ok) return r
  const balance = num(r.data && r.data.balance)
  if (balance === null) {
    return { ok: false, kind: 'unknown', message: 'Provider balance was not a number' }
  }
  return { ok: true, balance, currency: (r.data && r.data.currency) || null }
}