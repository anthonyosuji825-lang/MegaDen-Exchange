// app/api/proxy/plans/route.js
//
//   GET /api/proxy/plans -> proxy plans with OUR sell price, plus the
//                           countries (and US states) and proxy formats
//
// Fleexa's price_ngn is our wholesale cost; the customer-facing price is
// cost + the admin-editable markup (fleexa_proxy_markup_percent).
import { NextResponse } from 'next/server'
import { getAuthedUser, getMarkupPercent, sellPriceNgn } from '@/lib/fleexaShared'
import { listProxyPlans } from '@/lib/providers/fleexaProxy'

// Plans and countries change rarely - hold them for a minute per server
// instance so opening the page does not hit Fleexa every time. Prices are
// never taken from here at buy time (the buy route asks Fleexa again).
const TTL_MS = 60_000
let cache = null // { at, data }

export async function GET() {
  try {
    const user = await getAuthedUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!cache || Date.now() - cache.at > TTL_MS) {
      const r = await listProxyPlans()
      if (!r.ok) return NextResponse.json({ error: 'Proxies are unavailable right now. Please try again.' }, { status: 502 })
      cache = { at: Date.now(), data: r }
    }
    const { plans, countries, categories, expiryHours } = cache.data
    const markup = await getMarkupPercent('proxy')

    const out = plans
      .map((p) => {
        const price = sellPriceNgn(p.costNgn, markup)
        return price === null ? null : {
          id: p.id,
          label: p.label,
          quantity: p.quantity,
          price_ngn: price,
          per_ip_ngn: Math.ceil(price / Math.max(1, p.quantity)),
        }
      })
      .filter(Boolean)
      .sort((a, b) => a.quantity - b.quantity)

    return NextResponse.json({
      plans: out,
      countries: [...countries].sort((a, b) => a.name.localeCompare(b.name)),
      categories: categories.map((c) => ({ id: c.id, name: c.name, type: c.type, description: c.description })),
      expiry_hours: expiryHours,
    })
  } catch (error) {
    console.error('[proxy/plans]', error)
    return NextResponse.json({ error: 'Failed to load proxy plans' }, { status: 500 })
  }
}