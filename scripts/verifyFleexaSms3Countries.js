// scripts/verifyFleexaSms3Countries.js
//
// Issue 8: idMaps.js hardcodes FLEEXA_SMS3_COUNTRY_ID as a static,
// hand-maintained map (uk: '16', india: '22', germany: '43') sourced
// from Fleexa's docs EXAMPLE response — not from actually calling their
// live catalog endpoint. Fleexa's own docs describe sms3 as covering
// "dozens more" countries and explicitly call /sms3/countries a LIVE,
// dynamic listing, not a fixed catalog. This script calls that endpoint
// for real and:
//   1. Confirms whether the three IDs currently in idMaps.js still
//      point at the countries we think they do.
//   2. Prints the full live list, so you can see what else Fleexa
//      actually offers today that idMaps.js doesn't have yet.
//
// Deliberately does NOT try to guess Fleexa's exact response field
// names — it prints the raw shape it gets back first, then attempts a
// best-effort parse. If the parse looks wrong, the raw output is what
// to go by; the field-name guesses can be corrected once you've seen
// real data (there was no confirmed response shape for this endpoint
// before this run).
//
// Run with: node scripts/verifyFleexaSms3Countries.js

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const BASE = 'https://fleexa.com.ng/developer'

// What idMaps.js currently claims, so we can check it against reality.
const CURRENT_MAP = {
  uk: '16',
  india: '22',
  germany: '43',
}

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.FLEEXA_API_KEY}`,
    Accept: 'application/json',
  }
}

// Fleexa's response shape for this endpoint is unconfirmed — try a
// handful of plausible field name pairs and use whichever one actually
// yields usable id/name pairs.
function extractCountries(payload) {
  const candidateLists = [
    payload?.data,
    payload?.data?.countries,
    payload?.countries,
    Array.isArray(payload) ? payload : null,
  ].filter(Array.isArray)

  for (const list of candidateLists) {
    if (list.length === 0) continue
    const sample = list[0]
    const idKey = ['id', 'countryId', 'country_id'].find((k) => k in sample)
    const nameKey = ['name', 'countryName', 'country_name', 'title'].find((k) => k in sample)
    if (idKey && nameKey) {
      return { list: list.map((c) => ({ id: String(c[idKey]), name: c[nameKey], raw: c })), idKey, nameKey }
    }
  }
  return null
}

async function main() {
  if (!process.env.FLEEXA_API_KEY) {
    console.error('FLEEXA_API_KEY not found in environment — check your .env.local')
    process.exit(1)
  }

  console.log('Fetching GET /sms3/countries from Fleexa...\n')

  const res = await fetch(`${BASE}/sms3/countries`, { headers: authHeaders() })
  let payload = null
  try {
    payload = await res.json()
  } catch {
    console.error(`Response wasn't valid JSON. HTTP ${res.status}.`)
    process.exit(1)
  }

  if (!res.ok) {
    console.error(`HTTP ${res.status} — request failed.`)
    console.error(JSON.stringify(payload, null, 2))
    process.exit(1)
  }

  console.log('── Raw response (first 1500 chars, for reference) '.padEnd(60, '─'))
  console.log(JSON.stringify(payload, null, 2).slice(0, 1500))
  console.log()

  const extracted = extractCountries(payload)

  if (!extracted) {
    console.log('Could not confidently parse a country list out of the response above.')
    console.log('The raw JSON printed above is what to work from — the id/name field')
    console.log('names in extractCountries() need updating once you see the real shape.')
    return
  }

  const { list, idKey, nameKey } = extracted
  console.log(`Parsed ${list.length} countries using fields "${idKey}"/"${nameKey}".\n`)

  console.log('── Checking idMaps.js entries against live data '.padEnd(60, '─'))
  for (const [canonicalName, mappedId] of Object.entries(CURRENT_MAP)) {
    const liveMatch = list.find((c) => c.id === mappedId)
    if (!liveMatch) {
      console.log(`  ✗ ${canonicalName} (id '${mappedId}') — NOT FOUND in live list. Same failure mode as the dead 'usa' entry — this ID may be stale.`)
    } else {
      console.log(`  ✓ ${canonicalName} (id '${mappedId}') — live name: "${liveMatch.name}"`)
      console.log(`      (confirm this actually reads as "${canonicalName}" — a matching ID with a` )
      console.log(`       different real-world name would be a silent wrong-country bug, not a missing one)`)
    }
  }

  console.log()
  console.log('── Full live list (cross-check against countries you want to add) '.padEnd(60, '─'))
  for (const c of list) {
    const alreadyMapped = Object.values(CURRENT_MAP).includes(c.id)
    console.log(`  ${alreadyMapped ? '[mapped]  ' : '[unmapped]'} id=${c.id}  name=${c.name}`)
  }

  console.log()
  console.log(`Total live: ${list.length}. Currently mapped in idMaps.js: ${Object.keys(CURRENT_MAP).length}.`)
}

main()