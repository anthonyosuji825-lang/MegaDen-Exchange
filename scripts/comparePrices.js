// scripts/comparePrices.js
//
// Run this from your project root:
//   node scripts/comparePrices.js
//
// It reads your existing API keys from .env.local and queries all three
// providers' own pricing endpoints (no purchases made — read-only quotes)
// for a set of real country/service pairs, then prints a side-by-side
// comparison table. This exists to answer one question with real data
// instead of a guess: is SMSPool/Fleexa actually more expensive than
// 5sim, and by how much, for the pairs that matter to us?
//
// Requires: npm install dotenv --save-dev   (if not already installed)

require('dotenv').config({ path: '.env.local' })

const FIVESIM_KEY = process.env.FIVESIM_API_KEY
const SMSPOOL_KEY = process.env.SMSPOOL_API_KEY
const FLEEXA_KEY = process.env.FLEEXA_API_KEY

// -- Pairs worth checking — edit this list freely -----------------------
const PAIRS = [
  { country: 'usa', service: 'whatsapp' },
  { country: 'usa', service: 'telegram' },
  { country: 'uk', service: 'whatsapp' },
  { country: 'uk', service: 'telegram' },
  { country: 'nigeria', service: 'whatsapp' },
  { country: 'india', service: 'whatsapp' },
  { country: 'germany', service: 'telegram' },
]

// -- Minimal ID maps just for the countries/services above --------------
// (Mirrors lib/providers/idMaps.js — kept separate here so this script
// has zero dependency on the app's module system.)
const SMSPOOL_COUNTRY_ID = { usa: 1, uk: 2, nigeria: 14, india: 15, germany: 24 }
const SMSPOOL_SERVICE_ID = { whatsapp: 1012, telegram: 907 }
const FLEEXA_SMS3_COUNTRY_ID = { uk: '16', india: '22', germany: '43', usa: '187' }

async function safeJson(res) {
  try { return await res.json() } catch { return null }
}

// -- 5sim: reports BOTH the lowest and highest operator cost, so we can
//    see the full spread, not just whichever "bestPrice" logic picks. --
async function get5simPrice(country, service) {
  try {
    const res = await fetch(`https://5sim.net/v1/guest/prices?country=${country}&product=${service}`, {
      headers: { Authorization: `Bearer ${FIVESIM_KEY}`, Accept: 'application/json' },
    })
    const data = await safeJson(res)
    const operators = data?.[country]?.[service]
    if (!operators) return { ok: false, note: 'not available' }

    let min = Infinity
    let max = 0
    let stock = 0
    for (const [, info] of Object.entries(operators)) {
      if (!info || info.count === 0) continue
      stock += info.count
      if (info.cost < min) min = info.cost
      if (info.cost > max) max = info.cost
    }
    if (stock === 0) return { ok: false, note: 'out of stock' }
    return { ok: true, minUsd: min, maxUsd: max, stock }
  } catch (err) {
    return { ok: false, note: err.message }
  }
}

// -- SMSPool: /request/success_rate gives price + low_price per country
//    in one call, alongside their own success_rate for that pair. -------
async function getSmspoolPrice(country, service) {
  const countryId = SMSPOOL_COUNTRY_ID[country]
  const serviceId = SMSPOOL_SERVICE_ID[service]
  if (countryId === undefined || serviceId === undefined) return { ok: false, note: 'no ID mapping' }

  try {
    const res = await fetch('https://api.smspool.net/request/success_rate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${SMSPOOL_KEY}` },
      body: new URLSearchParams({ service: String(serviceId) }),
    })
    const rows = await safeJson(res)
    const row = Array.isArray(rows) ? rows.find((r) => r.country === countryId || r.country_id === countryId) : null
    if (!row) return { ok: false, note: 'country not in response' }
    return {
      ok: true,
      lowUsd: parseFloat(row.low_price),
      highUsd: parseFloat(row.price),
      successRate: row.success_rate,
    }
  } catch (err) {
    return { ok: false, note: err.message }
  }
}

