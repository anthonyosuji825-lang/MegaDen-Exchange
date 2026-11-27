'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AdminSidebar from '@/components/AdminSidebar'
import { AnnouncementCard } from '@/components/AnnouncementPopup'

// Boosting packages — mirrors boosting page exactly
// Prices stored in Supabase `boost_prices` table; fallback to these defaults
const DEFAULT_BOOST_PACKAGES = [
  { platform: 'Instagram', id: 'ig_f1k',   name: '1,000 Followers',  price: 1500  },
  { platform: 'Instagram', id: 'ig_f5k',   name: '5,000 Followers',  price: 6000  },
  { platform: 'Instagram', id: 'ig_f10k',  name: '10,000 Followers', price: 11000 },
  { platform: 'Instagram', id: 'ig_f50k',  name: '50,000 Followers', price: 48000 },
  { platform: 'Instagram', id: 'ig_l500',  name: '500 Likes',        price: 500   },
  { platform: 'Instagram', id: 'ig_l1k',   name: '1,000 Likes',      price: 800   },
  { platform: 'Instagram', id: 'ig_l5k',   name: '5,000 Likes',      price: 3500  },
  { platform: 'Instagram', id: 'ig_v10k',  name: '10,000 Views',     price: 600   },
  { platform: 'Instagram', id: 'ig_v50k',  name: '50,000 Views',     price: 2500  },
  { platform: 'Instagram', id: 'ig_v100k', name: '100,000 Views',    price: 4500  },
  { platform: 'TikTok',    id: 'tt_f1k',   name: '1,000 Followers',  price: 1200  },
  { platform: 'TikTok',    id: 'tt_f5k',   name: '5,000 Followers',  price: 5000  },
  { platform: 'TikTok',    id: 'tt_f10k',  name: '10,000 Followers', price: 9500  },
  { platform: 'TikTok',    id: 'tt_l1k',   name: '1,000 Likes',      price: 600   },
  { platform: 'TikTok',    id: 'tt_l5k',   name: '5,000 Likes',      price: 2500  },
  { platform: 'TikTok',    id: 'tt_v50k',  name: '50,000 Views',     price: 1000  },
  { platform: 'TikTok',    id: 'tt_v500k', name: '500,000 Views',    price: 8000  },
  { platform: 'Twitter',   id: 'tw_f500',  name: '500 Followers',    price: 1000  },
  { platform: 'Twitter',   id: 'tw_f1k',   name: '1,000 Followers',  price: 1800  },
  { platform: 'Twitter',   id: 'tw_f5k',   name: '5,000 Followers',  price: 7500  },
  { platform: 'Twitter',   id: 'tw_l500',  name: '500 Likes',        price: 700   },
  { platform: 'Twitter',   id: 'tw_l1k',   name: '1,000 Likes',      price: 1200  },
  { platform: 'Twitter',   id: 'tw_rt500', name: '500 Retweets',     price: 1000  },
  { platform: 'Facebook',  id: 'fb_pl1k',  name: '1,000 Page Likes', price: 2000  },
  { platform: 'Facebook',  id: 'fb_pl5k',  name: '5,000 Page Likes', price: 8000  },
  { platform: 'Facebook',  id: 'fb_f1k',   name: '1,000 Followers',  price: 1800  },
  { platform: 'Facebook',  id: 'fb_f5k',   name: '5,000 Followers',  price: 7000  },
  { platform: 'Facebook',  id: 'fb_ptl500',name: '500 Post Likes',   price: 800   },
  { platform: 'Facebook',  id: 'fb_ptl1k', name: '1,000 Post Likes', price: 1400  },
  { platform: 'YouTube',   id: 'yt_s500',  name: '500 Subscribers',  price: 3000  },
  { platform: 'YouTube',   id: 'yt_s1k',   name: '1,000 Subscribers',price: 5000  },
  { platform: 'YouTube',   id: 'yt_s5k',   name: '5,000 Subscribers',price: 22000 },
  { platform: 'YouTube',   id: 'yt_v10k',  name: '10,000 Views',     price: 2000  },
  { platform: 'YouTube',   id: 'yt_v50k',  name: '50,000 Views',     price: 8000  },
  { platform: 'YouTube',   id: 'yt_l500',  name: '500 Likes',        price: 1000  },
  { platform: 'YouTube',   id: 'yt_l1k',   name: '1,000 Likes',      price: 1800  },
  { platform: 'Telegram',  id: 'tg_m500',  name: '500 Members',      price: 1800  },
  { platform: 'Telegram',  id: 'tg_m1k',   name: '1,000 Members',    price: 3000  },
  { platform: 'Telegram',  id: 'tg_m5k',   name: '5,000 Members',    price: 12000 },
  { platform: 'Telegram',  id: 'tg_m10k',  name: '10,000 Members',   price: 22000 },
  { platform: 'Telegram',  id: 'tg_v10k',  name: '10,000 Post Views',price: 800   },
  { platform: 'Telegram',  id: 'tg_v50k',  name: '50,000 Post Views',price: 3000  },
  { platform: 'Spotify',   id: 'sp_pl1k',  name: '1,000 Plays (iOS)',price: 1800  },
  { platform: 'Spotify',   id: 'sp_pl5k',  name: '5,000 Plays (iOS)',price: 8000  },
  { platform: 'Spotify',   id: 'sp_pl10k', name: '10,000 Plays',     price: 14000 },
  { platform: 'Snapchat',  id: 'sc_f100',  name: '100 Followers',    price: 2500  },
  { platform: 'Snapchat',  id: 'sc_f500',  name: '500 Followers',    price: 10000 },

  // ── TURBO BOOST (Exo) ─────────────────────────────────────────────────────
  { platform: 'Turbo · Instagram', id: 'tb_ig_f1k_avg',   name: '1,000 Followers (Avg)',  price: 4000  },
  { platform: 'Turbo · Instagram', id: 'tb_ig_f1k_hq',    name: '1,000 Followers (HQ)',   price: 6000  },
  { platform: 'Turbo · Instagram', id: 'tb_ig_f5k_avg',   name: '5,000 Followers (Avg)',  price: 18000 },
  { platform: 'Turbo · Instagram', id: 'tb_ig_f5k_hq',    name: '5,000 Followers (HQ)',   price: 28000 },
  { platform: 'Turbo · Instagram', id: 'tb_ig_l1k_avg',   name: '1,000 Likes (Avg)',      price: 500   },
  { platform: 'Turbo · Instagram', id: 'tb_ig_l1k_hq',    name: '1,000 Likes (HQ)',       price: 900   },
  { platform: 'Turbo · Instagram', id: 'tb_ig_l5k_avg',   name: '5,000 Likes (Avg)',      price: 2000  },
  { platform: 'Turbo · Instagram', id: 'tb_ig_l5k_hq',    name: '5,000 Likes (HQ)',       price: 4000  },
  { platform: 'Turbo · Instagram', id: 'tb_ig_v10k_avg',  name: '10,000 Views (Avg)',     price: 100   },
  { platform: 'Turbo · Instagram', id: 'tb_ig_v10k_hq',   name: '10,000 Views (HQ)',      price: 300   },
  { platform: 'Turbo · Instagram', id: 'tb_ig_v100k_avg', name: '100,000 Views (Avg)',    price: 900   },
  { platform: 'Turbo · Instagram', id: 'tb_ig_v100k_hq',  name: '100,000 Views (HQ)',     price: 2500  },
  { platform: 'Turbo · TikTok',    id: 'tb_tt_f1k_avg',   name: '1,000 Followers (Avg)',  price: 8000  },
  { platform: 'Turbo · TikTok',    id: 'tb_tt_f1k_hq',    name: '1,000 Followers (HQ)',   price: 11000 },
  { platform: 'Turbo · TikTok',    id: 'tb_tt_f5k_avg',   name: '5,000 Followers (Avg)',  price: 38000 },
  { platform: 'Turbo · TikTok',    id: 'tb_tt_f5k_hq',    name: '5,000 Followers (HQ)',   price: 56000 },
  { platform: 'Turbo · TikTok',    id: 'tb_tt_l1k_avg',   name: '1,000 Likes (Avg)',      price: 500   },
  { platform: 'Turbo · TikTok',    id: 'tb_tt_l1k_hq',    name: '1,000 Likes (HQ)',       price: 700   },
  { platform: 'Turbo · TikTok',    id: 'tb_tt_l5k_avg',   name: '5,000 Likes (Avg)',      price: 2000  },
  { platform: 'Turbo · TikTok',    id: 'tb_tt_l5k_hq',    name: '5,000 Likes (HQ)',       price: 3500  },
  { platform: 'Turbo · TikTok',    id: 'tb_tt_v50k_avg',  name: '50,000 Views (Avg)',     price: 400   },
  { platform: 'Turbo · TikTok',    id: 'tb_tt_v50k_hq',   name: '50,000 Views (HQ)',      price: 600   },
  { platform: 'Turbo · TikTok',    id: 'tb_tt_v500k_avg', name: '500,000 Views (Avg)',    price: 4000  },
  { platform: 'Turbo · TikTok',    id: 'tb_tt_v500k_hq',  name: '500,000 Views (HQ)',     price: 6000  },
  { platform: 'Turbo · Facebook',  id: 'tb_fb_pgf1k_avg',   name: '1,000 Page Followers (Avg)',    price: 4500 },
  { platform: 'Turbo · Facebook',  id: 'tb_fb_pgf1k_hq',    name: '1,000 Page Followers (HQ)',     price: 4500 },
  { platform: 'Turbo · Facebook',  id: 'tb_fb_prf1k_avg',   name: '1,000 Profile Followers (Avg)', price: 7000 },
  { platform: 'Turbo · Facebook',  id: 'tb_fb_prf1k_hq',    name: '1,000 Profile Followers (HQ)',  price: 7000 },
  { platform: 'Turbo · Facebook',  id: 'tb_fb_pl1k_avg',    name: '1,000 Post Likes (Avg)',        price: 700  },
  { platform: 'Turbo · Facebook',  id: 'tb_fb_pl1k_hq',     name: '1,000 Post Likes (HQ)',         price: 900  },
  { platform: 'Turbo · Facebook',  id: 'tb_fb_react_love',  name: '1,000 Reactions ❤️',            price: 900  },
  { platform: 'Turbo · Facebook',  id: 'tb_fb_react_haha',  name: '1,000 Reactions 😂',            price: 900  },
  { platform: 'Turbo · Facebook',  id: 'tb_fb_react_wow',   name: '1,000 Reactions 😮',            price: 900  },
  { platform: 'Turbo · Facebook',  id: 'tb_fb_react_sad',   name: '1,000 Reactions 😢',            price: 900  },
  { platform: 'Turbo · Facebook',  id: 'tb_fb_react_angry', name: '1,000 Reactions 😡',            price: 900  },
  { platform: 'Turbo · Facebook',  id: 'tb_fb_shares',      name: '1,000 Post Shares',             price: 2200 },
  { platform: 'Turbo · Facebook',  id: 'tb_fb_grp1k_avg',   name: '1,000 Group Members (Avg)',     price: 2700 },
  { platform: 'Turbo · Facebook',  id: 'tb_fb_grp1k_hq',    name: '1,000 Group Members (HQ)',      price: 4000 },
  { platform: 'Turbo · Facebook',  id: 'tb_fb_v10k_avg',    name: '10,000 Video Views (Avg)',      price: 1200 },
  { platform: 'Turbo · Facebook',  id: 'tb_fb_v10k_hq',     name: '10,000 Video Views (HQ)',       price: 2000 },
  { platform: 'Turbo · YouTube',   id: 'tb_yt_s500_avg',    name: '500 Subscribers (Avg)',         price: 25000 },
  { platform: 'Turbo · YouTube',   id: 'tb_yt_s500_hq',     name: '500 Subscribers (HQ)',          price: 32000 },
  { platform: 'Turbo · YouTube',   id: 'tb_yt_v10k_avg',    name: '10,000 Views (Avg)',            price: 1800  },
  { platform: 'Turbo · YouTube',   id: 'tb_yt_v10k_hq',     name: '10,000 Views (HQ)',             price: 2500  },
  { platform: 'Turbo · YouTube',   id: 'tb_yt_v50k_avg',    name: '50,000 Views (Avg)',            price: 8000  },
  { platform: 'Turbo · YouTube',   id: 'tb_yt_v50k_hq',     name: '50,000 Views (HQ)',             price: 11000 },
  { platform: 'Turbo · YouTube',   id: 'tb_yt_l500_avg',    name: '500 Likes (Avg)',               price: 2200  },
  { platform: 'Turbo · YouTube',   id: 'tb_yt_l500_hq',     name: '500 Likes (HQ)',                price: 4000  },
  { platform: 'Turbo · YouTube',   id: 'tb_yt_l1k_avg',     name: '1,000 Likes (Avg)',             price: 4500  },
  { platform: 'Turbo · YouTube',   id: 'tb_yt_l1k_hq',      name: '1,000 Likes (HQ)',              price: 7000  },
  { platform: 'Turbo · Telegram',  id: 'tb_tg_m500_avg',     name: '500 Members (Avg)',            price: 1800 },
  { platform: 'Turbo · Telegram',  id: 'tb_tg_m500_hq',      name: '500 Members (HQ)',             price: 2200 },
  { platform: 'Turbo · Telegram',  id: 'tb_tg_m1k_avg',      name: '1,000 Members (Avg)',          price: 3500 },
  { platform: 'Turbo · Telegram',  id: 'tb_tg_m1k_hq',       name: '1,000 Members (HQ)',           price: 4500 },
  { platform: 'Turbo · Telegram',  id: 'tb_tg_v10k',         name: '10,000 Post Views',            price: 300  },
  { platform: 'Turbo · Telegram',  id: 'tb_tg_v50k',         name: '50,000 Post Views',            price: 1500 },
  { platform: 'Turbo · Telegram',  id: 'tb_tg_autoviews',    name: 'Auto Views (New & Old)',       price: 100  },
  { platform: 'Turbo · Telegram',  id: 'tb_tg_react_pos',    name: '1,000 Positive Reactions',     price: 500  },
  { platform: 'Turbo · Telegram',  id: 'tb_tg_react_neg',    name: '1,000 Negative Reactions',     price: 500  },
  { platform: 'Turbo · Telegram',  id: 'tb_tg_react_heart',  name: '1,000 Reactions ❤️',           price: 500  },
  { platform: 'Turbo · Telegram',  id: 'tb_tg_react_fire',   name: '1,000 Reactions 🔥',           price: 500  },
  { platform: 'Turbo · Telegram',  id: 'tb_tg_react_party',  name: '1,000 Reactions 🎉',           price: 500  },
  { platform: 'Turbo · Telegram',  id: 'tb_tg_react_thumbs', name: '1,000 Reactions 👍',           price: 500  },
]

const vpnProviders = ['NordVPN', 'ExpressVPN', 'Surfshark', 'CyberGhost']
const vpnPlans = ['1 Month', '6 Months', '1 Year']
const subServices = ['Spotify', 'Netflix', 'YouTube Premium', 'Canva Pro', 'ChatGPT Plus']
const subPlans = ['1 Month', '3 Months', '6 Months', '1 Year']
const subServiceIds = { 'Spotify': 'spotify', 'Netflix': 'netflix', 'YouTube Premium': 'youtube', 'Canva Pro': 'canva', 'ChatGPT Plus': 'chatgpt' }
const platforms = [...new Set(DEFAULT_BOOST_PACKAGES.map(p => p.platform))]

// Provider balance cards. Used by BOTH the card grid and the low-balance
// banner so the two can never disagree. `low` / `mid` are in each card's own
// currency (defaults: 5 / 20, which suit the $ providers). Fleexa is in naira
// and a US OTP number costs roughly N2,500, so N5,000 is about two purchases.
const PROVIDER_CARDS = [
  { key:'fivesim',  label:'5sim',      emoji:'📱', color:'#25d366', bg:'rgba(37,211,102,0.08)',  border:'rgba(37,211,102,0.2)',  currency:'$' },
  { key:'jap',      label:'JAP Panel', emoji:'📣', color:'#1877f2', bg:'rgba(24,119,242,0.08)',  border:'rgba(24,119,242,0.2)',  currency:'$' },
  { key:'smspool',  label:'SMSPool',   emoji:'📲', color:'#f0b429', bg:'rgba(240,180,41,0.08)',  border:'rgba(240,180,41,0.2)',  currency:'$' },
  { key:'exo',      label:'Exo Panel', emoji:'🚀', color:'#fb923c', bg:'rgba(251,146,60,0.08)',  border:'rgba(251,146,60,0.2)',  currency:'$' },
  { key:'fleexa',   label:'Fleexa',    emoji:'📞', color:'#22d3ee', bg:'rgba(34,211,238,0.08)',  border:'rgba(34,211,238,0.2)',  currency:'₦', low:5000, mid:15000 },
  { key:'vtugate',  label:'VTUGATE',   emoji:'📶', color:'#6c4ef2', bg:'rgba(108,78,242,0.08)',  border:'rgba(108,78,242,0.2)',  currency:'₦' },
]

// ── Overview money card helpers ──────────────────────────────────────────
// All "days" are calendar days in Nigeria time (WAT, no daylight saving), as
// 'YYYY-MM-DD'. A database timestamp with no timezone suffix is stored in UTC.
const LAGOS_DAY_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' })
function lagosDayKey(value) {
  let d
  if (value instanceof Date) {
    d = value
  } else {
    const s = String(value)
    d = new Date(/[zZ]$|[+-]\d\d(:?\d\d)?$/.test(s) ? s : s.replace(' ', 'T') + 'Z')
  }
  return LAGOS_DAY_FMT.format(d)
}
// Completed orders -> [{ date, total, count }]
function dailyFromOrders(orders) {
  const byDay = new Map()
  for (const o of orders || []) {
    if (o.status !== 'completed' || !o.created_at) continue
    const key = lagosDayKey(o.created_at)
    const b = byDay.get(key) || { total: 0, count: 0 }
    b.total += Number(o.amount) || 0
    b.count++
    byDay.set(key, b)
  }
  return [...byDay.entries()].map(([date, v]) => ({ date, total: v.total, count: v.count }))
}
// [{ date, total, count }] -> totals for today / 7 days / this month / all time + a 14-day series
function summarizeDaily(daily) {
  const todayKey = lagosDayKey(new Date())
  const dayMs = 86400000
  const at = (key) => { const [y, m, d] = key.split('-').map(Number); return Date.UTC(y, m - 1, d) }
  const todayMs = at(todayKey)
  const out = { total: 0, count: 0, today: 0, week: 0, month: 0, series: [] }
  const map = new Map()
  for (const r of daily || []) {
    map.set(r.date, r)
    out.total += r.total
    out.count += r.count
    const age = Math.round((todayMs - at(r.date)) / dayMs)
    if (age === 0) out.today += r.total
    if (age >= 0 && age <= 6) out.week += r.total
    if (r.date.slice(0, 7) === todayKey.slice(0, 7)) out.month += r.total
  }
  for (let i = 13; i >= 0; i--) {
    const key = new Date(todayMs - i * dayMs).toISOString().slice(0, 10)
    out.series.push({ date: key, total: map.get(key)?.total || 0 })
  }
  return out
}

