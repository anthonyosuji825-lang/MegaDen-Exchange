// app/api/esim/destinations/route.js
//
//   GET /api/esim/destinations?scope=country|regional|global&type=data|unlimited|calling
//     -> the destinations Fleexa sells eSIMs for, each with the cheapest plan
//        price (our sell price, markup included) - used to build the country grid.
import { NextResponse } from 'next/server'
import { getAuthedUser, getMarkupPercent, sellPriceNgn } from '@/lib/fleexaShared'
import { listEsimDestinations } from '@/lib/providers/fleexaEsim'

const SCOPES = ['country', 'regional', 'global']
const TYPES = ['data', 'unlimited', 'calling']

// The destination list is long and rarely changes - keep it for a minute per
// server instance. Purely a rate-limit mitigation; prices are never taken
// from here at buy time.
const TTL_MS = 60_000
const cache = new Map() // `${scope}:${type}` -> { at, destinations }

export async function GET(request) {
  try {
    const user = await getAuthedUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const params = new URL(request.url).searchParams
    const scope = SCOPES.includes(params.get('scope')) ? params.get('scope') : 'country'
    const type = TYPES.includes(params.get('type')) ? params.get('type') : 'data'
    const key = `${scope}:${type}`

    let hit = cache.get(key)
    if (!hit || Date.now() - hit.at > TTL_MS) {
      const r = await listEsimDestinations({ scope, type })
      if (!r.ok) return NextResponse.json({ error: 'eSIM destinations are unavailable right now. Please try again.' }, { status: 502 })
      hit = { at: Date.now(), destinations: r.destinations }
      cache.set(key, hit)
    }

    const markup = await getMarkupPercent('esim')
    const destinations = hit.destinations
      .map((d) => {
        const price = sellPriceNgn(d.fromCostNgn, markup)
        return price === null ? null : { key: d.key, name: d.name, code: d.code, continent: d.continent, scope: d.scope, plan_count: d.planCount, from_price_ngn: price }
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ scope, type, destinations })
  } catch (error) {
    console.error('[esim/destinations]', error)
    return NextResponse.json({ error: 'Failed to load eSIM destinations' }, { status: 500 })
  }
}