// scripts/verifyFleexaPricingPaths.js
//
// One-off confirmation for the sms4/sms5 pricing path split in
// lib/providers/fleexa.js (sms4 -> /prices, sms5 -> /pricing). Hits
// both paths directly and prints the raw HTTP status + body for each,
// so the split is confirmed by an explicit response instead of
// inferred from purchase success/failure.
//
// Run with: node scripts/verifyFleexaPricingPaths.js
// (requires FLEEXA_API_KEY in your environment / .env.local, same as
// the app itself — uses dotenv like scripts/comparePrices.js does)

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const BASE = 'https://fleexa.com.ng/developer'
const SERVICE = process.argv[2] || 'whatsapp' // override: node scripts/verifyFleexaPricingPaths.js telegram

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.FLEEXA_API_KEY}`,
    'Content-Type': 'application/json',
  }
}

async function check(prefix, pricingPath) {
  const url = `${BASE}/${prefix}/${pricingPath}?serviceName=${encodeURIComponent(SERVICE)}`
  try {
    const res = await fetch(url, { headers: authHeaders() })
    let body = null
    try {
      body = await res.json()
    } catch {
      body = await res.text().catch(() => '(unreadable body)')
    }
    return { prefix, pricingPath, url, httpStatus: res.status, ok: res.ok, body }
  } catch (err) {
    return { prefix, pricingPath, url, error: err.message }
  }
}

async function main() {
  if (!process.env.FLEEXA_API_KEY) {
    console.error('FLEEXA_API_KEY not found in environment — check your .env.local')
    process.exit(1)
  }

  console.log(`Verifying Fleexa sms4/sms5 pricing paths for service="${SERVICE}"\n`)

  const results = await Promise.all([
    check('sms4', 'prices'),   // current config
    check('sms4', 'pricing'),  // the old (pre-fix) path, for contrast
    check('sms5', 'pricing'),  // current config
    check('sms5', 'prices'),   // the alternate, for contrast
  ])

  for (const r of results) {
    console.log(`── /${r.prefix}/${r.pricingPath} `.padEnd(40, '─'))
    if (r.error) {
      console.log(`  ERROR: ${r.error}`)
    } else {
      console.log(`  HTTP ${r.httpStatus}${r.ok ? ' OK' : ' (not ok)'}`)
      console.log(`  body:`, JSON.stringify(r.body, null, 2).slice(0, 500))
    }
    console.log()
  }

  console.log('What to look for:')
  console.log('- sms4/prices and sms5/pricing (the current config) should both return 200 + a real price.')
  console.log('- sms4/pricing and sms5/prices (the alternates) should 404 / route-not-found, or return')
  console.log('  something clearly wrong — if either of THOSE also looks valid, the split may be coincidental')
  console.log('  rather than a real API distinction, and worth a second look.')
}

main()