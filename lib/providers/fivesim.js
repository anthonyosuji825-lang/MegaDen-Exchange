// lib/providers/fivesim.js
//
// Adapter for 5sim.net, wrapped to match the common provider interface
// used by lib/providers/orchestrator.js. This is the only provider that
// speaks MegaDen's canonical country/service slugs natively — no ID
// mapping needed.

import { log } from '@/lib/logger'

const BASE = 'https://5sim.net/v1'

function headers() {
  return {
    Authorization: `Bearer ${process.env.FIVESIM_API_KEY}`,
    Accept: 'application/json',
  }
}

// Same operator-priority idea as before, kept because it's a real (if
// blunt) lever for the countries it applies to. Left open to being
// replaced by real success-rate data later — this is a static guess,
// not a data-driven choice.
const OPERATOR_PRIORITY = {
  usa: ['att', 'tmobile', 'verizon', 'sprint', 'metropcs'],
  canada: ['rogers', 'bell', 'telus', 'fido', 'koodo'],
}

async function pickOperator(country, service) {
  const priority = OPERATOR_PRIORITY[country]
  if (!priority) return 'any'

  try {
    const res = await fetch(`${BASE}/guest/prices?country=${country}&product=${service}`, { headers: headers(), signal: AbortSignal.timeout(10000) })
    if (!res.ok) return 'any'
    const data = await res.json()
    const operators = data?.[country]?.[service]
    if (!operators) return 'any'
    for (const op of priority) {
      if (operators[op] && operators[op].count > 0) return op
    }
  } catch {
    // fall through to 'any'
  }
  return 'any'
}

