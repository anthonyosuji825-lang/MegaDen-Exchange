// scripts/check-provider-balances.mjs
//
// Checks your current balance on both providers. Read-only — never
// places an order, never spends anything.
//
// Run from the project root:
//   node scripts/check-provider-balances.mjs

import fs from 'node:fs'
import path from 'node:path'

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
for (const [k, v] of Object.entries(env)) process.env[k] = process.env[k] ?? v

const { pathToFileURL } = await import('node:url')
const providersPath = path.join(process.cwd(), 'lib', 'boost', 'providers.js')
const { getBalance } = await import(pathToFileURL(providersPath).href)

for (const providerKey of ['jap', 'exobooster']) {
  const r = await getBalance(providerKey)
  if (!r.ok) {
    console.log(`${providerKey.padEnd(12)} could not check balance — ${r.message}`)
  } else {
    console.log(`${providerKey.padEnd(12)} $${r.balance.toFixed(2)} ${r.currency || ''}`)
  }
}
