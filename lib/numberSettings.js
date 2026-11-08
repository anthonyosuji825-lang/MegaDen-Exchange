// lib/numberSettings.js
//
// ONE place that loads the pricing settings for the SMS OTP path.
//
// Previously app/api/numbers/buy, app/api/numbers/countries and
// lib/numberOrders.js each had their own copy of getSettings(), and
// they had already drifted: numberOrders.js was missing
// fleexaMarkupPercent, so a reissue onto a Fleexa provider priced with
// the 15% default even if the admin had changed it.
//
// Values are validated, not just parsed. parseFloat('abc') is NaN, and
// a NaN rate/multiplier would flow into Math.ceil(...) and produce a NaN
// price. `walletBalance < NaN` is always false, so the pre-purchase
// balance check would silently pass. A bad admin-entered value now falls
// back to the default instead of poisoning every price.

function positiveOr(value, fallback) {
  const n = parseFloat(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function nonNegativeOr(value, fallback) {
  const n = parseFloat(value)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export async function getNumberSettings(supabaseAdmin) {
  const { data } = await supabaseAdmin.from('app_settings').select('key, value')
  const map = {}
  ;(data || []).forEach((s) => { map[s.key] = s.value })

  const fleexaMarkupPercent = nonNegativeOr(map.fleexa_markup_percent, 15)

  return {
    rate: positiveOr(map.usd_to_ngn_rate || process.env.USD_TO_NGN_RATE, 1600),
    multiplier: positiveOr(map.markup_multiplier, 3.5),
    // Flat markup applied on top of Fleexa's wholesale price_ngn for
    // sms4/sms5 — see lib/providers/fleexaPricing.js.
    fleexaMarkupPercent,
    // Same idea for SMS OTP 6, tunable separately because its wholesale
    // prices are much lower. Optional: with no `fleexa_sms6_markup_percent`
    // row in app_settings it simply follows fleexaMarkupPercent, so no
    // admin-page change is required to ship this.
    fleexaSms6MarkupPercent: nonNegativeOr(map.fleexa_sms6_markup_percent, fleexaMarkupPercent),
  }
}