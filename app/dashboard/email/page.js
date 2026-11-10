'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import LoadingScreen from '@/components/RouteLoader'
import BottomNav from '@/components/BottomNav'
import DesktopSidebar from '@/components/DesktopSidebar'

const ACCENT = '#4687ff'
const CANCEL_LOCK_MS = 150 * 1000 // Fleexa refuses a cancel in the first 2 minutes; +30s margin (keep in sync with lib/emailOrders.js)
const EMAIL_LIFETIME_MS = 20 * 60 * 1000 // an email waits 20 minutes for a code (keep in sync with lib/emailOrders.js)

// ── Brand colours (matched by name, so new catalog entries still look right) ──
const BRANDS = [
  ['whatsapp', '#25d366'], ['telegram', '#0088cc'], ['facebook', '#1877f2'], ['instagram', '#e1306c'],
  ['tiktok', '#ff0050'], ['gmail', '#ea4335'], ['google', '#4285f4'], ['twitter', '#e7e7e7'],
  ['discord', '#5865f2'], ['snapchat', '#fffc00'], ['linkedin', '#0a66c2'], ['amazon', '#ff9900'],
  ['microsoft', '#00a4ef'], ['netflix', '#e50914'], ['tinder', '#fd5564'], ['paypal', '#0070e0'],
  ['yahoo', '#6001d2'], ['steam', '#66c0f4'], ['uber', '#e5e5e5'], ['spotify', '#1db954'],
  ['openai', '#10a37f'], ['chatgpt', '#10a37f'], ['binance', '#f0b90b'], ['coinbase', '#0052ff'],
  ['reddit', '#ff4500'], ['pinterest', '#e60023'], ['twitch', '#9146ff'], ['github', '#e6edf3'],
  ['apple', '#a2aaad'], ['shopee', '#f53d2d'], ['jumia', '#f68b1e'], ['bolt', '#34d186'],
  ['opay', '#1dcf9f'], ['palmpay', '#7b3ff2'], ['paystack', '#00c3f7'], ['flutterwave', '#f5a623'],
  ['bumble', '#ffc629'], ['viber', '#7360f2'], ['signal', '#3a76f0'], ['wechat', '#07c160'],
]
const POPULAR_KEYS = ['whatsapp', 'telegram', 'google', 'facebook', 'instagram', 'tiktok', 'twitter', 'discord', 'netflix', 'paypal', 'openai', 'amazon']

