// lib/providers/fleexaPricing.js
//
// Shared markup logic for anything priced off Fleexa's own price_ngn.
//
// WHY THIS EXISTS: Fleexa's price_ngn is YOUR wholesale cost as an API
// reseller — it is NOT a retail price with margin for you already
// built in. Confirmed with real data from GET /rent/durations for
// whatsapp/1-month:
//   provider_cost_ngn: 6768   <- Fleexa's own upstream cost
//   price_ngn:         7768   <- what YOU pay (the reseller/API rate)
//   full_price_ngn:    8768   <- what a REGULAR, non-API customer pays
//                                 on Fleexa's own dashboard
//   api_discount_percent: 50
// 7768 sits exactly halfway between 6768 and 8768 — api_discount_percent
// 50 means resellers get half of Fleexa's OWN markup as a discount off
// full_price_ngn. Charging your own users exactly price_ngn (as the
// original version of this code did, for both Rent and sms4/sms5) means
// ZERO margin for you — you'd be reselling at your own cost.
//
// STRATEGY:
// - Where Fleexa gives a full_price_ngn (confirmed for Rent Numbers'
//   /rent/durations): split the remaining gap by gapMarginPercent
//   (admin-configurable, defaults to 50%). This is self-limiting — it
//   can never exceed full_price_ngn, so a MegaDen customer never pays
//   more than they would by going directly to Fleexa's own site, while
//   you still capture real margin.
// - Where no full_price_ngn exists (confirmed: sms4/sms5's /prices,
//   /pricing endpoints only return price_ngn, no retail comparison
//   point): fall back to flatMarkupPercent (admin-configurable,
//   defaults to 15%).
//
// Both percentages are stored in the app_settings table
// (fleexa_markup_percent, fleexa_rent_margin_percent) and editable from
// the admin settings page — the defaults below only apply if a caller
// doesn't pass settings through (or a setting is missing/unparseable).
const DEFAULT_FLAT_MARKUP_PCT = 15
const DEFAULT_GAP_MARGIN_PCT = 50

/**
 * @param {number} costNgn - Fleexa's price_ngn (your wholesale cost)
 * @param {number|null} fullPriceNgn - Fleexa's full_price_ngn, if available
 * @param {{ flatMarkupPercent?: number, gapMarginPercent?: number }} [options]
 * @returns {number} the price to actually charge your own customer
 */
export function computeSellPriceNgn(costNgn, fullPriceNgn = null, options = {}) {
  const flatMarkupPercent = Number.isFinite(options.flatMarkupPercent) ? options.flatMarkupPercent : DEFAULT_FLAT_MARKUP_PCT
  const gapMarginPercent = Number.isFinite(options.gapMarginPercent) ? options.gapMarginPercent : DEFAULT_GAP_MARGIN_PCT

  if (!fullPriceNgn || fullPriceNgn <= costNgn) {
    return Math.ceil(costNgn * (1 + flatMarkupPercent / 100))
  }
  return Math.round(costNgn + (fullPriceNgn - costNgn) * (gapMarginPercent / 100))
}