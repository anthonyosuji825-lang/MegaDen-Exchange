// lib/fleexaShared.js
//
// Shared plumbing for the Fleexa Email OTP, eSIM and Proxy features.
// Nothing here is specific to one product, so the three adapters and their
// routes stay small and cannot drift apart on the money-handling rules.
//
// Conventions copied from the number routes (app/api/numbers/*), which are
// the proven ones in production:
//   - cookie session -> auth.getUser(), then the service-role client for
//     every privileged read/write
//   - wallet: deduct_wallet_balance (RETURNS TABLE(success, new_balance),
//     must be read with .single() and .success) and credit_wallet_balance
//     (returns a boolean)
//   - orders: product_type / product_name / amount / status / details
//
// MONEY ORDER (differs from the SMS number flow on purpose): for these three
// products the price is known BEFORE buying and none of them can be
// cancelled right after purchase (Email OTP locks cancel for 2 minutes,
// eSIM and Proxy have no cancel at all). So the wallet is debited FIRST,
// atomically, and refunded if the provider purchase fails. That way a
// refused debit can never leave us holding a product nobody paid for.

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { log } from '@/lib/logger'
import { computeSellPriceNgn } from '@/lib/providers/fleexaPricing'

export const FLEEXA_BASE = 'https://fleexa.com.ng/developer'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Auth ────────────────────────────────────────────────────────────────
// Returns the signed-in user or null. Same cookie pattern as the number
// routes.
export async function getAuthedUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { get(name) { return cookieStore.get(name)?.value } } }
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export async function getWalletProfile(userId) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('email, wallet_balance')
    .eq('id', userId)
    .single()
  return { email: data?.email || null, balance: Number(data?.wallet_balance || 0) }
}

// ── Fleexa HTTP ─────────────────────────────────────────────────────────
// Never cached (Next.js would otherwise cache live prices/stock), always
// time-limited so a hung Fleexa call cannot hang a purchase.
//
// Returns { status, data, ok, networkError }
//   ok           HTTP 2xx AND body.success !== false
//   networkError set when the request itself failed (timeout, DNS, reset).
//                A buy that ends this way is AMBIGUOUS - it may have gone
//                through - which is why callers treat it differently from a
//                clean refusal.
export async function fleexaRequest(path, { method = 'GET', body, headers = {}, timeoutMs } = {}) {
  const timeout = timeoutMs || (method === 'GET' ? 8000 : 20000)
  try {
    const res = await fetch(`${FLEEXA_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${process.env.FLEEXA_API_KEY}`,
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(timeout),
    })
    let data = null
    try { data = await res.json() } catch { /* non-JSON error body */ }
    return { status: res.status, data, ok: res.ok && data?.success !== false, networkError: null }
  } catch (err) {
    return { status: 0, data: null, ok: false, networkError: err?.message || 'Network error' }
  }
}

// Sorts a failed Fleexa response into a small set of reasons.
//   AMBIGUOUS     we cannot tell whether it happened (timeout / 5xx)
//   RATE_LIMITED  Fleexa rejected it (429) - nothing happened, safe to retry
//   BALANCE_ERROR OUR Fleexa account is out of funds - top it up
//   NOT_FOUND     404
//   REFUSED       any other clean refusal (4xx with a message)
export function classifyFailure(result) {
  if (result.networkError) return 'AMBIGUOUS'
  if (result.status === 429) return 'RATE_LIMITED'
  if (result.status >= 500) return 'AMBIGUOUS'
  const msg = String(result.data?.message || result.data?.error || '')
  if (/balance|insufficient|fund|wallet|top.?up/i.test(msg)) return 'BALANCE_ERROR'
  if (result.status === 404) return 'NOT_FOUND'
  return 'REFUSED'
}

export function failureMessage(result, fallback) {
  return result.data?.message || result.data?.error || fallback
}