export default function AdminPanel() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [mounted, setMounted] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    setIsDesktop(mq.matches)
    const handleChange = (e) => setIsDesktop(e.matches)
    mq.addEventListener('change', handleChange)
    return () => mq.removeEventListener('change', handleChange)
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  // Data
  const [stats, setStats] = useState({ users: 0, orders: 0, revenue: 0, pending: 0 })
  const money = (n) => (n == null ? '—' : `₦${n.toLocaleString()}`)
  const [revMode, setRevMode] = useState('paystack') // 'paystack' | 'purchases'
  const [paystackDaily, setPaystackDaily] = useState(null) // null = not loaded / failed
  const [users, setUsers] = useState([])
  const [orders, setOrders] = useState([])
  const [vpnKeys, setVpnKeys] = useState([])
  const [subKeys, setSubKeys] = useState([])

  // Settings
  const [settings, setSettings] = useState({ usd_to_ngn_rate: '1600', markup_multiplier: '3.5', fleexa_markup_percent: '15', fleexa_sms6_markup_percent: '', fleexa_email_markup_percent: '15', fleexa_proxy_markup_percent: '15', fleexa_esim_markup_percent: '15', fleexa_rent_margin_percent: '50', bills_broadcast_enabled: 'false', bills_broadcast_message: '', boost_broadcast_enabled: 'false', boost_broadcast_message: '' })
  const [editedSettings, setEditedSettings] = useState({ usd_to_ngn_rate: '1600', markup_multiplier: '3.5', fleexa_markup_percent: '15', fleexa_sms6_markup_percent: '', fleexa_email_markup_percent: '15', fleexa_proxy_markup_percent: '15', fleexa_esim_markup_percent: '15', fleexa_rent_margin_percent: '50', bills_broadcast_enabled: 'false', bills_broadcast_message: '', boost_broadcast_enabled: 'false', boost_broadcast_message: '' })
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const [boostPrices, setBoostPrices] = useState({})
  const [editedPrices, setEditedPrices] = useState({})
  const [savingPrices, setSavingPrices] = useState(false)
  const [pricesSaved, setPricesSaved] = useState(false)
  const [activePlatform, setActivePlatform] = useState('Instagram')

  // VPN form
  const [showVpnForm, setShowVpnForm] = useState(false)
  const [vpnForm, setVpnForm] = useState({ provider: 'NordVPN', plan: '1 Month', key: '' })
  const [savingVpn, setSavingVpn] = useState(false)
  const [vpnBulk, setVpnBulk] = useState('')

  // Subscription form
  const [showSubForm, setShowSubForm] = useState(false)
  const [subForm, setSubForm] = useState({ service: 'Spotify', plan: '1 Month', key: '' })
  const [savingSub, setSavingSub] = useState(false)
  const [subBulk, setSubBulk] = useState('')

  // Balance edit
  const [editingBalance, setEditingBalance] = useState(null)
  const [newBalance, setNewBalance] = useState('')

  // Order delivery
  const [deliveringOrder, setDeliveringOrder] = useState(null)
  const [deliveryKey, setDeliveryKey] = useState('')
  const [delivering, setDelivering] = useState(false)

  // Order filter
  const [orderFilter, setOrderFilter] = useState('all')
  const [userSort, setUserSort] = useState('recent')
  const [userSearch, setUserSearch] = useState('')
  const [userSearching, setUserSearching] = useState(false)

  // Provider balances
  const [providerBalances, setProviderBalances] = useState({ fivesim: { balance: null, error: null }, jap: { balance: null, error: null }, vtugate: { balance: null, error: null }, smspool: { balance: null, error: null }, exo: { balance: null, error: null }, fleexa: { balance: null, error: null } })
  const [balancesLoading, setBalancesLoading] = useState(false)
  const [balancesLastFetched, setBalancesLastFetched] = useState(null)

  // Logs
  const [logs, setLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsLastFetched, setLogsLastFetched] = useState(null)
  const [profitData, setProfitData] = useState(null)
  const [profitLoading, setProfitLoading] = useState(false)
  const [profitError, setProfitError] = useState('')
  const [profitProvider, setProfitProvider] = useState('fleexa')
  const [showFundForm, setShowFundForm] = useState(false)
  const [profitLogFilter, setProfitLogFilter] = useState('all')
  const [fundForm, setFundForm] = useState({ amount:'', paidNgn:'', balanceAfter:'', note:'' })
  const [fundSaving, setFundSaving] = useState(false)
  const [fundMsg, setFundMsg] = useState('')
  const [histUser, setHistUser] = useState(null)
  const [histData, setHistData] = useState(null)
  const [histLoading, setHistLoading] = useState(false)
  const [histError, setHistError] = useState('')
  const [histFilter, setHistFilter] = useState('all')
  const [psData, setPsData] = useState(null)
  const [psLoading, setPsLoading] = useState(false)
  const [psError, setPsError] = useState('')
  const [psView, setPsView] = useState('transactions')
  const [psOpenDay, setPsOpenDay] = useState(null)
  const [logLevelFilter, setLogLevelFilter] = useState('all')
  const [logCategoryFilter, setLogCategoryFilter] = useState('all')
  const [logSearch, setLogSearch] = useState('')
  const [expandedLog, setExpandedLog] = useState(null)

  // Broadcast email
  const [broadcastSubject, setBroadcastSubject] = useState('')
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [sendingBroadcast, setSendingBroadcast] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState(null)
  const [confirmingBroadcast, setConfirmingBroadcast] = useState(false)

  // Popup announcements
  const [annList, setAnnList] = useState([])
  const [annLoaded, setAnnLoaded] = useState(false)
  const [annLoading, setAnnLoading] = useState(false)
  const [annForm, setAnnForm] = useState(null) // null = closed, object = creating/editing
  const [annSaving, setAnnSaving] = useState(false)
  const [annError, setAnnError] = useState('')
  const [annDeleteId, setAnnDeleteId] = useState(null)
  const [annBusyId, setAnnBusyId] = useState(null)
  const [annImgBusy, setAnnImgBusy] = useState('') // '' | 'Compressing…' | 'Uploading…'
  const [annImgInfo, setAnnImgInfo] = useState('')
  const annFileRef = useRef(null)

  useEffect(() => {
    setMounted(true)
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
      if (!profile?.is_admin) { router.push('/dashboard'); return }

      const [usersRes, ordersRes, vpnRes, subRes, pricesRes, settingsRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('vpn_keys').select('*').order('created_at', { ascending: false }),
        supabase.from('subscription_keys').select('*').order('created_at', { ascending: false }),
        supabase.from('boost_prices').select('*'),
        supabase.from('app_settings').select('*'),
      ])

      const allUsers = usersRes.data || []
      const allOrders = ordersRes.data || []
      const allVpnKeys = vpnRes.data || []
      const allSubKeys = subRes.data || []
      const savedPrices = {}
      ;(pricesRes.data || []).forEach(p => { savedPrices[p.package_id] = p.price })

      // Load settings
      const settingsMap = {}
      ;(settingsRes.data || []).forEach(s => { settingsMap[s.key] = s.value })
      setSettings(prev => ({ ...prev, ...settingsMap }))
      setEditedSettings(prev => ({ ...prev, ...settingsMap }))

      // Get real auth user count via profiles (fallback) 
      // Count all profiles + any auth users without profiles
      const { count: authCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true })

      // Revenue = money paid in through Paystack (see app/api/admin/revenue).
      // null means "could not load" so the page shows a dash, never a wrong 0.
      let paystackRevenue = null
      try {
        const revRes = await fetch('/api/admin/revenue')
        if (revRes.ok) {
          const rev = await revRes.json()
          paystackRevenue = rev.total ?? null
          setPaystackDaily(Array.isArray(rev.daily) ? rev.daily : null)
        }
      } catch { /* leave as null */ }

      setUsers(allUsers)
      setOrders(allOrders)
      setVpnKeys(allVpnKeys)
      setSubKeys(allSubKeys)
      setBoostPrices(savedPrices)
      setEditedPrices(savedPrices)
      setStats({
        users: authCount || allUsers.length,
        orders: allOrders.length,
        revenue: paystackRevenue,
        pending: allOrders.filter(o => o.status === 'pending' || o.status === 'processing').length,
      })
      setLoading(false)
    }
    load()
    fetchProviderBalances()
  }, [router])

  // Search beyond the loaded list. The initial load fetches profiles with no
  // explicit limit, but Supabase caps API responses (1,000 rows by default),
  // so on a large user base the OLDEST accounts are not in `users` at all —
  // the Overview count comes from a real COUNT and can exceed the list. When
  // that is the case, the query is also run against the database and any
  // accounts not already loaded are added to `users`, which keeps Edit
  // Balance / Ban working on them like any other row. Skipped entirely when
  // everyone is already loaded.
  const usersLenRef = useRef(0)
  usersLenRef.current = users.length
  useEffect(() => {
    const q = userSearch.trim()
    if (!q || stats.users <= usersLenRef.current) { setUserSearching(false); return }

    let cancelled = false
    setUserSearching(true)
    const timer = setTimeout(async () => {
      try {
        // Inside .or() the characters , ( ) are filter syntax and % * are
        // wildcards — strip them from what the admin typed, then add our own *.
        const safe = q.replace(/[,()%*\\]/g, ' ').replace(/\s+/g, ' ').trim()
        if (!safe) return
        const filters = [`full_name.ilike.*${safe}*`, `email.ilike.*${safe}*`]
        if (/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(safe)) filters.push(`id.eq.${safe}`)
        const { data } = await createClient()
          .from('profiles').select('*').or(filters.join(',')).order('created_at', { ascending: false }).limit(50)
        if (cancelled || !data) return
        setUsers(prev => {
          const have = new Set(prev.map(u => u.id))
          const extra = data.filter(u => !have.has(u.id))
          return extra.length ? [...prev, ...extra] : prev
        })
      } catch (e) {
        console.error('[admin user search]', e)
      } finally {
        if (!cancelled) setUserSearching(false)
      }
    }, 350)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [userSearch, stats.users])

  const fetchProviderBalances = async () => {
    setBalancesLoading(true)
    try {
      const res = await fetch('/api/admin/balances')
      if (res.ok) {
        const data = await res.json()
        setProviderBalances(data)
        setBalancesLastFetched(new Date())
      }
    } catch (e) {
      console.error('Failed to fetch provider balances', e)
    }
    setBalancesLoading(false)
  }

  const fetchLogs = async () => {
    setLogsLoading(true)
    try {
      const res = await fetch('/api/admin/logs')
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
        setLogsLastFetched(new Date())
      } else {
        console.error('Failed to fetch logs:', res.status)
      }
    } catch (e) {
      console.error('Failed to fetch logs', e)
    }
    setLogsLoading(false)
  }

  const fetchProfit = async () => {
    setProfitLoading(true)
    setProfitError('')
    try {
      const res = await fetch('/api/admin/provider-profit')
      if (res.ok) setProfitData(await res.json())
      else setProfitError('Could not load profit data (' + res.status + ')')
    } catch (e) {
      setProfitError('Could not load profit data')
    }
    setProfitLoading(false)
  }

  const submitFunding = async () => {
    setFundSaving(true)
    setFundMsg('')
    try {
      const res = await fetch('/api/admin/provider-profit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: profitProvider, ...fundForm }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setShowFundForm(false)
        setFundForm({ amount:'', paidNgn:'', balanceAfter:'', note:'' })
        await fetchProfit()
      } else {
        setFundMsg(data.error || 'Could not save')
      }
    } catch (e) {
      setFundMsg('Could not save')
    }
    setFundSaving(false)
  }

  const deleteFunding = async (id) => {
    if (!window.confirm('Delete this funding entry? Profit history for this provider will be recalculated.')) return
    try {
      await fetch('/api/admin/provider-profit?id=' + encodeURIComponent(id), { method: 'DELETE' })
    } catch (e) {}
    await fetchProfit()
  }

  const openHistory = async (user) => {
    setHistUser(user)
    setHistData(null)
    setHistError('')
    setHistFilter('all')
    setHistLoading(true)
    try {
      const res = await fetch('/api/admin/user-history?userId=' + encodeURIComponent(user.id))
      if (res.ok) setHistData(await res.json())
      else setHistError('Could not load history (' + res.status + ')')
    } catch (e) {
      setHistError('Could not load history')
    }
    setHistLoading(false)
  }

  const fetchPaystack = async () => {
    setPsLoading(true)
    setPsError('')
    try {
      const res = await fetch('/api/admin/paystack')
      if (res.ok) {
        setPsData(await res.json())
      } else {
        setPsError('Could not load Paystack data (' + res.status + ')')
      }
    } catch (e) {
      setPsError('Could not load Paystack data')
    }
    setPsLoading(false)
  }

  const sendBroadcast = async () => {
    setSendingBroadcast(true)
    setBroadcastResult(null)
    try {
      const res = await fetch('/api/admin/broadcast-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: broadcastSubject, message: broadcastMessage }),
      })
      const data = await res.json()
      if (res.ok) {
        setBroadcastResult({ ok: true, ...data })
        setBroadcastSubject('')
        setBroadcastMessage('')
      } else {
        setBroadcastResult({ ok: false, error: data.error || 'Failed to send' })
      }
    } catch (e) {
      setBroadcastResult({ ok: false, error: 'Network error — please try again' })
    }
    setSendingBroadcast(false)
    setConfirmingBroadcast(false)
  }

  // ── Popup announcements ──────────────────────────────────────────────
  const annHeaders = async () => {
    const { data: { session } } = await createClient().auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }
  }
  const loadAnnouncements = async () => {
    setAnnLoading(true)
    setAnnError('')
    try {
      const res = await fetch('/api/admin/announcements', { headers: await annHeaders() })
      const data = await res.json()
      if (!res.ok) setAnnError(data.error || 'Could not load popups.')
      else { setAnnList(data.announcements || []); setAnnLoaded(true) }
    } catch { setAnnError('Could not load popups — check your connection.') }
    setAnnLoading(false)
  }
  useEffect(() => {
    if (activeTab === 'popups' && !annLoaded && !annLoading) loadAnnouncements()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const toLocalInput = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  const emptyAnn = { id: null, title: '', message: '', icon: 'bell', image_url: '', primary_label: '', primary_url: '', allow_hide: true, is_active: true, starts_at: '', ends_at: '' }
  const editAnn = (a) => {
    setAnnError('')
    setAnnImgInfo('')
    setAnnForm({ id: a.id, title: a.title, message: a.message || '', icon: a.icon || 'bell', image_url: a.image_url || '', primary_label: a.primary_label || '', primary_url: a.primary_url || '', allow_hide: a.allow_hide !== false, is_active: !!a.is_active, starts_at: toLocalInput(a.starts_at), ends_at: toLocalInput(a.ends_at) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const saveAnnouncement = async () => {
    if (!annForm) return
    setAnnSaving(true)
    setAnnError('')
    try {
      const body = {
        ...annForm,
        starts_at: annForm.starts_at ? new Date(annForm.starts_at).toISOString() : null,
        ends_at: annForm.ends_at ? new Date(annForm.ends_at).toISOString() : null,
      }
      const res = await fetch('/api/admin/announcements', { method: annForm.id ? 'PATCH' : 'POST', headers: await annHeaders(), body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) { setAnnError(data.error || 'Could not save.'); setAnnSaving(false); return }
      setAnnList((list) => annForm.id ? list.map((x) => (x.id === data.announcement.id ? data.announcement : x)) : [data.announcement, ...list])
      setAnnForm(null)
    } catch { setAnnError('Could not save — check your connection.') }
    setAnnSaving(false)
  }
  const patchAnnouncement = async (id, body) => {
    setAnnBusyId(id)
    setAnnError('')
    try {
      const res = await fetch('/api/admin/announcements', { method: 'PATCH', headers: await annHeaders(), body: JSON.stringify({ id, ...body }) })
      const data = await res.json()
      if (!res.ok) setAnnError(data.error || 'Update failed.')
      else setAnnList((list) => list.map((x) => (x.id === id ? data.announcement : x)))
    } catch { setAnnError('Update failed — check your connection.') }
    setAnnBusyId(null)
  }
  const deleteAnnouncement = async (id) => {
    setAnnBusyId(id)
    setAnnError('')
    try {
      const res = await fetch(`/api/admin/announcements?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: await annHeaders() })
      const data = await res.json()
      if (!res.ok) setAnnError(data.error || 'Delete failed.')
      else setAnnList((list) => list.filter((x) => x.id !== id))
    } catch { setAnnError('Delete failed — check your connection.') }
    setAnnBusyId(null)
    setAnnDeleteId(null)
  }
  // Shrinks the picture in the browser (max 960px wide, WebP/JPEG, under ~250 KB) so the popup loads fast.
  const compressImage = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image.')) }
    img.onload = async () => {
      URL.revokeObjectURL(url)
      const TARGET = 250 * 1024
      let w = Math.min(img.naturalWidth, 960)
      let q = 0.85
      for (let attempt = 0; attempt < 7; attempt++) {
        const h = Math.max(1, Math.round(img.naturalHeight * (w / img.naturalWidth)))
        const c = document.createElement('canvas')
        c.width = w; c.height = h
        const ctx = c.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        let blob = await new Promise((r) => c.toBlob(r, 'image/webp', q))
        if (!blob || blob.type !== 'image/webp') blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', q))
        if (blob && blob.size <= TARGET) return resolve({ blob, w, h })
        q = Math.max(0.5, q - 0.1)
        if (attempt >= 2) w = Math.round(w * 0.85)
      }
      reject(new Error('Could not shrink that image enough. Try a simpler picture.'))
    }
    img.src = url
  })

  const uploadAnnImage = async (file) => {
    if (!file) return
    setAnnError('')
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setAnnError('Please choose a PNG, JPG or WebP image (GIFs are not supported).'); return }
    if (file.size > 5 * 1024 * 1024) { setAnnError('That image is over 5 MB. Please choose a smaller one.'); return }
    try {
      setAnnImgBusy('Compressing…')
      const { blob, w, h } = await compressImage(file)
      setAnnImgBusy('Uploading…')
      const { data: { session } } = await createClient().auth.getSession()
      const fd = new FormData()
      fd.append('file', new File([blob], 'popup', { type: blob.type }))
      const res = await fetch('/api/admin/announcements/upload', { method: 'POST', headers: { Authorization: `Bearer ${session?.access_token}` }, body: fd })
      const data = await res.json()
      if (!res.ok) setAnnError(data.error || 'Upload failed.')
      else {
        setAnnForm((f) => ({ ...f, image_url: data.url }))
        setAnnImgInfo(`${Math.round(data.size / 1024)} KB · ${w}×${h}`)
      }
    } catch (e) {
      setAnnError(e?.message || 'Upload failed — check your connection.')
    }
    setAnnImgBusy('')
    if (annFileRef.current) annFileRef.current.value = ''
  }

  const annStatus = (a) => {
    if (!a.is_active) return { t: 'Off', c: 'var(--muted)', bg: 'var(--card2)' }
    const now = Date.now()
    if (a.starts_at && new Date(a.starts_at).getTime() > now) return { t: 'Scheduled', c: '#f0b429', bg: 'rgba(240,180,41,0.12)' }
    if (a.ends_at && new Date(a.ends_at).getTime() <= now) return { t: 'Expired', c: '#f43f5e', bg: 'rgba(244,63,94,0.1)' }
    return { t: 'Live', c: '#34d399', bg: 'rgba(52,211,153,0.12)' }
  }

  const getPrice = (id) => editedPrices[id] ?? (DEFAULT_BOOST_PACKAGES.find(p => p.id === id)?.price || 0)

  const saveBoostPrices = async () => {
    setSavingPrices(true)
    try {
      const res = await fetch('/api/admin/save-boost-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prices: editedPrices }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Failed to save prices')
        setSavingPrices(false)
        return
      }
      setBoostPrices({ ...editedPrices })
      setPricesSaved(true)
      setTimeout(() => setPricesSaved(false), 2500)
    } catch {
      alert('Failed to save prices — please try again')
    } finally {
      setSavingPrices(false)
    }
  }

  const saveSettings = async () => {
    setSavingSettings(true)
    setSettingsError('')
    try {
      // FIXED (2026-09-20): this used to upsert directly from the
      // browser with the anon key, which silently failed for any
      // BRAND-NEW setting key due to RLS (existing keys could be
      // updated, but new ones couldn't be inserted) — with no error
      // check, so it showed "Saved!" even when the write failed.
      // Confirmed live: fleexa_markup_percent and
      // fleexa_rent_margin_percent never reached the database despite
      // the UI saying they were saved. Routing through a server route
      // with the service role key bypasses RLS and lets us check the
      // real result.
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedSettings),
      })
      const data = await res.json()
      if (!res.ok) {
        setSettingsError(data.error || 'Failed to save settings.')
        setSavingSettings(false)
        return
      }
      setSettings({ ...editedSettings })
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2500)
    } catch (err) {
      setSettingsError('Failed to save settings — check your connection and try again.')
    }
    setSavingSettings(false)
  }

  const updateOrderStatus = async (orderId, status) => {
    const prevOrders = orders
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o))
    try {
      const res = await fetch('/api/admin/update-order-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status }),
      })
      const data = await res.json()
      if (!res.ok) {
        setOrders(prevOrders) // revert the optimistic update — it never actually saved
        alert(data.error || 'Failed to update order status')
      }
    } catch {
      setOrders(prevOrders)
      alert('Failed to update order status — please try again')
    }
  }

  const updateBalance = async (userId) => {
    const targetNewBalance = Number(newBalance)
    try {
      const res = await fetch('/api/admin/edit-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newBalance: targetNewBalance }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Failed to update balance')
        return
      }
      // Only update local state once the server confirms the write actually
      // happened — no more optimistic-only updates that silently revert.
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, wallet_balance: data.new_balance } : u))
      setEditingBalance(null)
      setNewBalance('')
    } catch {
      alert('Failed to update balance — please try again')
    }
  }

  const toggleBan = async (userId, currentStatus) => {
    try {
      const res = await fetch('/api/admin/ban-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, banned: !currentStatus }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Failed to update user')
        return
      }
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_banned: data.banned } : u))
    } catch {
      alert('Failed to update user — please try again')
    }
  }

  const saveVpnKey = async () => {
    setSavingVpn(true)
    const supabase = createClient()
    const keys = vpnBulk
      ? vpnBulk.split('\n').map(k => k.trim()).filter(k => k.length > 0)
      : [vpnForm.key.trim()]
    await supabase.from('vpn_keys').insert(keys.map(k => ({ provider: vpnForm.provider, plan: vpnForm.plan, key: k, is_used: false })))
    const { data } = await supabase.from('vpn_keys').select('*').order('created_at', { ascending: false })
    setVpnKeys(data || [])
    setSavingVpn(false)
    setShowVpnForm(false)
    setVpnForm({ provider: 'NordVPN', plan: '1 Month', key: '' })
    setVpnBulk('')
  }

  const deleteVpnKey = async (id) => {
    const supabase = createClient()
    await supabase.from('vpn_keys').delete().eq('id', id)
    setVpnKeys(prev => prev.filter(k => k.id !== id))
  }

  const saveSubKey = async () => {
    setSavingSub(true)
    const supabase = createClient()
    const keys = subBulk
      ? subBulk.split('\n').map(k => k.trim()).filter(k => k.length > 0)
      : [subForm.key.trim()]
    await supabase.from('subscription_keys').insert(keys.map(k => ({
      service_id: subServiceIds[subForm.service],
      plan: subForm.plan,
      key: k,
      is_used: false
    })))
    const { data } = await supabase.from('subscription_keys').select('*').order('created_at', { ascending: false })
    setSubKeys(data || [])
    setSavingSub(false)
    setShowSubForm(false)
    setSubForm({ service: 'Spotify', plan: '1 Month', key: '' })
    setSubBulk('')
  }

  const deleteSubKey = async (id) => {
    const supabase = createClient()
    await supabase.from('subscription_keys').delete().eq('id', id)
    setSubKeys(prev => prev.filter(k => k.id !== id))
  }

  const deliverOrder = async (order) => {
    if (!deliveryKey.trim()) return
    setDelivering(true)
    const supabase = createClient()
    await supabase.from('orders').update({ status: 'completed', details: { ...order.details, delivery_key: deliveryKey } }).eq('id', order.id)
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'completed' } : o))
    setDeliveringOrder(null)
    setDeliveryKey('')
    setDelivering(false)
  }

  const vpnStats = vpnProviders.map(p => ({
    provider: p,
    available: vpnKeys.filter(k => k.provider === p && !k.is_used).length,
    used: vpnKeys.filter(k => k.provider === p && k.is_used).length,
  }))

  // User search: every whitespace-separated word must appear somewhere in the
  // name, email or user id (case-insensitive).
  const userTerms = userSearch.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const matchedUsers = userTerms.length === 0 ? users : users.filter(u => {
    const hay = `${u.full_name || ''} ${u.email || ''} ${u.id || ''}`.toLowerCase()
    return userTerms.every(t => hay.includes(t))
  })
  const usersTruncated = stats.users > users.length

  const filteredOrders = orderFilter === 'all' ? orders : orders.filter(o => o.status === orderFilter)

  const statusStyle = (status) => {
    if (status === 'completed') return { bg: 'rgba(29,158,117,0.12)', color: '#34d399' }
    if (status === 'pending')   return { bg: 'rgba(240,180,41,0.12)',  color: '#f0b429' }
    if (status === 'processing')return { bg: 'rgba(108,78,242,0.12)', color: 'var(--purple2)' }
    if (status === 'failed')    return { bg: 'rgba(220,50,50,0.12)',   color: '#ff6b6b' }
    // 'resolving' is normally a few-second internal state; an order that
    // STAYS here was deliberately left for manual review (see the warning
    // shown on the order card).
    if (status === 'resolving') return { bg: 'rgba(255,159,67,0.14)',  color: '#ff9f43' }
    return { bg: 'var(--card2)', color: 'var(--muted)' }
  }

  // Mirrors lib/numberSettings.js exactly: a blank/invalid SMS OTP 6 markup
  // follows the SMS OTP 4/5 markup, which itself falls back to 15.
  const sms6EffectivePct = (() => {
    const own = parseFloat(editedSettings.fleexa_sms6_markup_percent)
    if (Number.isFinite(own) && own >= 0) return own
    const shared = parseFloat(editedSettings.fleexa_markup_percent)
    return Number.isFinite(shared) && shared >= 0 ? shared : 15
  })()
  // Fleexa's own SMS OTP 6 docs example: WhatsApp costs $0.16 = ₦269 wholesale.
  const SMS6_EXAMPLE_COST_NGN = 269
  const SMS6_EXAMPLE_COST_USD = 0.16
  const sms6SellPreview = Math.ceil(SMS6_EXAMPLE_COST_NGN * (1 + sms6EffectivePct / 100))
  const sms6Benchmark = Math.ceil(SMS6_EXAMPLE_COST_USD * Number(editedSettings.usd_to_ngn_rate) * Number(editedSettings.markup_multiplier))
  const sms6BenchmarkPct = Math.round((sms6Benchmark / SMS6_EXAMPLE_COST_NGN - 1) * 100)

  // Email OTP markup mirrors lib/fleexaShared.js getMarkupPercent('email'):
  // own value -> shared SMS OTP 4/5 markup -> 15.
  const emailEffectivePct = (() => {
    const own = parseFloat(editedSettings.fleexa_email_markup_percent)
    if (Number.isFinite(own) && own >= 0) return own
    const shared = parseFloat(editedSettings.fleexa_markup_percent)
    return Number.isFinite(shared) && shared >= 0 ? shared : 15
  })()
  // Example wholesale cost only, for the preview line (not used for real prices).
  const EMAIL_EXAMPLE_COST_NGN = 313
  const emailSellPreview = Math.ceil(EMAIL_EXAMPLE_COST_NGN * (1 + emailEffectivePct / 100))

  // Proxy markup: own value -> shared SMS OTP 4/5 markup -> 15 (mirrors
  // getMarkupPercent('proxy') in lib/fleexaShared.js).
  const proxyEffectivePct = (() => {
    const own = parseFloat(editedSettings.fleexa_proxy_markup_percent)
    if (Number.isFinite(own) && own >= 0) return own
    const shared = parseFloat(editedSettings.fleexa_markup_percent)
    return Number.isFinite(shared) && shared >= 0 ? shared : 15
  })()
  // Fleexa's docs example: a 1-IP plan costs ₦580 wholesale (preview only).
  const PROXY_EXAMPLE_COST_NGN = 580
  const proxySellPreview = Math.ceil(PROXY_EXAMPLE_COST_NGN * (1 + proxyEffectivePct / 100))

  // eSIM markup: own value -> shared SMS OTP 4/5 markup -> 15 (mirrors
  // getMarkupPercent('esim') in lib/fleexaShared.js).
  const esimEffectivePct = (() => {
    const own = parseFloat(editedSettings.fleexa_esim_markup_percent)
    if (Number.isFinite(own) && own >= 0) return own
    const shared = parseFloat(editedSettings.fleexa_markup_percent)
    return Number.isFinite(shared) && shared >= 0 ? shared : 15
  })()
  // Example wholesale cost only, for the preview line (not used for real prices).
  const ESIM_EXAMPLE_COST_NGN = 3000
  const esimSellPreview = Math.ceil(ESIM_EXAMPLE_COST_NGN * (1 + esimEffectivePct / 100))

  const inputStyle = { width: '100%', padding: '0.65rem 0.9rem', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text)', fontSize: '0.85rem', outline: 'none', fontFamily: 'Inter, sans-serif' }
  const selectStyle = { ...inputStyle }

  const tabs = [
    { id: 'overview', label: 'Overview',  icon: <GridIcon /> },
    { id: 'users',    label: 'Users',     icon: <UsersIcon /> },
    { id: 'orders',   label: 'Orders',    icon: <PackageIcon /> },
    { id: 'boost',    label: 'Prices',    icon: <MoneyIcon /> },
    { id: 'vpn',      label: 'VPN',       icon: <VpnIcon /> },
    { id: 'subs',     label: 'Subs',      icon: <SubsIcon /> },
    { id: 'notify',   label: 'Notify',    icon: <MailIcon /> },
    { id: 'popups',   label: 'Popups',    icon: <BellIcon /> },
    { id: 'paystack', label: 'Paystack',  icon: <MoneyIcon /> },
    { id: 'profit',   label: 'Profit',    icon: <MoneyIcon /> },
    { id: 'logs',     label: 'Logs',      icon: <LogsIcon /> },
    { id: 'settings', label: 'Settings',  icon: <SettingsIcon /> },
  ]

  if (loading) return (
    <main style={{ background: 'var(--navy)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.3rem', fontWeight: 800, color: 'var(--text)' }}>Mega<span style={{ color: 'var(--gold)' }}>Den</span> <span style={{ color: 'var(--purple2)' }}>Admin</span></div>
        <div style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: '0.5rem' }}>Loading panel...</div>
      </div>
    </main>
  )

  return (
    <main style={{ background: 'var(--navy)', minHeight: '100vh', display: isDesktop ? 'flex' : 'block' }}>
      <style>{`
        @keyframes fadeSlideIn { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes scaleIn { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:scale(1); } }
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        @keyframes shimmer { 0%,100% { opacity:0.4; } 50% { opacity:1; } }
        @keyframes glow { 0%,100% { box-shadow:0 0 6px #f43f5e; } 50% { box-shadow:0 0 14px #f43f5e; } }
        * { box-sizing: border-box; }
        .tab-btn { transition:background 0.15s,color 0.15s; cursor:pointer; }
        .tab-btn:hover { background:var(--card2) !important; }
        .bottom-nav-row { display:flex; justify-content:space-around; }
        @media (max-width: 640px) {
          .bottom-nav-row { justify-content:flex-start; overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none; -ms-overflow-style:none; gap:0.15rem; }
          .bottom-nav-row::-webkit-scrollbar { display:none; }
          .nav-tab-item { flex-shrink:0; min-width:3.6rem; }
        }
        .action-btn { transition:transform 0.13s,opacity 0.13s; cursor:pointer; }
        .action-btn:hover { transform:scale(1.04); }
        .action-btn:active { transform:scale(0.97); }
        .stat-card { transition:transform 0.18s,box-shadow 0.18s; }
        .stat-card:hover { transform:translateY(-3px); box-shadow:0 8px 24px rgba(0,0,0,0.15); }
        .row-item { transition:background 0.15s; }
        .row-item:hover { background:var(--card2) !important; }
        .price-input { transition:border-color 0.2s,box-shadow 0.2s; }
        .price-input:focus { border-color:var(--purple) !important; box-shadow:0 0 0 3px rgba(108,78,242,0.12); outline:none; }
        .plat-btn { transition:background 0.15s,border-color 0.15s,color 0.15s; cursor:pointer; }
      `}</style>

      {isDesktop && (
        <AdminSidebar tabs={tabs} activeTab={activeTab} onTabChange={(id) => {
          setActiveTab(id)
          if (id === 'logs' && logs.length === 0) fetchLogs()
          if (id === 'paystack' && !psData) fetchPaystack()
          if (id === 'profit' && !profitData) fetchProfit()
        }} onLogout={handleLogout} />
      )}

      <div style={{ flex: isDesktop ? 1 : 'none', minWidth: 0, paddingBottom: isDesktop ? 0 : '5rem' }}>
      {/* TOP BAR */}
      <div style={{ padding:'1rem 1.4rem', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100, background:'rgba(var(--navy-rgb,10,10,30),0.95)', backdropFilter:'blur(20px)', borderBottom:'1px solid var(--border)' }}>
        <div>
          <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:800, fontSize:'1.1rem', color:'var(--text)' }}>Mega<span style={{ color:'var(--gold)' }}>Den</span> <span style={{ color:'var(--purple2)' }}>Admin</span></div>
          <div style={{ fontSize:'0.68rem', color:'var(--muted)' }}>Control Panel · {stats.users} users · {money(stats.revenue)} revenue</div>
        </div>
        <a href="/dashboard" style={{ padding:'0.4rem 0.9rem', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'8px', color:'var(--muted)', fontSize:'0.75rem', textDecoration:'none', fontWeight:500 }}>← App</a>
      </div>

      <div style={{ padding:'1.2rem 1.4rem', maxWidth: isDesktop ? 900 : 520, margin:'0 auto' }}>

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div style={{ animation: mounted ? 'fadeSlideIn 0.4s ease' : 'none' }}>
            {/* MONEY CARD: Paystack revenue <-> completed purchases */}
            {(() => {
              const isPaystack = revMode === 'paystack'
              const summary = isPaystack
                ? (paystackDaily ? summarizeDaily(paystackDaily) : null)
                : summarizeDaily(dailyFromOrders(orders))
              const accent = isPaystack ? '#34d399' : 'var(--gold)'
              const noun = isPaystack ? 'payments' : 'orders'
              const maxBar = summary ? Math.max(1, ...summary.series.map(s => s.total)) : 1
              const dayLabel = (key) => new Date(key + 'T00:00:00Z').toLocaleDateString('en-NG', { day: 'numeric', month: 'short', timeZone: 'UTC' })
              return (
                <div className="stat-card" style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'16px', padding:'1.2rem', marginBottom:'0.8rem', animation: mounted ? 'fadeSlideIn 0.35s ease both' : 'none' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'0.6rem', marginBottom:'1rem' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', color: accent }}>
                      <span style={{ opacity:0.8, display:'flex' }}><MoneyIcon /></span>
                      <span style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.75rem', letterSpacing:'0.07em', textTransform:'uppercase' }}>
                        {isPaystack ? 'Revenue (Paystack)' : 'Completed purchases'}
                      </span>
                    </div>
                    <div role="tablist" aria-label="Choose which total to show" style={{ display:'inline-flex', padding:'0.2rem', background:'var(--navy)', border:'1px solid var(--border)', borderRadius:'10px' }}>
                      {[['paystack', 'Paystack'], ['purchases', 'Purchases']].map(([id, label]) => (
                        <button key={id} role="tab" aria-selected={revMode === id} className="tab-btn" onClick={() => setRevMode(id)}
                          style={{ padding:'0.35rem 0.85rem', borderRadius:'8px', border:'none', fontSize:'0.74rem', fontWeight:600, fontFamily:'Outfit, sans-serif',
                            background: revMode === id ? 'var(--card2)' : 'transparent', color: revMode === id ? 'var(--text)' : 'var(--muted)' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:800, fontSize:'2rem', letterSpacing:'-0.02em', color: accent }}>
                    {summary ? money(summary.total) : '—'}
                  </div>
                  <div style={{ fontSize:'0.72rem', color:'var(--muted)', marginTop:'0.25rem', lineHeight:1.5 }}>
                    {isPaystack
                      ? 'Money paid in through Paystack. Leaves out admin balance adjustments, refunds and wallet spending.'
                      : 'Value of completed orders: what customers have spent from their wallets in the app.'}
                  </div>

                  {!summary ? (
                    <div style={{ fontSize:'0.76rem', color:'#f0b429', marginTop:'0.9rem' }}>Could not load Paystack figures. Refresh the page to try again.</div>
                  ) : (
                    <>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(110px, 1fr))', gap:'0.5rem', marginTop:'1rem' }}>
                        {[
                          { label:'Today',        value: money(summary.today) },
                          { label:'Last 7 days',  value: money(summary.week) },
                          { label:'This month',   value: money(summary.month) },
                          { label: noun.charAt(0).toUpperCase() + noun.slice(1), value: summary.count.toLocaleString() },
                        ].map(m => (
                          <div key={m.label} style={{ background:'var(--navy)', border:'1px solid var(--border)', borderRadius:'12px', padding:'0.6rem 0.75rem' }}>
                            <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.95rem', color:'var(--text)' }}>{m.value}</div>
                            <div style={{ fontSize:'0.66rem', color:'var(--muted)', marginTop:'0.1rem' }}>{m.label}</div>
                          </div>
                        ))}
                      </div>

                      <div style={{ marginTop:'1rem' }}>
                        <div style={{ display:'flex', alignItems:'flex-end', gap:'3px', height:56 }} role="img" aria-label="Daily totals for the last 14 days">
                          {summary.series.map(s => (
                            <div key={s.date} title={`${dayLabel(s.date)}: ${money(s.total)}`}
                              style={{ flex:1, height: `${Math.max(s.total > 0 ? 6 : 2, (s.total / maxBar) * 100)}%`, background: accent, opacity: s.total > 0 ? 0.85 : 0.2, borderRadius:'3px 3px 0 0' }} />
                          ))}
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.62rem', color:'var(--muted)', marginTop:'0.3rem' }}>
                          <span>{dayLabel(summary.series[0].date)}</span>
                          <span>Last 14 days</span>
                          <span>{dayLabel(summary.series[summary.series.length - 1].date)}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )
            })()}

            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'0.8rem', marginBottom:'1.5rem' }}>
              {[
                { label:'Total Users',    value: stats.users,                         color:'var(--purple2)', icon:<UsersIcon /> },
                { label:'Total Orders',   value: stats.orders,                        color:'var(--gold)',    icon:<PackageIcon /> },
                { label:'Pending Orders', value: stats.pending,                       color:'#f0b429',       icon:<ClockIcon /> },
              ].map((s, i) => (
                <div key={s.label} className="stat-card" style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'16px', padding:'1.1rem', animation: mounted ? `fadeSlideIn 0.35s ease ${0.06*i}s both` : 'none' }}>
                  <div style={{ color:s.color, opacity:0.7, marginBottom:'0.6rem' }}>{s.icon}</div>
                  <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:800, fontSize:'1.5rem', color:s.color }}>{s.value}</div>
                  <div style={{ fontSize:'0.72rem', color:'var(--muted)', marginTop:'0.2rem' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* PROVIDER BALANCES */}
            <div style={{ marginBottom:'1.5rem' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.75rem' }}>
                <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.75rem', color:'var(--muted)', letterSpacing:'0.07em', textTransform:'uppercase' }}>
                  Provider Balances
                </div>
                <button onClick={fetchProviderBalances} disabled={balancesLoading}
                  style={{ display:'flex', alignItems:'center', gap:'0.3rem', background:'transparent', border:'none', color:'var(--muted)', fontSize:'0.65rem', cursor:'pointer', padding:'0.2rem 0.5rem', borderRadius:'8px', transition:'color 0.15s' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ animation: balancesLoading ? 'spin 0.8s linear infinite' : 'none' }}>
                    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                  </svg>
                  {balancesLastFetched ? `${balancesLastFetched.toLocaleTimeString('en-NG', { hour:'2-digit', minute:'2-digit' })}` : 'Refresh'}
                </button>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))', gap:'0.6rem' }}>
                {PROVIDER_CARDS.map(p => {
                  const val = providerBalances[p.key]?.balance
                  const err = providerBalances[p.key]?.error
                  const lowAt = p.low ?? 5
                  const midAt = p.mid ?? 20
                  const isLow = val !== null && val !== undefined && Number(val) < lowAt
                  const isMid = val !== null && val !== undefined && Number(val) >= lowAt && Number(val) < midAt
                  const balColor = err ? '#f43f5e' : val === null || val === undefined ? 'var(--muted)' : isLow ? '#f43f5e' : isMid ? '#f0b429' : '#34d399'
                  return (
                    <div key={p.key} style={{ position:'relative', background: isLow ? 'rgba(244,63,94,0.06)' : p.bg, border:`1px solid ${isLow ? 'rgba(244,63,94,0.3)' : p.border}`, borderRadius:'16px', padding:'1rem 0.75rem 0.85rem', overflow:'hidden', display:'flex', flexDirection:'column', gap:'0.35rem' }}>
                      {/* top accent bar */}
                      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background: isLow ? '#f43f5e' : p.color, borderRadius:'16px 16px 0 0' }} />
                      {/* low pulse dot */}
                      {isLow && !balancesLoading && (
                        <div style={{ position:'absolute', top:10, right:10, width:7, height:7, borderRadius:'50%', background:'#f43f5e', boxShadow:'0 0 8px #f43f5e', animation:'glow 1.2s ease infinite' }} />
                      )}
                      <div style={{ fontSize:'1.1rem', lineHeight:1 }}>{p.emoji}</div>
                      <div style={{ fontSize:'0.6rem', color:'var(--muted)', fontWeight:700, letterSpacing:'0.04em', textTransform:'uppercase' }}>{p.label}</div>
                      {balancesLoading ? (
                        <div style={{ height:18, width:'70%', background:'var(--border)', borderRadius:6, animation:'shimmer 1.2s ease infinite' }} />
                      ) : err ? (
                        <div title={String(err)} style={{ fontSize:'0.68rem', color:'#f43f5e', fontWeight:600 }}>Error</div>
                      ) : val === null || val === undefined ? (
                        <div style={{ fontSize:'0.8rem', color:'var(--muted)' }}>—</div>
                      ) : (
                        <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:800, fontSize:'1.05rem', color: balColor, letterSpacing:'-0.01em' }}>
                          {p.currency}{p.currency === '₦' ? Number(val).toLocaleString() : Number(val).toFixed(2)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Low balance warning banner */}
              {!balancesLoading && PROVIDER_CARDS.some(p => {
                const v = providerBalances[p.key]?.balance
                return v !== null && v !== undefined && Number(v) < (p.low ?? 5)
              }) && (
                <div style={{ marginTop:'0.6rem', padding:'0.65rem 0.9rem', background:'rgba(244,63,94,0.07)', border:'1px solid rgba(244,63,94,0.22)', borderRadius:'12px', fontSize:'0.7rem', color:'#f43f5e', display:'flex', alignItems:'center', gap:'0.5rem', fontWeight:500 }}>
                  <span style={{ fontSize:'0.9rem' }}>⚠️</span> One or more provider balances are low — top up to avoid service disruptions.
                </div>
              )}
            </div>
            <div style={{ marginBottom:'1.5rem' }}>
              <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.88rem', color:'var(--text)', marginBottom:'0.8rem' }}>VPN Stock</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'0.6rem' }}>
                {vpnStats.map(v => (
                  <div key={v.provider} style={{ background:'var(--card)', border:`1px solid ${v.available < 3 ? 'rgba(220,50,50,0.4)' : 'var(--border)'}`, borderRadius:'14px', padding:'0.9rem' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.35rem' }}>
                      <div style={{ fontSize:'0.8rem', fontWeight:600, color:'var(--text)' }}>{v.provider}</div>
                      {v.available < 3 && <span style={{ fontSize:'0.58rem', background:'rgba(220,50,50,0.15)', color:'#ff6b6b', borderRadius:'50px', padding:'0.1rem 0.45rem', fontWeight:700 }}>LOW</span>}
                    </div>
                    <div style={{ fontSize:'0.75rem', color:'#34d399', fontWeight:600 }}>{v.available} left</div>
                    <div style={{ fontSize:'0.68rem', color:'var(--muted)' }}>{v.used} delivered</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent orders */}
            <div style={{ marginBottom:'1.5rem' }}>
              <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.88rem', color:'var(--text)', marginBottom:'0.8rem' }}>Recent Orders</div>
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'16px', overflow:'hidden' }}>
                {orders.slice(0, 5).map((order, i) => {
                  const s = statusStyle(order.status)
                  return (
                    <div key={order.id} className="row-item" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.85rem 1.1rem', borderBottom: i < 4 ? '1px solid var(--border)' : 'none', background:'transparent' }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:'0.82rem', fontWeight:500, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{order.product_name || 'Order'}</div>
                        <div style={{ fontSize:'0.68rem', color:'var(--muted)' }}>{new Date(order.created_at).toLocaleDateString()}</div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', flexShrink:0 }}>
                        <span style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.82rem', color:'var(--gold)' }}>₦{order.amount?.toLocaleString()}</span>
                        <span style={{ padding:'0.18rem 0.55rem', borderRadius:'50px', background:s.bg, color:s.color, fontSize:'0.65rem', fontWeight:600 }}>{order.status}</span>
                      </div>
                    </div>
                  )
                })}
                {orders.length === 0 && <div style={{ padding:'2rem', textAlign:'center', color:'var(--muted)', fontSize:'0.82rem' }}>No orders yet</div>}
              </div>
            </div>

            {/* Recent users */}
            <div>
              <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.88rem', color:'var(--text)', marginBottom:'0.8rem' }}>Recent Users</div>
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'16px', overflow:'hidden' }}>
                {users.slice(0, 5).map((user, i) => (
                  <div key={user.id} className="row-item" style={{ display:'flex', alignItems:'center', gap:'0.8rem', padding:'0.85rem 1.1rem', borderBottom: i < 4 ? '1px solid var(--border)' : 'none', background:'transparent' }}>
                    <div style={{ width:34, height:34, borderRadius:'50%', background:'linear-gradient(135deg, var(--purple), var(--gold))', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Outfit, sans-serif', fontWeight:800, fontSize:'0.85rem', color:'#fff', flexShrink:0 }}>
                      {user.full_name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'0.82rem', fontWeight:500, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.full_name || 'User'}</div>
                      <div style={{ fontSize:'0.68rem', color:'var(--muted)' }}>{user.email}</div>
                    </div>
                    <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.78rem', color:'#34d399', flexShrink:0 }}>₦{(user.wallet_balance || 0).toLocaleString()}</div>
                  </div>
                ))}
                {users.length === 0 && <div style={{ padding:'2rem', textAlign:'center', color:'var(--muted)', fontSize:'0.82rem' }}>No users yet</div>}
              </div>
            </div>
          </div>
        )}

        {/* USERS */}
        {activeTab === 'users' && (
          <div style={{ animation:'fadeSlideIn 0.4s ease' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.9rem' }}>
              <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.92rem', color:'var(--text)' }}>{userTerms.length ? `Users — ${matchedUsers.length} found` : `All Users (${users.length})`}</div>
              <select value={userSort} onChange={e => setUserSort(e.target.value)}
                style={{ padding:'0.35rem 0.7rem', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'8px', color:'var(--text)', fontSize:'0.72rem', outline:'none', fontFamily:'Outfit, sans-serif' }}>
                <option value="recent">Recently Joined</option>
                <option value="oldest">Oldest First</option>
                <option value="alpha">A → Z</option>
              </select>
            </div>
            <div style={{ position:'relative', marginBottom:'0.9rem' }}>
              <input type="text" value={userSearch} onChange={e => setUserSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') setUserSearch('') }}
                placeholder="Search by name, email or user ID…" aria-label="Search users" autoComplete="off" spellCheck={false}
                style={{ ...inputStyle, paddingRight: userSearch ? '2.4rem' : undefined }} />
              {userSearch && (
                <button onClick={() => setUserSearch('')} aria-label="Clear search"
                  style={{ position:'absolute', right:'0.5rem', top:'1.3rem', transform:'translateY(-50%)', width:26, height:26, borderRadius:'50%', background:'var(--card2)', border:'1px solid var(--border)', color:'var(--muted)', fontSize:'0.7rem', cursor:'pointer' }}>✕</button>
              )}
              {(usersTruncated || userSearching) && (
                <div style={{ fontSize:'0.66rem', color:'var(--muted)', marginTop:'0.35rem' }}>
                  {userSearching ? 'Searching all users…' : `Only ${users.length.toLocaleString()} of ${stats.users.toLocaleString()} users are loaded here — search also checks the full database.`}
                </div>
              )}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
              {[
                // Admin always first
                ...matchedUsers.filter(u => u.is_admin),
                // Then non-admins sorted by chosen method
                ...[...matchedUsers.filter(u => !u.is_admin)].sort((a, b) => {
                  if (userSort === 'recent') return new Date(b.created_at) - new Date(a.created_at)
                  if (userSort === 'oldest') return new Date(a.created_at) - new Date(b.created_at)
                  if (userSort === 'alpha') return (a.full_name || '').localeCompare(b.full_name || '')
                  return 0
                }),
              ].map((user, i) => (
                <div key={user.id} style={{ background:'var(--card)', border:`1px solid ${user.is_admin ? 'rgba(108,78,242,0.35)' : 'var(--border)'}`, borderRadius:'16px', padding:'1rem 1.1rem', animation:`fadeSlideIn 0.3s ease ${0.04*i}s both`, position:'relative', overflow:'hidden' }}>
                  {/* admin top accent */}
                  {user.is_admin && <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg, var(--purple), var(--gold))', borderRadius:'16px 16px 0 0' }} />}
                  <div style={{ display:'flex', alignItems:'center', gap:'0.8rem', marginBottom:'0.8rem' }}>
                    <div style={{ width:38, height:38, borderRadius:'50%', background:'linear-gradient(135deg, var(--purple), var(--gold))', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Outfit, sans-serif', fontWeight:800, fontSize:'0.9rem', color:'#fff', flexShrink:0 }}>
                      {user.full_name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'0.86rem', fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.full_name || 'User'}</div>
                      <div style={{ fontSize:'0.7rem', color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.email}</div>
                    </div>
                    <div style={{ display:'flex', gap:'0.3rem', flexShrink:0 }}>
                      {user.is_admin && <span style={{ padding:'0.18rem 0.5rem', borderRadius:'50px', background:'rgba(108,78,242,0.15)', color:'var(--purple2)', fontSize:'0.62rem', fontWeight:700 }}>ADMIN</span>}
                      {user.is_banned && <span style={{ padding:'0.18rem 0.5rem', borderRadius:'50px', background:'rgba(220,50,50,0.15)', color:'#ff6b6b', fontSize:'0.62rem', fontWeight:700 }}>BANNED</span>}
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.7rem' }}>
                    <div>
                      <div style={{ fontSize:'0.68rem', color:'var(--muted)', marginBottom:'0.2rem' }}>Wallet</div>
                      {editingBalance === user.id ? (
                        <div style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
                          <input value={newBalance} onChange={e => setNewBalance(e.target.value)} type="number"
                            style={{ width:100, padding:'0.3rem 0.6rem', background:'var(--navy)', border:'1px solid var(--purple)', borderRadius:'6px', color:'var(--text)', fontSize:'0.82rem', outline:'none' }} />
                          <button className="action-btn" onClick={() => updateBalance(user.id)} style={{ padding:'0.3rem 0.6rem', background:'var(--purple)', border:'none', borderRadius:'6px', color:'#fff', fontSize:'0.72rem', fontWeight:600 }}>Save</button>
                          <button className="action-btn" onClick={() => setEditingBalance(null)} style={{ padding:'0.3rem 0.6rem', background:'var(--card2)', border:'1px solid var(--border)', borderRadius:'6px', color:'var(--muted)', fontSize:'0.72rem' }}>✕</button>
                        </div>
                      ) : (
                        <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.95rem', color:'var(--gold)' }}>₦{(user.wallet_balance || 0).toLocaleString()}</div>
                      )}
                    </div>
                    <div style={{ fontSize:'0.68rem', color:'var(--muted)', textAlign:'right' }}>
                      <div>Joined</div>
                      <div style={{ color:'var(--text)', fontWeight:500 }}>{new Date(user.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:'0.5rem' }}>
                    <button className="action-btn" onClick={() => { setEditingBalance(user.id); setNewBalance(String(user.wallet_balance || 0)) }}
                      style={{ flex:1, padding:'0.5rem', background:'rgba(240,180,41,0.1)', border:'1px solid rgba(240,180,41,0.3)', borderRadius:'8px', color:'var(--gold)', fontSize:'0.72rem', fontWeight:600 }}>
                      Edit Balance
                    </button>
                    <button className="action-btn" onClick={() => toggleBan(user.id, user.is_banned)}
                      style={{ flex:1, padding:'0.5rem', background: user.is_banned ? 'rgba(29,158,117,0.1)' : 'rgba(220,50,50,0.1)', border:`1px solid ${user.is_banned ? 'rgba(29,158,117,0.3)' : 'rgba(220,50,50,0.3)'}`, borderRadius:'8px', color: user.is_banned ? '#34d399' : '#ff6b6b', fontSize:'0.72rem', fontWeight:600 }}>
                      {user.is_banned ? 'Unban' : 'Ban User'}
                    </button>
                  </div>
                  <button className="action-btn" onClick={() => openHistory(user)}
                    style={{ width:'100%', marginTop:'0.5rem', padding:'0.5rem', background:'rgba(108,78,242,0.1)', border:'1px solid rgba(108,78,242,0.3)', borderRadius:'8px', color:'var(--purple2)', fontSize:'0.72rem', fontWeight:600 }}>
                    View History
                  </button>
                </div>
              ))}
              {users.length === 0 && <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'16px', padding:'2rem', textAlign:'center', color:'var(--muted)', fontSize:'0.82rem' }}>No users yet</div>}
              {users.length > 0 && matchedUsers.length === 0 && (
                <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'16px', padding:'2rem', textAlign:'center', color:'var(--muted)', fontSize:'0.82rem' }}>
                  {userSearching ? 'Searching…' : `No users match “${userSearch.trim()}”`}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ORDERS */}
        {activeTab === 'orders' && (
          <div style={{ animation:'fadeSlideIn 0.4s ease' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.9rem' }}>
              <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.92rem', color:'var(--text)' }}>Orders ({filteredOrders.length})</div>
              <select value={orderFilter} onChange={e => setOrderFilter(e.target.value)}
                style={{ padding:'0.35rem 0.7rem', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'8px', color:'var(--text)', fontSize:'0.75rem', outline:'none' }}>
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="resolving">Resolving (needs review)</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
                <option value="banned">Banned</option>
              </select>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
              {filteredOrders.map((order, i) => {
                const s = statusStyle(order.status)
                return (
                  <div key={order.id} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'16px', padding:'1rem 1.1rem', animation:`fadeSlideIn 0.3s ease ${0.04*i}s both` }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'0.7rem' }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:'0.86rem', fontWeight:600, color:'var(--text)', marginBottom:'0.15rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{order.product_name || 'Order'}</div>
                        <div style={{ fontSize:'0.7rem', color:'var(--muted)', textTransform:'capitalize' }}>{order.product_type} · {new Date(order.created_at).toLocaleDateString()}</div>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0, marginLeft:'0.5rem' }}>
                        <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:800, fontSize:'0.9rem', color:'var(--gold)', marginBottom:'0.3rem' }}>₦{order.amount?.toLocaleString()}</div>
                        <span style={{ padding:'0.2rem 0.55rem', borderRadius:'50px', background:s.bg, color:s.color, fontSize:'0.65rem', fontWeight:600, textTransform:'capitalize' }}>{order.status}</span>
                      </div>
                    </div>

                    {order.status === 'resolving' && (
                      <div style={{ marginBottom:'0.7rem', padding:'0.6rem 0.75rem', background:'rgba(255,159,67,0.1)', border:'1px solid rgba(255,159,67,0.3)', borderRadius:'10px', fontSize:'0.7rem', color:'#ff9f43', lineHeight:1.5 }}>
                        ⚠ Stuck mid-resolution. The customer's wallet may ALREADY have been refunded — check their Transactions before changing anything, and do not set this back to Pending (the system would refund it again).
                      </div>
                    )}

                    {order.status === 'pending' && (
                      <div style={{ marginBottom:'0.7rem' }}>
                        {deliveringOrder === order.id ? (
                          <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', animation:'scaleIn 0.2s ease' }}>
                            <textarea placeholder="Paste activation key or account credentials..." value={deliveryKey} onChange={e => setDeliveryKey(e.target.value)} rows={3}
                              style={{ width:'100%', padding:'0.6rem', background:'var(--navy)', border:'1px solid var(--purple)', borderRadius:'8px', color:'var(--text)', fontSize:'0.8rem', outline:'none', resize:'none', fontFamily:'Inter, sans-serif' }} />
                            <div style={{ display:'flex', gap:'0.5rem' }}>
                              <button className="action-btn" onClick={() => deliverOrder(order)} disabled={delivering}
                                style={{ flex:1, padding:'0.5rem', background:'rgba(29,158,117,0.15)', border:'1px solid rgba(29,158,117,0.3)', borderRadius:'8px', color:'#34d399', fontSize:'0.72rem', fontWeight:600 }}>
                                {delivering ? 'Delivering...' : '✓ Deliver & Complete'}
                              </button>
                              <button className="action-btn" onClick={() => { setDeliveringOrder(null); setDeliveryKey('') }}
                                style={{ padding:'0.5rem 0.8rem', background:'var(--card2)', border:'1px solid var(--border)', borderRadius:'8px', color:'var(--muted)', fontSize:'0.72rem' }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button className="action-btn" onClick={() => setDeliveringOrder(order.id)}
                            style={{ width:'100%', padding:'0.5rem', background:'rgba(29,158,117,0.1)', border:'1px solid rgba(29,158,117,0.3)', borderRadius:'8px', color:'#34d399', fontSize:'0.72rem', fontWeight:600, marginBottom:'0.4rem' }}>
                            📦 Deliver Order
                          </button>
                        )}
                      </div>
                    )}

                    <div style={{ display:'flex', gap:'0.5rem' }}>
                      {['pending','completed','failed'].map(status => {
                        // Re-opening a number order that is stuck or already refunded would put it
                        // back into the automatic poll/sweep, which can refund it a second time.
                        const reopenRisky = status === 'pending' && order.product_type === 'number' && ['resolving','cancelled','expired','banned'].includes(order.status)
                        return (
                        <button key={status} className="action-btn" disabled={reopenRisky}
                          title={reopenRisky ? 'Disabled: this order may already be refunded — re-opening it could refund it twice.' : undefined}
                          onClick={() => updateOrderStatus(order.id, status)}
                          style={{ flex:1, padding:'0.45rem', background: order.status === status ? statusStyle(status).bg : 'var(--card2)', border:`1px solid ${order.status === status ? statusStyle(status).color : 'var(--border)'}`, borderRadius:'8px', color: order.status === status ? statusStyle(status).color : 'var(--muted)', fontSize:'0.65rem', fontWeight:600, textTransform:'capitalize', opacity: reopenRisky ? 0.35 : 1, cursor: reopenRisky ? 'not-allowed' : 'pointer' }}>
                          {status}
                        </button>
                        )})}
                    </div>
                  </div>
                )
              })}
              {filteredOrders.length === 0 && <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'16px', padding:'2rem', textAlign:'center', color:'var(--muted)', fontSize:'0.82rem' }}>No orders found</div>}
            </div>
          </div>
        )}

        {/* BOOST PRICES */}
        {activeTab === 'boost' && (
          <div style={{ animation:'fadeSlideIn 0.4s ease' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
              <div>
                <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.92rem', color:'var(--text)' }}>Boosting Prices</div>
                <div style={{ fontSize:'0.7rem', color:'var(--muted)', marginTop:'0.1rem' }}>Edit prices — changes apply instantly for all users</div>
              </div>
              <button className="action-btn" onClick={saveBoostPrices} disabled={savingPrices}
                style={{ padding:'0.5rem 1rem', background: pricesSaved ? 'rgba(29,158,117,0.2)' : 'var(--purple)', border:`1px solid ${pricesSaved ? 'rgba(29,158,117,0.4)' : 'transparent'}`, borderRadius:'10px', color: pricesSaved ? '#34d399' : '#fff', fontSize:'0.78rem', fontWeight:700, fontFamily:'Outfit, sans-serif', minWidth:80 }}>
                {savingPrices ? 'Saving...' : pricesSaved ? '✓ Saved' : 'Save All'}
              </button>
            </div>

            {/* Platform tabs */}
            <div style={{ display:'flex', gap:'0.4rem', overflowX:'auto', paddingBottom:'0.5rem', marginBottom:'1rem', scrollbarWidth:'none' }}>
              {platforms.map(p => (
                <button key={p} className="plat-btn"
                  onClick={() => setActivePlatform(p)}
                  style={{ padding:'0.4rem 0.9rem', background: activePlatform === p ? 'var(--purple)' : 'var(--card)', border:`1px solid ${activePlatform === p ? 'var(--purple)' : 'var(--border)'}`, borderRadius:'20px', color: activePlatform === p ? '#fff' : 'var(--muted)', fontSize:'0.75rem', fontWeight:600, whiteSpace:'nowrap', flexShrink:0 }}>
                  {p}
                </button>
              ))}
            </div>

            {/* Package price editors */}
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              {DEFAULT_BOOST_PACKAGES.filter(p => p.platform === activePlatform).map((pkg, i) => (
                <div key={pkg.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', padding:'0.8rem 1rem', animation:`fadeSlideIn 0.25s ease ${0.04*i}s both` }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'0.84rem', fontWeight:600, color:'var(--text)' }}>{pkg.name}</div>
                    <div style={{ fontSize:'0.68rem', color:'var(--muted)', marginTop:'0.1rem' }}>Default: ₦{pkg.price.toLocaleString()}</div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', flexShrink:0 }}>
                    <span style={{ fontSize:'0.82rem', color:'var(--muted)' }}>₦</span>
                    <input className="price-input" type="number"
                      value={getPrice(pkg.id)}
                      onChange={e => setEditedPrices(prev => ({ ...prev, [pkg.id]: e.target.value }))}
                      style={{ width:90, padding:'0.4rem 0.6rem', background:'var(--navy)', border:'1px solid var(--border)', borderRadius:'8px', color:'var(--gold)', fontSize:'0.88rem', fontWeight:700, fontFamily:'Outfit, sans-serif', textAlign:'right' }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop:'1.2rem', padding:'0.9rem', background:'rgba(108,78,242,0.06)', border:'1px solid rgba(108,78,242,0.2)', borderRadius:'12px', fontSize:'0.75rem', color:'var(--muted)', lineHeight:1.6 }}>
              💡 <strong style={{ color:'var(--text)' }}>How it works:</strong> Prices you set here are saved to Supabase and used live on the boosting page. Hit <strong style={{ color:'var(--purple2)' }}>Save All</strong> after editing. Changes take effect immediately for all users.
            </div>
          </div>
        )}

        {/* VPN STOCK */}
        {activeTab === 'vpn' && (
          <div style={{ animation:'fadeSlideIn 0.4s ease' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.9rem' }}>
              <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.92rem', color:'var(--text)' }}>VPN Keys ({vpnKeys.filter(k => !k.is_used).length} available)</div>
              <button className="action-btn" onClick={() => setShowVpnForm(!showVpnForm)}
                style={{ padding:'0.5rem 1rem', background:'var(--purple)', border:'none', borderRadius:'10px', color:'#fff', fontSize:'0.78rem', fontWeight:700, fontFamily:'Outfit, sans-serif' }}>
                {showVpnForm ? 'Cancel' : '+ Add Keys'}
              </button>
            </div>

            {/* Stock summary */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'0.6rem', marginBottom:'1.2rem' }}>
              {vpnStats.map(v => (
                <div key={v.provider} style={{ background:'var(--card)', border:`1px solid ${v.available < 3 ? 'rgba(220,50,50,0.4)' : 'var(--border)'}`, borderRadius:'14px', padding:'0.9rem' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.3rem' }}>
                    <div style={{ fontSize:'0.8rem', fontWeight:600, color:'var(--text)' }}>{v.provider}</div>
                    {v.available < 3 && <span style={{ fontSize:'0.6rem', background:'rgba(220,50,50,0.15)', color:'#ff6b6b', borderRadius:'50px', padding:'0.1rem 0.45rem', fontWeight:700 }}>LOW</span>}
                  </div>
                  <div style={{ fontSize:'0.75rem', color:'#34d399', fontWeight:600 }}>{v.available} keys left</div>
                  <div style={{ fontSize:'0.68rem', color:'var(--muted)' }}>{v.used} delivered</div>
                </div>
              ))}
            </div>

            {/* Add VPN form */}
            {showVpnForm && (
              <div style={{ background:'var(--card)', border:'1px solid var(--purple)', borderRadius:'16px', padding:'1.2rem', marginBottom:'1rem', animation:'scaleIn 0.3s ease' }}>
                <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.88rem', color:'var(--text)', marginBottom:'1rem' }}>Add VPN Keys</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'0.7rem' }}>
                  <div>
                    <label style={{ fontSize:'0.72rem', color:'var(--muted)', display:'block', marginBottom:'0.3rem' }}>Provider</label>
                    <select value={vpnForm.provider} onChange={e => setVpnForm(f => ({ ...f, provider: e.target.value }))} style={selectStyle}>
                      {vpnProviders.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:'0.72rem', color:'var(--muted)', display:'block', marginBottom:'0.3rem' }}>Plan</label>
                    <select value={vpnForm.plan} onChange={e => setVpnForm(f => ({ ...f, plan: e.target.value }))} style={selectStyle}>
                      {vpnPlans.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:'0.72rem', color:'var(--muted)', display:'block', marginBottom:'0.3rem' }}>Single Key</label>
                    <input placeholder="Paste activation key or email:password" value={vpnForm.key} onChange={e => setVpnForm(f => ({ ...f, key: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize:'0.72rem', color:'var(--muted)', display:'block', marginBottom:'0.3rem' }}>Bulk Keys (one per line)</label>
                    <textarea placeholder={'email1:pass1\nemail2:pass2\nemail3:pass3'} value={vpnBulk} onChange={e => setVpnBulk(e.target.value)} rows={5}
                      style={{ ...inputStyle, resize:'vertical' }} />
                  </div>
                  <button onClick={saveVpnKey} disabled={savingVpn} className="action-btn"
                    style={{ padding:'0.8rem', background:'var(--purple)', border:'none', borderRadius:'10px', color:'#fff', fontFamily:'Outfit, sans-serif', fontSize:'0.9rem', fontWeight:700 }}>
                    {savingVpn ? 'Saving...' : `Save ${vpnBulk ? vpnBulk.split('\n').filter(k => k.trim()).length : vpnForm.key ? 1 : 0} Key(s)`}
                  </button>
                </div>
              </div>
            )}

            {/* Keys list */}
            <div style={{ display:'flex', flexDirection:'column', gap:'0.55rem' }}>
              {vpnKeys.map((k, i) => (
                <div key={k.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'14px', padding:'0.85rem 1.1rem', animation:`fadeSlideIn 0.3s ease ${0.03*i}s both` }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.2rem', flexWrap:'wrap' }}>
                      <span style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text)' }}>{k.provider}</span>
                      <span style={{ fontSize:'0.62rem', background:'var(--card2)', color:'var(--muted)', borderRadius:'50px', padding:'0.1rem 0.4rem' }}>{k.plan}</span>
                      <span style={{ fontSize:'0.62rem', background: k.is_used ? 'rgba(220,50,50,0.12)' : 'rgba(29,158,117,0.12)', color: k.is_used ? '#ff6b6b' : '#34d399', borderRadius:'50px', padding:'0.1rem 0.4rem', fontWeight:600 }}>{k.is_used ? 'Used' : 'Available'}</span>
                    </div>
                    <div style={{ fontSize:'0.7rem', color:'var(--muted)', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{k.key}</div>
                  </div>
                  {!k.is_used && (
                    <button className="action-btn" onClick={() => deleteVpnKey(k.id)}
                      style={{ marginLeft:'0.8rem', padding:'0.35rem 0.7rem', background:'rgba(220,50,50,0.1)', border:'1px solid rgba(220,50,50,0.3)', borderRadius:'8px', color:'#ff6b6b', fontSize:'0.68rem', fontWeight:600, flexShrink:0 }}>
                      Delete
                    </button>
                  )}
                </div>
              ))}
              {vpnKeys.length === 0 && (
                <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'16px', padding:'2rem', textAlign:'center', color:'var(--muted)', fontSize:'0.82rem' }}>No VPN keys yet. Add your first keys above!</div>
              )}
            </div>
          </div>
        )}

        {/* SUBSCRIPTIONS TAB */}
        {activeTab === 'subs' && (
          <div style={{ animation:'fadeSlideIn 0.4s ease' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
              <div>
                <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.92rem', color:'var(--text)' }}>Digital Subscriptions</div>
                <div style={{ fontSize:'0.7rem', color:'var(--muted)', marginTop:'0.1rem' }}>{subKeys.filter(k=>!k.is_used).length} available · {subKeys.filter(k=>k.is_used).length} used</div>
              </div>
              <button className="action-btn" onClick={() => setShowSubForm(!showSubForm)}
                style={{ padding:'0.5rem 1rem', background:'var(--purple)', border:'none', borderRadius:'10px', color:'#fff', fontSize:'0.78rem', fontWeight:700, fontFamily:'Outfit, sans-serif' }}>
                + Add Keys
              </button>
            </div>

            {/* Stock overview */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'0.6rem', marginBottom:'1rem' }}>
              {subServices.map(s => {
                const id = subServiceIds[s]
                const avail = subKeys.filter(k => k.service_id === id && !k.is_used).length
                const used = subKeys.filter(k => k.service_id === id && k.is_used).length
                return (
                  <div key={s} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'14px', padding:'0.9rem' }}>
                    <div style={{ fontSize:'0.75rem', fontWeight:700, color:'var(--text)', marginBottom:'0.4rem' }}>{s}</div>
                    <div style={{ display:'flex', gap:'0.8rem' }}>
                      <div><div style={{ fontSize:'1rem', fontWeight:800, color:'#34d399', fontFamily:'Outfit, sans-serif' }}>{avail}</div><div style={{ fontSize:'0.62rem', color:'var(--muted)' }}>available</div></div>
                      <div><div style={{ fontSize:'1rem', fontWeight:800, color:'var(--muted)', fontFamily:'Outfit, sans-serif' }}>{used}</div><div style={{ fontSize:'0.62rem', color:'var(--muted)' }}>used</div></div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Add keys form */}
            {showSubForm && (
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'16px', padding:'1.2rem', marginBottom:'1rem', animation:'scaleIn 0.25s ease' }}>
                <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.85rem', color:'var(--text)', marginBottom:'0.9rem' }}>Add Subscription Keys</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'0.7rem' }}>
                  <div>
                    <label style={{ fontSize:'0.72rem', color:'var(--muted)', display:'block', marginBottom:'0.3rem' }}>Service</label>
                    <select value={subForm.service} onChange={e => setSubForm(f => ({ ...f, service: e.target.value }))} style={selectStyle}>
                      {subServices.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:'0.72rem', color:'var(--muted)', display:'block', marginBottom:'0.3rem' }}>Plan</label>
                    <select value={subForm.plan} onChange={e => setSubForm(f => ({ ...f, plan: e.target.value }))} style={selectStyle}>
                      {subPlans.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:'0.72rem', color:'var(--muted)', display:'block', marginBottom:'0.3rem' }}>Single Key</label>
                    <input value={subForm.key} onChange={e => setSubForm(f => ({ ...f, key: e.target.value }))} placeholder="Paste single key here..." style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize:'0.72rem', color:'var(--muted)', display:'block', marginBottom:'0.3rem' }}>Bulk Keys (one per line)</label>
                    <textarea value={subBulk} onChange={e => setSubBulk(e.target.value)} placeholder={"key1\nkey2\nkey3"} rows={4}
                      style={{ ...inputStyle, resize:'vertical', lineHeight:1.6 }} />
                    {subBulk && <div style={{ fontSize:'0.68rem', color:'var(--purple2)', marginTop:'0.3rem' }}>{subBulk.split('\n').filter(k=>k.trim()).length} keys ready to add</div>}
                  </div>
                  <div style={{ display:'flex', gap:'0.6rem' }}>
                    <button className="action-btn" onClick={saveSubKey} disabled={savingSub || (!subForm.key.trim() && !subBulk.trim())}
                      style={{ flex:1, padding:'0.65rem', background:'var(--purple)', border:'none', borderRadius:'10px', color:'#fff', fontSize:'0.82rem', fontWeight:700, fontFamily:'Outfit, sans-serif', opacity: (!subForm.key.trim() && !subBulk.trim()) ? 0.5 : 1 }}>
                      {savingSub ? 'Saving...' : 'Save Keys'}
                    </button>
                    <button className="action-btn" onClick={() => { setShowSubForm(false); setSubBulk('') }}
                      style={{ padding:'0.65rem 1rem', background:'var(--card2)', border:'1px solid var(--border)', borderRadius:'10px', color:'var(--muted)', fontSize:'0.82rem', fontWeight:600 }}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Keys list */}
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              {subKeys.map(k => (
                <div key={k.id} className="row-item" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'14px', padding:'0.8rem 1rem' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.2rem' }}>
                      <span style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--text)' }}>{k.service_id}</span>
                      <span style={{ fontSize:'0.65rem', background:'var(--card2)', color:'var(--muted)', borderRadius:'50px', padding:'0.1rem 0.4rem' }}>{k.plan}</span>
                      <span style={{ fontSize:'0.65rem', borderRadius:'50px', padding:'0.1rem 0.4rem', background: k.is_used ? 'rgba(220,50,50,0.1)' : 'rgba(29,158,117,0.1)', color: k.is_used ? '#ff6b6b' : '#34d399' }}>
                        {k.is_used ? 'used' : 'available'}
                      </span>
                    </div>
                    <div style={{ fontSize:'0.7rem', color:'var(--muted)', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{k.key}</div>
                  </div>
                  {!k.is_used && (
                    <button className="action-btn" onClick={() => deleteSubKey(k.id)}
                      style={{ marginLeft:'0.8rem', padding:'0.35rem 0.7rem', background:'rgba(220,50,50,0.1)', border:'1px solid rgba(220,50,50,0.3)', borderRadius:'8px', color:'#ff6b6b', fontSize:'0.68rem', fontWeight:600, flexShrink:0 }}>
                      Delete
                    </button>
                  )}
                </div>
              ))}
              {subKeys.length === 0 && (
                <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'16px', padding:'2rem', textAlign:'center', color:'var(--muted)', fontSize:'0.82rem' }}>No subscription keys yet. Add your first keys above!</div>
              )}
            </div>
          </div>
        )}

        {/* NOTIFY TAB — mass email broadcast */}
        {activeTab === 'notify' && (
          <div style={{ animation:'fadeSlideIn 0.4s ease' }}>
            <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.92rem', color:'var(--text)', marginBottom:'0.3rem' }}>
              Mass Email Notification
            </div>
            <div style={{ fontSize:'0.72rem', color:'var(--muted)', marginBottom:'1.1rem' }}>
              Sends a separate email to every user with a registered email address. Currently {stats.users} users.
            </div>

            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'16px', padding:'1.2rem', marginBottom:'1rem' }}>
              <label style={{ fontSize:'0.72rem', color:'var(--muted)', display:'block', marginBottom:'0.4rem' }}>Subject</label>
              <input
                value={broadcastSubject}
                onChange={e => setBroadcastSubject(e.target.value)}
                placeholder="e.g. New feature: Instant number delivery"
                style={{ width:'100%', padding:'0.7rem 0.9rem', background:'var(--navy)', border:'1px solid var(--border)', borderRadius:'10px', color:'var(--text)', fontSize:'0.85rem', outline:'none', marginBottom:'1rem', fontFamily:'Inter, sans-serif' }}
              />

              <label style={{ fontSize:'0.72rem', color:'var(--muted)', display:'block', marginBottom:'0.4rem' }}>Message</label>
              <textarea
                value={broadcastMessage}
                onChange={e => setBroadcastMessage(e.target.value)}
                placeholder="Write your message here…"
                rows={7}
                style={{ width:'100%', padding:'0.9rem', background:'var(--navy)', border:'1px solid var(--border)', borderRadius:'10px', color:'var(--text)', fontSize:'0.85rem', outline:'none', resize:'vertical', fontFamily:'Inter, sans-serif', lineHeight:1.6 }}
              />
              <div style={{ fontSize:'0.68rem', color:'var(--muted)', marginTop:'0.4rem' }}>
                Sent from <code style={{ background:'var(--card2)', padding:'0.1rem 0.3rem', borderRadius:'4px' }}>no-reply@megad.name.ng</code>
              </div>
            </div>

            {broadcastResult && (
              <div style={{
                background: broadcastResult.ok ? 'rgba(29,158,117,0.08)' : 'rgba(244,63,94,0.08)',
                border: `1px solid ${broadcastResult.ok ? 'rgba(29,158,117,0.25)' : 'rgba(244,63,94,0.25)'}`,
                borderRadius:'12px', padding:'0.85rem 1rem', marginBottom:'1rem',
                fontSize:'0.78rem', color: broadcastResult.ok ? '#34d399' : '#f43f5e', lineHeight:1.5,
              }}>
                {broadcastResult.ok
                  ? `Sent to ${broadcastResult.sent} of ${broadcastResult.total} recipients.${broadcastResult.failed ? ` ${broadcastResult.failed} failed.` : ''}`
                  : `Failed: ${broadcastResult.error}`}
              </div>
            )}

            {!confirmingBroadcast ? (
              <button
                className="action-btn"
                disabled={!broadcastSubject.trim() || !broadcastMessage.trim() || sendingBroadcast}
                onClick={() => setConfirmingBroadcast(true)}
                style={{
                  width:'100%', padding:'0.9rem', background: (!broadcastSubject.trim() || !broadcastMessage.trim()) ? 'var(--card2)' : 'var(--purple)',
                  border:'none', borderRadius:'12px', color: (!broadcastSubject.trim() || !broadcastMessage.trim()) ? 'var(--muted)' : '#fff',
                  fontSize:'0.85rem', fontWeight:700, fontFamily:'Outfit, sans-serif',
                  cursor: (!broadcastSubject.trim() || !broadcastMessage.trim()) ? 'not-allowed' : 'pointer',
                }}>
                Review & Send
              </button>
            ) : (
              <div style={{ background:'rgba(240,180,41,0.06)', border:'1px solid rgba(240,180,41,0.25)', borderRadius:'12px', padding:'1rem' }}>
                <div style={{ fontSize:'0.8rem', color:'var(--text)', marginBottom:'0.9rem', lineHeight:1.5 }}>
                  Send this email to all <strong>{stats.users}</strong> users? This can't be undone.
                </div>
                <div style={{ display:'flex', gap:'0.6rem' }}>
                  <button className="action-btn" onClick={() => setConfirmingBroadcast(false)} disabled={sendingBroadcast}
                    style={{ flex:1, padding:'0.7rem', background:'var(--card2)', border:'1px solid var(--border)', borderRadius:'10px', color:'var(--muted)', fontSize:'0.8rem', fontWeight:600 }}>
                    Cancel
                  </button>
                  <button className="action-btn" onClick={sendBroadcast} disabled={sendingBroadcast}
                    style={{ flex:1, padding:'0.7rem', background:'var(--purple)', border:'none', borderRadius:'10px', color:'#fff', fontSize:'0.8rem', fontWeight:700 }}>
                    {sendingBroadcast ? 'Sending…' : 'Confirm & Send'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* POPUPS TAB */}
        {activeTab === 'popups' && (
          <div style={{ animation:'fadeSlideIn 0.4s ease' }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'0.8rem', marginBottom:'1.1rem' }}>
              <div>
                <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.92rem', color:'var(--text)', marginBottom:'0.3rem' }}>Popup announcements</div>
                <div style={{ fontSize:'0.72rem', color:'var(--muted)', lineHeight:1.5 }}>Write a popup, switch it on, and users see it when they open the dashboard.</div>
              </div>
              {!annForm && (
                <button className="action-btn" onClick={() => { setAnnError(''); setAnnForm({ ...emptyAnn }) }}
                  style={{ padding:'0.6rem 1rem', background:'var(--purple)', border:'none', borderRadius:'10px', color:'#fff', fontSize:'0.78rem', fontWeight:700, fontFamily:'Outfit, sans-serif', whiteSpace:'nowrap', flexShrink:0 }}>
                  + New popup
                </button>
              )}
            </div>

            {annError && (
              <div role="alert" style={{ background:'rgba(244,63,94,0.08)', border:'1px solid rgba(244,63,94,0.25)', borderRadius:'12px', padding:'0.75rem 1rem', marginBottom:'1rem', fontSize:'0.78rem', color:'#f43f5e' }}>{annError}</div>
            )}

            {annForm && (
              <div style={{ display:'grid', gridTemplateColumns: isDesktop ? '1.1fr 0.9fr' : '1fr', gap:'1rem', marginBottom:'1.4rem', alignItems:'start' }}>
                {/* FORM */}
                <div style={{ background:'var(--card)', border:'1px solid rgba(108,78,242,0.3)', borderRadius:'16px', padding:'1.2rem' }}>
                  <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.88rem', color:'var(--text)', marginBottom:'1rem' }}>{annForm.id ? 'Edit popup' : 'New popup'}</div>

                  <label style={{ fontSize:'0.72rem', color:'var(--muted)', display:'block', marginBottom:'0.35rem' }}>Image <span style={{ opacity:0.7 }}>(optional)</span></label>
                  <input ref={annFileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display:'none' }} onChange={e => uploadAnnImage(e.target.files?.[0])} />
                  {annForm.image_url ? (
                    <div style={{ marginBottom:'0.9rem' }}>
                      <div style={{ position:'relative', width:'100%', aspectRatio:'16 / 9', borderRadius:'12px', overflow:'hidden', border:'1px solid var(--border)', background:'var(--navy)' }}>
                        <img src={annForm.image_url} alt="Popup banner" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', opacity: annImgBusy ? 0.4 : 1 }} />
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginTop:'0.5rem', flexWrap:'wrap' }}>
                        <button type="button" className="action-btn" disabled={!!annImgBusy} onClick={() => annFileRef.current?.click()} style={{ padding:'0.35rem 0.8rem', background:'var(--card2)', border:'1px solid var(--border)', borderRadius:'8px', color:'var(--text)', fontSize:'0.72rem', fontWeight:600 }}>{annImgBusy || 'Replace'}</button>
                        <button type="button" className="action-btn" disabled={!!annImgBusy} onClick={() => { setAnnForm(f => ({ ...f, image_url: '' })); setAnnImgInfo('') }} style={{ padding:'0.35rem 0.8rem', background:'transparent', border:'1px solid rgba(244,63,94,0.3)', borderRadius:'8px', color:'#f43f5e', fontSize:'0.72rem', fontWeight:600 }}>Remove</button>
                        {annImgInfo && <span style={{ fontSize:'0.68rem', color:'#34d399' }}>✓ {annImgInfo}</span>}
                      </div>
                    </div>
                  ) : (
                    <button type="button" disabled={!!annImgBusy} onClick={() => annFileRef.current?.click()}
                      style={{ width:'100%', marginBottom:'0.9rem', padding:'1.1rem 0.8rem', background:'var(--navy)', border:'1.5px dashed var(--border)', borderRadius:'12px', color:'var(--muted)', cursor: annImgBusy ? 'wait' : 'pointer', textAlign:'center' }}>
                      <div style={{ fontSize:'0.8rem', fontWeight:600, color:'var(--text)', marginBottom:'0.2rem' }}>{annImgBusy || '+ Add a banner image'}</div>
                      <div style={{ fontSize:'0.66rem', lineHeight:1.5 }}>PNG, JPG or WebP · up to 5 MB · shrunk automatically to under 250 KB so it loads fast. Best at 1280×720 (16:9).</div>
                    </button>
                  )}

                  <label style={{ fontSize:'0.72rem', color:'var(--muted)', display:'block', marginBottom:'0.35rem' }}>Title <span style={{ opacity:0.7 }}>({annForm.title.length}/80)</span></label>
                  <input value={annForm.title} maxLength={80} onChange={e => setAnnForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Travel eSIM is live!" style={{ ...inputStyle, marginBottom:'0.9rem' }} />

                  <label style={{ fontSize:'0.72rem', color:'var(--muted)', display:'block', marginBottom:'0.35rem' }}>Message <span style={{ opacity:0.7 }}>({annForm.message.length}/500)</span></label>
                  <textarea value={annForm.message} maxLength={500} rows={4} onChange={e => setAnnForm(f => ({ ...f, message: e.target.value }))} placeholder="Tell people what's new…"
                    style={{ ...inputStyle, resize:'vertical', lineHeight:1.6, marginBottom:'0.9rem' }} />

                  <label style={{ fontSize:'0.72rem', color:'var(--muted)', display:'block', marginBottom:'0.4rem' }}>Icon <span style={{ opacity:0.7 }}>{annForm.image_url ? '(hidden while a banner image is used)' : ''}</span></label>
                  <div style={{ display:'flex', gap:'0.45rem', marginBottom:'0.9rem', flexWrap:'wrap' }}>
                    {['bell','gift','rocket','alert','info'].map(ic => (
                      <button key={ic} type="button" onClick={() => setAnnForm(f => ({ ...f, icon: ic }))} aria-pressed={annForm.icon === ic} aria-label={ic}
                        style={{ padding:'0.5rem 0.85rem', borderRadius:'10px', cursor:'pointer', fontSize:'0.72rem', fontWeight:600, textTransform:'capitalize', background: annForm.icon === ic ? 'rgba(108,78,242,0.14)' : 'var(--navy)', border:`1px solid ${annForm.icon === ic ? 'var(--purple)' : 'var(--border)'}`, color: annForm.icon === ic ? 'var(--purple2)' : 'var(--muted)' }}>{ic}</button>
                    ))}
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.7rem', marginBottom:'0.35rem' }}>
                    <div>
                      <label style={{ fontSize:'0.72rem', color:'var(--muted)', display:'block', marginBottom:'0.35rem' }}>Button text <span style={{ opacity:0.7 }}>(optional)</span></label>
                      <input value={annForm.primary_label} maxLength={30} onChange={e => setAnnForm(f => ({ ...f, primary_label: e.target.value }))} placeholder="Read More" style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ fontSize:'0.72rem', color:'var(--muted)', display:'block', marginBottom:'0.35rem' }}>Button link</label>
                      <input value={annForm.primary_url} list="ann-links" onChange={e => setAnnForm(f => ({ ...f, primary_url: e.target.value }))} placeholder="/dashboard/esim" style={inputStyle} />
                      <datalist id="ann-links">
                        {['/dashboard/wallet','/dashboard/numbers','/dashboard/email','/dashboard/proxy','/dashboard/esim','/dashboard/boosting','/dashboard/bills','/dashboard/referral'].map(l => <option key={l} value={l} />)}
                      </datalist>
                    </div>
                  </div>
                  <div style={{ fontSize:'0.66rem', color:'var(--muted)', marginBottom:'0.9rem' }}>Link can be a page in your app (starts with /) or a full https:// address. Leave both empty for a simple “Got it” popup.</div>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.7rem', marginBottom:'0.35rem' }}>
                    <div>
                      <label style={{ fontSize:'0.72rem', color:'var(--muted)', display:'block', marginBottom:'0.35rem' }}>Show from <span style={{ opacity:0.7 }}>(optional)</span></label>
                      <input type="datetime-local" value={annForm.starts_at} onChange={e => setAnnForm(f => ({ ...f, starts_at: e.target.value }))} style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ fontSize:'0.72rem', color:'var(--muted)', display:'block', marginBottom:'0.35rem' }}>Hide after <span style={{ opacity:0.7 }}>(optional)</span></label>
                      <input type="datetime-local" value={annForm.ends_at} onChange={e => setAnnForm(f => ({ ...f, ends_at: e.target.value }))} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ fontSize:'0.66rem', color:'var(--muted)', marginBottom:'0.9rem' }}>Times use your current timezone. Leave empty to show straight away with no end date.</div>

                  <label style={{ display:'flex', alignItems:'center', gap:'0.55rem', fontSize:'0.78rem', color:'var(--text)', marginBottom:'0.6rem', cursor:'pointer' }}>
                    <input type="checkbox" checked={annForm.allow_hide} onChange={e => setAnnForm(f => ({ ...f, allow_hide: e.target.checked }))} />
                    Let users tick “Don’t show this again”
                  </label>
                  <label style={{ display:'flex', alignItems:'center', gap:'0.55rem', fontSize:'0.78rem', color:'var(--text)', marginBottom:'1.1rem', cursor:'pointer' }}>
                    <input type="checkbox" checked={annForm.is_active} onChange={e => setAnnForm(f => ({ ...f, is_active: e.target.checked }))} />
                    Switch on now (users will see it)
                  </label>

                  <div style={{ display:'flex', gap:'0.6rem' }}>
                    <button className="action-btn" onClick={() => { setAnnForm(null); setAnnError('') }} disabled={annSaving}
                      style={{ flex:1, padding:'0.75rem', background:'var(--card2)', border:'1px solid var(--border)', borderRadius:'10px', color:'var(--muted)', fontSize:'0.8rem', fontWeight:600 }}>Cancel</button>
                    <button className="action-btn" onClick={saveAnnouncement} disabled={annSaving || !!annImgBusy || !annForm.title.trim()}
                      style={{ flex:1.4, padding:'0.75rem', background: annForm.title.trim() ? 'var(--purple)' : 'var(--card2)', border:'none', borderRadius:'10px', color: annForm.title.trim() ? '#fff' : 'var(--muted)', fontSize:'0.82rem', fontWeight:700, fontFamily:'Outfit, sans-serif', cursor: annForm.title.trim() ? 'pointer' : 'not-allowed' }}>
                      {annSaving ? 'Saving…' : annForm.id ? 'Save changes' : annForm.is_active ? 'Publish popup' : 'Save (off)'}
                    </button>
                  </div>
                </div>

                {/* LIVE PREVIEW */}
                <div style={{ position: isDesktop ? 'sticky' : 'static', top:80 }}>
                  <div style={{ fontSize:'0.68rem', color:'var(--muted)', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:700, marginBottom:'0.6rem' }}>Live preview</div>
                  <div style={{ background:'rgba(5,5,20,0.45)', border:'1px dashed var(--border)', borderRadius:'16px', padding:'1.2rem 0.8rem', display:'flex', justifyContent:'center' }}>
                    <AnnouncementCard preview a={{ ...annForm, created_at: new Date().toISOString() }} onPrimary={() => {}} onDismiss={() => {}} onHide={() => {}} />
                  </div>
                </div>
              </div>
            )}

            {/* LIST */}
            <div style={{ fontSize:'0.68rem', color:'var(--muted)', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:700, marginBottom:'0.6rem' }}>Your popups</div>
            {annLoading && !annLoaded ? (
              <div style={{ textAlign:'center', padding:'2rem', color:'var(--muted)', fontSize:'0.82rem' }}>Loading popups…</div>
            ) : annList.length === 0 ? (
              <div style={{ background:'var(--card)', border:'1px dashed var(--border)', borderRadius:'16px', padding:'2rem 1rem', textAlign:'center', color:'var(--muted)', fontSize:'0.82rem' }}>
                No popups yet. Tap “+ New popup” to create your first announcement.
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
                {annList.map(a => {
                  const st = annStatus(a)
                  const busy = annBusyId === a.id
                  return (
                    <div key={a.id} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'14px', padding:'0.9rem 1rem', opacity: busy ? 0.6 : 1 }}>
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'0.8rem' }}>
                        <div style={{ minWidth:0 }}>
                          {a.image_url && <img src={a.image_url} alt="" loading="lazy" style={{ width:112, aspectRatio:'16 / 9', objectFit:'cover', borderRadius:'8px', marginBottom:'0.5rem', display:'block', border:'1px solid var(--border)' }} />}
                          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexWrap:'wrap' }}>
                            <span style={{ fontSize:'0.86rem', fontWeight:600, color:'var(--text)', wordBreak:'break-word' }}>{a.title}</span>
                            <span style={{ padding:'0.12rem 0.6rem', borderRadius:'50px', background:st.bg, color:st.c, fontSize:'0.64rem', fontWeight:700 }}>{st.t}</span>
                          </div>
                          {a.message && <div style={{ fontSize:'0.74rem', color:'var(--muted)', marginTop:'0.25rem', overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{a.message}</div>}
                          <div style={{ fontSize:'0.66rem', color:'var(--muted)', marginTop:'0.35rem' }}>
                            Created {new Date(a.created_at).toLocaleDateString('en-NG', { day:'numeric', month:'short', year:'numeric' })}
                            {a.starts_at && ` · from ${new Date(a.starts_at).toLocaleString('en-NG', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}`}
                            {a.ends_at && ` · until ${new Date(a.ends_at).toLocaleString('en-NG', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}`}
                          </div>
                        </div>
                        {/* ON / OFF switch */}
                        <button onClick={() => patchAnnouncement(a.id, { is_active: !a.is_active })} disabled={busy} role="switch" aria-checked={!!a.is_active} aria-label={a.is_active ? 'Switch off' : 'Switch on'}
                          style={{ width:44, height:26, borderRadius:99, border:'none', background: a.is_active ? '#34d399' : 'var(--card2)', position:'relative', cursor:'pointer', flexShrink:0, transition:'background 0.2s', boxShadow:'inset 0 0 0 1px var(--border)' }}>
                          <span style={{ position:'absolute', top:3, left: a.is_active ? 21 : 3, width:20, height:20, borderRadius:'50%', background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.3)' }} />
                        </button>
                      </div>
                      <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.7rem', flexWrap:'wrap', alignItems:'center' }}>
                        <button className="action-btn" onClick={() => editAnn(a)} disabled={busy} style={{ padding:'0.35rem 0.8rem', background:'var(--card2)', border:'1px solid var(--border)', borderRadius:'8px', color:'var(--text)', fontSize:'0.72rem', fontWeight:600 }}>Edit</button>
                        <button className="action-btn" onClick={() => patchAnnouncement(a.id, { reshow: true })} disabled={busy} title="Show again to everyone who ticked “Don’t show again”" style={{ padding:'0.35rem 0.8rem', background:'var(--card2)', border:'1px solid var(--border)', borderRadius:'8px', color:'var(--text)', fontSize:'0.72rem', fontWeight:600 }}>Show again to everyone</button>
                        {annDeleteId === a.id ? (
                          <>
                            <span style={{ fontSize:'0.72rem', color:'#f43f5e' }}>Delete for good?</span>
                            <button className="action-btn" onClick={() => deleteAnnouncement(a.id)} disabled={busy} style={{ padding:'0.35rem 0.8rem', background:'#f43f5e', border:'none', borderRadius:'8px', color:'#fff', fontSize:'0.72rem', fontWeight:700 }}>Yes, delete</button>
                            <button className="action-btn" onClick={() => setAnnDeleteId(null)} style={{ padding:'0.35rem 0.8rem', background:'transparent', border:'1px solid var(--border)', borderRadius:'8px', color:'var(--muted)', fontSize:'0.72rem', fontWeight:600 }}>No</button>
                          </>
                        ) : (
                          <button className="action-btn" onClick={() => setAnnDeleteId(a.id)} disabled={busy} style={{ padding:'0.35rem 0.8rem', background:'transparent', border:'1px solid rgba(244,63,94,0.3)', borderRadius:'8px', color:'#f43f5e', fontSize:'0.72rem', fontWeight:600 }}>Delete</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* USER HISTORY PANEL */}
        {histUser && (() => {
          const fmt = (n) => '₦' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })
          const lagosDate = (iso) => new Date(iso).toLocaleDateString('en-NG', { timeZone:'Africa/Lagos', weekday:'long', day:'numeric', month:'long', year:'numeric' })
          const lagosTime = (iso) => new Date(iso).toLocaleTimeString('en-NG', { timeZone:'Africa/Lagos', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true })
          const dayKey = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone:'Africa/Lagos' })
          const meta = {
            signup:     { icon:'★', color:'#a78bfa' },
            funding:    { icon:'↑', color:'#34d399' },
            refund:     { icon:'↩', color:'#34d399' },
            adjustment: { icon:'✎', color:'#f0b429' },
            credit:     { icon:'↑', color:'#34d399' },
            spend:      { icon:'↓', color:'#f43f5e' },
            order:      { icon:'▣', color:'#60a5fa' },
            boost:      { icon:'⚡', color:'#f0b429' },
            referral:   { icon:'♥', color:'#f472b6' },
            log:        { icon:'•', color:'var(--muted)' },
          }
          const statusColor = (s) => ['completed','success'].includes(s) ? '#34d399' : ['refunded','failed','canceled','cancelled'].includes(s) ? '#f43f5e' : '#f0b429'
          const filters = [
            { id:'all', label:'All' },
            { id:'wallet', label:'Wallet' },
            { id:'orders', label:'Orders' },
            { id:'activity', label:'Activity' },
          ]
          const events = (histData?.events || []).filter(e => histFilter === 'all' || e.group === histFilter)
          const groups = []
          for (const e of events) {
            const k = dayKey(e.at)
            if (!groups.length || groups[groups.length - 1].key !== k) groups.push({ key: k, at: e.at, items: [] })
            groups[groups.length - 1].items.push(e)
          }
          const s = histData?.summary
          const tile = { background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', padding:'0.6rem 0.7rem' }
          const tl = { fontSize:'0.56rem', color:'var(--muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em' }
          const tv = { fontFamily:'Outfit, sans-serif', fontWeight:800, fontSize:'0.95rem', color:'var(--text)', marginTop:'0.1rem' }
          const close = () => { setHistUser(null); setHistData(null) }
          return (
            <div onClick={close} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:300, display:'flex', justifyContent:'flex-end' }}>
              <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:520, height:'100%', background:'var(--navy)', borderLeft:'1px solid var(--border)', display:'flex', flexDirection:'column', animation:'fadeSlideIn 0.25s ease' }}>
                <div style={{ padding:'1rem 1.1rem', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:'0.8rem' }}>
                  <div style={{ width:40, height:40, borderRadius:'50%', background:'linear-gradient(135deg, var(--purple), var(--gold))', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Outfit, sans-serif', fontWeight:800, color:'#fff', flexShrink:0 }}>
                    {histUser.full_name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.92rem', color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{histUser.full_name || 'User'}</div>
                    <div style={{ fontSize:'0.7rem', color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{histUser.email}</div>
                  </div>
                  <button onClick={close} aria-label="Close history"
                    style={{ width:30, height:30, borderRadius:'50%', background:'var(--card)', border:'1px solid var(--border)', color:'var(--muted)', cursor:'pointer' }}>{'✕'}</button>
                </div>

                <div style={{ flex:1, overflowY:'auto', padding:'1rem 1.1rem 2rem' }}>
                  {histLoading && <div style={{ textAlign:'center', color:'var(--muted)', fontSize:'0.8rem', padding:'2rem 0' }}>Loading history...</div>}
                  {histError && <div style={{ ...tile, color:'#f43f5e', fontSize:'0.78rem' }}>{histError}</div>}

                  {histData && (
                    <>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'0.5rem', marginBottom:'0.9rem' }}>
                        <div style={tile}><div style={tl}>Wallet now</div><div style={{ ...tv, color:'var(--gold)' }}>{fmt(histData.profile.wallet)}</div></div>
                        <div style={tile}><div style={tl}>Paid in (Paystack)</div><div style={tv}>{fmt(s.funded)}</div></div>
                        <div style={tile}><div style={tl}>Spent</div><div style={tv}>{fmt(s.spent)}</div></div>
                        <div style={tile}><div style={tl}>Orders</div><div style={tv}>{s.orders}</div></div>
                      </div>
                      <div style={{ fontSize:'0.68rem', color:'var(--muted)', marginBottom:'0.9rem' }}>
                        Joined {histData.profile.joined ? lagosDate(histData.profile.joined) : '-'}
                        {s.lastActive ? ' · Last activity ' + lagosDate(s.lastActive) + ', ' + lagosTime(s.lastActive) : ''}
                        {histData.profile.phone ? ' · ' + histData.profile.phone : ''}
                      </div>

                      <div style={{ display:'flex', gap:'0.4rem', marginBottom:'1rem', overflowX:'auto' }}>
                        {filters.map(f => (
                          <button key={f.id} onClick={() => setHistFilter(f.id)}
                            style={{ padding:'0.4rem 0.85rem', borderRadius:'10px', fontSize:'0.72rem', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', background: histFilter === f.id ? 'var(--purple2)' : 'var(--card)', color: histFilter === f.id ? '#fff' : 'var(--text)', border:'1px solid ' + (histFilter === f.id ? 'var(--purple2)' : 'var(--border)') }}>
                            {f.label}
                          </button>
                        ))}
                      </div>

                      {groups.length === 0 && <div style={{ ...tile, textAlign:'center', color:'var(--muted)', fontSize:'0.78rem' }}>No history yet</div>}

                      {groups.map(g => (
                        <div key={g.key} style={{ marginBottom:'1.1rem' }}>
                          <div style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'0.5rem' }}>{lagosDate(g.at)}</div>
                          <div style={{ borderLeft:'2px solid var(--border)', marginLeft:'0.9rem', paddingLeft:'1rem', display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                            {g.items.map(e => {
                              const m = meta[e.kind] || meta.log
                              return (
                                <div key={e.id} style={{ position:'relative', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', padding:'0.6rem 0.75rem' }}>
                                  <div style={{ position:'absolute', left:'-1.95rem', top:'0.55rem', width:22, height:22, borderRadius:'50%', background:'var(--navy)', border:'2px solid ' + m.color, color:m.color, fontSize:'0.65rem', display:'flex', alignItems:'center', justifyContent:'center' }}>{m.icon}</div>
                                  <div style={{ display:'flex', justifyContent:'space-between', gap:'0.6rem', alignItems:'flex-start' }}>
                                    <div style={{ minWidth:0 }}>
                                      <div style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text)', wordBreak:'break-word' }}>{e.title}</div>
                                      {e.detail && <div style={{ fontSize:'0.64rem', color:'var(--muted)', marginTop:'0.1rem', wordBreak:'break-all' }}>{e.detail}</div>}
                                    </div>
                                    {e.amount != null && (
                                      <div style={{ textAlign:'right', flexShrink:0 }}>
                                        <div style={{ fontWeight:700, fontSize:'0.82rem', color: e.sign === '+' ? '#34d399' : e.sign === '-' ? '#f43f5e' : 'var(--text)' }}>{e.sign || ''}{fmt(e.amount)}</div>
                                      </div>
                                    )}
                                  </div>
                                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:'0.35rem', fontSize:'0.62rem' }}>
                                    <span style={{ color:'var(--muted)' }}>{lagosTime(e.at)}</span>
                                    {e.status && <span style={{ fontWeight:700, color: statusColor(e.status) }}>{e.status}</span>}
                                    {!e.status && e.level && e.level !== 'info' && <span style={{ fontWeight:700, color: e.level === 'error' ? '#f43f5e' : '#f0b429' }}>{e.level}</span>}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}

                      {histData.truncated && <div style={{ fontSize:'0.66rem', color:'var(--muted)', textAlign:'center' }}>Showing the most recent records only.</div>}
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })()}

        {/* PROFIT TAB */}
        {activeTab === 'profit' && (() => {
          const fmt = (n) => '₦' + Math.round(Number(n || 0)).toLocaleString('en-NG')
          const signed = (n) => (n > 0 ? '+' : n < 0 ? '-' : '') + fmt(Math.abs(n))
          const when = (v) => v ? new Date(v).toLocaleString('en-NG', { timeZone:'Africa/Lagos', day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : 'now'
          const short = (v) => v ? new Date(v).toLocaleDateString('en-NG', { timeZone:'Africa/Lagos', day:'numeric', month:'short' }) : 'now'
          const card = { background:'var(--card)', border:'1px solid var(--border)', borderRadius:'14px', padding:'0.8rem' }
          const lbl = { fontSize:'0.58rem', color:'var(--muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }
          const good = '#34d399', bad = '#f43f5e'
          const pc = (n) => n > 0 ? good : n < 0 ? bad : 'var(--text)'
          const d = profitData
          const prov = d?.providers?.[profitProvider]
          const cur = prov?.currency === 'USD' ? '$' : '₦'
          const num = (n) => n == null ? '-' : cur + Number(n).toLocaleString('en-NG', { maximumFractionDigits: 2 })
          const inputS = { ...inputStyle, padding:'0.55rem 0.75rem' }
          const provOrder = ['fleexa','jap','exo','fivesim','smspool']
          const brand = (k) => PROVIDER_CARDS.find(x => x.key === k) || { color:'var(--purple2)', emoji:'', bg:'var(--card)' }
          const bc = brand(profitProvider)
          const wins = prov ? prov.windows : []
          const live = wins.find(w => w.open)
          const closed = wins.filter(w => !w.open)
          const chrono = wins.slice().reverse().filter(w => w.profit != null).slice(-10)
          const maxAbs = Math.max(1, ...chrono.map(w => Math.abs(w.profit)))
          const margin = prov && prov.totalRevenue > 0 ? (prov.totalProfit / prov.totalRevenue) * 100 : null
          const pill = (txt, color) => <span style={{ display:'inline-block', padding:'0.15rem 0.55rem', borderRadius:'50px', fontSize:'0.6rem', fontWeight:800, letterSpacing:'0.04em', color, background:'rgba(255,255,255,0.06)', border:'1px solid ' + color }}>{txt}</span>
          return (
          <div style={{ animation:'fadeSlideIn 0.4s ease' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
              <div>
                <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:800, fontSize:'1.05rem', color:'var(--text)' }}>Provider Profit</div>
                <div style={{ fontSize:'0.68rem', color:'var(--muted)', marginTop:'0.1rem' }}>Profit or loss on every top-up you make</div>
              </div>
              <button onClick={fetchProfit} disabled={profitLoading}
                style={{ padding:'0.45rem 0.9rem', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'10px', color:'var(--text)', fontSize:'0.72rem', fontWeight:600, cursor:'pointer' }}>
                {profitLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {profitError && <div style={{ ...card, color:bad, fontSize:'0.78rem', marginBottom:'0.75rem' }}>{profitError}</div>}
            {!d && !profitError && <div style={{ ...card, textAlign:'center', color:'var(--muted)', fontSize:'0.78rem' }}>{profitLoading ? 'Loading...' : 'No data yet'}</div>}

            {d && (
              <>
                {/* Provider picker */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(118px, 1fr))', gap:'0.5rem', marginBottom:'1rem' }}>
                  {provOrder.map(k => {
                    const pv = d.providers[k]
                    const b = brand(k)
                    const active = profitProvider === k
                    return (
                      <button key={k} onClick={() => { setProfitProvider(k); setShowFundForm(false); setFundMsg(''); setProfitLogFilter('all') }}
                        style={{ position:'relative', overflow:'hidden', textAlign:'left', padding:'0.65rem 0.7rem 0.6rem', borderRadius:'12px', cursor:'pointer', background: active ? b.bg : 'var(--card)', border:'1px solid ' + (active ? b.color : 'var(--border)'), transition:'all 0.15s' }}>
                        <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:b.color, opacity: active ? 1 : 0.35 }} />
                        <div style={{ display:'flex', alignItems:'center', gap:'0.35rem', fontSize:'0.74rem', fontWeight:700, color:'var(--text)' }}><span>{b.emoji}</span>{pv.label}</div>
                        <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:800, fontSize:'0.88rem', marginTop:'0.25rem', color: pv.windows.length ? pc(pv.totalProfit) : 'var(--muted)' }}>{pv.windows.length ? signed(pv.totalProfit) : 'No fundings'}</div>
                        <div style={{ fontSize:'0.58rem', color:'var(--muted)', marginTop:'0.05rem' }}>{pv.windows.length} {pv.windows.length === 1 ? 'funding' : 'fundings'}</div>
                      </button>
                    )
                  })}
                </div>

                {prov && (
                  <>
                    {/* Hero */}
                    <div style={{ position:'relative', overflow:'hidden', borderRadius:'18px', padding:'1.1rem 1.1rem 1rem', marginBottom:'0.9rem', background:'linear-gradient(135deg, rgba(108,78,242,0.22), rgba(240,180,41,0.08) 60%, var(--card))', border:'1px solid ' + bc.border }}>
                      <div style={{ position:'absolute', right:-40, top:-40, width:160, height:160, borderRadius:'50%', background:bc.color, opacity:0.08 }} />
                      <div style={{ display:'flex', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap', position:'relative' }}>
                        <div style={{ minWidth:180 }}>
                          <div style={lbl}>{bc.emoji} {prov.label} {'·'} all-time result</div>
                          <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:800, fontSize:'2rem', lineHeight:1.15, marginTop:'0.25rem', color: pc(prov.totalProfit) }}>{signed(prov.totalProfit)}</div>
                          <div style={{ marginTop:'0.4rem', display:'flex', gap:'0.4rem', alignItems:'center', flexWrap:'wrap' }}>
                            {wins.length > 0 && pill(prov.totalProfit >= 0 ? 'PROFIT' : 'LOSS', pc(prov.totalProfit))}
                            {margin != null && <span style={{ fontSize:'0.68rem', color:'var(--muted)' }}>{margin.toFixed(1)}% margin</span>}
                          </div>
                          <div style={{ fontSize:'0.66rem', color:'var(--muted)', marginTop:'0.5rem', lineHeight:1.5 }}>
                            Customers paid {fmt(prov.totalRevenue)} {'·'} provider used {fmt(prov.totalCost)}
                          </div>
                        </div>
                        {chrono.length > 0 && (
                          <div style={{ flex:1, minWidth:200, maxWidth:320 }}>
                            <div style={{ ...lbl, marginBottom:'0.3rem' }}>Result per funding</div>
                            <svg viewBox="0 0 200 70" width="100%" height="70" preserveAspectRatio="none" role="img" aria-label="Profit or loss for each funding">
                              <line x1="0" y1="35" x2="200" y2="35" stroke="var(--border)" strokeWidth="1" />
                              {chrono.map((w, i) => {
                                const slot = 200 / chrono.length
                                const bw = Math.min(slot * 0.62, 26)
                                const h = Math.max(2, (Math.abs(w.profit) / maxAbs) * 32)
                                const x = i * slot + (slot - bw) / 2
                                const y = w.profit >= 0 ? 35 - h : 35
                                return <rect key={w.id} x={x} y={y} width={bw} height={h} rx="2" fill={w.profit >= 0 ? good : bad} opacity={w.open ? 0.55 : 0.95} />
                              })}
                            </svg>
                            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.56rem', color:'var(--muted)' }}>
                              <span>{short(chrono[0].fundedAt)}</span><span>{chrono.length > 1 ? short(chrono[chrono.length - 1].fundedAt) : ''}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stat tiles */}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'0.5rem', marginBottom:'0.9rem' }}>
                      {[
                        { l:'Balance now', v: num(prov.liveBalance), c:'var(--gold)' },
                        { l:'Fundings', v: String(wins.length), c:'var(--text)' },
                        { l:'Best / worst', v: closed.some(w => w.profit != null) ? signed(Math.max(...closed.filter(w => w.profit != null).map(w => w.profit))) + ' / ' + signed(Math.min(...closed.filter(w => w.profit != null).map(w => w.profit))) : '-', c:'var(--text)', small:true },
                      ].map(t => (
                        <div key={t.l} style={card}>
                          <div style={lbl}>{t.l}</div>
                          <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:800, fontSize: t.small ? '0.72rem' : '1.05rem', marginTop:'0.2rem', color:t.c, wordBreak:'break-word' }}>{t.v}</div>
                        </div>
                      ))}
                    </div>

                    {/* Live funding */}
                    {live && (() => {
                      const left = live.startBalance > 0 && live.endBalance != null ? Math.max(0, Math.min(100, (live.endBalance / live.startBalance) * 100)) : null
                      const barMax = Math.max(live.revenue, live.cost || 0, 1)
                      return (
                        <div style={{ ...card, marginBottom:'0.9rem', border:'1px solid ' + bc.border, background:'linear-gradient(180deg, ' + bc.bg + ', var(--card))' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'0.6rem' }}>
                            <div>
                              <div style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
                                <span style={{ width:8, height:8, borderRadius:'50%', background:good, boxShadow:'0 0 0 4px rgba(52,211,153,0.2)' }} />
                                <span style={{ fontWeight:800, fontSize:'0.82rem', color:'var(--text)' }}>Current funding</span>
                              </div>
                              <div style={{ fontSize:'0.66rem', color:'var(--muted)', marginTop:'0.25rem' }}>Funded {num(live.amount)}{live.paidNgn ? ' (paid ' + fmt(live.paidNgn) + ')' : ''} {'·'} since {when(live.fundedAt)}</div>
                            </div>
                            <div style={{ textAlign:'right' }}>
                              <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:800, fontSize:'1.3rem', color: live.profit == null ? 'var(--muted)' : pc(live.profit) }}>{live.profit == null ? 'n/a' : signed(live.profit)}</div>
                              <div style={{ fontSize:'0.58rem', color:'var(--muted)' }}>so far</div>
                            </div>
                          </div>
                          {left != null && (
                            <div style={{ marginTop:'0.8rem' }}>
                              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.62rem', color:'var(--muted)', marginBottom:'0.25rem' }}>
                                <span>Balance left {num(live.endBalance)}</span><span>{left.toFixed(0)}% of {num(live.startBalance)}</span>
                              </div>
                              <div style={{ height:8, borderRadius:8, background:'var(--navy)', overflow:'hidden', border:'1px solid var(--border)' }}>
                                <div style={{ width:left + '%', height:'100%', borderRadius:8, background: left < 15 ? bad : left < 40 ? '#f0b429' : bc.color, transition:'width 0.4s' }} />
                              </div>
                              {left < 15 && <div style={{ fontSize:'0.62rem', color:bad, marginTop:'0.3rem', fontWeight:600 }}>Running low. Log your next top-up straight after you fund.</div>}
                            </div>
                          )}
                          <div style={{ marginTop:'0.8rem', display:'flex', flexDirection:'column', gap:'0.35rem' }}>
                            {[{ l:'Customers paid', v:live.revenue, c:good }, { l:'Provider used', v:live.cost, c:'#f0b429' }].map(r => (
                              <div key={r.l}>
                                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.64rem', color:'var(--muted)' }}><span>{r.l}</span><span style={{ color:'var(--text)', fontWeight:700 }}>{r.v == null ? '-' : fmt(r.v)}</span></div>
                                <div style={{ height:5, borderRadius:5, background:'var(--navy)', marginTop:'0.15rem' }}><div style={{ width: r.v == null ? 0 : Math.max(2, (r.v / barMax) * 100) + '%', height:'100%', borderRadius:5, background:r.c }} /></div>
                              </div>
                            ))}
                          </div>
                          <div style={{ fontSize:'0.62rem', color:'var(--muted)', marginTop:'0.55rem' }}>{live.orders} orders so far{live.beforeBalance != null ? ' · balance before top-up ' + num(live.beforeBalance) : ''}</div>
                        </div>
                      )
                    })()}

                    {!showFundForm ? (
                      <button onClick={() => { setShowFundForm(true); setFundMsg('') }}
                        style={{ width:'100%', padding:'0.75rem', marginBottom:'1rem', background:'linear-gradient(90deg, var(--purple), var(--purple2))', border:'none', borderRadius:'12px', color:'#fff', fontSize:'0.82rem', fontWeight:800, cursor:'pointer', boxShadow:'0 6px 18px rgba(108,78,242,0.3)' }}>
                        + Log a {prov.label} funding
                      </button>
                    ) : (
                      <div style={{ ...card, marginBottom:'1rem', display:'flex', flexDirection:'column', gap:'0.65rem', border:'1px solid var(--purple2)' }}>
                        <div style={{ fontWeight:800, fontSize:'0.86rem', color:'var(--text)' }}>Log a {prov.label} funding</div>
                        <div style={{ fontSize:'0.66rem', color:'var(--muted)', lineHeight:1.5 }}>Log it right after you fund, before any new orders use it, so the starting balance is correct.</div>
                        <div>
                          <div style={lbl}>Amount you funded ({prov.currency === 'USD' ? 'dollars' : 'naira'})</div>
                          <input type="number" value={fundForm.amount} onChange={e => setFundForm({ ...fundForm, amount: e.target.value })} placeholder={prov.currency === 'USD' ? 'e.g. 15' : 'e.g. 20000'} style={{ ...inputS, marginTop:'0.25rem' }} />
                        </div>
                        {prov.currency === 'USD' && (
                          <div>
                            <div style={lbl}>Naira you actually paid (optional, makes profit exact)</div>
                            <input type="number" value={fundForm.paidNgn} onChange={e => setFundForm({ ...fundForm, paidNgn: e.target.value })} placeholder={d.usdRate ? 'Blank = use rate ₦' + d.usdRate + '/$' : 'e.g. 24000'} style={{ ...inputS, marginTop:'0.25rem' }} />
                          </div>
                        )}
                        <div>
                          <div style={lbl}>Provider balance now (blank = read automatically)</div>
                          <input type="number" value={fundForm.balanceAfter} onChange={e => setFundForm({ ...fundForm, balanceAfter: e.target.value })} placeholder="Auto" style={{ ...inputS, marginTop:'0.25rem' }} />
                        </div>
                        <div>
                          <div style={lbl}>Note (optional)</div>
                          <input type="text" value={fundForm.note} onChange={e => setFundForm({ ...fundForm, note: e.target.value })} maxLength={200} style={{ ...inputS, marginTop:'0.25rem' }} />
                        </div>
                        {fundMsg && <div style={{ color:bad, fontSize:'0.74rem' }}>{fundMsg}</div>}
                        <div style={{ display:'flex', gap:'0.5rem' }}>
                          <button onClick={submitFunding} disabled={fundSaving}
                            style={{ flex:1, padding:'0.65rem', background:'var(--purple2)', border:'none', borderRadius:'10px', color:'#fff', fontSize:'0.8rem', fontWeight:800, cursor:'pointer' }}>{fundSaving ? 'Saving...' : 'Save funding'}</button>
                          <button onClick={() => { setShowFundForm(false); setFundMsg('') }}
                            style={{ padding:'0.65rem 1.1rem', background:'var(--card2)', border:'1px solid var(--border)', borderRadius:'10px', color:'var(--muted)', fontSize:'0.8rem', cursor:'pointer' }}>Cancel</button>
                        </div>
                      </div>
                    )}

                    {wins.length === 0 && (
                      <div style={{ ...card, textAlign:'center', color:'var(--muted)', fontSize:'0.78rem', padding:'1.4rem' }}>No fundings logged for {prov.label} yet. Log your next top-up to start tracking profit.</div>
                    )}

                    {/* Past fundings */}
                    {closed.length > 0 && (
                      <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.88rem', color:'var(--text)', marginBottom:'0.5rem' }}>Past fundings</div>
                    )}
                    <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
                      {closed.map(w => {
                        const known = w.profit != null
                        const col = known ? pc(w.profit) : 'var(--muted)'
                        const mx = Math.max(w.revenue, w.cost || 0, 1)
                        return (
                          <div key={w.id} style={{ ...card, position:'relative', overflow:'hidden', paddingLeft:'1rem' }}>
                            <div style={{ position:'absolute', left:0, top:0, bottom:0, width:4, background:col }} />
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'0.5rem' }}>
                              <div>
                                <div style={{ fontWeight:800, fontSize:'0.86rem', color:'var(--text)' }}>Funded {num(w.amount)}{w.paidNgn ? <span style={{ fontWeight:500, color:'var(--muted)' }}> {'·'} paid {fmt(w.paidNgn)}</span> : null}</div>
                                <div style={{ fontSize:'0.64rem', color:'var(--muted)', marginTop:'0.15rem' }}>{when(w.fundedAt)} {'→'} {when(w.endedAt)}</div>
                                {w.beforeBalance != null && <div style={{ fontSize:'0.62rem', color:'var(--muted)', marginTop:'0.1rem' }}>Balance {num(w.beforeBalance)} {'→'} {num(w.startBalance)} on top-up</div>}
                                {w.note && <div style={{ fontSize:'0.64rem', color:'var(--muted)', marginTop:'0.1rem' }}>{w.note}</div>}
                              </div>
                              <div style={{ textAlign:'right', flexShrink:0 }}>
                                <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:800, fontSize:'1.1rem', color:col }}>{known ? signed(w.profit) : 'n/a'}</div>
                                <div style={{ marginTop:'0.2rem' }}>{known ? pill((w.profit >= 0 ? 'PROFIT' : 'LOSS') + (w.marginPct != null ? ' ' + w.marginPct.toFixed(1) + '%' : ''), col) : pill('BALANCE MISSING', 'var(--muted)')}</div>
                              </div>
                            </div>
                            <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem', marginTop:'0.7rem' }}>
                              {[{ l:'Customers paid (' + w.orders + ' orders)', v:w.revenue, c:good }, { l:'Provider used', v:w.cost, c:'#f0b429' }].map(r => (
                                <div key={r.l}>
                                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.62rem', color:'var(--muted)' }}><span>{r.l}</span><span style={{ color:'var(--text)', fontWeight:700 }}>{r.v == null ? '-' : fmt(r.v)}</span></div>
                                  <div style={{ height:5, borderRadius:5, background:'var(--navy)', marginTop:'0.15rem' }}><div style={{ width: r.v == null ? 0 : Math.max(2, (r.v / mx) * 100) + '%', height:'100%', borderRadius:5, background:r.c }} /></div>
                                </div>
                              ))}
                            </div>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'0.6rem', paddingTop:'0.5rem', borderTop:'1px solid var(--border)' }}>
                              <span style={{ fontSize:'0.6rem', color:'var(--muted)' }}>Ended with {num(w.endBalance)}{w.frozen ? ' · record saved' : ''}</span>
                              <button onClick={() => deleteFunding(w.id)} style={{ background:'transparent', border:'none', color:'var(--muted)', fontSize:'0.6rem', cursor:'pointer', textDecoration:'underline' }}>Delete entry</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {live && (
                      <div style={{ textAlign:'right', marginTop:'0.4rem' }}>
                        <button onClick={() => deleteFunding(live.id)} style={{ background:'transparent', border:'none', color:'var(--muted)', fontSize:'0.6rem', cursor:'pointer', textDecoration:'underline' }}>Delete current funding entry</button>
                      </div>
                    )}

                    {prov.events && prov.events.length > 0 && (() => {
                      const evs = prov.events.filter(e => profitLogFilter === 'all' || e.type === profitLogFilter)
                      const dayKey = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone:'Africa/Lagos' })
                      const dayLab = (iso) => new Date(iso).toLocaleDateString('en-NG', { timeZone:'Africa/Lagos', weekday:'long', day:'numeric', month:'long', year:'numeric' })
                      const tm = (iso) => new Date(iso).toLocaleTimeString('en-NG', { timeZone:'Africa/Lagos', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true })
                      const groups = []
                      for (const e of evs) {
                        const k = dayKey(e.at)
                        if (!groups.length || groups[groups.length - 1].key !== k) groups.push({ key:k, at:e.at, items:[] })
                        groups[groups.length - 1].items.push(e)
                      }
                      const mt = {
                        funding: { icon:'↑', color:'#a78bfa' },
                        closed:  { icon:'✓', color:'#34d399' },
                        orders:  { icon:'▣', color:'#60a5fa' },
                        balance: { icon:'•', color:'var(--muted)' },
                      }
                      const lf = [
                        { id:'all', label:'All' }, { id:'funding', label:'Fundings' }, { id:'closed', label:'Results' },
                        { id:'orders', label:'Orders' }, { id:'balance', label:'Balance' },
                      ]
                      return (
                        <div style={{ marginTop:'1.4rem' }}>
                          <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.88rem', color:'var(--text)', marginBottom:'0.15rem' }}>{prov.label} log</div>
                          <div style={{ fontSize:'0.66rem', color:'var(--muted)', marginBottom:'0.7rem' }}>Every funding, result, day of orders and balance change, with Lagos time stamps.</div>
                          <div style={{ display:'flex', gap:'0.4rem', marginBottom:'0.9rem', overflowX:'auto' }}>
                            {lf.map(f => (
                              <button key={f.id} onClick={() => setProfitLogFilter(f.id)}
                                style={{ padding:'0.38rem 0.8rem', borderRadius:'10px', fontSize:'0.7rem', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', background: profitLogFilter === f.id ? 'var(--purple2)' : 'var(--card)', color: profitLogFilter === f.id ? '#fff' : 'var(--text)', border:'1px solid ' + (profitLogFilter === f.id ? 'var(--purple2)' : 'var(--border)') }}>{f.label}</button>
                            ))}
                          </div>
                          {groups.length === 0 && <div style={{ ...card, textAlign:'center', color:'var(--muted)', fontSize:'0.76rem' }}>Nothing here yet</div>}
                          {groups.map(g => (
                            <div key={g.key} style={{ marginBottom:'1rem' }}>
                              <div style={{ fontSize:'0.66rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'0.45rem' }}>{dayLab(g.at)}</div>
                              <div style={{ borderLeft:'2px solid var(--border)', marginLeft:'0.9rem', paddingLeft:'1rem', display:'flex', flexDirection:'column', gap:'0.45rem' }}>
                                {g.items.map(e => {
                                  const m = mt[e.type] || mt.balance
                                  const dot = e.type === 'closed' ? (e.profit >= 0 ? good : bad) : m.color
                                  return (
                                    <div key={e.id} style={{ position:'relative', ...card, padding:'0.55rem 0.7rem' }}>
                                      <div style={{ position:'absolute', left:'-1.95rem', top:'0.5rem', width:22, height:22, borderRadius:'50%', background:'var(--navy)', border:'2px solid ' + dot, color:dot, fontSize:'0.65rem', display:'flex', alignItems:'center', justifyContent:'center' }}>{m.icon}</div>
                                      {e.type === 'funding' && (
                                        <>
                                          <div style={{ display:'flex', justifyContent:'space-between', gap:'0.5rem' }}>
                                            <div style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--text)' }}>Funding logged: {num(e.amount)}</div>
                                            {e.paidNgn ? <div style={{ fontSize:'0.7rem', color:'var(--muted)' }}>paid {fmt(e.paidNgn)}</div> : null}
                                          </div>
                                          <div style={{ fontSize:'0.66rem', color:'var(--muted)', marginTop:'0.15rem' }}>
                                            Balance {num(e.beforeBalance)} {'→'} {num(e.afterBalance)}
                                            {e.carried != null ? ' · carried over ' + num(e.carried) + ' from the previous funding' : ''}
                                            {e.rate ? ' · rate ' + fmt(e.rate) + '/$' : ''}
                                          </div>
                                          {e.note && <div style={{ fontSize:'0.64rem', color:'var(--muted)', marginTop:'0.1rem' }}>{e.note}</div>}
                                        </>
                                      )}
                                      {e.type === 'closed' && (
                                        <>
                                          <div style={{ display:'flex', justifyContent:'space-between', gap:'0.5rem' }}>
                                            <div style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--text)' }}>Funding closed: {e.profit >= 0 ? 'profit' : 'loss'}</div>
                                            <div style={{ fontSize:'0.82rem', fontWeight:800, color: pc(e.profit) }}>{signed(e.profit)}{e.marginPct != null ? ' (' + e.marginPct.toFixed(1) + '%)' : ''}</div>
                                          </div>
                                          <div style={{ fontSize:'0.66rem', color:'var(--muted)', marginTop:'0.15rem' }}>
                                            Funded {when(e.fundedAt)} {'·'} {e.orders} orders {'·'} customers paid {fmt(e.revenue)} {'·'} provider used {fmt(e.cost)} {'·'} ended with {num(e.endBalance)}
                                          </div>
                                        </>
                                      )}
                                      {e.type === 'orders' && (
                                        <div style={{ display:'flex', justifyContent:'space-between', gap:'0.5rem' }}>
                                          <div style={{ fontSize:'0.76rem', fontWeight:600, color:'var(--text)' }}>{e.orders} {e.orders === 1 ? 'order' : 'orders'} completed that day</div>
                                          <div style={{ fontSize:'0.76rem', fontWeight:700, color:'var(--text)' }}>{fmt(e.revenue)}</div>
                                        </div>
                                      )}
                                      {e.type === 'balance' && (
                                        <div style={{ display:'flex', justifyContent:'space-between', gap:'0.5rem' }}>
                                          <div style={{ fontSize:'0.74rem', color:'var(--text)' }}>Balance checked: {num(e.balance)}</div>
                                          {e.change != null && <div style={{ fontSize:'0.72rem', fontWeight:700, color: e.change >= 0 ? good : bad }}>{e.change >= 0 ? '+' : '-'}{num(Math.abs(e.change))}</div>}
                                        </div>
                                      )}
                                      <div style={{ fontSize:'0.6rem', color:'var(--muted)', marginTop:'0.3rem' }}>{tm(e.at)}</div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })()}


                    <div style={{ fontSize:'0.64rem', color:'var(--muted)', marginTop:'0.9rem', lineHeight:1.5 }}>
                      Profit = what customers paid for this provider's completed orders, minus the provider balance used, between one funding and the next. A cancelled or refunded order counts as nothing on both sides.
                    </div>
                  </>
                )}
              </>
            )}
          </div>
          )
        })()}

        {/* PAYSTACK TAB */}
        {activeTab === 'paystack' && (() => {
          const fmt = (n) => '₦' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })
          const when = (v) => v ? new Date(v).toLocaleString('en-NG', { timeZone:'Africa/Lagos', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '-'
          const dayLabel = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-NG', { timeZone:'Africa/Lagos', weekday:'short', day:'numeric', month:'short', year:'numeric' })
          const statusColor = (s) => s === 'success' ? '#34d399' : (s === 'failed' || s === 'abandoned' || s === 'reversed') ? '#f43f5e' : '#f0b429'
          const d = psData
          const errs = d?.errors || {}
          const card = { background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', padding:'0.75rem' }
          const lbl = { fontSize:'0.58rem', color:'var(--muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em' }
          const val = { fontFamily:'Outfit, sans-serif', fontWeight:800, fontSize:'1.05rem', color:'var(--text)', marginTop:'0.15rem' }
          const empty = (t) => <div style={{ ...card, textAlign:'center', color:'var(--muted)', fontSize:'0.78rem' }}>{t}</div>
          const secErr = (k) => errs[k] ? <div style={{ ...card, color:'#f43f5e', fontSize:'0.74rem', marginBottom:'0.5rem' }}>Paystack: {errs[k]}</div> : null
          const views = [
            { id:'transactions', label:'Transactions' },
            { id:'payouts',      label:'Payouts' },
            { id:'pending',      label:'Pending' },
            { id:'daily',        label:'Daily payers' },
          ]
          return (
          <div style={{ animation:'fadeSlideIn 0.4s ease' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
              <div>
                <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.92rem', color:'var(--text)' }}>Paystack</div>
                <div style={{ fontSize:'0.68rem', color:'var(--muted)', marginTop:'0.1rem' }}>
                  {d?.fetchedAt ? 'Updated ' + new Date(d.fetchedAt).toLocaleTimeString('en-NG', { hour:'2-digit', minute:'2-digit', second:'2-digit' }) : 'Payments, payouts and who paid in'}
                </div>
              </div>
              <button onClick={fetchPaystack} disabled={psLoading}
                style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.45rem 0.9rem', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'10px', color:'var(--text)', fontSize:'0.72rem', fontWeight:600, cursor:'pointer' }}>
                {psLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {psError && <div style={{ ...card, color:'#f43f5e', fontSize:'0.78rem', marginBottom:'0.75rem' }}>{psError}</div>}
            {!d && !psError && empty(psLoading ? 'Loading Paystack data...' : 'No data yet')}

            {d && (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'0.5rem', marginBottom:'0.75rem' }}>
                  <div style={card}><div style={lbl}>Available balance</div><div style={val}>{d.balance == null ? '-' : fmt(d.balance)}</div></div>
                  <div style={card}><div style={lbl}>Pending payout</div><div style={val}>{fmt(d.pendingTotal)}</div></div>
                  <div style={card}><div style={lbl}>Not credited</div><div style={{ ...val, color: d.notCredited?.length ? '#f43f5e' : '#34d399' }}>{d.notCredited?.length || 0}</div></div>
                </div>
                {secErr('balance')}

                {d.notCredited?.length > 0 && (
                  <div style={{ ...card, border:'1px solid #f43f5e', marginBottom:'0.75rem' }}>
                    <div style={{ fontWeight:700, fontSize:'0.78rem', color:'#f43f5e', marginBottom:'0.35rem' }}>Paid on Paystack but not found in wallet credits</div>
                    {d.notCredited.map(t => (
                      <div key={t.id} style={{ fontSize:'0.72rem', color:'var(--text)', display:'flex', justifyContent:'space-between', gap:'0.5rem', padding:'0.2rem 0' }}>
                        <span style={{ overflow:'hidden', textOverflow:'ellipsis' }}>{t.email || t.reference}</span>
                        <span style={{ whiteSpace:'nowrap' }}>{fmt(t.amount)} · {when(t.paidAt)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display:'flex', gap:'0.4rem', marginBottom:'0.75rem', overflowX:'auto' }}>
                  {views.map(v => (
                    <button key={v.id} onClick={() => setPsView(v.id)}
                      style={{ padding:'0.4rem 0.8rem', borderRadius:'10px', fontSize:'0.72rem', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', background: psView === v.id ? 'var(--purple2)' : 'var(--card)', color: psView === v.id ? '#fff' : 'var(--text)', border:'1px solid ' + (psView === v.id ? 'var(--purple2)' : 'var(--border)') }}>
                      {v.label}
                    </button>
                  ))}
                </div>

                {psView === 'transactions' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
                    {secErr('transactions')}
                    {d.transactions.length === 0 && empty('No transactions')}
                    {d.transactions.map(t => (
                      <div key={t.id} style={{ ...card, display:'flex', justifyContent:'space-between', alignItems:'center', gap:'0.5rem' }}>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.email || t.reference}</div>
                          <div style={{ fontSize:'0.64rem', color:'var(--muted)' }}>{when(t.paidAt)} · {t.channel || '-'}</div>
                        </div>
                        <div style={{ textAlign:'right', flexShrink:0 }}>
                          <div style={{ fontWeight:700, fontSize:'0.82rem', color:'var(--text)' }}>{fmt(t.amount)}</div>
                          <div style={{ fontSize:'0.62rem', fontWeight:700, color: statusColor(t.status) }}>
                            {t.status}{t.status === 'success' ? (t.credited ? ' · credited' : ' · NOT credited') : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {(psView === 'payouts' || psView === 'pending') && (() => {
                  const list = psView === 'payouts' ? d.payouts : d.pendingPayouts
                  return (
                    <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
                      {secErr(psView === 'payouts' ? 'payouts' : 'pendingPayouts')}
                      {list.length === 0 && empty(psView === 'payouts' ? 'No payouts yet' : 'No pending payouts')}
                      {list.map(s => (
                        <div key={s.id} style={{ ...card, display:'flex', justifyContent:'space-between', alignItems:'center', gap:'0.5rem' }}>
                          <div>
                            <div style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text)' }}>{dayLabel(String(s.date).slice(0, 10))}</div>
                            <div style={{ fontSize:'0.64rem', color:'var(--muted)' }}>Processed {fmt(s.processed)} · fees {fmt(s.fees)}</div>
                          </div>
                          <div style={{ textAlign:'right' }}>
                            <div style={{ fontWeight:700, fontSize:'0.82rem', color:'var(--text)' }}>{fmt(s.effective)}</div>
                            <div style={{ fontSize:'0.62rem', fontWeight:700, color: statusColor(s.status) }}>{s.status}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}

                {psView === 'daily' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
                    {secErr('daily')}
                    {d.daily.length === 0 && empty('No payments yet')}
                    {d.daily.map(day => (
                      <div key={day.date} style={card}>
                        <div onClick={() => setPsOpenDay(psOpenDay === day.date ? null : day.date)}
                          style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}>
                          <div>
                            <div style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text)' }}>{dayLabel(day.date)}</div>
                            <div style={{ fontSize:'0.64rem', color:'var(--muted)' }}>{day.payers} {day.payers === 1 ? 'user' : 'users'} · {day.count} {day.count === 1 ? 'payment' : 'payments'}</div>
                          </div>
                          <div style={{ fontWeight:700, fontSize:'0.85rem', color:'var(--text)' }}>{fmt(day.total)}</div>
                        </div>
                        {psOpenDay === day.date && (
                          <div style={{ marginTop:'0.5rem', borderTop:'1px solid var(--border)', paddingTop:'0.4rem' }}>
                            {day.users.map((u, i) => (
                              <div key={i} style={{ display:'flex', justifyContent:'space-between', gap:'0.5rem', fontSize:'0.72rem', color:'var(--text)', padding:'0.15rem 0' }}>
                                <span style={{ overflow:'hidden', textOverflow:'ellipsis' }}>{u.email}</span>
                                <span style={{ whiteSpace:'nowrap' }}>{fmt(u.total)}{u.count > 1 ? ' (' + u.count + 'x)' : ''}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          )
        })()}

        {/* LOGS TAB */}
        {activeTab === 'logs' && (
          <div style={{ animation:'fadeSlideIn 0.4s ease' }}>

            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
              <div>
                <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.92rem', color:'var(--text)' }}>Activity Logs</div>
                <div style={{ fontSize:'0.68rem', color:'var(--muted)', marginTop:'0.1rem' }}>
                  {logsLastFetched ? `Updated ${logsLastFetched.toLocaleTimeString('en-NG', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}` : 'Last 200 events'}
                </div>
              </div>
              <button onClick={fetchLogs} disabled={logsLoading}
                style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.45rem 0.9rem', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'10px', color:'var(--text)', fontSize:'0.72rem', fontWeight:600, cursor:'pointer' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ animation: logsLoading ? 'spin 0.8s linear infinite' : 'none' }}>
                  <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                {logsLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {/* Quick stats */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'0.5rem', marginBottom:'1rem' }}>
              {[
                { label:'Errors',   count: logs.filter(l=>l.level==='error').length,   color:'#f43f5e', bg:'rgba(244,63,94,0.08)'  },
                { label:'Warnings', count: logs.filter(l=>l.level==='warning').length, color:'#f0b429', bg:'rgba(240,180,41,0.08)' },
                { label:'Info',     count: logs.filter(l=>l.level==='info').length,    color:'#34d399', bg:'rgba(52,211,153,0.08)' },
                { label:'Auth',     count: logs.filter(l=>l.level==='auth').length,    color:'var(--purple2)', bg:'rgba(108,78,242,0.08)' },
              ].map(s => (
                <div key={s.label} onClick={() => setLogLevelFilter(s.label.toLowerCase())}
                  style={{ background: logLevelFilter === s.label.toLowerCase() ? s.bg : 'var(--card)', border:`1px solid ${logLevelFilter === s.label.toLowerCase() ? s.color : 'var(--border)'}`, borderRadius:'12px', padding:'0.65rem 0.5rem', textAlign:'center', cursor:'pointer', transition:'all 0.15s' }}>
                  <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:800, fontSize:'1.1rem', color: s.color }}>{s.count}</div>
                  <div style={{ fontSize:'0.58rem', color:'var(--muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Filters row */}
            <div style={{ display:'flex', gap:'0.5rem', marginBottom:'0.9rem', flexWrap:'wrap' }}>
              <select value={logLevelFilter} onChange={e => setLogLevelFilter(e.target.value)}
                style={{ flex:1, minWidth:100, padding:'0.45rem 0.7rem', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'8px', color:'var(--text)', fontSize:'0.72rem', outline:'none' }}>
                <option value="all">All Levels</option>
                <option value="error">🔴 Error</option>
                <option value="warning">🟡 Warning</option>
                <option value="info">🟢 Info</option>
                <option value="auth">🔵 Auth</option>
                <option value="admin">⚪ Admin</option>
              </select>
              <select value={logCategoryFilter} onChange={e => setLogCategoryFilter(e.target.value)}
                style={{ flex:1, minWidth:100, padding:'0.45rem 0.7rem', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'8px', color:'var(--text)', fontSize:'0.72rem', outline:'none' }}>
                <option value="all">All Categories</option>
                <option value="number">📱 Numbers</option>
                <option value="rent">🗓️ Rent Numbers</option>
                <option value="boost">📣 Boost</option>
                <option value="vpn">🔒 VPN</option>
                <option value="wallet">💰 Wallet</option>
                <option value="auth">🔑 Auth</option>
                <option value="admin">🛡️ Admin</option>
                <option value="system">⚙️ System</option>
              </select>
              <input value={logSearch} onChange={e => setLogSearch(e.target.value)}
                placeholder="Search user or message..."
                style={{ flex:2, minWidth:140, padding:'0.45rem 0.7rem', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'8px', color:'var(--text)', fontSize:'0.72rem', outline:'none' }} />
            </div>

            {/* Log entries */}
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              {logsLoading ? (
                [1,2,3,4,5].map(i => (
                  <div key={i} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'14px', padding:'1rem', animation:'shimmer 1.2s ease infinite' }}>
                    <div style={{ height:12, width:'60%', background:'var(--border)', borderRadius:6, marginBottom:'0.5rem' }} />
                    <div style={{ height:10, width:'40%', background:'var(--border)', borderRadius:6 }} />
                  </div>
                ))
              ) : (() => {
                const filtered = logs.filter(l => {
                  if (logLevelFilter !== 'all' && l.level !== logLevelFilter) return false
                  if (logCategoryFilter === 'rent') {
                    if (l.context?.feature !== 'rent_numbers') return false
                  } else if (logCategoryFilter !== 'all' && l.category !== logCategoryFilter) {
                    return false
                  }
                  if (logSearch) {
                    const q = logSearch.toLowerCase()
                    return (l.message || '').toLowerCase().includes(q) ||
                      (l.user_email || '').toLowerCase().includes(q)
                  }
                  return true
                })

                if (filtered.length === 0) return (
                  <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'14px', padding:'2.5rem', textAlign:'center', color:'var(--muted)', fontSize:'0.82rem' }}>
                    No logs match your filters
                  </div>
                )

                const levelStyle = (level) => {
                  if (level === 'error')   return { bg:'rgba(244,63,94,0.1)',   color:'#f43f5e', dot:'#f43f5e',       label:'ERROR'   }
                  if (level === 'warning') return { bg:'rgba(240,180,41,0.1)', color:'#f0b429', dot:'#f0b429',       label:'WARN'    }
                  if (level === 'info')    return { bg:'rgba(52,211,153,0.1)', color:'#34d399', dot:'#34d399',       label:'INFO'    }
                  if (level === 'auth')    return { bg:'rgba(108,78,242,0.1)', color:'var(--purple2)', dot:'var(--purple2)', label:'AUTH' }
                  if (level === 'admin')   return { bg:'rgba(200,200,200,0.1)',color:'var(--muted)', dot:'var(--muted)',   label:'ADMIN'  }
                  return { bg:'var(--card2)', color:'var(--muted)', dot:'var(--muted)', label:'LOG' }
                }

                const categoryEmoji = (cat) => {
                  if (cat === 'number') return '📱'
                  if (cat === 'boost')  return '📣'
                  if (cat === 'vpn')    return '🔒'
                  if (cat === 'wallet') return '💰'
                  if (cat === 'auth')   return '🔑'
                  if (cat === 'admin')  return '🛡️'
                  return '⚙️'
                }

                return filtered.map((entry) => {
                  const ls = levelStyle(entry.level)
                  const isExpanded = expandedLog === entry.id
                  return (
                    <div key={entry.id}
                      style={{ background:'var(--card)', border:`1px solid ${entry.level === 'error' ? 'rgba(244,63,94,0.25)' : entry.level === 'warning' ? 'rgba(240,180,41,0.2)' : 'var(--border)'}`, borderRadius:'14px', overflow:'hidden' }}>
                      <div onClick={() => setExpandedLog(isExpanded ? null : entry.id)}
                        style={{ padding:'0.85rem 1rem', cursor:'pointer', display:'flex', alignItems:'flex-start', gap:'0.7rem' }}>
                        {/* Level dot */}
                        <div style={{ width:8, height:8, borderRadius:'50%', background: ls.dot, flexShrink:0, marginTop:'0.35rem',
                          boxShadow: entry.level === 'error' ? `0 0 6px ${ls.dot}` : 'none' }} />
                        <div style={{ flex:1, minWidth:0 }}>
                          {/* Top row */}
                          <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.25rem', flexWrap:'wrap' }}>
                            <span style={{ padding:'0.1rem 0.4rem', borderRadius:'50px', background: ls.bg, color: ls.color, fontSize:'0.58rem', fontWeight:800, letterSpacing:'0.05em' }}>{ls.label}</span>
                            <span style={{ fontSize:'0.65rem', color:'var(--muted)' }}>{categoryEmoji(entry.category)} {entry.category}</span>
                            {entry.context?.feature === 'rent_numbers' && (
                              <span style={{ padding:'0.1rem 0.4rem', borderRadius:'50px', background:'rgba(108,78,242,0.12)', color:'var(--purple2)', fontSize:'0.58rem', fontWeight:700 }}>🗓️ Rent</span>
                            )}
                            <span style={{ fontSize:'0.62rem', color:'var(--muted)', marginLeft:'auto', flexShrink:0 }}>
                              {new Date(entry.created_at).toLocaleString('en-NG', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' })}
                            </span>
                          </div>
                          {/* Message */}
                          <div style={{ fontSize:'0.78rem', color:'var(--text)', fontWeight:500, lineHeight:1.4 }}>{entry.message}</div>
                          {/* User */}
                          {entry.user_email && (
                            <div style={{ fontSize:'0.67rem', color:'var(--muted)', marginTop:'0.2rem' }}>👤 {entry.user_email}</div>
                          )}
                        </div>
                        {/* Expand chevron */}
                        {entry.context && Object.keys(entry.context).length > 0 && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0, transition:'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', marginTop:'0.2rem' }}>
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                        )}
                      </div>
                      {/* Expanded context */}
                      {isExpanded && entry.context && Object.keys(entry.context).length > 0 && (
                        <div style={{ borderTop:'1px solid var(--border)', padding:'0.75rem 1rem', background:'var(--navy)' }}>
                          <div style={{ fontSize:'0.62rem', color:'var(--muted)', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:'0.4rem' }}>Context</div>
                          <pre style={{ fontSize:'0.68rem', color:'var(--purple2)', background:'rgba(108,78,242,0.06)', border:'1px solid rgba(108,78,242,0.15)', borderRadius:'8px', padding:'0.7rem', overflowX:'auto', margin:0, lineHeight:1.6, whiteSpace:'pre-wrap', wordBreak:'break-all' }}>
                            {JSON.stringify(entry.context, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )
                })
              })()}
            </div>

            {logs.length === 0 && !logsLoading && (
              <div style={{ marginTop:'1rem', padding:'2rem', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'16px', textAlign:'center', color:'var(--muted)', fontSize:'0.82rem' }}>
                No logs yet — they'll appear here as users interact with MegaDen.
              </div>
            )}
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div style={{ animation:'fadeSlideIn 0.4s ease' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
              <div>
                <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.92rem', color:'var(--text)' }}>App Settings</div>
                <div style={{ fontSize:'0.7rem', color:'var(--muted)', marginTop:'0.1rem' }}>Control number pricing and app behaviour</div>
              </div>
              <button className="action-btn" onClick={saveSettings} disabled={savingSettings}
                style={{ padding:'0.5rem 1rem', background: settingsSaved ? 'rgba(29,158,117,0.2)' : 'var(--purple)', border:`1px solid ${settingsSaved ? 'rgba(29,158,117,0.4)' : 'transparent'}`, borderRadius:'10px', color: settingsSaved ? '#34d399' : '#fff', fontSize:'0.78rem', fontWeight:700, fontFamily:'Outfit, sans-serif', minWidth:80 }}>
                {savingSettings ? 'Saving...' : settingsSaved ? '✓ Saved' : 'Save'}
              </button>
            </div>

            {settingsError && (
              <div style={{ padding:'0.75rem 1rem', marginBottom:'1rem', background:'rgba(244,63,94,0.08)', border:'1px solid rgba(244,63,94,0.25)', borderRadius:'10px', color:'#f43f5e', fontSize:'0.78rem' }}>
                ⚠️ {settingsError}
              </div>
            )}

            {/* Bills page broadcast */}
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'16px', padding:'1.2rem', marginBottom:'1rem' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.3rem' }}>
                <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.85rem', color:'var(--text)' }}>Top-Up & Bills Broadcast</div>
                <button
                  onClick={() => setEditedSettings(s => ({ ...s, bills_broadcast_enabled: s.bills_broadcast_enabled === 'true' ? 'false' : 'true' }))}
                  style={{
                    width: 44, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', position: 'relative',
                    background: editedSettings.bills_broadcast_enabled === 'true' ? 'var(--purple)' : 'var(--navy)',
                    transition: 'background 0.2s', flexShrink: 0,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 3, left: editedSettings.bills_broadcast_enabled === 'true' ? 23 : 3,
                    width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
                  }} />
                </button>
              </div>
              <div style={{ fontSize:'0.72rem', color:'var(--muted)', marginBottom:'0.9rem' }}>
                When on, this message shows as a banner at the top of the Top-Up & Bills page for every user — use it for outage notices (e.g. "Cable TV & Education temporarily unavailable").
              </div>
              <textarea
                value={editedSettings.bills_broadcast_message}
                onChange={e => setEditedSettings(s => ({ ...s, bills_broadcast_message: e.target.value }))}
                placeholder="e.g. Cable TV and Education pins are temporarily unavailable while we resolve a provider issue. Airtime and Data are working normally."
                rows={3}
                style={{
                  width: '100%', padding: '0.7rem 0.9rem', background: 'var(--navy)', border: '1px solid var(--border)',
                  borderRadius: '10px', color: 'var(--text)', fontSize: '0.82rem', fontFamily: 'Inter, sans-serif',
                  outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                }}
              />
              {settings.bills_broadcast_enabled === 'true' && settings.bills_broadcast_message && (
                <div style={{ fontSize:'0.68rem', color:'var(--muted)', marginTop:'0.5rem' }}>
                  Currently live: "{settings.bills_broadcast_message}"
                </div>
              )}
            </div>

            {/* Standard Boost broadcast */}
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'16px', padding:'1.2rem', marginBottom:'1rem' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.3rem' }}>
                <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.85rem', color:'var(--text)' }}>Standard Boost Broadcast</div>
                <button
                  onClick={() => setEditedSettings(s => ({ ...s, boost_broadcast_enabled: s.boost_broadcast_enabled === 'true' ? 'false' : 'true' }))}
                  style={{
                    width: 44, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', position: 'relative',
                    background: editedSettings.boost_broadcast_enabled === 'true' ? 'var(--purple)' : 'var(--navy)',
                    transition: 'background 0.2s', flexShrink: 0,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 3, left: editedSettings.boost_broadcast_enabled === 'true' ? 23 : 3,
                    width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
                  }} />
                </button>
              </div>
              <div style={{ fontSize:'0.72rem', color:'var(--muted)', marginBottom:'0.9rem' }}>
                When on, this message shows as a banner at the top of the Social Boosting page for every user — use it for outage notices (e.g. "Standard Boost is temporarily unavailable while we carry out repairs").
              </div>
              <textarea
                value={editedSettings.boost_broadcast_message}
                onChange={e => setEditedSettings(s => ({ ...s, boost_broadcast_message: e.target.value }))}
                placeholder="e.g. Standard Boost is currently undergoing repair and is temporarily unavailable. Turbo Boost is working normally."
                rows={3}
                style={{
                  width: '100%', padding: '0.7rem 0.9rem', background: 'var(--navy)', border: '1px solid var(--border)',
                  borderRadius: '10px', color: 'var(--text)', fontSize: '0.82rem', fontFamily: 'Inter, sans-serif',
                  outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                }}
              />
              {settings.boost_broadcast_enabled === 'true' && settings.boost_broadcast_message && (
                <div style={{ fontSize:'0.68rem', color:'var(--muted)', marginTop:'0.5rem' }}>
                  Currently live: "{settings.boost_broadcast_message}"
                </div>
              )}
            </div>

            {/* Number pricing */}
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'16px', padding:'1.2rem', marginBottom:'1rem' }}>
              <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.85rem', color:'var(--text)', marginBottom:'0.3rem' }}>Virtual Number Pricing</div>
              <div style={{ fontSize:'0.72rem', color:'var(--muted)', marginBottom:'1rem' }}>
                Final price = 5sim USD price × Exchange Rate × Markup. Adjust to control your margins.
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.8rem' }}>
                <div>
                  <label style={{ fontSize:'0.72rem', color:'var(--muted)', display:'block', marginBottom:'0.3rem' }}>USD → NGN Exchange Rate</label>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                    <input type="number" value={editedSettings.usd_to_ngn_rate}
                      onChange={e => setEditedSettings(s => ({ ...s, usd_to_ngn_rate: e.target.value }))}
                      style={{ flex:1, padding:'0.7rem 0.9rem', background:'var(--navy)', border:'1px solid var(--border)', borderRadius:'10px', color:'var(--gold)', fontSize:'1rem', fontWeight:700, fontFamily:'Outfit, sans-serif', outline:'none' }} />
                    <span style={{ fontSize:'0.75rem', color:'var(--muted)', whiteSpace:'nowrap' }}>NGN per $1</span>
                  </div>
                  <div style={{ fontSize:'0.68rem', color:'var(--muted)', marginTop:'0.3rem' }}>Current: ₦{Number(settings.usd_to_ngn_rate).toLocaleString()} per $1</div>
                </div>
                <div>
                  <label style={{ fontSize:'0.72rem', color:'var(--muted)', display:'block', marginBottom:'0.3rem' }}>Markup Multiplier</label>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                    <input type="number" step="0.1" value={editedSettings.markup_multiplier}
                      onChange={e => setEditedSettings(s => ({ ...s, markup_multiplier: e.target.value }))}
                      style={{ flex:1, padding:'0.7rem 0.9rem', background:'var(--navy)', border:'1px solid var(--border)', borderRadius:'10px', color:'var(--gold)', fontSize:'1rem', fontWeight:700, fontFamily:'Outfit, sans-serif', outline:'none' }} />
                    <span style={{ fontSize:'0.75rem', color:'var(--muted)', whiteSpace:'nowrap' }}>× multiplier</span>
                  </div>
                  <div style={{ fontSize:'0.68rem', color:'var(--muted)', marginTop:'0.3rem' }}>Current: {settings.markup_multiplier}× markup</div>
                </div>
              </div>

              {/* Live preview */}
              <div style={{ marginTop:'1rem', padding:'0.8rem', background:'rgba(108,78,242,0.06)', border:'1px solid rgba(108,78,242,0.15)', borderRadius:'10px' }}>
                <div style={{ fontSize:'0.72rem', color:'var(--muted)', marginBottom:'0.3rem' }}>Price Preview (example: $0.15 number)</div>
                <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'1.1rem', color:'var(--gold)' }}>
                  ₦{Math.ceil(0.15 * Number(editedSettings.usd_to_ngn_rate) * Number(editedSettings.markup_multiplier)).toLocaleString()}
                </div>
                <div style={{ fontSize:'0.68rem', color:'var(--muted)', marginTop:'0.1rem' }}>$0.15 × {editedSettings.usd_to_ngn_rate} × {editedSettings.markup_multiplier}</div>
              </div>
            </div>

            <div style={{ padding:'0.9rem', background:'rgba(108,78,242,0.06)', border:'1px solid rgba(108,78,242,0.2)', borderRadius:'12px', fontSize:'0.75rem', color:'var(--muted)', lineHeight:1.6 }}>
              💡 <strong style={{ color:'var(--text)' }}>How it works:</strong> Settings are saved to Supabase <code style={{ background:'var(--card2)', padding:'0.1rem 0.3rem', borderRadius:'4px' }}>app_settings</code> table and read live by your number buy route. Changes apply immediately — no redeployment needed.
            </div>

            {/* Fleexa markup */}
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'16px', padding:'1.2rem', marginTop:'1rem', marginBottom:'1rem' }}>
              <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.85rem', color:'var(--text)', marginBottom:'0.3rem' }}>Fleexa Pricing (OTP, Rent Numbers, Email OTP, Proxies & eSIM)</div>
              <div style={{ fontSize:'0.72rem', color:'var(--muted)', marginBottom:'1rem' }}>
                Fleexa's own price_ngn is your wholesale cost, not a retail price — these settings control your margin on top of it.
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.8rem' }}>
                <div>
                  <label style={{ fontSize:'0.72rem', color:'var(--muted)', display:'block', marginBottom:'0.3rem' }}>Flat Markup — SMS OTP 4/5 (no retail price to compare against)</label>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                    <input type="number" step="1" value={editedSettings.fleexa_markup_percent}
                      onChange={e => setEditedSettings(s => ({ ...s, fleexa_markup_percent: e.target.value }))}
                      style={{ flex:1, padding:'0.7rem 0.9rem', background:'var(--navy)', border:'1px solid var(--border)', borderRadius:'10px', color:'var(--gold)', fontSize:'1rem', fontWeight:700, fontFamily:'Outfit, sans-serif', outline:'none' }} />
                    <span style={{ fontSize:'0.75rem', color:'var(--muted)', whiteSpace:'nowrap' }}>% over cost</span>
                  </div>
                  <div style={{ fontSize:'0.68rem', color:'var(--muted)', marginTop:'0.3rem' }}>Current: +{settings.fleexa_markup_percent}% over Fleexa's wholesale price_ngn</div>
                </div>
                <div>
                  <label style={{ fontSize:'0.72rem', color:'var(--muted)', display:'block', marginBottom:'0.3rem' }}>Flat Markup — SMS OTP 6 (multi-country). Leave blank to follow the SMS OTP 4/5 markup</label>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                    <input type="number" step="1" min="0" placeholder={`Following SMS OTP 4/5: +${editedSettings.fleexa_markup_percent}%`} value={editedSettings.fleexa_sms6_markup_percent ?? ''}
                      onChange={e => setEditedSettings(s => ({ ...s, fleexa_sms6_markup_percent: e.target.value }))}
                      style={{ flex:1, padding:'0.7rem 0.9rem', background:'var(--navy)', border:'1px solid var(--border)', borderRadius:'10px', color:'var(--gold)', fontSize:'1rem', fontWeight:700, fontFamily:'Outfit, sans-serif', outline:'none' }} />
                    <span style={{ fontSize:'0.75rem', color:'var(--muted)', whiteSpace:'nowrap' }}>% over cost</span>
                  </div>
                  <div style={{ fontSize:'0.68rem', color:'var(--muted)', marginTop:'0.3rem' }}>
                    Effective: +{sms6EffectivePct}% — e.g. Fleexa's docs example (WhatsApp, cost ₦{SMS6_EXAMPLE_COST_NGN}) would sell for ₦{sms6SellPreview.toLocaleString()}.
                    {Number.isFinite(sms6BenchmarkPct) && ` For comparison, your 5sim/SMSPool-style price for the same $${SMS6_EXAMPLE_COST_USD} is ₦${sms6Benchmark.toLocaleString()}, which is about +${sms6BenchmarkPct}% over Fleexa's cost.`}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize:'0.72rem', color:'var(--muted)', display:'block', marginBottom:'0.3rem' }}>Margin Share — Rent Numbers (% of the gap to Fleexa's own retail price)</label>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                    <input type="number" step="1" min="0" max="100" value={editedSettings.fleexa_rent_margin_percent}
                      onChange={e => setEditedSettings(s => ({ ...s, fleexa_rent_margin_percent: e.target.value }))}
                      style={{ flex:1, padding:'0.7rem 0.9rem', background:'var(--navy)', border:'1px solid var(--border)', borderRadius:'10px', color:'var(--gold)', fontSize:'1rem', fontWeight:700, fontFamily:'Outfit, sans-serif', outline:'none' }} />
                    <span style={{ fontSize:'0.75rem', color:'var(--muted)', whiteSpace:'nowrap' }}>% of gap</span>
                  </div>
                  <div style={{ fontSize:'0.68rem', color:'var(--muted)', marginTop:'0.3rem' }}>
                    Current: you keep {settings.fleexa_rent_margin_percent}% of the gap between your cost and Fleexa's retail price. 100% would match Fleexa's own retail price exactly (no price advantage for your customers); 0% means no margin at all.
                  </div>
                </div>
                <div>
                  <label style={{ fontSize:'0.72rem', color:'var(--muted)', display:'block', marginBottom:'0.3rem' }}>Flat Markup — Email OTP. Leave blank to follow the SMS OTP 4/5 markup</label>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                    <input type="number" step="1" min="0" placeholder={`Following SMS OTP 4/5: +${editedSettings.fleexa_markup_percent}%`} value={editedSettings.fleexa_email_markup_percent ?? ''}
                      onChange={e => setEditedSettings(s => ({ ...s, fleexa_email_markup_percent: e.target.value }))}
                      style={{ flex:1, padding:'0.7rem 0.9rem', background:'var(--navy)', border:'1px solid var(--border)', borderRadius:'10px', color:'var(--gold)', fontSize:'1rem', fontWeight:700, fontFamily:'Outfit, sans-serif', outline:'none' }} />
                    <span style={{ fontSize:'0.75rem', color:'var(--muted)', whiteSpace:'nowrap' }}>% over cost</span>
                  </div>
                  <div style={{ fontSize:'0.68rem', color:'var(--muted)', marginTop:'0.3rem' }}>
                    Effective: +{emailEffectivePct}% — an email costing you ₦{EMAIL_EXAMPLE_COST_NGN} would sell for ₦{emailSellPreview.toLocaleString()} (₦{(emailSellPreview - EMAIL_EXAMPLE_COST_NGN).toLocaleString()} profit). Applies to every Email OTP domain.
                  </div>
                </div>
                <div>
                  <label style={{ fontSize:'0.72rem', color:'var(--muted)', display:'block', marginBottom:'0.3rem' }}>Flat Markup — Residential Proxies. Leave blank to follow the SMS OTP 4/5 markup</label>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                    <input type="number" step="1" min="0" placeholder={`Following SMS OTP 4/5: +${editedSettings.fleexa_markup_percent}%`} value={editedSettings.fleexa_proxy_markup_percent ?? ''}
                      onChange={e => setEditedSettings(s => ({ ...s, fleexa_proxy_markup_percent: e.target.value }))}
                      style={{ flex:1, padding:'0.7rem 0.9rem', background:'var(--navy)', border:'1px solid var(--border)', borderRadius:'10px', color:'var(--gold)', fontSize:'1rem', fontWeight:700, fontFamily:'Outfit, sans-serif', outline:'none' }} />
                    <span style={{ fontSize:'0.75rem', color:'var(--muted)', whiteSpace:'nowrap' }}>% over cost</span>
                  </div>
                  <div style={{ fontSize:'0.68rem', color:'var(--muted)', marginTop:'0.3rem' }}>
                    Effective: +{proxyEffectivePct}% — a proxy plan costing you ₦{PROXY_EXAMPLE_COST_NGN} would sell for ₦{proxySellPreview.toLocaleString()} (₦{(proxySellPreview - PROXY_EXAMPLE_COST_NGN).toLocaleString()} profit). Proxies cannot be refunded, so keep a healthy margin.
                  </div>
                </div>
                <div>
                  <label style={{ fontSize:'0.72rem', color:'var(--muted)', display:'block', marginBottom:'0.3rem' }}>Flat Markup — Travel eSIM. Leave blank to follow the SMS OTP 4/5 markup</label>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                    <input type="number" step="1" min="0" placeholder={`Following SMS OTP 4/5: +${editedSettings.fleexa_markup_percent}%`} value={editedSettings.fleexa_esim_markup_percent ?? ''}
                      onChange={e => setEditedSettings(s => ({ ...s, fleexa_esim_markup_percent: e.target.value }))}
                      style={{ flex:1, padding:'0.7rem 0.9rem', background:'var(--navy)', border:'1px solid var(--border)', borderRadius:'10px', color:'var(--gold)', fontSize:'1rem', fontWeight:700, fontFamily:'Outfit, sans-serif', outline:'none' }} />
                    <span style={{ fontSize:'0.75rem', color:'var(--muted)', whiteSpace:'nowrap' }}>% over cost</span>
                  </div>
                  <div style={{ fontSize:'0.68rem', color:'var(--muted)', marginTop:'0.3rem' }}>
                    Effective: +{esimEffectivePct}% — an eSIM plan costing you ₦{ESIM_EXAMPLE_COST_NGN.toLocaleString()} would sell for ₦{esimSellPreview.toLocaleString()} (₦{(esimSellPreview - ESIM_EXAMPLE_COST_NGN).toLocaleString()} profit). Also applies to top-ups. eSIMs cannot be refunded once delivered, so keep a healthy margin.
                  </div>
                </div>
              </div>

              {/* Live preview using the real WhatsApp/1-month numbers we confirmed: cost ₦7,768, Fleexa retail ₦8,768 */}
              <div style={{ marginTop:'1rem', padding:'0.8rem', background:'rgba(108,78,242,0.06)', border:'1px solid rgba(108,78,242,0.15)', borderRadius:'10px' }}>
                <div style={{ fontSize:'0.72rem', color:'var(--muted)', marginBottom:'0.3rem' }}>Rent Preview (WhatsApp, 1 month — cost ₦7,768, Fleexa retail ₦8,768)</div>
                <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'1.1rem', color:'var(--gold)' }}>
                  ₦{Math.round(7768 + (8768 - 7768) * (Number(editedSettings.fleexa_rent_margin_percent) / 100)).toLocaleString()}
                </div>
                <div style={{ fontSize:'0.68rem', color:'var(--muted)', marginTop:'0.1rem' }}>
                  ₦{(Math.round(7768 + (8768 - 7768) * (Number(editedSettings.fleexa_rent_margin_percent) / 100)) - 7768).toLocaleString()} margin per rental
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* BOTTOM NAV */}
      {!isDesktop && (
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'var(--navy)', backdropFilter:'blur(12px)', borderTop:'1px solid var(--border)', zIndex:100 }}>
        <div className="bottom-nav-row" style={{ padding:'0.6rem 0.5rem 0.9rem' }}>
          {tabs.map(tab => (
            <button key={tab.id} className="tab-btn nav-tab-item" onClick={() => {
              setActiveTab(tab.id)
              if (tab.id === 'logs' && logs.length === 0) fetchLogs()
              if (tab.id === 'paystack' && !psData) fetchPaystack()
              if (tab.id === 'profit' && !profitData) fetchProfit()
            }}
              style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0.22rem', background:'transparent', border:'none', padding:'0.3rem 0.5rem', borderRadius:'10px' }}>
              <div style={{ color: activeTab === tab.id ? 'var(--purple2)' : 'var(--muted)', transition:'color 0.15s' }}>{tab.icon}</div>
              <span style={{ fontSize:'0.58rem', color: activeTab === tab.id ? 'var(--purple2)' : 'var(--muted)', fontWeight: activeTab === tab.id ? 700 : 400, transition:'color 0.15s', whiteSpace:'nowrap' }}>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
      )}
    </main>
  )
}

function GridIcon()    { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> }
function UsersIcon()   { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> }
function PackageIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> }
function MoneyIcon()   { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> }
function ClockIcon()   { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> }
function VpnIcon()     { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> }
function SubsIcon()    { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> }
function LogsIcon()    { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> }
function MailIcon()    { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><polyline points="22 6 12 13 2 6"/></svg> }
function SettingsIcon(){ return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> }
function BellIcon()    { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> }