export const fivesim = {
  id: 'fivesim',

  // 5sim has no per-pair capability gate — it either has the country/
  // service in its live catalog or it doesn't, which getPriceNgn already
  // has to check anyway.
  supports() {
    return true
  },

  async getPriceNgn(country, service, { rate, multiplier }) {
    try {
      const res = await fetch(`${BASE}/guest/prices?country=${country}&product=${service}`, { headers: headers(), signal: AbortSignal.timeout(10000) })
      if (!res.ok) return { ok: false, reason: 'FETCH_FAILED' }
      const data = await res.json()
      const operators = data?.[country]?.[service]
      if (!operators) return { ok: false, reason: 'NOT_AVAILABLE' }

      let bestPrice = Infinity
      let totalStock = 0
      for (const [, info] of Object.entries(operators)) {
        if (!info || info.count === 0) continue
        totalStock += info.count
        if (info.cost < bestPrice) bestPrice = info.cost
      }
      if (totalStock === 0 || bestPrice === Infinity) return { ok: false, reason: 'OUT_OF_STOCK' }

      const displayPriceUsd = Math.max(bestPrice, 0.5)
      const priceNgn = Math.ceil(displayPriceUsd * rate * multiplier)
      return { ok: true, priceNgn, priceUsd: displayPriceUsd, stock: totalStock }
    } catch (err) {
      return { ok: false, reason: 'FETCH_FAILED', error: err.message }
    }
  },

  async buy(country, service) {
    const operator = await pickOperator(country, service)

    const attempt = async (op) => {
      const res = await fetch(`${BASE}/user/buy/activation/${country}/${op}/${service}`, { headers: headers(), signal: AbortSignal.timeout(10000) })
      if (res.ok) return { ok: true, data: await res.json(), operatorUsed: op }
      return { ok: false, error: await res.text() }
    }

    let result = await attempt(operator)
    if (!result.ok && operator !== 'any') {
      result = await attempt('any')
      if (result.ok) result.operatorUsed = 'any (fallback)'
    }

    if (!result.ok) {
      // 5sim doesn't give a structured error type — just raw text. We
      // don't yet have a confirmed example of what it says for "account
      // needs topping up" specifically (that needs deliberately draining
      // an account to observe), so this is a best-effort keyword match,
      // not a guaranteed-correct classification. Still better than
      // bucketing every failure as OUT_OF_STOCK regardless of cause —
      // if this ever misfires, the raw errorMessage is still logged
      // alongside it for someone to correct the keyword list from.
      const looksLikeFunding = /balance|insufficient|fund|credit|top.?up/i.test(result.error || '')
      return {
        ok: false,
        errorType: looksLikeFunding ? 'BALANCE_ERROR' : 'OUT_OF_STOCK',
        errorMessage: result.error,
      }
    }

    return {
      ok: true,
      externalId: String(result.data.id),
      phone: result.data.phone,
      meta: { operator: result.data.operator, operatorChosenBy: result.operatorUsed },
      // 5sim's own quoted expiry — used as a hint only, our own 20-min
      // window (set by the orchestrator) is the source of truth so all
      // providers behave consistently for the frontend countdown.
      providerExpiresInSeconds: 1200,
    }
  },

  async checkStatus(externalId) {
    try {
      const res = await fetch(`${BASE}/user/check/${externalId}`, { headers: headers(), signal: AbortSignal.timeout(10000) })
      if (!res.ok) return { status: 'unknown', raw: { httpStatus: res.status } }
      const data = await res.json()

      if (data.sms && data.sms.length > 0) {
        return { status: 'received', smsCode: data.sms[0].code, smsText: data.sms[0].text, raw: data }
      }

      const map = {
        PENDING: 'pending',
        RECEIVED: 'received',
        CANCELED: 'cancelled',
        TIMEOUT: 'expired',
        // FINISHED normally means the activation already completed
        // successfully — the sms.length check above already catches
        // that case. If FINISHED shows up with no sms in the same
        // response (5sim lag), treat it as 'unknown' rather than
        // 'expired': 'unknown' just makes evaluateAndResolveOrder wait
        // for our own window to elapse, instead of immediately
        // reissuing/refunding an order that may actually have
        // succeeded.
        FINISHED: 'unknown',
        BANNED: 'banned',
      }
      const status = map[data.status] || 'unknown'

      // data.status not being a key in map at all (as opposed to FINISHED,
      // which IS in the map and deliberately resolves to 'unknown') means
      // 5sim returned a status this adapter has genuinely never seen —
      // same evidence-gathering as the SMSPool/Fleexa adapters, so any
      // new status added on 5sim's side surfaces here instead of quietly
      // vanishing into 'unknown'.
      if (!(data.status in map)) {
        await log('warning', 'number', `5sim returned unrecognized status "${data.status}" for order ${externalId}`, null, null, {
          provider: 'fivesim', external_id: externalId, raw: data,
        }).catch(() => {})
      }

      return { status, raw: data }
    } catch (err) {
      return { status: 'unknown', raw: { error: err.message } }
    }
  },

  async cancel(externalId) {
    try {
      const checkRes = await fetch(`${BASE}/user/check/${externalId}`, { headers: headers(), signal: AbortSignal.timeout(10000) })
      if (checkRes.ok) {
        const checkData = await checkRes.json()
        if (checkData.sms && checkData.sms.length > 0) {
          return { ok: false, alreadyReceived: true, message: 'SMS already received — no refund possible.' }
        }
      }
      const res = await fetch(`${BASE}/user/cancel/${externalId}`, { headers: headers(), signal: AbortSignal.timeout(10000) })
      if (res.ok) return { ok: true }
      // Report the truth: the cancel did NOT go through. Whether that
      // blocks a refund is the CALLER's decision (the manual-cancel route
      // re-checks the provider's real status; the auto-resolve path
      // refunds regardless because the order is already dead).
      const body = await res.text().catch(() => '')
      return { ok: false, alreadyReceived: false, message: body || `5sim cancel failed (HTTP ${res.status})` }
    } catch (err) {
      return { ok: false, alreadyReceived: false, message: err.message }
    }
  },
}