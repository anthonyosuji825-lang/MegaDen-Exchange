// lib/countries.js
// Shared country display helpers used by app/api/5sim/countries/route.js
// and app/api/5sim/buy/route.js. Previously buy/route.js had its own short
// copy of this list (~14 countries) while countries/route.js had the full
// ~90+. Any order placed for a country outside that short list stored a
// wrong flag/generic name in order.details even though the picker showed
// the correct one. Single source of truth now — both routes import this.

const NAMES = {
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

const FLAGS = {
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

export function formatCountryName(code) {
  return NAMES[code] || code.charAt(0).toUpperCase() + code.slice(1).replace(/([a-z])([A-Z])/g, '$1 $2')
}

export function getFlag(code) {
  return FLAGS[code] || '🌍'
}