const brandColor = (name = '') => {
  const n = String(name).toLowerCase()
  const hit = BRANDS.find(([k]) => n.includes(k))
  return hit ? hit[1] : ACCENT
}
const popularRank = (name = '') => {
  const n = String(name).toLowerCase()
  return POPULAR_KEYS.findIndex((k) => n.includes(k))
}
const isWaiting = (o) => o.status === 'pending' || o.status === 'resolving'
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const fmtDate = (iso) => {
  try { return new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}

export default function EmailOtpPage() {
  const [isDesktop, setIsDesktop] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [tab, setTab] = useState('buy')

  const [sites, setSites] = useState([])
  const [loadingSites, setLoadingSites] = useState(true)
  const [siteSearch, setSiteSearch] = useState('')
  const [siteOpen, setSiteOpen] = useState(true)
  const [selectedSite, setSelectedSite] = useState(null)
  const [domains, setDomains] = useState([])
  const [loadingDomains, setLoadingDomains] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState(null)
  const [count, setCount] = useState(1)
  const [ordering, setOrdering] = useState(false)
  const [error, setError] = useState('')
  const [orders, setOrders] = useState([])

  // A ref check is synchronous, unlike waiting for the `ordering` state to
  // re-render the disabled button - stops a double-tap buying twice.
  const orderingRef = useRef(false)
  // Ignore a slow domain response if the user already picked another site.
  const domainsReqRef = useRef(0)
  const step2Ref = useRef(null)
  const summaryRef = useRef(null)
  const gridRef = useRef(null)
  const [servicePage, setServicePage] = useState(0)
  const [swipePct, setSwipePct] = useState(0)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    setIsDesktop(mq.matches)
    const onChange = (e) => setIsDesktop(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const handleLogout = async () => {
    await createClient().auth.signOut()
    window.location.href = '/'
  }

  const loadOrders = useCallback(async (uid) => {
    const { data } = await createClient()
      .from('orders').select('*')
      .eq('user_id', uid).eq('product_type', 'email_otp')
      .order('created_at', { ascending: false }).limit(30)
    setOrders(data || [])
  }, [])

  const refreshBalance = useCallback(async (uid) => {
    const { data } = await createClient().from('profiles').select('wallet_balance').eq('id', uid).single()
    if (data) setProfile((p) => ({ ...p, wallet_balance: data.wallet_balance }))
  }, [])

  useEffect(() => {
    setMounted(true)
    const load = async () => {
      const supabase = createClient()
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { window.location.href = '/login'; return }
      setUser(u)
      const { data: p } = await supabase.from('profiles').select('*').eq('id', u.id).single()
      setProfile(p)
      await loadOrders(u.id)
      setPageLoading(false)
    }
    load()
  }, [loadOrders])

  useEffect(() => {
    const loadSites = async () => {
      try {
        const res = await fetch('/api/email/catalog')
        const data = await res.json()
        if (!res.ok) setError(data.error || 'Could not load email services.')
        else setSites(data.sites || [])
      } catch {
        setError('Could not load email services. Please refresh.')
      }
      setLoadingSites(false)
    }
    loadSites()
  }, [])

  // Gently bring the next step into view once the previous one is done.
  useEffect(() => {
    if (!selectedSite || siteOpen) return
    const t = setTimeout(() => step2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 140)
    return () => clearTimeout(t)
  }, [selectedSite, siteOpen])

  useEffect(() => {
    if (!selectedDomain) return
    const t = setTimeout(() => summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 140)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDomain?.name])

  const handleSiteSelect = async (site) => {
    setSelectedSite(site)
    setSiteOpen(false)
    setSelectedDomain(null)
    setDomains([])
    setCount(1)
    setError('')
    setLoadingDomains(true)
    const reqId = ++domainsReqRef.current
    try {
      const res = await fetch(`/api/email/catalog?site=${encodeURIComponent(site.id)}`)
      const data = await res.json()
      if (reqId !== domainsReqRef.current) return
      if (!res.ok) setError(data.error || 'Could not load domains.')
      else setDomains(data.domains || [])
    } catch {
      if (reqId === domainsReqRef.current) setError('Could not load domains. Please try again.')
    }
    if (reqId === domainsReqRef.current) setLoadingDomains(false)
  }

  const handleBuy = async () => {
    if (!selectedSite || !selectedDomain || !user || orderingRef.current) return
    orderingRef.current = true
    setOrdering(true)
    setError('')
    try {
      const res = await fetch('/api/email/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site: selectedSite.id,
          domain: selectedDomain.name,
          count,
          // The price on screen - the server treats it as a ceiling only.
          expected_price_ngn: selectedDomain.price_ngn,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409 && data.code === 'PRICE_CHANGED' && Number.isFinite(data.price_ngn)) {
          const name = selectedDomain.name
          setSelectedDomain((d) => (d && d.name === name ? { ...d, price_ngn: data.price_ngn } : d))
          setDomains((list) => list.map((d) => (d.name === name ? { ...d, price_ngn: data.price_ngn } : d)))
        }
        setError(data.error || 'Purchase failed. Try again.')
        return
      }
      await Promise.all([loadOrders(user.id), refreshBalance(user.id)])
      setSelectedSite(null)
      setSelectedDomain(null)
      setDomains([])
      setCount(1)
      setSiteOpen(true)
      setSiteSearch('')
      setTab('mine')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      orderingRef.current = false
      setOrdering(false)
    }
  }

  const handleChanged = useCallback(() => {
    if (!user) return
    loadOrders(user.id)
    refreshBalance(user.id)
  }, [user, loadOrders, refreshBalance])

  // Popular services first (when not searching), then everything else A→Z as the API returns it.
  const q = siteSearch.trim().toLowerCase()
  const { popular, rest, matchCount } = useMemo(() => {
    const list = sites.filter((s) => s.name.toLowerCase().includes(q))
    if (q) return { popular: [], rest: list, matchCount: list.length }
    const pop = list
      .map((s) => ({ s, r: popularRank(s.name) }))
      .filter((x) => x.r >= 0)
      .sort((a, b) => a.r - b.r)
      .map((x) => x.s)
      .slice(0, 9)
    const popIds = new Set(pop.map((s) => s.id))
    return { popular: pop, rest: list.filter((s) => !popIds.has(s.id)), matchCount: list.length }
  }, [sites, q])

  // One swipeable list: popular first, then the rest. 2 rows x 4 columns per "page".
  const ordered = [...popular, ...rest]
  const pages = Math.max(1, Math.ceil(Math.ceil(ordered.length / 2) / 4))

  const handleSwipe = (e) => {
    const el = e.currentTarget
    const max = el.scrollWidth - el.clientWidth
    setSwipePct(max > 0 ? el.scrollLeft / max : 0)
    setServicePage(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))
  }

  // Back to the start whenever the search changes or the list is reopened.
  useEffect(() => {
    gridRef.current?.scrollTo?.({ left: 0 })
    setServicePage(0)
    setSwipePct(0)
  }, [q, siteOpen])

  const total = (selectedDomain?.price_ngn || 0) * count
  const hasBalance = (profile?.wallet_balance || 0) >= total
  const maxCount = Math.max(1, Math.min(10, selectedDomain?.stock ?? 10))
  const activeOrders = orders.filter(isWaiting)
  const pastOrders = orders.filter((o) => !isWaiting(o))
  const activeCount = activeOrders.length

  const inStock = domains.filter((d) => !(d.stock !== null && d.stock <= 0))
  const prices = inStock.map((d) => d.price_ngn)
  const minPrice = prices.length ? Math.min(...prices) : null
  const hasPriceSpread = prices.length > 1 && Math.max(...prices) !== minPrice

  if (pageLoading) return <LoadingScreen />

  return (
    <main style={{ background: 'var(--navy)', minHeight: '100vh', display: isDesktop ? 'flex' : 'block' }}>
      <style>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes smsReveal { from { opacity: 0; transform: translateY(10px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes glow { 0%, 100% { box-shadow: 0 0 12px rgba(108,78,242,0.25); } 50% { box-shadow: 0 0 26px rgba(108,78,242,0.5); } }
        * { box-sizing: border-box; }
        .em-swipe::-webkit-scrollbar { display: none; }
        .em-chip { transition: transform 0.15s ease, border-color 0.15s, background 0.15s, box-shadow 0.15s; }
        .em-chip:hover:not(:disabled) { transform: translateY(-2px); }
        .em-chip:active:not(:disabled) { transform: scale(0.97); }
        .em-chip:focus-visible, .em-tab:focus-visible, .em-copy:focus-visible, .em-buy:focus-visible, .em-cancel:focus-visible, .em-link:focus-visible { outline: 2px solid var(--purple); outline-offset: 2px; }
        .em-buy { transition: transform 0.18s ease, box-shadow 0.18s, background 0.18s; }
        .em-buy:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 32px rgba(108,78,242,0.45); }
        .em-buy:active:not(:disabled) { transform: scale(0.98); }
        .em-search { transition: border-color 0.2s, box-shadow 0.2s; }
        .em-search:focus { border-color: var(--purple) !important; box-shadow: 0 0 0 3px rgba(108,78,242,0.12); }
        .em-back { transition: background 0.15s, transform 0.15s; }
        .em-back:hover { background: var(--card2) !important; transform: translateX(-2px); }
        .em-copy { transition: background 0.15s, transform 0.15s; }
        .em-copy:hover { transform: scale(1.05); }
        .em-copy:active { transform: scale(0.95); }
        .em-cancel { transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.15s; }
        .em-cancel:hover:not(:disabled) { background: rgba(244,63,94,0.08) !important; border-color: rgba(244,63,94,0.4) !important; color: #f43f5e !important; transform: translateY(-1px); }
        .em-link { transition: background 0.15s, border-color 0.15s; }
        .em-link:hover { background: var(--card2) !important; }
        .em-tab { transition: background 0.2s, color 0.2s, border-color 0.2s; }
        .em-live { background: linear-gradient(135deg, rgba(108,78,242,0.08) 0%, rgba(192,120,26,0.06) 100%); border: 1px solid rgba(108,78,242,0.25); animation: glow 3s ease infinite; }
        .em-skel { background: linear-gradient(90deg, var(--card) 25%, var(--card2) 50%, var(--card) 75%); background-size: 200% 100%; animation: shimmer 1.4s linear infinite; border: 1px solid var(--border); }
        @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; } }
      `}</style>

      {isDesktop && <DesktopSidebar profile={profile} onLogout={handleLogout} />}

      <div style={{ flex: isDesktop ? 1 : 'none', minWidth: 0, paddingBottom: isDesktop ? '2rem' : '6.5rem' }}>
        {/* ── STICKY HEADER ── */}
        <div style={{ padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.85rem', position: 'sticky', top: 0, zIndex: 100, background: 'rgba(var(--navy-rgb, 10,10,30), 0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)' }}>
          <Link href="/dashboard" className="em-back" aria-label="Back to dashboard" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', textDecoration: 'none', flexShrink: 0 }}>
            <BackIcon />
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--text)', letterSpacing: '-0.02em' }}>Email OTP</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.05rem' }}>Temporary emails · 20-min window</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, flexShrink: 0 }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>BAL</span>
            <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem', color: 'var(--gold)' }}>₦{(profile?.wallet_balance || 0).toLocaleString()}</span>
          </div>
        </div>

        <div style={{ padding: '1.2rem', maxWidth: 480, margin: '0 auto' }}>
          {/* ── TABS ── */}
          <div role="tablist" style={{ display: 'flex', gap: '0.3rem', padding: '0.3rem', marginBottom: '1.3rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14 }}>
            {[
              { id: 'buy', label: 'Get an email', icon: <PlusIcon /> },
              { id: 'mine', label: 'My emails', icon: <MailIcon size={14} />, badge: activeCount },
            ].map((t) => {
              const on = tab === t.id
              return (
                <button key={t.id} role="tab" aria-selected={on} className="em-tab" onClick={() => setTab(t.id)}
                  style={{ flex: 1, padding: '0.6rem 0.5rem', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem', border: `1px solid ${on ? 'rgba(108,78,242,0.4)' : 'transparent'}`, background: on ? 'rgba(108,78,242,0.14)' : 'transparent', color: on ? 'var(--purple2)' : 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem' }}>
                  {t.icon}
                  {t.label}
                  {t.badge > 0 && (
                    <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 99, background: 'var(--purple)', color: '#fff', fontSize: '0.64rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{t.badge}</span>
                  )}
                </button>
              )
            })}
          </div>

          {tab === 'buy' ? (
            <div key="buy" style={{ animation: mounted ? 'fadeSlideIn 0.35s ease both' : 'none' }}>
              {/* How it works */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1.4rem' }}>
                {[
                  { n: 1, t: 'Pick a service', s: 'and a domain' },
                  { n: 2, t: 'Use the email', s: 'on that site' },
                  { n: 3, t: 'Get your code', s: 'right here' },
                ].map((h) => (
                  <div key={h.n} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '0.65rem 0.6rem', textAlign: 'center' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', margin: '0 auto 0.4rem', background: 'rgba(108,78,242,0.15)', color: 'var(--purple2)', fontSize: '0.66rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{h.n}</div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>{h.t}</div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{h.s}</div>
                  </div>
                ))}
              </div>

              {/* ── STEP 1: SERVICE ── */}
              <div style={{ marginBottom: '1.5rem' }}>
                <StepHeader n={1} done={!!selectedSite} title="Select service"
                  right={!siteOpen && selectedSite ? null : (!loadingSites && sites.length > 0 ? `${matchCount} available` : null)} muted />

                {selectedSite && !siteOpen ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 0.8rem', background: `${brandColor(selectedSite.name)}12`, border: `1.5px solid ${brandColor(selectedSite.name)}`, borderRadius: 14, boxShadow: `0 4px 16px ${brandColor(selectedSite.name)}26`, animation: 'scaleIn 0.25s ease both' }}>
                    <SiteTile name={selectedSite.name} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedSite.name}</div>
                      <div style={{ fontSize: '0.66rem', color: 'var(--muted)', marginTop: '0.05rem' }}>Selected service</div>
                    </div>
                    <button onClick={() => setSiteOpen(true)} className="em-link"
                      style={{ padding: '0.4rem 0.8rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', color: 'var(--text)', fontSize: '0.74rem', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ position: 'relative', marginBottom: '0.7rem' }}>
                      <div style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }}><SearchIcon /></div>
                      <input className="em-search" placeholder="Search service…" aria-label="Search service" value={siteSearch} onChange={(e) => setSiteSearch(e.target.value)}
                        style={{ width: '100%', padding: '0.7rem 2.4rem 0.7rem 2.4rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: '0.85rem', outline: 'none', fontFamily: 'Inter, sans-serif' }} />
                      {siteSearch && (
                        <button onClick={() => setSiteSearch('')} aria-label="Clear search"
                          style={{ position: 'absolute', right: '0.55rem', top: '50%', transform: 'translateY(-50%)', width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'var(--card2)', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', lineHeight: 1 }}>×</button>
                      )}
                    </div>

                    {loadingSites ? (
                      <div style={{ display: 'grid', gridTemplateRows: 'repeat(2, 1fr)', gridAutoFlow: 'column', gridAutoColumns: 'calc(25% - 0.38rem)', gap: '0.5rem', overflow: 'hidden' }}>
                        {Array.from({ length: 8 }).map((_, i) => (
                          <div key={i} className="em-skel" style={{ height: 88, borderRadius: 14 }} />
                        ))}
                      </div>
                    ) : matchCount === 0 && sites.length > 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--muted)', fontSize: '0.82rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem', opacity: 0.6 }}><SearchIcon size={22} /></div>
                        No service found for “{siteSearch}”
                      </div>
                    ) : (
                      <>
                        <div className="em-swipe" ref={gridRef} onScroll={handleSwipe}
                          style={{ display: 'grid', gridTemplateRows: 'repeat(2, 1fr)', gridAutoFlow: 'column', gridAutoColumns: 'calc(25% - 0.38rem)', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.3rem', scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
                          {ordered.map((s, i) => (
                            <SiteChip key={s.id} site={s} index={i} mounted={mounted} selected={selectedSite?.id === s.id} onClick={() => handleSiteSelect(s)} />
                          ))}
                        </div>

                        {pages > 1 && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', marginTop: '0.5rem' }}>
                            {pages <= 7 ? (
                              <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                                {Array.from({ length: pages }).map((_, i) => (
                                  <div key={i} style={{ width: servicePage === i ? 16 : 6, height: 6, borderRadius: 99, background: servicePage === i ? 'var(--purple)' : 'var(--border)', transition: 'all 0.3s ease' }} />
                                ))}
                              </div>
                            ) : (
                              <div style={{ position: 'relative', width: 96, height: 5, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: 0, height: '100%', width: '26%', left: `${swipePct * 74}%`, borderRadius: 99, background: 'var(--purple)', transition: 'left 0.1s linear' }} />
                              </div>
                            )}
                            <span style={{ fontSize: '0.6rem', color: 'var(--muted)', letterSpacing: '0.04em' }}>
                              {swipePct > 0.98 ? 'That’s everything ←' : 'Swipe to see more services →'}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>

              {/* ── STEP 2: DOMAIN ── */}
              {selectedSite && (
                <div ref={step2Ref} style={{ marginBottom: '1.5rem', scrollMarginTop: 84, animation: 'fadeSlideIn 0.35s ease both' }}>
                  <StepHeader n={2} done={!!selectedDomain} title="Choose email domain" right={selectedDomain?.name} />

                  <div style={{ background: 'rgba(108,78,242,0.08)', border: '1px solid rgba(108,78,242,0.25)', borderRadius: 12, padding: '0.75rem 1rem', marginBottom: '0.85rem', display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                    <span style={{ flexShrink: 0, marginTop: '0.1rem' }}><InfoIcon size={15} color="var(--purple2)" /></span>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text)', lineHeight: 1.55 }}>
                      <strong>Tip:</strong> use the exact address we give you, then request the code <strong>once</strong>.
                      <div style={{ color: 'var(--muted)', marginTop: '0.25rem' }}>
                        Stays active for 20 minutes. No code? Cancel for a refund after about 2 minutes — unused emails are refunded automatically.
                      </div>
                    </div>
                  </div>

                  {loadingDomains ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {[0, 1, 2].map((i) => <div key={i} className="em-skel" style={{ height: 62, borderRadius: 12 }} />)}
                    </div>
                  ) : domains.length === 0 ? (
                    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, textAlign: 'center', padding: '1.6rem 1rem', color: 'var(--muted)', fontSize: '0.82rem' }}>
                      No domains available for this service right now.
                      <div style={{ marginTop: '0.6rem' }}>
                        <button onClick={() => setSiteOpen(true)} className="em-link" style={{ padding: '0.45rem 0.9rem', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', color: 'var(--text)', fontSize: '0.76rem', fontWeight: 600 }}>Try another service</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {domains.map((d, i) => {
                        const sel = selectedDomain?.name === d.name
                        const out = d.stock !== null && d.stock <= 0
                        const low = !out && d.stock !== null && d.stock <= 5
                        const best = !out && hasPriceSpread && d.price_ngn === minPrice
                        return (
                          <button key={d.name} className="em-chip" disabled={out} aria-pressed={sel} onClick={() => { setSelectedDomain(d); setCount(1); setError('') }}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.8rem 0.95rem', borderRadius: 12, cursor: out ? 'not-allowed' : 'pointer', opacity: out ? 0.5 : 1, textAlign: 'left', background: sel ? 'rgba(108,78,242,0.1)' : 'var(--card)', border: `1.5px solid ${sel ? 'var(--purple)' : 'var(--border)'}`, boxShadow: sel ? '0 4px 16px rgba(108,78,242,0.18)' : 'none', animation: mounted ? `fadeSlideIn 0.3s ease ${Math.min(i * 0.04, 0.24)}s both` : 'none' }}>
                            <span style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, border: `2px solid ${sel ? 'var(--purple)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.15s' }}>
                              {sel && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--purple)' }} />}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</span>
                                {best && <span style={{ flexShrink: 0, padding: '0.1rem 0.45rem', borderRadius: 99, background: 'rgba(52,211,153,0.12)', color: '#34d399', fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Lowest</span>}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.67rem', marginTop: '0.15rem', color: out ? '#f43f5e' : low ? '#f0b429' : 'var(--muted)' }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: out ? '#f43f5e' : low ? '#f0b429' : '#34d399' }} />
                                {out ? 'Out of stock' : low ? `Only ${d.stock} left` : d.stock !== null ? `${d.stock} available` : 'In stock'}
                              </div>
                            </div>
                            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.95rem', color: 'var(--gold)', flexShrink: 0 }}>₦{d.price_ngn.toLocaleString()}</div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── SUMMARY + BUY ── */}
              {selectedSite && selectedDomain && (
                <div ref={summaryRef} style={{ scrollMarginTop: 84, animation: 'scaleIn 0.3s ease both' }}>
                  <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '1rem', marginBottom: '0.75rem' }}>
                    <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)', marginBottom: '0.75rem' }}>Order summary</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      <Row label="Service">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', textTransform: 'capitalize' }}>
                          <SiteTile name={selectedSite.name} size={18} radius={5} />
                          {selectedSite.name}
                        </span>
                      </Row>
                      <Row label="Domain">{selectedDomain.name}</Row>
                      <Row label="Quantity">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}>
                          <button onClick={() => setCount((c) => Math.max(1, c - 1))} disabled={count <= 1} aria-label="Decrease quantity" style={{ ...stepBtn, opacity: count <= 1 ? 0.4 : 1 }}>−</button>
                          <span style={{ minWidth: 16, textAlign: 'center', fontWeight: 700 }}>{count}</span>
                          <button onClick={() => setCount((c) => Math.min(maxCount, c + 1))} disabled={count >= maxCount} aria-label="Increase quantity" style={{ ...stepBtn, opacity: count >= maxCount ? 0.4 : 1 }}>+</button>
                        </span>
                      </Row>
                      {count >= maxCount && maxCount > 1 && (
                        <div style={{ fontSize: '0.64rem', color: 'var(--muted)', textAlign: 'right', marginTop: '-0.2rem' }}>Maximum {maxCount} per order</div>
                      )}
                      <Row label="Balance">
                        <span style={{ color: hasBalance ? '#10b981' : '#f43f5e', fontWeight: 700 }}>₦{(profile?.wallet_balance || 0).toLocaleString()}</span>
                      </Row>
                      <div style={{ height: 1, background: 'var(--border)', margin: '0.1rem 0' }} />
                      <Row label="Total" bold>
                        <span style={{ color: 'var(--gold)', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem' }}>₦{total.toLocaleString()}</span>
                      </Row>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border)', fontSize: '0.7rem', color: 'var(--muted)' }}>
                      <span style={{ color: '#34d399', display: 'flex' }}><ShieldIcon /></span>
                      Auto-refunded to your wallet if no code arrives.
                    </div>
                  </div>

                  {!hasBalance && (
                    <div style={{ background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 12, padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#f43f5e', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Insufficient balance</span>
                      <Link href="/dashboard/wallet" style={{ color: '#f43f5e', fontWeight: 700, textDecoration: 'none', fontSize: '0.75rem' }}>Fund Wallet →</Link>
                    </div>
                  )}
                  {error && <ErrorBox text={error} />}

                  <button onClick={handleBuy} disabled={ordering || !hasBalance} className="em-buy"
                    style={{ width: '100%', padding: '1rem', background: !hasBalance ? 'var(--card2)' : ordering ? 'var(--purple2)' : 'var(--purple)', color: !hasBalance ? 'var(--muted)' : '#fff', border: 'none', borderRadius: 14, fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem', fontWeight: 700, cursor: ordering || !hasBalance ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', opacity: !hasBalance ? 0.6 : 1 }}>
                    {ordering ? (<><Spinner size={18} /> Getting your email…</>) : `Buy ${count > 1 ? `${count} emails` : 'email'} — ₦${total.toLocaleString()}`}
                  </button>
                </div>
              )}

              {/* An error from loading (no domain picked yet) */}
              {error && !selectedDomain && <ErrorBox text={error} />}
            </div>
          ) : (
            <div key="mine" style={{ animation: mounted ? 'fadeSlideIn 0.35s ease both' : 'none' }}>
              {orders.length === 0 ? (
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: '2.5rem 1.2rem', textAlign: 'center' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 20, margin: '0 auto 1rem', background: 'rgba(108,78,242,0.1)', border: '1px solid rgba(108,78,242,0.25)', color: 'var(--purple2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MailIcon size={28} /></div>
                  <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', marginBottom: '0.3rem' }}>No emails yet</div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginBottom: '1.1rem', lineHeight: 1.5 }}>Get a temporary email to receive a verification code in seconds.</div>
                  <button onClick={() => setTab('buy')} className="em-buy" style={{ padding: '0.7rem 1.5rem', background: 'var(--purple)', color: '#fff', border: 'none', borderRadius: 12, fontSize: '0.85rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif', cursor: 'pointer' }}>Get an email</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {activeOrders.length > 0 && (
                    <>
                      <MiniLabel>Active · {activeOrders.length}</MiniLabel>
                      {activeOrders.map((o) => <EmailCard key={o.id} order={o} onChanged={handleChanged} />)}
                    </>
                  )}
                  {pastOrders.length > 0 && (
                    <>
                      <div style={{ marginTop: activeOrders.length ? '0.4rem' : 0 }}><MiniLabel>History</MiniLabel></div>
                      {pastOrders.map((o) => <EmailCard key={o.id} order={o} onChanged={handleChanged} />)}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {!isDesktop && <BottomNav />}
    </main>
  )
}

// One purchased email. Polls its own status while it is waiting for a code.
function EmailCard({ order, onChanged }) {
  const [live, setLive] = useState({ status: order.status, code: order.details?.sms_code || null, text: order.details?.sms_text || null })
  const [now, setNow] = useState(Date.now())
  const [cancelling, setCancelling] = useState(false)
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState('')

  const waiting = live.status === 'pending' || live.status === 'resolving'
  const lockTotal = CANCEL_LOCK_MS / 1000
  const lifeTotal = EMAIL_LIFETIME_MS / 1000
  const unlockIn = Math.max(0, Math.ceil((Date.parse(order.created_at) + CANCEL_LOCK_MS - now) / 1000))
  const expiresIn = Math.max(0, Math.ceil((Date.parse(order.created_at) + EMAIL_LIFETIME_MS - now) / 1000))
  const lockPct = Math.min(100, Math.max(0, ((lockTotal - unlockIn) / lockTotal) * 100))
  const lifePct = Math.min(100, Math.max(0, (expiresIn / lifeTotal) * 100))
  const urgent = expiresIn <= 120

  useEffect(() => {
    if (!waiting) return
    let stopped = false
    const poll = async () => {
      try {
        const res = await fetch(`/api/email/status?order_id=${order.id}`)
        const data = await res.json()
        if (stopped || !res.ok) return
        setLive({ status: data.status, code: data.code, text: data.text })
        if (data.status !== 'pending' && data.status !== 'resolving') onChanged?.()
      } catch { /* network hiccup - try again on the next tick */ }
    }
    const first = setTimeout(poll, 1500)
    const iv = setInterval(poll, 7000)
    return () => { stopped = true; clearTimeout(first); clearInterval(iv) }
  }, [order.id, waiting, onChanged])

  useEffect(() => {
    if (!waiting) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [waiting])

  const copy = (key, value) => {
    if (!value) return
    navigator.clipboard.writeText(value)
    setCopied(key)
    setTimeout(() => setCopied(''), 1800)
  }

  const handleCancel = async () => {
    setCancelling(true)
    setMsg('')
    try {
      const res = await fetch('/api/email/status', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: order.id }) })
      const data = await res.json()
      if (!res.ok) { setMsg(data.error || 'Cancel failed. Contact support.'); return }
      setLive((l) => ({ ...l, status: 'cancelled' }))
      onChanged?.()
    } catch {
      setMsg('Cancel failed. Contact support.')
    } finally {
      setCancelling(false)
    }
  }

  const siteName = order.details?.site || 'Email'
  const color = brandColor(siteName)
  const received = live.status === 'completed'
  const refunded = live.status === 'cancelled' || live.status === 'expired'
  const meta = `₦${Number(order.amount || 0).toLocaleString()} · ${fmtDate(order.created_at)}`

  // ── Refunded: compact, quiet ──
  if (refunded) {
    return (
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '0.9rem 1rem', animation: 'fadeSlideIn 0.3s ease both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
          <SiteTile name={siteName} size={32} dim />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>{siteName}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--muted)', wordBreak: 'break-all', marginTop: '0.1rem' }}>{order.details?.email}</div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.65rem', borderRadius: 50, background: 'rgba(240,180,41,0.12)', color: '#f0b429', fontSize: '0.68rem', fontWeight: 700, flexShrink: 0 }}>Refunded</span>
        </div>
        <div style={{ marginTop: '0.7rem', paddingTop: '0.6rem', borderTop: '1px dashed var(--border)', display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.72rem', color: 'var(--muted)' }}>
          <span>No code arrived — ₦{Number(order.amount || 0).toLocaleString()} returned to your wallet.</span>
          <span style={{ flexShrink: 0 }}>{fmtDate(order.created_at)}</span>
        </div>
      </div>
    )
  }

  // ── Waiting / Received: full card ──
  return (
    <div className={waiting ? 'em-live' : undefined}
      style={{ borderRadius: 20, padding: '1.25rem', position: 'relative', overflow: 'hidden', animation: 'scaleIn 0.3s ease both', ...(waiting ? {} : { background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.25)' }) }}>
      {/* Service + timer / status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.1rem', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: color, boxShadow: `0 0 10px ${color}`, animation: waiting ? 'pulse 2s ease infinite' : 'none' }} />
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{siteName}</span>
        </div>
        {waiting ? (
          expiresIn > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
              <ClockIcon color={urgent ? '#f43f5e' : 'var(--muted)'} />
              <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem', color: urgent ? '#f43f5e' : 'var(--muted)' }}>{fmtTime(expiresIn)}</span>
            </div>
          )
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#34d399', fontSize: '0.75rem', fontWeight: 600, flexShrink: 0 }}>
            <CheckIcon size={12} color="#34d399" /> Received
          </div>
        )}
      </div>

      {/* Email address */}
      <div style={{ marginBottom: '1.1rem' }}>
        <div style={{ fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Your email</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.15rem', color: 'var(--text)', letterSpacing: '0.01em', flex: 1, minWidth: 0, wordBreak: 'break-all', lineHeight: 1.3 }}>{order.details?.email}</span>
          <CopyBtn done={copied === 'email'} onClick={() => copy('email', order.details?.email)} />
        </div>
      </div>

      {/* Progress bar while waiting */}
      {waiting && (
        <div style={{ height: 3, borderRadius: 99, background: 'var(--border)', overflow: 'hidden', marginBottom: '1rem' }}>
          <div style={{ height: '100%', borderRadius: 99, background: urgent ? '#f43f5e' : 'var(--purple)', width: `${lifePct}%`, transition: 'width 1s linear, background 0.5s' }} />
        </div>
      )}

      {/* Body */}
      {received ? (
        live.code ? (
          <div style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 16, padding: '1.1rem', animation: 'smsReveal 0.4s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px #34d399' }} />
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#34d399', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Verification code</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
              <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: '2rem', color: 'var(--text)', letterSpacing: '0.15em', flex: 1, minWidth: 0, wordBreak: 'break-all' }}>{live.code}</span>
              <CopyBtn done={copied === 'code'} onClick={() => copy('code', live.code)} />
            </div>
            {live.text && live.text !== live.code && (
              <div style={{ fontSize: '0.76rem', color: 'var(--muted)', lineHeight: 1.5, marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px dashed rgba(52,211,153,0.25)', wordBreak: 'break-word' }}>{live.text}</div>
            )}
          </div>
        ) : (
          <div style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 14, padding: '1rem', fontSize: '0.8rem', color: 'var(--text)', lineHeight: 1.5, wordBreak: 'break-word' }}>
            {live.text || 'A message was received on this address.'}
          </div>
        )
      ) : (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '1rem', textAlign: 'center' }}>
          {expiresIn > 0 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <Spinner color="var(--purple)" />
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>Waiting for the code…</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                Enter this address on <span style={{ textTransform: 'capitalize', color: 'var(--text)', fontWeight: 600 }}>{siteName}</span>, then request the code once.
              </div>
            </>
          ) : (
            <div style={{ fontSize: '0.82rem', color: '#f43f5e', fontWeight: 600 }}>Time expired — refunding…</div>
          )}
        </div>
      )}

      {/* Cancel */}
      {waiting && (
        <button onClick={handleCancel} disabled={cancelling || unlockIn > 0} className="em-cancel"
          style={{ position: 'relative', overflow: 'hidden', width: '100%', marginTop: '0.85rem', padding: '0.8rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: 12, cursor: cancelling || unlockIn > 0 ? 'not-allowed' : 'pointer', color: 'var(--muted)', fontSize: '0.84rem', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
          {unlockIn > 0 && <span aria-hidden style={{ position: 'absolute', left: 0, bottom: 0, height: 2, width: `${lockPct}%`, background: 'var(--purple)', opacity: 0.7, transition: 'width 1s linear' }} />}
          <span style={{ position: 'relative' }}>
            {cancelling ? 'Cancelling…' : unlockIn > 0 ? `Cancel & Refund unlocks in ${fmtTime(unlockIn)}` : 'Cancel & Refund'}
          </span>
        </button>
      )}
      {msg && <ErrorBox text={msg} style={{ marginTop: '0.7rem', marginBottom: 0 }} />}

      <div style={{ marginTop: '0.9rem', fontSize: '0.66rem', color: 'var(--muted)', textAlign: 'center' }}>{meta}</div>
    </div>
  )
}

