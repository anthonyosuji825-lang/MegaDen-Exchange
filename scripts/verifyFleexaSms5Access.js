// scripts/verifyFleexaSms5Access.js
//
// Confirms whether SMS OTP 5's WhatsApp approval has actually gone
// through, by calling Fleexa's own /sms5/access-status endpoint
// directly — the same call lib/providers/fleexa.js's fleexaSms5.supports()
// makes internally before every USA/WhatsApp purchase attempt. Read-only,
// no purchase involved.
//
// Run with: node scripts/verifyFleexaSms5Access.js

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const BASE = 'https://fleexa.com.ng/developer'

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.FLEEXA_API_KEY}`,
    Accept: 'application/json',
  }
}

async function main() {
  if (!process.env.FLEEXA_API_KEY) {
    console.error('FLEEXA_API_KEY not found in environment — check your .env.local')
    process.exit(1)
  }

  console.log('Checking GET /sms5/access-status?service=whatsapp...\n')

  const res = await fetch(`${BASE}/sms5/access-status?service=whatsapp`, { headers: authHeaders() })
  let body = null
  try {
    body = await res.json()
  } catch {
    body = await res.text().catch(() => '(unreadable body)')
  }

  console.log(`HTTP ${res.status}`)
  console.log(JSON.stringify(body, null, 2))
  console.log()

  const approved = body?.data?.approved
  if (approved === true) {
    console.log('✓ Approved. fleexaSms5.supports() will return true for USA/WhatsApp —')
    console.log('  meaning fleexaSms5 is now genuinely reachable first in the priority')
    console.log('  chain for that pair, not silently skipped.')
  } else if (approved === false) {
    console.log('✗ NOT approved yet (or request still pending). fleexaSms5.supports()')
    console.log('  will keep returning false for USA/WhatsApp, and the orchestrator')
    console.log('  will keep silently falling through to smspool/fleexaSms4/fivesim,')
    console.log('  same as it does today. Check body.data.status / .request above for')
    console.log('  where the request actually stands with Fleexa.')
  } else {
    console.log('Could not find a clear true/false at data.approved — check the raw')
    console.log('response above; the field name or shape may differ from what')
    console.log('fleexaSms5.supports() expects (it reads data?.data?.approved).')
  }
}

main()