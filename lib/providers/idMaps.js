// lib/providers/idMaps.js
//
// MegaDen's "canonical" country/service codes are the ones already used
// across the app today — the same slugs lib/countries.js formats
// (e.g. 'usa', 'uk', 'nigeria') and the same service names the frontend
// already sends (e.g. 'whatsapp', 'telegram').
//
// 5sim already speaks these slugs natively, so it needs no mapping.
// SMSPool and Fleexa use their own IDs/names, so this file is the single
// place that translates canonical -> provider-specific.
//
// IMPORTANT: this is intentionally NOT exhaustive. Only countries/services
// you actually route through SMSPool or Fleexa need an entry — everything
// else silently falls through to 5sim (or whichever provider comes first
// in PROVIDER_PRIORITY for that pair) since a missing mapping just makes
// that provider report itself as "unsupported" for the pair, not an error.
//
// To add coverage: look up the ID from SMSPool's own list endpoints
// (POST /country/retrieve_all, /service/retrieve_all) and add a line
// below. SMSPool needs ID mapping, and so does Fleexa SMS OTP 6 (see the
// FLEEXA_SMS6_* maps at the bottom) — 5sim speaks canonical slugs, and
// Fleexa sms4/sms5 take service names directly.

const SMSPOOL_COUNTRY_ID = {
  usa: 1,
  uk: 2,
  netherlands: 3,
  russia: 4,
  nigeria: 14,
  india: 15,
  kenya: 16,
  indonesia: 9,
  ghana: 42,
  philippines: 12,
  vietnam: 11,
  poland: 21,
  germany: 24,
  ukraine: 25,
  france: 23,
  brazil: 68,
  mexico: 53,
  southafrica: 153,
  pakistan: 62,
  bangladesh: 58,
}

const SMSPOOL_SERVICE_ID = {
  whatsapp: 1012,
  telegram: 907,
  google: 395,
  instagram: 457,
  facebook: 329,
  tiktok: 924,
  twitter: 948,
  discord: 273,
  amazon: 39,
  snapchat: 846,
}

// Fleexa sms4/sms5 (US-only) take the service NAME directly (lowercase),
// per their docs ("telegram", "whatsapp") — no ID lookup needed, so no
// map is required for Fleexa at all.
//
// REMOVED 2026-09-18: FLEEXA_SMS3_COUNTRY_ID and fleexaSms3CountryId()
// used to live here, mapping canonical slugs to sms3's numeric-string
// countryIds (uk/india/germany, plus a 'usa' entry that turned out to
// be dead). Fleexa has permanently retired sms3 ("Server 3 · All
// Countries"), so there is nothing left to map — see the header of
// fleexa.js for the full evidence. Fleexa is a US-only provider now.

export function smspoolCountryId(canonicalCountry) {
  return SMSPOOL_COUNTRY_ID[canonicalCountry] ?? null
}

export function smspoolServiceId(canonicalService) {
  return SMSPOOL_SERVICE_ID[canonicalService] ?? null
}

// -- Fleexa SMS OTP 6 (multi-country) ------------------------------------
//
// Countries: Fleexa's numeric country IDs are NOT hardcoded here. The
// adapter (fleexaSms6.js) resolves them live from GET /sms6/countries by
// ISO alpha-2 code, so a wrong or changed numeric ID can never make us
// buy a number in the wrong country. This map only translates our
// canonical slug <-> ISO code, and it now covers EVERY country the app
// can display (lib/countries.js) so the country picker can be built from
// Fleexa's own list. A country Fleexa doesn't sell simply never appears.
const FLEEXA_SMS6_COUNTRY_ISO = {
  usa: 'us', uk: 'gb', russia: 'ru', ukraine: 'ua', canada: 'ca',
  indonesia: 'id', india: 'in', brazil: 'br', germany: 'de', france: 'fr',
  philippines: 'ph', vietnam: 'vn', nigeria: 'ng', ghana: 'gh', kenya: 'ke',
  poland: 'pl', spain: 'es', italy: 'it', netherlands: 'nl', sweden: 'se',
  norway: 'no', australia: 'au', japan: 'jp', china: 'cn', mexico: 'mx',
  colombia: 'co', argentina: 'ar', egypt: 'eg', pakistan: 'pk', bangladesh: 'bd',
  myanmar: 'mm', thailand: 'th', malaysia: 'my', cambodia: 'kh', laos: 'la',
  hongkong: 'hk', taiwan: 'tw', southkorea: 'kr', estonia: 'ee', latvia: 'lv',
  lithuania: 'lt', moldova: 'md', georgia: 'ge', armenia: 'am', kazakhstan: 'kz',
  uzbekistan: 'uz', kyrgyzstan: 'kg', tajikistan: 'tj', azerbaijan: 'az',
  romania: 'ro', bulgaria: 'bg', serbia: 'rs', croatia: 'hr', czechia: 'cz',
  hungary: 'hu', slovakia: 'sk', austria: 'at', switzerland: 'ch', belgium: 'be',
  portugal: 'pt', denmark: 'dk', finland: 'fi', ireland: 'ie', newzealand: 'nz',
  southafrica: 'za', morocco: 'ma', ethiopia: 'et', tanzania: 'tz', uganda: 'ug',
  senegal: 'sn', cameroon: 'cm', afghanistan: 'af', albania: 'al', algeria: 'dz',
  angola: 'ao', belarus: 'by', bolivia: 'bo', bosniaandherzegovina: 'ba',
  chile: 'cl', costarica: 'cr', cuba: 'cu', dominicanrepublic: 'do',
  ecuador: 'ec', elsalvador: 'sv', guatemala: 'gt', haiti: 'ht', honduras: 'hn',
  iraq: 'iq', iran: 'ir', israel: 'il', jamaica: 'jm', jordan: 'jo',
  kuwait: 'kw', lebanon: 'lb', libya: 'ly', madagascar: 'mg', mongolia: 'mn',
  mozambique: 'mz', namibia: 'na', nepal: 'np', nicaragua: 'ni', oman: 'om',
  panama: 'pa', paraguay: 'py', peru: 'pe', qatar: 'qa', saudiarabia: 'sa',
  srilanka: 'lk', sudan: 'sd', syria: 'sy', tunisia: 'tn', turkey: 'tr',
  uae: 'ae', uruguay: 'uy', venezuela: 've', yemen: 'ye', zambia: 'zm',
  zimbabwe: 'zw',
}