// ── Small pieces ────────────────────────────────────────────────────────
const stepBtn = { width: 26, height: 26, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card2)', color: 'var(--text)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, fontWeight: 700 }

// ── Real platform logos (same marks as the Virtual Numbers page) ──
const ICON_RULES = [
  ['whatsapp', /whatsapp/], ['telegram', /telegram/], ['facebook', /facebook|\bfb\b|messenger/], ['instagram', /instagram/],
  ['tiktok', /tiktok/], ['gmail', /gmail/], ['google', /google/], ['twitter', /twitter|\bx\b/], ['discord', /discord/],
  ['snapchat', /snapchat/], ['linkedin', /linkedin/], ['amazon', /amazon/], ['microsoft', /microsoft|outlook|hotmail|\blive\b/],
  ['viber', /viber/], ['line', /\bline\b/], ['signal', /signal/], ['uber', /uber/], ['netflix', /netflix/], ['tinder', /tinder/],
  ['paypal', /paypal/], ['wechat', /wechat/], ['yahoo', /yahoo/], ['steam', /steam/], ['shopee', /shopee/],
  ['truecaller', /truecaller/], ['zoho', /zoho/], ['proton', /proton/],
]
const iconKey = (name = '') => {
  const n = String(name).toLowerCase()
  const hit = ICON_RULES.find(([, re]) => re.test(n))
  return hit ? hit[0] : null
}

