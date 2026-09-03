// app/api/5sim/countries/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { formatCountryName, getFlag } from '@/lib/countries'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const service = searchParams.get('service') || 'whatsapp'

    const [res, settingsRes] = await Promise.all([
      fetch(
        `https://5sim.net/v1/guest/prices?product=${service}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.FIVESIM_API_KEY}`,
            'Accept': 'application/json',
          },
          next: { revalidate: 60 },
        }
      ),
      supabaseAdmin.from('app_settings').select('key, value'),
    ])

    if (!res.ok) throw new Error(`5sim responded with ${res.status}`)

    const data = await res.json()

    const settingsMap = {}
    ;(settingsRes.data || []).forEach(s => { settingsMap[s.key] = s.value })
    const rate = parseFloat(settingsMap.usd_to_ngn_rate || process.env.USD_TO_NGN_RATE || '1600')
    const multiplier = parseFloat(settingsMap.markup_multiplier || '3.5')

    const serviceData = data[service]
    if (!serviceData) return NextResponse.json({ countries: [] })

    const countries = []

    for (const [country, operators] of Object.entries(serviceData)) {
      let bestPrice = 0
      let totalStock = 0

      for (const [operator, info] of Object.entries(operators)) {
        if (!info || info.count === 0) continue
        totalStock += info.count
        if (info.cost > bestPrice) bestPrice = info.cost
      }

      if (totalStock === 0 || bestPrice === 0) continue

      const displayPrice = Math.max(bestPrice, 0.50)

      countries.push({
        code: country,
        name: formatCountryName(country),
        flag: getFlag(country),
        price_usd: displayPrice,
        price_ngn: Math.ceil(displayPrice * rate * multiplier),
        stock: totalStock,
      })
    }

    const preferred = [
      'usa', 'uk', 'russia', 'ukraine', 'canada',
      'indonesia', 'india', 'nigeria', 'ghana',
    ]

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
    console.error('[5sim/countries]', error)
    return NextResponse.json({ error: 'Failed to fetch countries' }, { status: 500 })
  }
}