const ISO_TO_SLUG = Object.fromEntries(
  Object.entries(FLEEXA_SMS6_COUNTRY_ISO).map(([slug, iso]) => [iso, slug])
)

// Services: sms6 uses SHORT service ids ("wa", "tg"), not names. They are
// now resolved LIVE from GET /sms6/products by matching Fleexa's product
// NAME against the aliases below (see resolveServiceId in fleexaSms6.js),
// so every service Fleexa actually sells works without hand-copying ids.
//
// Matching is deliberately strict — names are lower-cased with everything
// except letters/digits removed, then compared for EXACT equality with one
// of these aliases. A near-miss ("Google (Gmail, YouTube)" vs "google")
// does NOT match: buying the wrong service's number would be worse than
// falling through to the next provider. If the adapter logs that a service
// is unmatched, add the normalized Fleexa name it printed to that
// service's list here. A service listed under two different Fleexa ids is
// treated as ambiguous and not matched.
const FLEEXA_SMS6_SERVICE_ALIASES = {
  whatsapp: ['whatsapp'],
  telegram: ['telegram'],
  facebook: ['facebook'],
  // Fleexa names (from its live /sms6/products): "Instagram + Threads" (ig),
  // "Google, Gmail, Youtube" (go) — one product serves google AND gmail.
  instagram: ['instagram', 'instagramthreads'],
  tiktok: ['tiktok'],
  gmail: ['gmail', 'googlegmailyoutube'],
  twitter: ['twitter', 'twitterx', 'xtwitter', 'x'],
  google: ['google', 'googlegmailyoutube'],
  discord: ['discord'],
  snapchat: ['snapchat'],
  linkedin: ['linkedin'],
  amazon: ['amazon'],
  microsoft: ['microsoft'],
  viber: ['viber'],
  line: ['line'],
  signal: ['signal'],
  uber: ['uber'],
  netflix: ['netflix'],
  tinder: ['tinder'],
  paypal: ['paypal'],
  wechat: ['wechat'],
  yahoo: ['yahoo'],
  steam: ['steam'],
  shopee: ['shopee'],
  truecaller: ['truecaller'],
  zoho: ['zoho'],
  proton: ['protonmail', 'proton'],
  // 'any' (Any SMS) has no Fleexa equivalent on purpose.
}

// Known-good ids — used only if /sms6/products
// can't be fetched (or has no match), so WhatsApp/Telegram keep working
// during a products-endpoint hiccup.
const FLEEXA_SMS6_SERVICE_ID = {
  whatsapp: 'wa',
  telegram: 'tg',
  // Confirmed against Fleexa's live /sms6/products (2026-11-07): so these
  // keep working even when the (large, slow) products list can't be fetched.
  facebook: 'fb',
  instagram: 'ig',
  tiktok: 'lf',
  google: 'go',
  gmail: 'go',
}

export function fleexaSms6Iso(canonicalCountry) {
  return FLEEXA_SMS6_COUNTRY_ISO[canonicalCountry] ?? null
}

export function fleexaSms6SlugForIso(iso) {
  return ISO_TO_SLUG[String(iso || '').toLowerCase()] ?? null
}

export function fleexaSms6ServiceId(canonicalService) {
  return FLEEXA_SMS6_SERVICE_ID[canonicalService] ?? null
}

export function fleexaSms6ServiceAliases(canonicalService) {
  return FLEEXA_SMS6_SERVICE_ALIASES[canonicalService] ?? []
}

export function listCanonicalServices() {
  return Object.keys(FLEEXA_SMS6_SERVICE_ALIASES)
}