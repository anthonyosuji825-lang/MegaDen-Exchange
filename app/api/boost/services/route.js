// app/api/boost/services/route.js
//
// GET /api/boost/services?tier=turbo|standard
//
// Public, read-only. Lists what's available to order, with each
// service's REAL min/max (from boost_services, kept fresh by the sync
// script) and a set of sensible quick-pick quantities computed from
// those limits — never hardcoded, since a fixed [500, 1000, 5000] list
// would offer quantities some services don't even allow (Instagram
// Followers tops out at 10,000; TikTok Views has almost no ceiling).
//
// Does NOT return price. Price depends on the live exchange rate and
// changes constantly, so the front end asks /api/boost/quote for a
// price only once the customer has picked a quantity — showing a price
// here would go stale the moment it's rendered.

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/boost/supabase-admin'

// Candidate quick-pick amounts, filtered down to whatever actually fits
// inside a given service's [min, max]. Kept small and round.
const CANDIDATE_PICKS = [100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000]

function quickPicksFor(min, max) {
  const fits = CANDIDATE_PICKS.filter(n => n >= min && n <= max)
  if (fits.length >= 3) {
    // Spread across the range rather than clustering at the bottom:
    // take up to 4, biased toward small/medium/large.
    if (fits.length <= 4) return fits
    const first = fits[0]
    const last = fits[fits.length - 1]
    const mid1 = fits[Math.floor(fits.length / 3)]
    const mid2 = fits[Math.floor((fits.length * 2) / 3)]
    return [...new Set([first, mid1, mid2, last])]
  }
  // Not enough round numbers fit this narrow a range — fall back to
  // min, a midpoint, and max so there's still something useful to tap.
  const mid = Math.round((min + max) / 2)
  return [...new Set([min, mid, max])].filter(n => n >= min && n <= max)
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const tier = searchParams.get('tier')
  if (tier !== 'turbo' && tier !== 'standard') {
    return NextResponse.json({ error: 'tier must be "turbo" or "standard"' }, { status: 400 })
  }

  const admin = getAdminClient()
  const { data, error } = await admin
    .from('boost_services')
    .select('code, platform, label, quality, min_qty, max_qty')
    .eq('tier', tier)
    .eq('active', true)
    .order('platform', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Could not load services' }, { status: 500 })
  }

  // Group by platform so the page can render one section per platform
  // without doing its own grouping logic.
  const byPlatform = new Map()
  for (const row of data || []) {
    if (!byPlatform.has(row.platform)) byPlatform.set(row.platform, [])
    byPlatform.get(row.platform).push({
      code: row.code,
      label: row.quality ? `${row.label} (${row.quality.toUpperCase()})` : row.label,
      min: row.min_qty,
      max: row.max_qty,
      quickPicks: quickPicksFor(row.min_qty, row.max_qty),
    })
  }

  const platforms = [...byPlatform.entries()].map(([platform, services]) => ({ platform, services }))
  return NextResponse.json({ tier, platforms })
}