const ICONS = {
  whatsapp: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#25d366">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  ),
  telegram: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#0088cc">
      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  ),
  facebook: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#1877f2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
  instagram: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <defs>
        <linearGradient id="em-ig" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f09433"/>
          <stop offset="25%" stopColor="#e6683c"/>
          <stop offset="50%" stopColor="#dc2743"/>
          <stop offset="75%" stopColor="#cc2366"/>
          <stop offset="100%" stopColor="#bc1888"/>
        </linearGradient>
      </defs>
      <path fill="url(#em-ig)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  ),
  tiktok: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path fill="#ff0050" d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.52V6.75a4.85 4.85 0 01-1.02-.06z"/>
    </svg>
  ),
  gmail: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path fill="#ea4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.907 1.528-1.148C21.69 2.28 24 3.434 24 5.457z"/>
    </svg>
  ),
  twitter: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#e7e7e7">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
  google: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  ),
  discord: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#5865f2">
      <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  ),
  snapchat: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#fffc00">
      <path d="M12.166.006C9.834-.072 7.2.637 5.51 2.341 4.073 3.786 3.42 5.836 3.34 7.835c-.05 1.215-.01 2.43-.01 3.644-.31.156-.636.23-.968.252-.347.024-.706-.027-1.02-.177-.186-.09-.4-.232-.604-.166-.21.068-.332.292-.334.506-.003.29.212.527.46.645.82.387 1.693.4 2.566.553.1.463.275.902.572 1.28.07.09.004.226-.073.295-.28.247-.595.44-.904.637-.424.269-.87.568-1.117 1.017-.145.264-.146.6.044.843.208.266.553.326.863.3.468-.04.91-.225 1.355-.375.333-.113.688-.228 1.04-.188.32.036.598.205.856.39.567.406 1.103.876 1.793 1.117.747.26 1.54.295 2.326.3h.194c.786-.005 1.58-.04 2.327-.3.69-.241 1.226-.711 1.793-1.117.258-.185.535-.354.855-.39.353-.04.708.075 1.041.188.445.15.887.334 1.355.375.31.026.655-.034.863-.3.19-.243.189-.579.044-.843-.247-.449-.693-.748-1.117-1.017-.31-.197-.624-.39-.904-.637-.077-.069-.144-.206-.073-.295.297-.378.471-.817.572-1.28.873-.153 1.746-.166 2.566-.553.248-.118.463-.355.46-.645-.002-.214-.123-.438-.334-.506-.204-.066-.418.076-.604.166-.314.15-.673.2-1.02.177-.332-.022-.658-.096-.968-.252 0-1.215.04-2.43-.01-3.644-.08-1.999-.733-4.05-2.17-5.494C16.8.637 14.165-.072 12.166.006"/>
    </svg>
  ),
  linkedin: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#0a66c2">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 23.2 24 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  ),
  amazon: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path fill="#ff9900" d="M13.958 10.09c0 1.232.029 2.256-.591 3.351-.502.891-1.301 1.438-2.186 1.438-1.214 0-1.922-.924-1.922-2.292 0-2.692 2.415-3.182 4.7-3.182v.685zm3.186 7.705c-.209.189-.512.201-.745.076-1.047-.872-1.234-1.276-1.814-2.106-1.733 1.767-2.959 2.297-5.209 2.297-2.66 0-4.731-1.641-4.731-4.925 0-2.565 1.391-4.309 3.37-5.164 1.715-.754 4.11-.891 5.942-1.095v-.41c0-.753.06-1.642-.384-2.294-.385-.579-1.124-.82-1.775-.82-1.205 0-2.277.618-2.54 1.897-.054.285-.261.567-.549.582l-3.061-.331c-.259-.058-.548-.266-.472-.66C5.57 2.7 8.983 1.624 12.06 1.624c1.568 0 3.614.418 4.848 1.605 1.568 1.469 1.418 3.428 1.418 5.558v5.031c0 1.513.627 2.177 1.217 2.994.207.291.252.639-.01.855-.661.55-1.836 1.57-2.479 2.142l-.01-.014zm3.648 1.83C18.902 21.703 16.132 23 13.337 23c-3.81 0-6.93-1.418-9.414-3.783-.197-.178-.021-.422.215-.283 2.679 1.558 5.985 2.494 9.405 2.494 2.308 0 4.843-.479 7.174-1.471.351-.151.647.23.275.558zm.95-2.705c-.267-.343-1.77-.162-2.447-.082-.205.025-.237-.154-.051-.283 1.197-.842 3.162-.599 3.39-.317.228.283-.06 2.248-1.185 3.186-.172.145-.337.068-.26-.123.253-.631.817-2.041.553-2.381z"/>
    </svg>
  ),
  microsoft: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path fill="#f25022" d="M1 1h10v10H1z"/>
      <path fill="#00a4ef" d="M13 1h10v10H13z"/>
      <path fill="#7fba00" d="M1 13h10v10H1z"/>
      <path fill="#ffb900" d="M13 13h10v10H13z"/>
    </svg>
  ),
  viber: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#7360f2">
      <path d="M11.4.006C9.396.022 4.98.285 2.548 2.535 .804 4.28.21 6.83.144 9.988c-.066 3.158-.132 9.08 5.567 10.702h.005l-.005 2.456s-.038.96.596 1.152c.77.232 1.215-.492 1.95-1.28.4-.438.955-1.06 1.376-1.558 3.793.32 6.71-.41 7.043-.518.766-.248 5.1-.803 5.8-6.545.72-5.916-.35-9.649-2.834-11.329l-.001-.001c-.712-.506-3.57-1.066-7.24-1.06h-.001zm.034 1.76c3.16-.003 5.756.454 6.29.826 2.03 1.39 2.89 4.643 2.268 9.73-.578 4.847-4.022 5.15-4.666 5.356-.276.09-2.892.73-6.168.528 0 0-2.44 2.95-3.2 3.717-.118.12-.256.168-.348.147-.128-.03-.163-.18-.162-.394l.022-3.607C2.98 16.4 1.77 12.042 1.83 9.93c.057-2.63.53-4.82 1.98-6.224C5.856 1.9 9.746 1.768 11.434 1.765z"/>
    </svg>
  ),
  line: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#06c755">
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
    </svg>
  ),
  signal: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#3a76f0">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 4a8 8 0 110 16A8 8 0 0112 4zm0 2a6 6 0 100 12A6 6 0 0012 6zm0 2a4 4 0 110 8 4 4 0 010-8zm0 2a2 2 0 100 4 2 2 0 000-4z"/>
    </svg>
  ),
  uber: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <rect width="24" height="24" rx="4" fill="#000" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8"/>
      <path fill="#fff" d="M5 7h2v6a2 2 0 004 0V7h2v6a4 4 0 01-8 0V7zm9 0h2v10h-2V7z"/>
    </svg>
  ),
  netflix: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#e50914">
      <path d="M5.398 0v.006c3.028 8.556 5.37 15.175 8.348 23.578.788.15 1.555.343 2.413.429l-1.732-4.882c.918.196 1.87.309 2.854.309 4.785 0 8.664-3.879 8.664-8.664S22.451 2.13 17.666 2.13c-1.97 0-3.786.654-5.252 1.745C11.194 1.486 9.048 0 6.524 0H5.398zm8.28 4.805c1.01-.72 2.237-1.148 3.566-1.148 3.387 0 6.137 2.75 6.137 6.136s-2.75 6.137-6.137 6.137c-.706 0-1.385-.12-2.017-.34L13.678 4.805zM5.398 2.54v18.92c.65.14 1.295.298 1.94.465V12.37l5.97 9.555c.655.187 1.31.38 1.96.582L9.29 12.42V2.54H5.398z"/>
    </svg>
  ),
  tinder: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#fd5564">
      <path d="M8.21 10.08c-.02 0-.04 0-.06-.02-.67-.9-.84-1.96-.85-2.72 0-.34-.38-.54-.65-.34C4.6 8.4 3 10.87 3 13.55 3 18.74 7.26 23 12.45 23c5.2 0 9.45-4.26 9.45-9.45 0-5.39-3.87-9.17-7.77-10.03-.39-.09-.75.23-.7.62.23 2.07-.45 4.05-1.83 5.67-.19.23-.04.42.61.27z"/>
    </svg>
  ),
  paypal: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path fill="#0070e0" d="M7.076 21.337H2.47a.641.641 0 01-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 00-.607-.541c-.013.076-.026.175-.041.254-.59 3.025-2.566 4.643-5.813 4.643h-2.19c-.524 0-.968.382-1.05.9l-1.42 9.007h3.544c.524 0 .968-.383 1.05-.9l.586-3.704c.082-.518.527-.9 1.05-.9h1.364c3.688 0 6.074-1.715 6.85-5.12.31-1.375.196-2.546-.323-3.64z"/>
    </svg>
  ),
  wechat: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#07c160">
      <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-5.972 3.067-7.965C11.24 3.027 9.94 2.188 8.691 2.188zm-2.48 3.69c.498 0 .9.402.9.9 0 .498-.402.9-.9.9a.9.9 0 110-1.8zm4.95 0c.498 0 .9.402.9.9 0 .498-.402.9-.9.9a.9.9 0 110-1.8zM24 14.601c0-3.399-3.247-6.16-7.25-6.16s-7.25 2.761-7.25 6.16c0 3.4 3.247 6.16 7.25 6.16.957 0 1.874-.14 2.722-.395a.717.717 0 01.594.082l1.54.9a.297.297 0 00.14.047c.134 0 .24-.107.24-.242 0-.06-.024-.12-.04-.177l-.316-1.2a.49.49 0 01.178-.554C23.04 18.447 24 16.617 24 14.6zm-9.75-1.27a.75.75 0 110-1.5.75.75 0 010 1.5zm5 0a.75.75 0 110-1.5.75.75 0 010 1.5z"/>
    </svg>
  ),
  yahoo: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#8f4dff">
      <path d="M0 0l6.693 15.93L0 24h3.434l3.615-5.784L10.663 24h3.434L7.405 7.898h8.533L24 0H0z"/>
    </svg>
  ),
  steam: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#c7d5e0">
      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.624 0 11.979-5.355 11.979-11.979 0-6.623-5.355-11.979-11.979-11.979z"/>
    </svg>
  ),
  shopee: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#f53d2d">
      <path d="M19.317 5.43C18.59 2.374 15.836 0 12.525 0c-3.312 0-6.065 2.374-6.792 5.43H3.5L2 24h21L21.5 5.43h-2.183zM12.525 1.694c2.516 0 4.626 1.773 5.187 4.144H7.338c.561-2.371 2.672-4.144 5.187-4.144zm5.547 13.938a5.547 5.547 0 01-5.547 5.547 5.547 5.547 0 01-5.547-5.547 5.547 5.547 0 015.547-5.547 5.547 5.547 0 015.547 5.547zm-5.547-3.853a3.853 3.853 0 100 7.706 3.853 3.853 0 000-7.706z"/>
    </svg>
  ),
  truecaller: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#009de0">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.25 16.5l-1.5 1.5L9 11.25V7.5h2.25v3l6 6z"/>
    </svg>
  ),
  zoho: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#e0414d">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
    </svg>
  ),
  proton: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#6d4aff">
      <path d="M24 0H0v24h13.5c5.799 0 10.5-4.701 10.5-10.5V0zM13.5 17H11V9h2.5c2.21 0 4 1.79 4 4s-1.79 4-4 4z"/>
    </svg>
  ),
}

