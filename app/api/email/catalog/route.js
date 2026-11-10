// app/api/email/catalog/route.js
//
//   GET /api/email/catalog            -> the sites Fleexa supports
//   GET /api/email/catalog?site=telegram -> that site's domains, with OUR
//                                          sell price and stock for each
//
// The price for an email is per DOMAIN (@outlook.com costs less than
// @gmail.com), not per site, so prices are only returned with the domain
// list - the site list deliberately carries none.
import { NextResponse } from 'next/server'
import { getAuthedUser, getMarkupPercent, sellPriceNgn } from '@/lib/fleexaShared'
import { listEmailProducts, listEmailDomains } from '@/lib/providers/fleexaEmail'

// The site list is long and changes rarely - hold it for a minute per server
// instance so opening the page does not hit Fleexa every time. Purely a
// rate-limit mitigation: prices are never taken from here at buy time.
const SITES_TTL_MS = 60_000
let sitesCache = null // { at, sites }

export async function GET(request) {
  try {
    const user = await getAuthedUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const site = new URL(request.url).searchParams.get('site')

    if (!site) {
      if (!sitesCache || Date.now() - sitesCache.at > SITES_TTL_MS) {
        const r = await listEmailProducts()
        if (!r.ok) return NextResponse.json({ error: 'Email services are unavailable right now. Please try again.' }, { status: 502 })
        sitesCache = { at: Date.now(), sites: r.sites }
      }
      const sites = sitesCache.sites
        .map((s) => ({ id: s.id, name: s.name }))
        .sort((a, b) => a.name.localeCompare(b.name))
      return NextResponse.json({ sites })
    }

    if (site.length > 64) return NextResponse.json({ error: 'Invalid service' }, { status: 400 })

    const [markup, r] = await Promise.all([getMarkupPercent('email'), listEmailDomains(site)])
    if (!r.ok) return NextResponse.json({ error: 'Could not load domains for this service. Please try again.' }, { status: 502 })

    const domains = r.domains
      .map((d) => ({ name: d.name, price_ngn: sellPriceNgn(d.costNgn, markup), stock: d.stock }))
      .filter((d) => d.price_ngn !== null)
      .sort((a, b) => a.price_ngn - b.price_ngn)

    return NextResponse.json({ site, domains })
  } catch (error) {
    console.error('[email/catalog]', error)
    return NextResponse.json({ error: 'Failed to load email services' }, { status: 500 })
  }
}