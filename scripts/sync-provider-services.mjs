// scripts/sync-provider-services.mjs
//
// Refreshes boost_services with LIVE rate/min/max/label from each
// provider's service list, for exactly the codes defined in
// lib/boost/catalog.js. This is what makes pricing dynamic: run this on
// a schedule (e.g. every few hours via cron) and prices/limits shown to
// customers always reflect the provider's current numbers, with zero
// code changes needed when a provider adjusts something.
//
// Run from the project root:
//   node scripts/sync-provider-services.mjs
//
// Requires (from .env.local or the real environment):
//   JAP_API_KEY, EXO_API_KEY
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Safe to run repeatedly: it only reads each provider's service list
// (never places orders) and upserts into boost_services by `code`.

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const PROVIDERS = {
  jap:        { url: 'https://justanotherpanel.com/api/v2', keyVar: 'JAP_API_KEY',  urlVar: 'JAP_API_URL' },
  exobooster: { url: 'https://exosupplier.com/api/v2',       keyVar: 'EXO_API_KEY', urlVar: 'EXOBOOSTER_API_URL' },
}

function loadEnvFile(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 1) continue
    let v = line.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    out[line.slice(0, i).trim()] = v
  }
  return out
}
const env = { ...loadEnvFile(path.join(process.cwd(), '.env.local')), ...process.env }

async function fetchServiceList(providerKey) {
  const cfg = PROVIDERS[providerKey]
  const apiKey = env[cfg.keyVar]
  if (!apiKey) throw new Error(`${cfg.keyVar} is not set`)
  const url = env[cfg.urlVar] || cfg.url

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45000)
  let res, text
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ key: apiKey, action: 'services' }),
      signal: controller.signal,
    })
    text = await res.text()
  } finally {
    clearTimeout(timer)
  }
  let list
  try { list = JSON.parse(text) } catch { list = null }
  if (!Array.isArray(list)) {
    const msg = list && list.error ? String(list.error) : `unexpected reply (HTTP ${res.status})`
    throw new Error(`${providerKey}: ${msg}`)
  }
  return new Map(list.map(s => [String(s.service), s]))
}

async function main() {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
    process.exit(1)
  }
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const catalogPath = path.join(process.cwd(), 'lib', 'boost', 'catalog.js')
  if (!fs.existsSync(catalogPath)) {
    console.error('lib/boost/catalog.js not found. Run this from the project root.')
    process.exit(1)
  }
  const { CATALOG } = await import(`file://${catalogPath}?t=${Date.now()}`)

  console.log(`Syncing ${CATALOG.length} catalog entries...`)

  const byProvider = { jap: [], exobooster: [] }
  for (const entry of CATALOG) byProvider[entry.provider].push(entry)

  const lists = {}
  for (const providerKey of Object.keys(byProvider)) {
    if (!byProvider[providerKey].length) continue
    try {
      lists[providerKey] = await fetchServiceList(providerKey)
      console.log(`${providerKey}: fetched ${lists[providerKey].size} live services`)
    } catch (err) {
      console.error(`${providerKey}: FAILED to fetch service list — ${err.message}`)
      console.error(`${providerKey}: all its catalog entries will be marked with a sync error and left untouched otherwise`)
    }
  }

  const now = new Date().toISOString()
  let ok = 0, missing = 0, failed = 0

  for (const entry of CATALOG) {
    const list = lists[entry.provider]
    if (!list) {
      // Provider fetch itself failed — record the error but don't wipe
      // out previously-known-good rate/min/max for this code.
      await supabase.from('boost_services').upsert({
        code: entry.code,
        platform: entry.platform,
        tier: entry.tier,
        provider: entry.provider,
        provider_service_id: entry.providerServiceId,
        label: entry.label,
        quality: entry.quality || null,
        sync_error: `provider fetch failed`,
        updated_at: now,
      }, { onConflict: 'code', ignoreDuplicates: false })
        .select()
        .then(({ error }) => { if (error) console.error(`  ${entry.code}: db error — ${error.message}`) })
      failed++
      continue
    }

    const live = list.get(String(entry.providerServiceId))
    if (!live) {
      console.error(`MISSING  ${entry.code} (${entry.provider} #${entry.providerServiceId}) — provider no longer lists this service ID!`)
      await supabase.from('boost_services').upsert({
        code: entry.code,
        platform: entry.platform,
        tier: entry.tier,
        provider: entry.provider,
        provider_service_id: entry.providerServiceId,
        label: entry.label,
        quality: entry.quality || null,
        active: false,
        sync_error: 'service ID no longer exists on provider',
        updated_at: now,
      }, { onConflict: 'code' })
      missing++
      continue
    }

    const { error } = await supabase.from('boost_services').upsert({
      code: entry.code,
      platform: entry.platform,
      tier: entry.tier,
      provider: entry.provider,
      provider_service_id: entry.providerServiceId,
      label: entry.label,
      quality: entry.quality || null,
      rate_usd: Number(live.rate) || 0,
      min_qty: Number(live.min) || 0,
      max_qty: Number(live.max) || 0,
      active: true,
      sync_error: null,
      last_synced_at: now,
      updated_at: now,
    }, { onConflict: 'code' })

    if (error) {
      console.error(`  ${entry.code}: db error — ${error.message}`)
      failed++
    } else {
      ok++
    }
  }

  console.log(`\nDone: ${ok} synced, ${missing} missing on provider (deactivated), ${failed} failed`)
  if (missing > 0) {
    console.log('A service going missing means the provider removed or renumbered it — check it manually before re-enabling.')
  }
}

main().catch(err => {
  console.error('Sync failed:', err.message)
  process.exit(1)
})
