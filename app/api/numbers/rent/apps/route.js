// app/api/numbers/rent/apps/route.js
import { NextResponse } from 'next/server'
import { listRentApps } from '@/lib/providers/fleexaRent'

// Only 'US' is wired up today. Kept as a fallback list so the frontend
// has something to render a country selector from even though there's
// only one entry right now.
const FALLBACK_COUNTRIES = [{ code: 'US', name: 'United States' }]

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const countryId = searchParams.get('countryId') || 'US'

    const result = await listRentApps(countryId)
    if (!result.ok) {
      return NextResponse.json({
        apps: [],
        error: result.reason === 'NOT_AVAILABLE'
          ? 'Rental services are temporarily unavailable for this country.'
          : 'Failed to fetch rental services.',
      }, { status: result.reason === 'NOT_AVAILABLE' ? 200 : 500 })
    }

    return NextResponse.json({ countries: FALLBACK_COUNTRIES, apps: result.apps })
  } catch (error) {
    console.error('[numbers/rent/apps]', error)
    return NextResponse.json({ error: 'Failed to fetch rental services' }, { status: 500 })
  }
}