// -- Fleexa: sms4 for USA (pre-marked-up NGN, no USD/rate math needed),
//    sms3 for everything else we have a mapping for. ---------------------
async function getFleexaPrice(country, service) {
  try {
    if (country === 'usa') {
      const res = await fetch(`https://fleexa.com.ng/developer/sms4/pricing?serviceName=${encodeURIComponent(service)}`, {
        headers: { Authorization: `Bearer ${FLEEXA_KEY}` },
      })
      const data = await safeJson(res)
      if (!data?.success) return { ok: false, note: data?.message || 'not available' }
      return { ok: true, ngn: Math.ceil(parseFloat(data.data.price_ngn)), usd: data.data.price_usd, sub: 'sms4' }
    }

    const countryId = FLEEXA_SMS3_COUNTRY_ID[country]
    if (!countryId) return { ok: false, note: 'no ID mapping' }
    const res = await fetch(`https://fleexa.com.ng/developer/sms3/apps?countryId=${countryId}&search=${encodeURIComponent(service)}`, {
      headers: { Authorization: `Bearer ${FLEEXA_KEY}` },
    })
    const data = await safeJson(res)
    if (!data?.success || !data.data?.length) return { ok: false, note: data?.message || 'not available' }
    return { ok: true, ngn: Math.ceil(parseFloat(data.data[0].price_ngn)), sub: 'sms3' }
  } catch (err) {
    return { ok: false, note: err.message }
  }
}

async function main() {
  if (!FIVESIM_KEY || !SMSPOOL_KEY || !FLEEXA_KEY) {
    console.error('Missing one or more API keys in .env.local (FIVESIM_API_KEY, SMSPOOL_API_KEY, FLEEXA_API_KEY). Aborting.')
    process.exit(1)
  }

  // Use whatever rate/multiplier your app currently uses, so 5sim/SMSPool
  // USD prices convert to NGN the same way your live app would — makes
  // this a fair apples-to-apples comparison against Fleexa's native NGN.
  const rate = parseFloat(process.env.USD_TO_NGN_RATE || '1600')
  const multiplier = parseFloat(process.env.MARKUP_MULTIPLIER || '3.5')
  console.log(`Using rate=${rate}, multiplier=${multiplier} to convert USD -> NGN for 5sim/SMSPool (matches your app_settings defaults — override with env vars if your admin panel values differ).\n`)

  const rows = []
  for (const { country, service } of PAIRS) {
    const [fivesim, smspool, fleexa] = await Promise.all([
      get5simPrice(country, service),
      getSmspoolPrice(country, service),
      getFleexaPrice(country, service),
    ])

    rows.push({
      pair: `${country} / ${service}`,
      '5sim (low-high USD)': fivesim.ok ? `$${fivesim.minUsd.toFixed(2)}-$${fivesim.maxUsd.toFixed(2)}` : `— (${fivesim.note})`,
      '5sim → NGN (low-high)': fivesim.ok
        ? `₦${Math.ceil(fivesim.minUsd * rate * multiplier).toLocaleString()}-₦${Math.ceil(fivesim.maxUsd * rate * multiplier).toLocaleString()}`
        : '—',
      'SMSPool (low-high USD)': smspool.ok ? `$${smspool.lowUsd.toFixed(2)}-$${smspool.highUsd.toFixed(2)} (${smspool.successRate}% success)` : `— (${smspool.note})`,
      'SMSPool → NGN (low-high)': smspool.ok
        ? `₦${Math.ceil(smspool.lowUsd * rate * multiplier).toLocaleString()}-₦${Math.ceil(smspool.highUsd * rate * multiplier).toLocaleString()}`
        : '—',
      'Fleexa NGN (as-is)': fleexa.ok ? `₦${fleexa.ngn.toLocaleString()} (${fleexa.sub})` : `— (${fleexa.note})`,
    })
  }

  console.table(rows)
  console.log('\nDone. "5sim -> NGN" and "SMSPool -> NGN" already have your app\'s rate/multiplier applied, so they\'re directly comparable to each other and to Fleexa\'s native NGN column — no more mental math needed to see which provider would actually cost more at purchase time.')
}

main()