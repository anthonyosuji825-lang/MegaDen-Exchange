// scripts/verify-services.mjs
//
// READ-ONLY tool for checking a provider's live service list against your
// catalog. It only calls the provider's "services" action. It never places
// an order, never spends money, and never prints your API key.
//
// Two modes:
//
//   1. VERIFY (checks the IDs your catalog already uses)
//      node scripts/verify-services.mjs jap
//      node scripts/verify-services.mjs exo
//
//   2. SEARCH (find candidate services by keyword, e.g. when a catalog ID
//      turns out to be wrong and you need a real one to replace it)
//      node scripts/verify-services.mjs jap search "twitter likes"
//      node scripts/verify-services.mjs exo search "instagram views"
//
// Both modes read the key from .env.local and write a report to
// scripts/verify-report-<jap|exo>.txt or scripts/search-report-<...>.txt

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const which = (process.argv[2] || '').toLowerCase()
const mode = (process.argv[3] || 'verify').toLowerCase()
const query = process.argv.slice(4).join(' ').trim()

const CONFIG = {
  jap: { label: 'JAP', keyVar: 'JAP_API_KEY', urlVar: 'JAP_API_URL',
         url: 'https://justanotherpanel.com/api/v2', catalog: 'STANDARD_SERVICES' },
  exo: { label: 'Exobooster', keyVar: 'EXO_API_KEY', urlVar: 'EXOBOOSTER_API_URL',
         url: 'https://exosupplier.com/api/v2', catalog: 'TURBO_SERVICES' },
}
const cfg = CONFIG[which]
if (!cfg) {
  console.error('Usage:')
  console.error('  node scripts/verify-services.mjs jap|exo')
  console.error('  node scripts/verify-services.mjs jap|exo search "<keyword>"')
  process.exit(1)
}
if (mode === 'search' && !query) {
  console.error('Usage: node scripts/verify-services.mjs jap|exo search "<keyword>"')
  process.exit(1)
}
if (mode !== 'verify' && mode !== 'search') {
  console.error(`Unknown mode "${mode}". Use "search" or leave it out to verify.`)
  process.exit(1)
}

// ---- environment (.env.local, then real environment) ----------------------
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
const apiKey = env[cfg.keyVar]
if (!apiKey) {
  console.error(`${cfg.keyVar} was not found in .env.local. Run this from the project root.`)
  process.exit(1)
}
const apiUrl = env[cfg.urlVar] || cfg.url

// ---- ask the provider for its full service list ----------------------------
async function fetchServices() {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45000)
  let res, text
  try {
    res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ key: apiKey, action: 'services' }),
      signal: controller.signal,
    })
    text = await res.text()
  } catch (err) {
    console.error(`Could not reach ${cfg.label}: ${err.name === 'AbortError' ? 'timed out' : err.message}`)
    process.exit(1)
  } finally {
    clearTimeout(timer)
  }
  let list
  try { list = JSON.parse(text) } catch { list = null }
  if (!Array.isArray(list)) {
    const msg = list && list.error ? String(list.error) : `unexpected reply (HTTP ${res.status})`
    console.error(`${cfg.label} did not return a service list: ${msg}`)
    process.exit(1)
  }
  return list
}

const cut = (s, n) => (String(s ?? '').length > n ? String(s).slice(0, n - 1) + '…' : String(s ?? ''))
const label = n => n.replace(/^[\d,]+\s*/, '').trim()

// Things worth a second look before you pick a service. Not proof of a
// problem, just a nudge to read the full name before committing to an ID.
function flagsFor(s) {
  const name = String(s.name || '')
  const flags = []
  if (/\bold data\b/i.test(name)) flags.push('OLD DATA')
  if (/\btest\b/i.test(name)) flags.push('marked TEST')
  if (/\bdo not use\b/i.test(name)) flags.push('marked DO NOT USE')
  if (/\bnft\b/i.test(name)) flags.push('NFT-specific, probably not what you want')
  if (String(s.type) !== 'Default') flags.push(`type=${s.type} (needs different order fields than link+quantity)`)
  if (!s.refill) flags.push('no refill')
  return flags
}

// ---------------------------------------------------------------------------
// SEARCH MODE
// ---------------------------------------------------------------------------
async function runSearch() {
  const list = await fetchServices()
  const q = query.toLowerCase()
  const matches = list.filter(s =>
    String(s.name || '').toLowerCase().includes(q) ||
    String(s.category || '').toLowerCase().includes(q)
  )

  const lines = []
  const out = s => { lines.push(s); console.log(s) }

  out(`${cfg.label} search for "${query}"  |  ${matches.length} match(es) out of ${list.length} total services\n`)

  if (!matches.length) {
    out('No matches. Try a shorter or different keyword (e.g. just "retweet" instead of "twitter retweet").')
  } else {
    const rates = matches.map(s => Number(s.rate)).filter(Number.isFinite).sort((a, b) => a - b)
    const median = rates[Math.floor(rates.length / 2)] || 0

    const sorted = [...matches].sort((a, b) => Number(a.rate) - Number(b.rate))
    for (const s of sorted) {
      const flags = flagsFor(s)
      const rate = Number(s.rate)
      if (median > 0 && Number.isFinite(rate)) {
        if (rate < median * 0.25) flags.push('price far below the median for this search — check quality before using')
        if (rate > median * 3) flags.push('price far above the median for this search')
      }
      const refill = s.refill ? 'refill' : 'no-refill'
      const cancel = s.cancel ? 'cancel' : 'no-cancel'
      out(`[${s.service}] ${cut(s.name, 78)}`)
      out(`         cat: ${cut(s.category, 40)} | $${s.rate}/1k (provider currency, USD) | min ${s.min} max ${s.max} | ${refill}, ${cancel}${flags.length ? '\n         !! ' + flags.join('; ') : ''}`)
    }
    out(`\nMedian price in these results: $${median}/1000 (provider currency, USD)`)
    out('Sorted cheapest to most expensive. A price far below the median often means a lower-quality or bot-driven source — check the full name before choosing it.')
  }

  const file = path.join(process.cwd(), 'scripts', `search-report-${which}-${query.replace(/[^a-z0-9]+/gi, '-')}.txt`)
  try { fs.writeFileSync(file, lines.join('\n')); console.log(`\nReport also saved to ${file}`) } catch {}
}

