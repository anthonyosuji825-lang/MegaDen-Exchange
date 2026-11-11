// app/api/esim/plans/route.js
//
//   GET /api/esim/plans?country=NG            plans for one country
//   GET /api/esim/plans?scope=regional&region=europe
//   GET /api/esim/plans?scope=global
//   (optional) &type=data|unlimited|calling
//
// Returns each plan with OUR sell price (Fleexa's price + the admin-editable
// eSIM markup). Cheapest first.
import { NextResponse } from 'next/server'
import { getAuthedUser, getMarkupPercent, sellPriceNgn } from '@/lib/fleexaShared'
import { listEsimPlans } from '@/lib/providers/fleexaEsim'

const SCOPES = ['country', 'regional', 'global']
const TYPES = ['data', 'unlimited', 'calling']

export async function GET(request) {
  try {
    const user = await getAuthedUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const params = new URL(request.url).searchParams
    const scope = params.get('scope')
    const country = (params.get('country') || '').toUpperCase()
    const region = params.get('region') || ''
    const type = TYPES.includes(params.get('type')) ? params.get('type') : 'data'

    if (scope && !SCOPES.includes(scope)) return NextResponse.json({ error: 'Invalid scope' }, { status: 400 })
    if (country && !/^[A-Z]{2}$/.test(country)) return NextResponse.json({ error: 'Invalid country' }, { status: 400 })
    if (region && !/^[a-zA-Z0-9_-]{1,40}$/.test(region)) return NextResponse.json({ error: 'Invalid region' }, { status: 400 })
    if (!country && !region && scope !== 'global') return NextResponse.json({ error: 'Choose a destination first.' }, { status: 400 })

    const [markup, r] = await Promise.all([getMarkupPercent('esim'), listEsimPlans({ scope: scope || (country ? 'country' : undefined), country, region, type })])
    if (!r.ok) return NextResponse.json({ error: 'Could not load eSIM plans. Please try again.' }, { status: 502 })

    const plans = r.plans
      .map((p) => {
        const price = sellPriceNgn(p.costNgn, markup)
        return price === null ? null : {
          id: p.id,
          name: p.name,
          type: p.type,
          country_name: p.countryName,
          data_mb: p.dataMb,
          is_unlimited: p.isUnlimited,
          validity_days: p.validityDays,
          networks: p.networks,
          supports_topup: p.supportsTopup,
          price_ngn: price,
        }
      })
      .filter(Boolean)
      .sort((a, b) => a.price_ngn - b.price_ngn)

    return NextResponse.json({ plans })
  } catch (error) {
    console.error('[esim/plans]', error)
    return NextResponse.json({ error: 'Failed to load eSIM plans' }, { status: 500 })
  }
}