// ── Pricing ─────────────────────────────────────────────────────────────
// Fleexa's price_ngn is OUR reseller cost, not a retail price (see
// lib/providers/fleexaPricing.js), so every price shown to a customer is
// cost + a flat markup. One admin-editable setting per product:
//   fleexa_email_markup_percent / fleexa_esim_markup_percent /
//   fleexa_proxy_markup_percent
// Each falls back to fleexa_markup_percent (the one the SMS numbers use),
// then to 15. Bad values (NaN, negative) fall back too, so a typo in the
// admin page can never produce a NaN price.
export async function getMarkupPercent(feature) {
  const { data } = await supabaseAdmin.from('app_settings').select('key, value')
  const map = {}
  ;(data || []).forEach((s) => { map[s.key] = s.value })
  const pick = (k) => {
    const n = parseFloat(map[k])
    return Number.isFinite(n) && n >= 0 ? n : null
  }
  return pick(`fleexa_${feature}_markup_percent`) ?? pick('fleexa_markup_percent') ?? 15
}

export function sellPriceNgn(costNgn, markupPercent) {
  const cost = Math.ceil(Number(costNgn))
  if (!Number.isFinite(cost) || cost <= 0) return null
  return computeSellPriceNgn(cost, null, { flatMarkupPercent: markupPercent })
}

// ── Wallet ──────────────────────────────────────────────────────────────
// Atomic debit. deduct_wallet_balance does not raise when funds are short -
// it returns one row with success = false - so the result MUST be read with
// .single() and checked on .success (an array, or the row itself, is truthy
// even when the debit was refused).
export async function debitWallet(userId, amount) {
  const { data, error } = await supabaseAdmin
    .rpc('deduct_wallet_balance', { p_user_id: userId, p_amount: amount })
    .single()
  if (error) return { ok: false, reason: 'RPC_ERROR', error: error.message }
  if (!data?.success) return { ok: false, reason: 'INSUFFICIENT', balance: data?.new_balance }
  return { ok: true, balance: data.new_balance }
}

export async function creditWallet(userId, amount) {
  const { data, error } = await supabaseAdmin
    .rpc('credit_wallet_balance', { p_user_id: userId, p_amount: amount })
  return { ok: !error && Boolean(data), error: error?.message }
}

// Refund after a failed purchase. If even the refund fails, make it loud:
// this is the one state where a customer is charged for nothing.
export async function refundOrLog({ userId, userEmail, amount, feature, context }) {
  const refund = await creditWallet(userId, amount)
  if (!refund.ok) {
    await log('error', 'wallet', `CRITICAL: ${feature} purchase failed AFTER the wallet was debited and the automatic refund ALSO failed - customer is charged with nothing, needs manual refund`, userId, userEmail, {
      feature, amount_ngn: amount, refund_error: refund.error, ...context,
    }).catch(() => {})
  }
  return refund.ok
}

// Ledger row. Failure is logged, never thrown: the wallet is already moved,
// this is only the history line.
export async function recordTransaction({ userId, userEmail, type, amount, description, reference, feature }) {
  const { error } = await supabaseAdmin.from('transactions').insert({
    user_id: userId,
    type,
    amount,
    description,
    reference,
    status: 'success',
  })
  if (error) {
    await log('error', 'wallet', `Transaction log insert failed (${feature}, ${type})`, userId, userEmail, {
      feature, amount, reference, tx_error: error.message,
    }).catch(() => {})
  }
  return !error
}

// One purchase per user + product at a time. A slow purchase invites repeat
// taps, and each repeat would buy (and charge for) another one. Per server
// instance - best effort on serverless - but it covers one user hammering
// Buy. Used the same way as buyInFlight in app/api/numbers/buy.
export function makeInFlightGuard() {
  const active = new Set()
  return {
    tryEnter(key) {
      if (active.has(key)) return false
      active.add(key)
      return true
    },
    leave(key) { active.delete(key) },
  }
}