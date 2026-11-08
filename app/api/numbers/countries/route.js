// app/api/numbers/countries/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { formatCountryName, getFlag } from '@/lib/countries'
import { getBestPriceNgn, hasFleexaCoverage, listFleexaCountries } from '@/lib/providers/orchestrator'
import { getNumberSettings } from '@/lib/numberSettings'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// The full country catalog still comes from 5sim, same as before — it
// has the broadest coverage and running the full multi-provider fallback
// chain for every one of ~90 countries just to build a picker list would
// mean dozens of extra API calls per page load for no real benefit.
//
// Fleexa is the primary provider, so every country+service pair that a
// Fleexa sub-service handles (USA via sms4/sms5, plus whatever sms6 is
// enabled for — see hasFleexaCoverage in the orchestrator) is run through
// the full priority chain here. Its listed price then reflects whichever
// provider actually wins today, so the price shown up front matches what
// /numbers/buy will charge. Pairs Fleexa doesn't cover keep the 5sim
// catalog price. Quotes run a few at a time to stay under Fleexa's rate
// limits.

// getBestPriceNgn for an override country walks the full provider chain
// live (including Fleexa's WhatsApp-approval check, which is its own
// network round trip) — unlike the 5sim catalog fetch above, nothing
// about that call was cached, so every single page load / service
// switch re-hit Fleexa + SMSPool. This is a short-lived, best-effort,
// per-instance cache to cut that down; it's fine if a cold serverless
// instance misses it, this is purely a rate-limit/cost mitigation, not
// a correctness requirement (buy-time pricing is never trusted from
// here regardless — see app/api/numbers/buy/route.js).
const OVERRIDE_CACHE_TTL_MS = 45_000
const overridePriceCache = new Map() // `${country}:${service}` -> { priceNgn, expiresAt }

async function getCachedBestPriceNgn(country, service, settings) {
  const key = `${country}:${service}`
  const cached = overridePriceCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return { ok: true, priceNgn: cached.priceNgn }
  }

  const best = await getBestPriceNgn(country, service, settings)
  if (best.ok) {
    overridePriceCache.set(key, { priceNgn: best.priceNgn, expiresAt: Date.now() + OVERRIDE_CACHE_TTL_MS })
  }
  return best
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const service = searchParams.get('service') || 'whatsapp'
    const settings = await getNumberSettings(supabaseAdmin)

    // ── FLEEXA FIRST ────────────────────────────────────────────────────
    // The picker is built from Fleexa's own countries, stock and prices.
    // 5sim's catalog is used ONLY as an emergency fallback when Fleexa
    // returns nothing at all (outage), so the page is never empty.
    const countries = []

    // USA (sms4/sms5, quoted through the full chain so it matches the buy
    // route) and everything else (SMS OTP 6's one-call reverse lookup) are
    // independent, so they run at the same time.
    const [usa, fleexa] = await Promise.all([
      (async () => {
        if (!(await hasFleexaCoverage('usa', service))) return null
        const best = await getCachedBestPriceNgn('usa', service, settings)
        return best.ok ? best : null
      })(),
      listFleexaCountries(service, settings),
    ])

    if (usa) {
      countries.push({ code: 'usa', name: formatCountryName('usa'), flag: getFlag('usa'), price_ngn: usa.priceNgn, stock: 1, provider: usa.providerId })
    }
    if (fleexa.ok) {
      for (const c of fleexa.countries) {
        if (countries.some((x) => x.code === c.country)) continue // USA already priced above
        countries.push({ code: c.country, name: formatCountryName(c.country), flag: getFlag(c.country), price_ngn: c.priceNgn, stock: c.stock, provider: 'fleexa_sms6' })
      }
    }

    if (countries.length === 0) {
      // Fleexa gave us nothing (not just "few countries"): fall back to
      // the 5sim catalog so the page still works. Prices here are 5sim's.
      const res = await fetch(`https://5sim.net/v1/guest/prices?product=${service}`, {
        headers: { Authorization: `Bearer ${process.env.FIVESIM_API_KEY}`, Accept: 'application/json' },
        next: { revalidate: 60 },
      })
      if (!res.ok) throw new Error(`5sim responded with ${res.status}`)
      const data = await res.json()
      for (const [country, operators] of Object.entries(data[service] || {})) {
        let bestPrice = Infinity
        let totalStock = 0
        for (const [, info] of Object.entries(operators)) {
          if (!info || info.count === 0) continue
          totalStock += info.count
          if (info.cost < bestPrice) bestPrice = info.cost
        }
        if (totalStock === 0 || bestPrice === Infinity) continue
        countries.push({
          code: country, name: formatCountryName(country), flag: getFlag(country),
          price_ngn: Math.ceil(Math.max(bestPrice, 0.5) * settings.rate * settings.multiplier),
          stock: totalStock, provider: 'fivesim',
        })
      }
    }

    const preferred = ['usa', 'uk', 'russia', 'ukraine', 'canada', 'indonesia', 'india', 'nigeria', 'ghana']
    countries.sort((a, b) => {
      const ai = preferred.indexOf(a.code)
      const bi = preferred.indexOf(b.code)
      if (ai !== -1 && bi !== -1) return ai - bi
      if (ai !== -1) return -1
      if (bi !== -1) return 1
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json({ countries })
  } catch (error) {
    console.error('[numbers/countries]', error)
    return NextResponse.json({ error: 'Failed to fetch countries' }, { status: 500 })
  }
}