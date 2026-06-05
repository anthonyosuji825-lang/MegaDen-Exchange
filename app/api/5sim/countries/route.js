// app/api/5sim/countries/route.js
import { NextResponse } from 'next/server'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const service = searchParams.get('service') || 'whatsapp'

    const res = await fetch(
      `https://5sim.net/v1/guest/prices?product=${service}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.FIVESIM_API_KEY}`,
          'Accept': 'application/json',
        },
        next: { revalidate: 300 } // cache for 5 minutes
      }
    )

    if (!res.ok) throw new Error('Failed to fetch from 5SIM')
    const data = await res.json()

    // Transform 5SIM response into clean country list
    const countries = []
    for (const [country, services] of Object.entries(data)) {
      const serviceData = services[service]
      if (!serviceData) continue

      // Get cheapest operator
      let cheapestPrice = Infinity
      let totalQty = 0
      for (const [operator, info] of Object.entries(serviceData)) {
        if (info.cost < cheapestPrice) cheapestPrice = info.cost
        totalQty += info.count
      }

      if (totalQty === 0) continue // skip out of stock

      countries.push({
        code: country,
        name: formatCountryName(country),
        flag: getFlag(country),
        price_usd: cheapestPrice,
        price_ngn: Math.ceil(cheapestPrice * 1600 * 3.5), // markup: USD rate × 3.5x
        stock: totalQty,
      })
    }

    // Sort by popularity (Nigeria users prefer these)
    const preferred = ['usa', 'uk', 'russia', 'ukraine', 'canada', 'indonesia', 'india']
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
    console.error('5SIM countries error:', error)
    return NextResponse.json({ error: 'Failed to fetch countries' }, { status: 500 })
  }
}

function formatCountryName(code) {
  const names = {
    usa: 'United States', uk: 'United Kingdom', russia: 'Russia',
    ukraine: 'Ukraine', canada: 'Canada', indonesia: 'Indonesia',
    india: 'India', brazil: 'Brazil', germany: 'Germany',
    france: 'France', philippines: 'Philippines', vietnam: 'Vietnam',
    nigeria: 'Nigeria', ghana: 'Ghana', kenya: 'Kenya',
    poland: 'Poland', spain: 'Spain', italy: 'Italy',
    netherlands: 'Netherlands', sweden: 'Sweden', norway: 'Norway',
    australia: 'Australia', japan: 'Japan', china: 'China',
    mexico: 'Mexico', colombia: 'Colombia', argentina: 'Argentina',
    egypt: 'Egypt', pakistan: 'Pakistan', bangladesh: 'Bangladesh',
    myanmar: 'Myanmar', thailand: 'Thailand', malaysia: 'Malaysia',
    cambodia: 'Cambodia', laos: 'Laos', hongkong: 'Hong Kong',
    taiwan: 'Taiwan', southkorea: 'South Korea', estonia: 'Estonia',
    latvia: 'Latvia', lithuania: 'Lithuania', moldova: 'Moldova',
    georgia: 'Georgia', armenia: 'Armenia', kazakhstan: 'Kazakhstan',
    uzbekistan: 'Uzbekistan', kyrgyzstan: 'Kyrgyzstan', tajikistan: 'Tajikistan',
    azerbaijan: 'Azerbaijan', romania: 'Romania', bulgaria: 'Bulgaria',
    serbia: 'Serbia', croatia: 'Croatia', czechia: 'Czech Republic',
    hungary: 'Hungary', slovakia: 'Slovakia', austria: 'Austria',
    switzerland: 'Switzerland', belgium: 'Belgium', portugal: 'Portugal',
    denmark: 'Denmark', finland: 'Finland', ireland: 'Ireland',
    newzealand: 'New Zealand', southafrica: 'South Africa',
    morocco: 'Morocco', ethiopia: 'Ethiopia', tanzania: 'Tanzania',
    uganda: 'Uganda', senegal: 'Senegal', cameroon: 'Cameroon',
  }
  return names[code] || code.charAt(0).toUpperCase() + code.slice(1)
}

function getFlag(code) {
  const flags = {
    usa: '🇺🇸', uk: '🇬🇧', russia: '🇷🇺', ukraine: '🇺🇦', canada: '🇨🇦',
    indonesia: '🇮🇩', india: '🇮🇳', brazil: '🇧🇷', germany: '🇩🇪',
    france: '🇫🇷', philippines: '🇵🇭', vietnam: '🇻🇳', nigeria: '🇳🇬',
    ghana: '🇬🇭', kenya: '🇰🇪', poland: '🇵🇱', spain: '🇪🇸', italy: '🇮🇹',
    netherlands: '🇳🇱', sweden: '🇸🇪', norway: '🇳🇴', australia: '🇦🇺',
    japan: '🇯🇵', china: '🇨🇳', mexico: '🇲🇽', colombia: '🇨🇴',
    argentina: '🇦🇷', egypt: '🇪🇬', pakistan: '🇵🇰', bangladesh: '🇧🇩',
    myanmar: '🇲🇲', thailand: '🇹🇭', malaysia: '🇲🇾', cambodia: '🇰🇭',
    laos: '🇱🇦', hongkong: '🇭🇰', taiwan: '🇹🇼', southkorea: '🇰🇷',
    estonia: '🇪🇪', latvia: '🇱🇻', lithuania: '🇱🇹', moldova: '🇲🇩',
    georgia: '🇬🇪', armenia: '🇦🇲', kazakhstan: '🇰🇿', uzbekistan: '🇺🇿',
    romania: '🇷🇴', bulgaria: '🇧🇬', serbia: '🇷🇸', czechia: '🇨🇿',
    hungary: '🇭🇺', austria: '🇦🇹', switzerland: '🇨🇭', belgium: '🇧🇪',
    portugal: '🇵🇹', denmark: '🇩🇰', finland: '🇫🇮', ireland: '🇮🇪',
    newzealand: '🇳🇿', southafrica: '🇿🇦', morocco: '🇲🇦',
    ethiopia: '🇪🇹', tanzania: '🇹🇿', uganda: '🇺🇬', senegal: '🇸🇳',
    cameroon: '🇨🇲', skyroam: '🌐',
  }
  return flags[code] || '🌍'
}