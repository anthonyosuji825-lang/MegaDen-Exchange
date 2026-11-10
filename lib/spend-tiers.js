// Spender tiers for the dashboard "Total Spent" card.
// Edit thresholds / names / colours here only. min is inclusive (in Naira).
export const SPEND_TIERS = [
  { key: 'starter',  name: 'Starter',  min: 0,       icon: 'spark',  fx: 'dots',    particles: 0,  bg: 'linear-gradient(135deg,#171a3a 0%,#262b63 55%,#3a3f8f 100%)', accent: '#a5adff', glow: 'rgba(130,140,255,0.35)' },
  { key: 'bronze',   name: 'Bronze',   min: 1000,    icon: 'medal',  fx: 'dots',    particles: 4,  bg: 'linear-gradient(135deg,#2e1608 0%,#6b3a1a 55%,#b8743a 100%)', accent: '#f0b07a', glow: 'rgba(232,150,90,0.45)' },
  { key: 'gold',     name: 'Gold',     min: 10000,   icon: 'trophy', fx: 'dots',    particles: 7,  bg: 'linear-gradient(135deg,#3a2400 0%,#8a5d00 55%,#d9a21f 100%)', accent: '#ffd76a', glow: 'rgba(255,200,60,0.55)' },
  { key: 'diamond',  name: 'Diamond',  min: 30000,   icon: 'gem',    fx: 'twinkle', particles: 9,  bg: 'linear-gradient(135deg,#031d33 0%,#0a5686 55%,#2fb4ee 100%)', accent: '#a8ecff', glow: 'rgba(80,200,255,0.55)' },
  { key: 'platinum', name: 'Platinum', min: 60000,   icon: 'shield', fx: 'twinkle', particles: 10, bg: 'linear-gradient(135deg,#171c2b 0%,#3d4863 55%,#8794b3 100%)', accent: '#eef2ff', glow: 'rgba(200,215,255,0.5)' },
  { key: 'master',   name: 'Master',   min: 120000,  icon: 'flame',  fx: 'embers',  particles: 12, bg: 'linear-gradient(135deg,#250640 0%,#5f10b8 55%,#d23ee8 100%)', accent: '#f8c0ff', glow: 'rgba(220,90,245,0.6)' },
  { key: 'legend',   name: 'Legend',   min: 250000,  icon: 'crown',  fx: 'embers',  particles: 14, bg: 'linear-gradient(135deg,#380808 0%,#b3261e 50%,#ff9d00 100%)', accent: '#ffe08a', glow: 'rgba(255,150,40,0.65)' },
]

// Orders with these statuses were not really spent (refunded / never delivered).
export const NON_SPEND_STATUSES = ['cancelled', 'canceled', 'failed', 'refunded', 'expired']

export function getTierInfo(totalSpent) {
  const total = Math.max(0, Number(totalSpent) || 0)
  let index = 0
  for (let i = 0; i < SPEND_TIERS.length; i++) {
    if (total >= SPEND_TIERS[i].min) index = i
  }
  const tier = SPEND_TIERS[index]
  const next = SPEND_TIERS[index + 1] || null
  const progress = next ? Math.min(1, (total - tier.min) / (next.min - tier.min)) : 1
  const remaining = next ? Math.max(0, next.min - total) : 0
  return { tier, next, index, progress, remaining, total }
}

export function formatNaira(n) {
  return '₦' + Math.round(Number(n) || 0).toLocaleString('en-NG')
}

// Short form for tight spaces: ₦950, ₦47.1K, ₦1.2M
export function formatNairaShort(n) {
  const v = Math.round(Number(n) || 0)
  if (v >= 1000000) return '₦' + (v / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (v >= 1000) return '₦' + (v / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  return '₦' + v
}