// ---------------------------------------------------------------------------
// VERIFY MODE (unchanged from before)
// ---------------------------------------------------------------------------
async function runVerify() {
  const catalogPath = path.join(process.cwd(), 'lib', 'boost-catalog.js')
  if (!fs.existsSync(catalogPath)) {
    console.error('lib/boost-catalog.js not found. Run this from the project root.')
    process.exit(1)
  }
  const tmp = path.join(os.tmpdir(), `boost-catalog-${Date.now()}.mjs`)
  fs.writeFileSync(tmp, fs.readFileSync(catalogPath, 'utf8'))
  const catalogModule = await import(pathToFileURL(tmp).href)
  fs.unlinkSync(tmp)
  const services = catalogModule[cfg.catalog]

  const list = await fetchServices()
  const byId = new Map(list.map(s => [String(s.service), s]))

  const lines = []
  const out = s => { lines.push(s); console.log(s) }
  const flagList = []

  out(`${cfg.label} check  |  provider lists ${list.length} services  |  catalog: ${cfg.catalog}`)
  out('rate = provider price per 1,000 (their currency, USD on your account)\n')

  out('=== 1. FAMILIES: does each service ID match what your catalog says it is? ===')
  const rows = []
  for (const p of services) {
    const fam = new Map()
    for (const k of p.packages) {
      if (!fam.has(k.service_id)) fam.set(k.service_id, [])
      fam.get(k.service_id).push(k)
    }
    for (const [sid, pk] of fam) {
      const s = byId.get(String(sid))
      const ours = [...new Set(pk.map(k => label(k.name)))].join(' / ')
      if (!s) {
        out(`[${p.id}] ${sid}  ours: "${ours}"  ->  !! MISSING: provider has no service with this ID`)
        flagList.push(`${p.id} ${sid} MISSING`)
        continue
      }
      const flags = flagsFor(s)
      const refill = s.refill ? 'refill' : 'no-refill'
      const cancel = s.cancel ? 'cancel' : 'no-cancel'
      out(`[${p.id}] ${sid}  ours: "${cut(ours, 34)}"  <->  provider: "${cut(s.name, 70)}" | cat: ${cut(s.category, 40)} | type ${s.type} | $${s.rate}/1k (provider) | min ${s.min} max ${s.max} | ${refill}, ${cancel}${flags.length ? '  !! ' + flags.join('; ') : ''}`)
      if (flags.length) flagList.push(`${p.id} ${sid} ${flags.join('; ')}`)
      for (const k of pk) rows.push({ p, k, s })
    }
  }

  out('\n=== 2. PACKAGES: quantity limits and break-even ===')
  out('break-even = the Naira-per-dollar rate at which this package earns exactly zero.')
  out('If the real rate ever rises above it, you sell at a loss.\n')
  const margins = []
  for (const { p, k, s } of rows) {
    const cost = (Number(s.rate) * k.quantity) / 1000
    const be = cost > 0 ? Math.round(k.price / cost) : null
    const flags = []
    if (k.quantity < Number(s.min) || k.quantity > Number(s.max)) flags.push(`RANGE provider allows ${s.min}-${s.max}`)
    if (be !== null) margins.push({ id: k.id, be, k })
    out(`${k.id.padEnd(20)} qty ${String(k.quantity).padStart(7)}  ₦${String(k.price).padStart(6)}  cost $${cost.toFixed(4).padStart(8)}  break-even ₦${be === null ? '?' : be}/$${flags.length ? '  !! ' + flags.join('; ') : ''}`)
    if (flags.length) flagList.push(`${k.id} ${flags.join('; ')}`)
  }

  out('\n=== 3. TIGHTEST 10 PACKAGES (lowest break-even = most exposed) ===')
  margins.sort((a, b) => a.be - b.be)
  for (const m of margins.slice(0, 10)) out(`${m.id.padEnd(20)} break-even ₦${m.be}/$`)

  out(`\n=== SUMMARY ===`)
  out(flagList.length ? `${flagList.length} item(s) need attention:\n- ${flagList.join('\n- ')}` : 'No missing IDs, type problems or range problems found.')

  const file = path.join(process.cwd(), 'scripts', `verify-report-${which}.txt`)
  try { fs.writeFileSync(file, lines.join('\n')); console.log(`\nReport also saved to ${file}`) } catch {}
}

if (mode === 'search') await runSearch()
else await runVerify()
