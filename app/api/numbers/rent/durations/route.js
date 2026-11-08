// app/api/numbers/rent/durations/route.js
//
// Confirmed by Fleexa support (2026-09-16) to be the real source of
// the 1/3/12-month tiered pricing shown on their own dashboard —
// replaces the earlier client-side "priceNgn * months" estimate,
// which was known to be wrong (their real tiers aren't linear
// multiples of the monthly baseline).
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { listRentDurations } from '@/lib/providers/fleexaRent'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function getMarkupSettings() {
  const { data } = await supabaseAdmin.from('app_settings').select('key, value')
  const map = {}
  ;(data || []).forEach((s) => { map[s.key] = s.value })
  return {
    fleexaMarkupPercent: parseFloat(map.fleexa_markup_percent || '15'),
    fleexaRentMarginPercent: parseFloat(map.fleexa_rent_margin_percent || '50'),
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const appName = searchParams.get('appName')
    if (!appName) return NextResponse.json({ error: 'Missing appName' }, { status: 400 })

    const settings = await getMarkupSettings()
    const result = await listRentDurations(appName, settings)
    if (!result.ok) {
      const isThrottled = result.reason === 'THROTTLED'
      const isNotAvailable = result.reason === 'NOT_AVAILABLE'
      return NextResponse.json({
        tiers: {},
        throttled: isThrottled,
        error: isThrottled
          ? 'This is taking a moment — please try again in a few seconds.'
          : isNotAvailable
            ? 'This service isn\u2019t available for long-term rental right now.'
            : 'Failed to fetch pricing.',
      }, { status: isThrottled || isNotAvailable ? 200 : 500 })
    }

    return NextResponse.json({ tiers: result.tiers })
  } catch (error) {
    console.error('[numbers/rent/durations]', error)
    return NextResponse.json({ error: 'Failed to fetch pricing' }, { status: 500 })
  }
}