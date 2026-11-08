// lib/boost/fx.js
//
// Keeps app_settings.usd_to_ngn_rate current automatically, without ever
// overwriting a rate the admin set by hand.
//
// Contract:
// - usd_to_ngn_auto_update = 'true'  -> updateFxRateIfDue() may overwrite the rate
// - usd_to_ngn_auto_update = 'false' -> updateFxRateIfDue() does nothing
// - Call setManualFxRate() from the admin save handler whenever an admin
//   edits the rate by hand; it writes the value AND flips auto-update off,
//   so the next scheduled sync doesn't silently overwrite what was just typed.
// - A failed fetch NEVER blanks or zeroes the rate — the last known good
//   value is left exactly as it was.

const FX_API_URL = 'https://api.exchangerate-api.com/v4/latest/USD'
// No API key required for this endpoint. If it ever goes away or rate-limits
// you, swap FX_API_URL and the one field read in fetchLiveUsdToNgn() below —
// nothing else in this file needs to change.

async function getSetting(admin, key) {
  const { data, error } = await admin.from('app_settings').select('value').eq('key', key).maybeSingle()
  if (error) return { ok: false, message: error.message }
  return { ok: true, value: data ? data.value : null }
}

async function setSetting(admin, key, value) {
  const { error } = await admin.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

async function fetchLiveUsdToNgn() {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(FX_API_URL, { signal: controller.signal, cache: 'no-store' })
    if (!res.ok) return { ok: false, message: `FX API returned HTTP ${res.status}` }
    const data = await res.json()
    const rate = data && data.rates && Number(data.rates.NGN)
    if (!Number.isFinite(rate) || rate <= 0) {
      return { ok: false, message: 'FX API reply had no usable NGN rate' }
    }
    return { ok: true, rate }
  } catch (err) {
    return { ok: false, message: err.name === 'AbortError' ? 'FX fetch timed out' : err.message }
  } finally {
    clearTimeout(timer)
  }
}

// Call this from a scheduled job (cron / Vercel Cron / route handler hit
// periodically). Does nothing and returns skipped:true if auto-update is off.
export async function updateFxRateIfDue(admin) {
  const auto = await getSetting(admin, 'usd_to_ngn_auto_update')
  if (!auto.ok) return { ok: false, message: auto.message }
  if (auto.value !== 'true') return { ok: true, skipped: true, reason: 'auto-update is off' }

  const fetched = await fetchLiveUsdToNgn()
  if (!fetched.ok) {
    // Leave the existing rate untouched; just note the failure didn't corrupt anything.
    return { ok: false, message: fetched.message }
  }

  const rounded = Math.round(fetched.rate)
  const write = await setSetting(admin, 'usd_to_ngn_rate', String(rounded))
  if (!write.ok) return { ok: false, message: write.message }
  await setSetting(admin, 'usd_to_ngn_rate_updated_at', new Date().toISOString())
  return { ok: true, rate: rounded }
}

// Call this from the admin page's save handler when a human edits the rate.
// Writes the value AND turns auto-update off so the manual number sticks.
export async function setManualFxRate(admin, rate) {
  const n = Number(rate)
  if (!Number.isFinite(n) || n <= 0) return { ok: false, message: 'Invalid rate' }
  const a = await setSetting(admin, 'usd_to_ngn_rate', String(n))
  if (!a.ok) return a
  const b = await setSetting(admin, 'usd_to_ngn_auto_update', 'false')
  if (!b.ok) return b
  await setSetting(admin, 'usd_to_ngn_rate_updated_at', new Date().toISOString())
  return { ok: true }
}

// Call this if an admin wants to turn auto-update back on after a manual edit.
export async function enableFxAutoUpdate(admin) {
  return setSetting(admin, 'usd_to_ngn_auto_update', 'true')
}