function SiteTile({ name, size = 36, radius, dim }) {
  const key = iconKey(name)
  if (key) {
    return (
      <span aria-hidden style={{ width: size, height: size, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: dim ? 0.55 : 1, filter: dim ? 'grayscale(60%)' : 'none' }}>
        {ICONS[key](Math.round(size * 0.82))}
      </span>
    )
  }
  const c = brandColor(name)
  const letter = String(name || '?').trim().charAt(0).toUpperCase() || '?'
  return (
    <span aria-hidden style={{ width: size, height: size, borderRadius: radius ?? Math.round(size * 0.3), flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${c}2e, ${c}12)`, border: `1px solid ${c}40`, color: c, fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: Math.round(size * 0.46), lineHeight: 1, opacity: dim ? 0.6 : 1 }}>
      {letter}
    </span>
  )
}

function SiteChip({ site, selected, onClick, index, mounted }) {
  const c = brandColor(site.name)
  return (
    <button className="em-chip" onClick={onClick} aria-pressed={selected} title={site.name}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1rem 0.4rem', minWidth: 0, background: selected ? `${c}15` : 'var(--card)', border: `1.5px solid ${selected ? c : 'var(--border)'}`, borderRadius: 14, cursor: 'pointer', boxShadow: selected ? `0 4px 16px ${c}33` : 'none', animation: mounted ? `fadeSlideIn 0.3s ease ${Math.min(index * 0.03, 0.3)}s both` : 'none' }}>
      <div style={{ filter: selected ? 'none' : 'grayscale(20%) opacity(0.9)', transition: 'filter 0.2s', display: 'flex' }}>
        <SiteTile name={site.name} size={32} />
      </div>
      <span style={{ fontSize: '0.66rem', fontWeight: 600, color: selected ? c : 'var(--muted)', textAlign: 'center', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textTransform: 'capitalize' }}>{site.name}</span>
    </button>
  )
}

function StepHeader({ n, done, title, right, muted }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.85rem' }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', background: done ? '#34d399' : 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.3s' }}>
        {done ? <CheckIcon size={11} color="#fff" /> : <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#fff' }}>{n}</span>}
      </div>
      <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>{title}</span>
      {right && (
        <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: muted ? 'var(--muted)' : '#34d399', display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '55%' }}>
          {!muted && <CheckIcon size={11} color="#34d399" />}
          {right}
        </span>
      )}
    </div>
  )
}

function MiniLabel({ children }) {
  return <div style={{ fontSize: '0.62rem', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, margin: '0 0 0.5rem 0.15rem' }}>{children}</div>
}

function Row({ label, children, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', gap: '0.5rem' }}>
      <span style={{ color: 'var(--muted)', flexShrink: 0, fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ color: 'var(--text)', fontWeight: bold ? 700 : 500, textAlign: 'right' }}>{children}</span>
    </div>
  )
}

function ErrorBox({ text, style }) {
  return (
    <div role="alert" style={{ background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 12, padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#f43f5e', marginBottom: '0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.55rem', lineHeight: 1.45, ...style }}>
      <span style={{ flexShrink: 0, marginTop: '0.1rem', display: 'flex' }}><InfoIcon size={15} color="#f43f5e" /></span>
      <span>{text}</span>
    </div>
  )
}

function CopyBtn({ done, onClick }) {
  return (
    <button onClick={onClick} className="em-copy" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', flexShrink: 0, background: done ? 'rgba(52,211,153,0.12)' : 'var(--card)', border: `1px solid ${done ? 'rgba(52,211,153,0.4)' : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', color: done ? '#34d399' : 'var(--text)', fontSize: '0.75rem', fontWeight: 600 }}>
      {done ? <><CheckIcon size={12} color="#34d399" /> Copied</> : <><CopyIcon /> Copy</>}
    </button>
  )
}

function Spinner({ color = 'currentColor', size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.9s linear infinite', flexShrink: 0 }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  )
}
function BackIcon() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> }
function SearchIcon({ size = 14 }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> }
function CheckIcon({ size = 14, color = 'currentColor' }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> }
function CopyIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> }
function MailIcon({ size = 18 }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg> }
function PlusIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function InfoIcon({ size = 16, color = 'currentColor' }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> }
function ClockIcon({ color = 'currentColor' }) { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> }
function ShieldIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg> }