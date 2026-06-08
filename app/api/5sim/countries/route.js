// app/api/5sim/countries/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const service = searchParams.get('service') || 'whatsapp'

    // Fetch 5sim data + app settings in parallel
    const [res, settingsRes] = await Promise.all([
      fetch(
        `https://5sim.net/v1/guest/prices?product=${service}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.FIVESIM_API_KEY}`,
            'Accept': 'application/json',
          },
          next: { revalidate: 300 }
        }
      ),
      supabaseAdmin.from('app_settings').select('key, value'),
    ])

    if (!res.ok) throw new Error('Failed to fetch from 5SIM')
    const data = await res.json()

    // Read live settings, fall back to defaults
    const settingsMap = {}
    ;(settingsRes.data || []).forEach(s => { settingsMap[s.key] = s.value })
    const rate = parseFloat(settingsMap.usd_to_ngn_rate || process.env.USD_TO_NGN_RATE || '1600')
    const multiplier = parseFloat(settingsMap.markup_multiplier || '3.5')

    // 5SIM response: { "whatsapp": { "country": { "operator": { cost, count } } } }
    const serviceData = data[service]
    if (!serviceData) return NextResponse.json({ countries: [] })

    const countries = []

    for (const [country, operators] of Object.entries(serviceData)) {
      let cheapestPrice = Infinity
      let totalQty = 0

      for (const [operator, info] of Object.entries(operators)) {
        if (info.cost < cheapestPrice) cheapestPrice = info.cost
        totalQty += info.count
      }

      if (totalQty === 0) continue // skip out of stock
      if (cheapestPrice === Infinity) continue

      countries.push({
        code: country,
        name: formatCountryName(country),
        flag: getFlag(country),
        price_usd: cheapestPrice,
        price_ngn: Math.ceil(cheapestPrice * rate * multiplier),
        stock: totalQty,
      })
    }

    // Sort preferred countries first
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
    afghanistan: 'Afghanistan', albania: 'Albania', algeria: 'Algeria',
    angola: 'Angola', belarus: 'Belarus', bolivia: 'Bolivia',
    bosniaandherzegovina: 'Bosnia & Herzegovina', chile: 'Chile',
    costarica: 'Costa Rica', cuba: 'Cuba', dominicanrepublic: 'Dominican Republic',
    ecuador: 'Ecuador', elsalvador: 'El Salvador', guatemala: 'Guatemala',
    haiti: 'Haiti', honduras: 'Honduras', iraq: 'Iraq',
    iran: 'Iran', israel: 'Israel', jamaica: 'Jamaica',
    jordan: 'Jordan', kuwait: 'Kuwait', lebanon: 'Lebanon',
    libya: 'Libya', madagascar: 'Madagascar', mongolia: 'Mongolia',
    mozambique: 'Mozambique', namibia: 'Namibia', nepal: 'Nepal',
    nicaragua: 'Nicaragua', oman: 'Oman', panama: 'Panama',
    paraguay: 'Paraguay', peru: 'Peru', qatar: 'Qatar',
    saudiarabia: 'Saudi Arabia', srilanka: 'Sri Lanka', sudan: 'Sudan',
    syria: 'Syria', tunisia: 'Tunisia', turkey: 'Turkey',
    uae: 'UAE', uruguay: 'Uruguay', venezuela: 'Venezuela',
    yemen: 'Yemen', zambia: 'Zambia', zimbabwe: 'Zimbabwe',
  }
  return names[code] || code.charAt(0).toUpperCase() + code.slice(1).replace(/([a-z])([A-Z])/g, '$1 $2')
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
    cameroon: '🇨🇲', afghanistan: '🇦🇫', albania: '🇦🇱', algeria: '🇩🇿',
    angola: '🇦🇴', belarus: '🇧🇾', bolivia: '🇧🇴', chile: '🇨🇱',
    cuba: '🇨🇺', ecuador: '🇪🇨', guatemala: '🇬🇹', haiti: '🇭🇹',
    honduras: '🇭🇳', iraq: '🇮🇶', iran: '🇮🇷', israel: '🇮🇱',
    jamaica: '🇯🇲', jordan: '🇯🇴', kuwait: '🇰🇼', lebanon: '🇱🇧',
    libya: '🇱🇾', mongolia: '🇲🇳', nepal: '🇳🇵', nicaragua: '🇳🇮',
    oman: '🇴🇲', panama: '🇵🇦', paraguay: '🇵🇾', peru: '🇵🇪',
    qatar: '🇶🇦', saudiarabia: '🇸🇦', srilanka: '🇱🇰', sudan: '🇸🇩',
    syria: '🇸🇾', tunisia: '🇹🇳', turkey: '🇹🇷', uae: '🇦🇪',
    uruguay: '🇺🇾', venezuela: '🇻🇪', yemen: '🇾🇪', zambia: '🇿🇲',
    zimbabwe: '🇿🇼',
  }
  return flags[code] || '🌍'
}