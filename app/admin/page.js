'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

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
]

const vpnProviders = ['NordVPN', 'ExpressVPN', 'Surfshark', 'CyberGhost']
const vpnPlans = ['1 Month', '6 Months', '1 Year']
const subServices = ['Spotify', 'Netflix', 'YouTube Premium', 'Canva Pro', 'ChatGPT Plus']
const subPlans = ['1 Month', '3 Months', '6 Months', '1 Year']
const subServiceIds = { 'Spotify': 'spotify', 'Netflix': 'netflix', 'YouTube Premium': 'youtube', 'Canva Pro': 'canva', 'ChatGPT Plus': 'chatgpt' }
const platforms = [...new Set(DEFAULT_BOOST_PACKAGES.map(p => p.platform))]

export default function AdminPanel() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [mounted, setMounted] = useState(false)

  // Data
  const [stats, setStats] = useState({ users: 0, orders: 0, revenue: 0, pending: 0 })
  const [users, setUsers] = useState([])
  const [orders, setOrders] = useState([])
  const [vpnKeys, setVpnKeys] = useState([])
  const [subKeys, setSubKeys] = useState([])

  // Settings
  const [settings, setSettings] = useState({ usd_to_ngn_rate: '1600', markup_multiplier: '3.5' })
  const [editedSettings, setEditedSettings] = useState({ usd_to_ngn_rate: '1600', markup_multiplier: '3.5' })
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)
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

  // Provider balances
  const [providerBalances, setProviderBalances] = useState({ fivesim: { balance: null, error: null }, jap: { balance: null, error: null }, vpn: { balance: null, error: null } })
  const [balancesLoading, setBalancesLoading] = useState(false)
  const [balancesLastFetched, setBalancesLastFetched] = useState(null)

  // Logs
  const [logs, setLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsLastFetched, setLogsLastFetched] = useState(null)
  const [logLevelFilter, setLogLevelFilter] = useState('all')
  const [logCategoryFilter, setLogCategoryFilter] = useState('all')
  const [logSearch, setLogSearch] = useState('')
  const [expandedLog, setExpandedLog] = useState(null)

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
      if (Object.keys(settingsMap).length) {
        setSettings(settingsMap)
        setEditedSettings(settingsMap)
      }

      // Get real auth user count via profiles (fallback) 
      // Count all profiles + any auth users without profiles
      const { count: authCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true })

      setUsers(allUsers)
      setOrders(allOrders)
      setVpnKeys(allVpnKeys)
      setSubKeys(allSubKeys)
      setBoostPrices(savedPrices)
      setEditedPrices(savedPrices)
      setStats({
        users: authCount || allUsers.length,
        orders: allOrders.length,
        revenue: allOrders.filter(o => o.status === 'completed').reduce((sum, o) => sum + (o.amount || 0), 0),
        pending: allOrders.filter(o => o.status === 'pending' || o.status === 'processing').length,
      })
      setLoading(false)
    }
    load()
    fetchProviderBalances()
  }, [router])

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
      const supabase = createClient()
      const { data } = await supabase
        .from('logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      setLogs(data || [])
      setLogsLastFetched(new Date())
    } catch (e) {
      console.error('Failed to fetch logs', e)
    }
    setLogsLoading(false)
  }

  const getPrice = (id) => editedPrices[id] ?? (DEFAULT_BOOST_PACKAGES.find(p => p.id === id)?.price || 0)

  const saveBoostPrices = async () => {
    setSavingPrices(true)
    const supabase = createClient()
    const upserts = Object.entries(editedPrices).map(([package_id, price]) => ({ package_id, price: Number(price) }))
    await supabase.from('boost_prices').upsert(upserts, { onConflict: 'package_id' })
    setBoostPrices({ ...editedPrices })
    setSavingPrices(false)
    setPricesSaved(true)
    setTimeout(() => setPricesSaved(false), 2500)
  }

  const saveSettings = async () => {
    setSavingSettings(true)
    const supabase = createClient()
    const upserts = Object.entries(editedSettings).map(([key, value]) => ({ key, value }))
    await supabase.from('app_settings').upsert(upserts, { onConflict: 'key' })
    setSettings({ ...editedSettings })
    setSavingSettings(false)
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 2500)
  }

  const updateOrderStatus = async (orderId, status) => {
    const supabase = createClient()
    await supabase.from('orders').update({ status }).eq('id', orderId)
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o))
  }

  const updateBalance = async (userId) => {
    const supabase = createClient()
    await supabase.from('profiles').update({ wallet_balance: Number(newBalance) }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, wallet_balance: Number(newBalance) } : u))
    setEditingBalance(null)
    setNewBalance('')
  }

  const toggleBan = async (userId, currentStatus) => {
    const supabase = createClient()
    await supabase.from('profiles').update({ is_banned: !currentStatus }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_banned: !currentStatus } : u))
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

  const filteredOrders = orderFilter === 'all' ? orders : orders.filter(o => o.status === orderFilter)

  const statusStyle = (status) => {
    if (status === 'completed') return { bg: 'rgba(29,158,117,0.12)', color: '#34d399' }
    if (status === 'pending')   return { bg: 'rgba(240,180,41,0.12)',  color: '#f0b429' }
    if (status === 'processing')return { bg: 'rgba(108,78,242,0.12)', color: 'var(--purple2)' }
    if (status === 'failed')    return { bg: 'rgba(220,50,50,0.12)',   color: '#ff6b6b' }
    return { bg: 'var(--card2)', color: 'var(--muted)' }
  }

  const inputStyle = { width: '100%', padding: '0.65rem 0.9rem', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text)', fontSize: '0.85rem', outline: 'none', fontFamily: 'Inter, sans-serif' }
  const selectStyle = { ...inputStyle }

  const tabs = [
    { id: 'overview', label: 'Overview',  icon: <GridIcon /> },
    { id: 'users',    label: 'Users',     icon: <UsersIcon /> },
    { id: 'orders',   label: 'Orders',    icon: <PackageIcon /> },
    { id: 'boost',    label: 'Prices',    icon: <MoneyIcon /> },
    { id: 'vpn',      label: 'VPN',       icon: <VpnIcon /> },
    { id: 'subs',     label: 'Subs',      icon: <SubsIcon /> },
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
    <main style={{ background: 'var(--navy)', minHeight: '100vh', paddingBottom: '5rem' }}>
      <style>{`
        @keyframes fadeSlideIn { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes scaleIn { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:scale(1); } }
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        @keyframes shimmer { 0%,100% { opacity:0.4; } 50% { opacity:1; } }
        @keyframes glow { 0%,100% { box-shadow:0 0 6px #f43f5e; } 50% { box-shadow:0 0 14px #f43f5e; } }
        * { box-sizing: border-box; }
        .tab-btn { transition:background 0.15s,color 0.15s; cursor:pointer; }
        .tab-btn:hover { background:var(--card2) !important; }
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

      {/* TOP BAR */}
      <div style={{ padding:'1rem 1.4rem', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100, background:'rgba(var(--navy-rgb,10,10,30),0.95)', backdropFilter:'blur(20px)', borderBottom:'1px solid var(--border)' }}>
        <div>
          <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:800, fontSize:'1.1rem', color:'var(--text)' }}>Mega<span style={{ color:'var(--gold)' }}>Den</span> <span style={{ color:'var(--purple2)' }}>Admin</span></div>
          <div style={{ fontSize:'0.68rem', color:'var(--muted)' }}>Control Panel · {stats.users} users · ₦{stats.revenue.toLocaleString()} revenue</div>
        </div>
        <a href="/dashboard" style={{ padding:'0.4rem 0.9rem', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'8px', color:'var(--muted)', fontSize:'0.75rem', textDecoration:'none', fontWeight:500 }}>← App</a>
      </div>

      <div style={{ padding:'1.2rem 1.4rem', maxWidth:520, margin:'0 auto' }}>

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div style={{ animation: mounted ? 'fadeSlideIn 0.4s ease' : 'none' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'0.8rem', marginBottom:'1.5rem' }}>
              {[
                { label:'Total Users',    value: stats.users,                         color:'var(--purple2)', icon:<UsersIcon /> },
                { label:'Total Orders',   value: stats.orders,                        color:'var(--gold)',    icon:<PackageIcon /> },
                { label:'Revenue',        value:`₦${stats.revenue.toLocaleString()}`, color:'#34d399',       icon:<MoneyIcon /> },
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

              <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'0.6rem' }}>
                {[
                  { key:'fivesim',  label:'5sim',         emoji:'📱', color:'#25d366', bg:'rgba(37,211,102,0.08)',  border:'rgba(37,211,102,0.2)'  },
                  { key:'jap',      label:'JAP Panel',    emoji:'📣', color:'#1877f2', bg:'rgba(24,119,242,0.08)', border:'rgba(24,119,242,0.2)' },
                  { key:'vpn',      label:'VPNresellers', emoji:'🔒', color:'#6d4aff', bg:'rgba(109,74,255,0.08)', border:'rgba(109,74,255,0.2)'  },
                ].map(p => {
                  const val = providerBalances[p.key]?.balance
                  const err = providerBalances[p.key]?.error
                  const isLow = val !== null && val !== undefined && Number(val) < 5
                  const isMid = val !== null && val !== undefined && Number(val) >= 5 && Number(val) < 20
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
                        <div style={{ fontSize:'0.68rem', color:'#f43f5e', fontWeight:600 }}>Error</div>
                      ) : val === null || val === undefined ? (
                        <div style={{ fontSize:'0.8rem', color:'var(--muted)' }}>—</div>
                      ) : (
                        <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:800, fontSize:'1.05rem', color: balColor, letterSpacing:'-0.01em' }}>
                          ${Number(val).toFixed(2)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Low balance warning banner */}
              {!balancesLoading && (
                providerBalances.fivesim?.balance < 5 ||
                providerBalances.jap?.balance < 5 ||
                providerBalances.vpn?.balance < 5
              ) && (
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
              <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.92rem', color:'var(--text)' }}>All Users ({users.length})</div>
              <select value={userSort} onChange={e => setUserSort(e.target.value)}
                style={{ padding:'0.35rem 0.7rem', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'8px', color:'var(--text)', fontSize:'0.72rem', outline:'none', fontFamily:'Outfit, sans-serif' }}>
                <option value="recent">Recently Joined</option>
                <option value="oldest">Oldest First</option>
                <option value="alpha">A → Z</option>
              </select>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
              {[
                // Admin always first
                ...users.filter(u => u.is_admin),
                // Then non-admins sorted by chosen method
                ...[...users.filter(u => !u.is_admin)].sort((a, b) => {
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
                </div>
              ))}
              {users.length === 0 && <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'16px', padding:'2rem', textAlign:'center', color:'var(--muted)', fontSize:'0.82rem' }}>No users yet</div>}
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
                      {['pending','completed','failed'].map(status => (
                        <button key={status} className="action-btn" onClick={() => updateOrderStatus(order.id, status)}
                          style={{ flex:1, padding:'0.45rem', background: order.status === status ? statusStyle(status).bg : 'var(--card2)', border:`1px solid ${order.status === status ? statusStyle(status).color : 'var(--border)'}`, borderRadius:'8px', color: order.status === status ? statusStyle(status).color : 'var(--muted)', fontSize:'0.65rem', fontWeight:600, textTransform:'capitalize' }}>
                          {status}
                        </button>
                      ))}
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
                  if (logCategoryFilter !== 'all' && l.category !== logCategoryFilter) return false
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
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'var(--navy)', backdropFilter:'blur(12px)', borderTop:'1px solid var(--border)', padding:'0.6rem 0.5rem 0.9rem', display:'flex', justifyContent:'space-around', zIndex:100 }}>
        {tabs.map(tab => (
          <button key={tab.id} className="tab-btn" onClick={() => {
            setActiveTab(tab.id)
            if (tab.id === 'logs' && logs.length === 0) fetchLogs()
          }}
            style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0.22rem', background:'transparent', border:'none', padding:'0.3rem 0.5rem', borderRadius:'10px' }}>
            <div style={{ color: activeTab === tab.id ? 'var(--purple2)' : 'var(--muted)', transition:'color 0.15s' }}>{tab.icon}</div>
            <span style={{ fontSize:'0.58rem', color: activeTab === tab.id ? 'var(--purple2)' : 'var(--muted)', fontWeight: activeTab === tab.id ? 700 : 400, transition:'color 0.15s' }}>{tab.label}</span>
          </button>
        ))}
      </div>
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
function SettingsIcon(){ return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> }