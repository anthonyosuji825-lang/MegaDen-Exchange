'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import LoadingScreen from '@/components/RouteLoader'
import BottomNav from '@/components/BottomNav'
import DesktopSidebar from '@/components/DesktopSidebar'

const ACCENT = '#2dd4bf'
const POPULAR_CODES = ['US', 'GB', 'NG', 'CA', 'DE', 'FR', 'AU', 'NL', 'BR', 'IN', 'ES', 'IT', 'JP', 'ZA', 'AE', 'SG']

// Country code -> flag emoji (e.g. "NG" -> 🇳🇬). Returns '' if it isn't a 2-letter code.
const flagOf = (code = '') => {
  const c = String(code).trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(c)) return ''
  return String.fromCodePoint(...[...c].map((ch) => 127397 + ch.charCodeAt(0)))
}
const fmtClock = (s) => {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}
const fmtDate = (iso) => {
  try { return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}
const isRunning = (o) => o.status === 'active' || o.status === 'pending'

export default function ProxyPage() {
  const [isDesktop, setIsDesktop] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [tab, setTab] = useState('buy')

  const [catalog, setCatalog] = useState({ plans: [], countries: [], categories: [], expiry_hours: 6 })
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [countrySearch, setCountrySearch] = useState('')
  const [countryOpen, setCountryOpen] = useState(true)
  const [country, setCountry] = useState(null)
  const [state, setState] = useState('Random')
  const [stateSearch, setStateSearch] = useState('')
  const [plan, setPlan] = useState(null)
  const [proxyType, setProxyType] = useState(null)
  const [ordering, setOrdering] = useState(false)
  const [error, setError] = useState('')
  const [orders, setOrders] = useState([])

  // Synchronous guard against a double-tap buying twice.
  const orderingRef = useRef(false)
  const nextRef = useRef(null)
  const summaryRef = useRef(null)

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

  const loadOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/orders')
      const data = await res.json()
      if (res.ok) setOrders(data.orders || [])
    } catch { /* keep what we have */ }
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
      await loadOrders()
      setPageLoading(false)
    }
    load()
  }, [loadOrders])

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const res = await fetch('/api/proxy/plans')
        const data = await res.json()
        if (!res.ok) setError(data.error || 'Could not load proxy plans.')
        else {
          setCatalog(data)
          if (data.categories?.length) setProxyType(data.categories[0].type)
        }
      } catch {
        setError('Could not load proxy plans. Please refresh.')
      }
      setLoadingCatalog(false)
    }
    loadCatalog()
  }, [])

  // Bring the next step into view once the previous one is done.
  useEffect(() => {
    if (!country || countryOpen) return
    const t = setTimeout(() => nextRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 140)
    return () => clearTimeout(t)
  }, [country, countryOpen])

  useEffect(() => {
    if (!plan) return
    const t = setTimeout(() => summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 140)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id])

  const handleCountrySelect = (c) => {
    setCountry(c)
    setCountryOpen(false)
    setState('Random')
    setStateSearch('')
    setError('')
  }

  const handleBuy = async () => {
    if (!country || !plan || !user || orderingRef.current) return
    orderingRef.current = true
    setOrdering(true)
    setError('')
    try {
      const res = await fetch('/api/proxy/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: plan.id,
          country: country.code,
          state: state === 'Random' ? undefined : state,
          proxy_type: proxyType ?? undefined,
          // The price on screen - the server treats it as a ceiling only.
          expected_price_ngn: plan.price_ngn,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409 && data.code === 'PRICE_CHANGED' && Number.isFinite(data.price_ngn)) {
          const id = plan.id
          setPlan((p) => (p && p.id === id ? { ...p, price_ngn: data.price_ngn } : p))
          setCatalog((c) => ({ ...c, plans: c.plans.map((x) => (x.id === id ? { ...x, price_ngn: data.price_ngn } : x)) }))
        }
        setError(data.error || 'Purchase failed. Try again.')
        return
      }
      await Promise.all([loadOrders(), refreshBalance(user.id)])
      setCountry(null)
      setCountryOpen(true)
      setCountrySearch('')
      setState('Random')
      setPlan(null)
      setTab('mine')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      orderingRef.current = false
      setOrdering(false)
    }
  }

  const handleChanged = useCallback(() => { loadOrders() }, [loadOrders])

  // Popular countries first (when not searching), everything else in the API's order.
  const cq = countrySearch.trim().toLowerCase()
  const { popular, rest, matchCount } = useMemo(() => {
    const list = catalog.countries.filter((c) => c.name.toLowerCase().includes(cq) || c.code.toLowerCase() === cq)
    if (cq) return { popular: [], rest: list, matchCount: list.length }
    const pop = list
      .map((c) => ({ c, r: POPULAR_CODES.indexOf(String(c.code).toUpperCase()) }))
      .filter((x) => x.r >= 0)
      .sort((a, b) => a.r - b.r)
      .map((x) => x.c)
    const ids = new Set(pop.map((c) => c.code))
    return { popular: pop, rest: list.filter((c) => !ids.has(c.code)), matchCount: list.length }
  }, [catalog.countries, cq])

  // name/code -> flag, so order cards can show a flag for the country they were bought in.
  const flags = useMemo(() => {
    const m = {}
    for (const c of catalog.countries) {
      const f = flagOf(c.code)
      if (!f) continue
      m[String(c.name).toLowerCase()] = f
      m[String(c.code).toLowerCase()] = f
    }
    return m
  }, [catalog.countries])

  const states = country ? country.states.filter((s) => s.toLowerCase() !== 'random') : []
  const sq = stateSearch.trim().toLowerCase()
  const shownStates = states.filter((s) => s.toLowerCase().includes(sq))
  const total = plan?.price_ngn || 0
  const hasBalance = (profile?.wallet_balance || 0) >= total
  const runningOrders = orders.filter(isRunning)
  const pastOrders = orders.filter((o) => !isRunning(o))
  const runningCount = runningOrders.length
  const planStep = states.length > 0 ? 3 : 2

  const perIps = catalog.plans.map((p) => p.per_ip_ngn).filter((n) => Number.isFinite(n))
  const bestPer = perIps.length ? Math.min(...perIps) : null
  const worstPer = perIps.length ? Math.max(...perIps) : null
  const hasSpread = bestPer !== null && bestPer !== worstPer
  const selectedFormat = catalog.categories.find((c) => c.type === proxyType)

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
        .px-scroll::-webkit-scrollbar { width: 4px; }
        .px-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }
        .px-chip { transition: transform 0.15s ease, border-color 0.15s, background 0.15s, box-shadow 0.15s; }
        .px-chip:hover:not(:disabled) { transform: translateY(-2px); }
        .px-chip:active:not(:disabled) { transform: scale(0.97); }
        .px-chip:focus-visible, .px-tab:focus-visible, .px-copy:focus-visible, .px-buy:focus-visible, .px-act:focus-visible, .px-link:focus-visible { outline: 2px solid var(--purple); outline-offset: 2px; }
        .px-buy { transition: transform 0.18s ease, box-shadow 0.18s, background 0.18s; }
        .px-buy:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 32px rgba(108,78,242,0.45); }
        .px-buy:active:not(:disabled) { transform: scale(0.98); }
        .px-search { transition: border-color 0.2s, box-shadow 0.2s; }
        .px-search:focus { border-color: var(--purple) !important; box-shadow: 0 0 0 3px rgba(108,78,242,0.12); }
        .px-back { transition: background 0.15s, transform 0.15s; }
        .px-back:hover { background: var(--card2) !important; transform: translateX(-2px); }
        .px-copy { transition: background 0.15s, transform 0.15s; }
        .px-copy:hover { transform: scale(1.05); }
        .px-copy:active { transform: scale(0.95); }
        .px-act { transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.15s; }
        .px-act:hover:not(:disabled) { background: var(--card2) !important; transform: translateY(-1px); }
        .px-act.danger:hover:not(:disabled) { background: rgba(244,63,94,0.08) !important; border-color: rgba(244,63,94,0.5) !important; }
        .px-link { transition: background 0.15s, border-color 0.15s; }
        .px-link:hover { background: var(--card2) !important; }
        .px-tab { transition: background 0.2s, color 0.2s, border-color 0.2s; }
        .px-live { background: linear-gradient(135deg, rgba(108,78,242,0.09) 0%, rgba(45,212,191,0.06) 100%); border: 1px solid rgba(108,78,242,0.28); animation: glow 3s ease infinite; }
        .px-skel { background: linear-gradient(90deg, var(--card) 25%, var(--card2) 50%, var(--card) 75%); background-size: 200% 100%; animation: shimmer 1.4s linear infinite; border: 1px solid var(--border); }
        @media (max-width: 380px) { .px-grid { grid-template-columns: 1fr !important; } }
        @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; } }
      `}</style>

      {isDesktop && <DesktopSidebar profile={profile} onLogout={handleLogout} />}

      <div style={{ flex: isDesktop ? 1 : 'none', minWidth: 0, paddingBottom: isDesktop ? '2rem' : '6.5rem' }}>
        {/* ── STICKY HEADER ── */}
        <div style={{ padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.85rem', position: 'sticky', top: 0, zIndex: 100, background: 'rgba(var(--navy-rgb, 10,10,30), 0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)' }}>
          <Link href="/dashboard" className="px-back" aria-label="Back to dashboard" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', textDecoration: 'none', flexShrink: 0 }}>
            <BackIcon />
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--text)', letterSpacing: '-0.02em' }}>Residential Proxies</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.05rem' }}>Real residential IPs · up to {catalog.expiry_hours}h each</div>
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
              { id: 'buy', label: 'Buy a proxy', icon: <PlusIcon /> },
              { id: 'mine', label: 'My proxies', icon: <GlobeIcon size={14} />, badge: runningCount },
            ].map((t) => {
              const on = tab === t.id
              return (
                <button key={t.id} role="tab" aria-selected={on} className="px-tab" onClick={() => setTab(t.id)}
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
              {/* Important: no refunds */}
              <div style={{ background: 'rgba(240,180,41,0.08)', border: '1px solid rgba(240,180,41,0.3)', borderRadius: 14, padding: '0.8rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                <span style={{ flexShrink: 0, marginTop: '0.1rem', display: 'flex' }}><WarnIcon color="#f0b429" /></span>
                <div style={{ fontSize: '0.76rem', color: 'var(--text)', lineHeight: 1.55 }}>
                  <strong>Please note:</strong> proxies cannot be refunded once bought.
                  <div style={{ color: 'var(--muted)', marginTop: '0.2rem' }}>
                    After buying, tap “Get proxy” to start it — the {catalog.expiry_hours}-hour timer begins then.
                  </div>
                </div>
              </div>

              {/* How it works */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1.4rem' }}>
                {[
                  { n: 1, t: 'Pick location', s: 'country & state' },
                  { n: 2, t: 'Choose a plan', s: 'how many IPs' },
                  { n: 3, t: 'Get proxy', s: 'start when ready' },
                ].map((h) => (
                  <div key={h.n} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '0.65rem 0.6rem', textAlign: 'center' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', margin: '0 auto 0.4rem', background: 'rgba(108,78,242,0.15)', color: 'var(--purple2)', fontSize: '0.66rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{h.n}</div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>{h.t}</div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{h.s}</div>
                  </div>
                ))}
              </div>

              {/* ── STEP 1: COUNTRY ── */}
              <div style={{ marginBottom: '1.5rem' }}>
                <StepHeader n={1} done={!!country} title="Select country"
                  right={country && !countryOpen ? null : (!loadingCatalog && catalog.countries.length > 0 ? `${matchCount} available` : null)} muted />

                {country && !countryOpen ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0.85rem', background: 'rgba(108,78,242,0.08)', border: '1.5px solid var(--purple)', borderRadius: 14, boxShadow: '0 4px 16px rgba(108,78,242,0.18)', animation: 'scaleIn 0.25s ease both' }}>
                    <span style={{ fontSize: '1.7rem', lineHeight: 1, flexShrink: 0 }}>{flagOf(country.code) || <GlobeIcon size={26} />}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{country.name}</div>
                      <div style={{ fontSize: '0.66rem', color: 'var(--muted)', marginTop: '0.05rem' }}>Selected country</div>
                    </div>
                    <button onClick={() => setCountryOpen(true)} className="px-link"
                      style={{ padding: '0.4rem 0.8rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', color: 'var(--text)', fontSize: '0.74rem', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ position: 'relative', marginBottom: '0.7rem' }}>
                      <div style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }}><SearchIcon /></div>
                      <input className="px-search" placeholder="Search country…" aria-label="Search country" value={countrySearch} onChange={(e) => setCountrySearch(e.target.value)}
                        style={{ width: '100%', padding: '0.7rem 2.4rem 0.7rem 2.4rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: '0.85rem', outline: 'none', fontFamily: 'Inter, sans-serif' }} />
                      {countrySearch && (
                        <button onClick={() => setCountrySearch('')} aria-label="Clear search"
                          style={{ position: 'absolute', right: '0.55rem', top: '50%', transform: 'translateY(-50%)', width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'var(--card2)', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', lineHeight: 1 }}>×</button>
                      )}
                    </div>

                    {loadingCatalog ? (
                      <div className="px-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="px-skel" style={{ height: 52, borderRadius: 12 }} />)}
                      </div>
                    ) : matchCount === 0 && catalog.countries.length > 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--muted)', fontSize: '0.82rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem', opacity: 0.6 }}><SearchIcon size={22} /></div>
                        No country found for “{countrySearch}”
                      </div>
                    ) : (
                      <div className="px-scroll" style={{ maxHeight: 340, overflowY: 'auto', paddingRight: 2 }}>
                        {popular.length > 0 && (
                          <>
                            <MiniLabel>Popular</MiniLabel>
                            <div className="px-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                              {popular.map((c, i) => (
                                <CountryChip key={c.code} c={c} index={i} mounted={mounted} selected={country?.code === c.code} onClick={() => handleCountrySelect(c)} />
                              ))}
                            </div>
                          </>
                        )}
                        {rest.length > 0 && (
                          <>
                            {popular.length > 0 && <MiniLabel>All countries</MiniLabel>}
                            <div className="px-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                              {rest.map((c, i) => (
                                <CountryChip key={c.code} c={c} index={popular.length ? 0 : i} mounted={mounted} selected={country?.code === c.code} onClick={() => handleCountrySelect(c)} />
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* ── STEP 2: STATE (only where the country has them) ── */}
              {country && states.length > 0 && (
                <div ref={nextRef} style={{ marginBottom: '1.5rem', scrollMarginTop: 84, animation: 'fadeSlideIn 0.35s ease both' }}>
                  <StepHeader n={2} done title="Choose state · optional" right={state} />
                  {states.length > 12 && (
                    <div style={{ position: 'relative', marginBottom: '0.6rem' }}>
                      <div style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }}><SearchIcon size={13} /></div>
                      <input className="px-search" placeholder="Search state…" aria-label="Search state" value={stateSearch} onChange={(e) => setStateSearch(e.target.value)}
                        style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.2rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: '0.8rem', outline: 'none', fontFamily: 'Inter, sans-serif' }} />
                    </div>
                  )}
                  <div className="px-scroll" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', maxHeight: 176, overflowY: 'auto', paddingRight: 2 }}>
                    {(sq ? shownStates : ['Random', ...states]).map((s) => {
                      const sel = state === s
                      const isRandom = s === 'Random'
                      return (
                        <button key={s} className="px-chip" aria-pressed={sel} onClick={() => setState(s)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', borderRadius: 50, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, background: sel ? 'rgba(108,78,242,0.14)' : 'var(--card)', border: `1.5px solid ${sel ? 'var(--purple)' : 'var(--border)'}`, color: sel ? 'var(--purple2)' : 'var(--text)' }}>
                          {isRandom && <ShuffleIcon />}
                          {isRandom ? 'Any (random)' : s}
                        </button>
                      )
                    })}
                    {sq && shownStates.length === 0 && (
                      <div style={{ width: '100%', textAlign: 'center', padding: '1rem', color: 'var(--muted)', fontSize: '0.8rem' }}>No state found for “{stateSearch}”</div>
                    )}
                  </div>
                </div>
              )}

              {/* ── STEP 3: PLAN ── */}
              {country && (
                <div ref={states.length > 0 ? undefined : nextRef} style={{ marginBottom: '1.5rem', scrollMarginTop: 84, animation: 'fadeSlideIn 0.35s ease both' }}>
                  <StepHeader n={planStep} done={!!plan} title="Choose a plan" right={plan ? `${plan.quantity} ${plan.quantity === 1 ? 'IP' : 'IPs'}` : null} />
                  {catalog.plans.length === 0 ? (
                    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, textAlign: 'center', padding: '1.6rem 1rem', color: 'var(--muted)', fontSize: '0.82rem' }}>No plans available right now.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {catalog.plans.map((p, i) => {
                        const sel = plan?.id === p.id
                        const best = hasSpread && p.per_ip_ngn === bestPer
                        const save = hasSpread && worstPer ? Math.round((1 - p.per_ip_ngn / worstPer) * 100) : 0
                        return (
                          <button key={p.id} className="px-chip" aria-pressed={sel} onClick={() => { setPlan(p); setError('') }}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.85rem 0.95rem', borderRadius: 14, cursor: 'pointer', textAlign: 'left', background: sel ? 'rgba(108,78,242,0.1)' : 'var(--card)', border: `1.5px solid ${sel ? 'var(--purple)' : 'var(--border)'}`, boxShadow: sel ? '0 4px 16px rgba(108,78,242,0.18)' : 'none', animation: mounted ? `fadeSlideIn 0.3s ease ${Math.min(i * 0.04, 0.24)}s both` : 'none' }}>
                            <span style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, border: `2px solid ${sel ? 'var(--purple)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.15s' }}>
                              {sel && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--purple)' }} />}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>{p.quantity} {p.quantity === 1 ? 'IP' : 'IPs'}</span>
                                {best && <span style={{ padding: '0.1rem 0.45rem', borderRadius: 99, background: 'rgba(52,211,153,0.12)', color: '#34d399', fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Best value</span>}
                                {!best && save > 0 && <span style={{ padding: '0.1rem 0.45rem', borderRadius: 99, background: 'rgba(45,212,191,0.1)', color: ACCENT, fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Save {save}%</span>}
                              </div>
                              <div style={{ fontSize: '0.67rem', color: 'var(--muted)', marginTop: '0.15rem' }}>₦{p.per_ip_ngn.toLocaleString()} per IP · {catalog.expiry_hours}h each</div>
                            </div>
                            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.98rem', color: 'var(--gold)', flexShrink: 0 }}>₦{p.price_ngn.toLocaleString()}</div>
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {catalog.categories.length > 1 && (
                    <div style={{ marginTop: '1.1rem' }}>
                      <MiniLabel>Format</MiniLabel>
                      <div style={{ display: 'grid', gridTemplateColumns: catalog.categories.length === 2 ? '1fr 1fr' : '1fr', gap: '0.5rem' }}>
                        {catalog.categories.map((c) => {
                          const sel = proxyType === c.type
                          return (
                            <button key={c.id} className="px-chip" aria-pressed={sel} onClick={() => setProxyType(c.type)}
                              style={{ textAlign: 'left', padding: '0.7rem 0.85rem', borderRadius: 12, cursor: 'pointer', background: sel ? 'rgba(108,78,242,0.1)' : 'var(--card)', border: `1.5px solid ${sel ? 'var(--purple)' : 'var(--border)'}` }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: sel ? 'var(--purple2)' : 'var(--text)' }}>{c.name}</span>
                                {sel && <CheckIcon size={12} color="var(--purple2)" />}
                              </div>
                              {c.description && <div style={{ fontSize: '0.67rem', color: 'var(--muted)', marginTop: '0.2rem', lineHeight: 1.4 }}>{c.description}</div>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── SUMMARY + BUY ── */}
              {country && plan && (
                <div ref={summaryRef} style={{ scrollMarginTop: 84, animation: 'scaleIn 0.3s ease both' }}>
                  <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '1rem', marginBottom: '0.75rem' }}>
                    <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)', marginBottom: '0.75rem' }}>Order summary</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      <Row label="Location">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span>{flagOf(country.code)}</span>
                          {country.name}{state !== 'Random' ? ` · ${state}` : ''}
                        </span>
                      </Row>
                      <Row label="Plan">{plan.quantity} {plan.quantity === 1 ? 'IP' : 'IPs'}</Row>
                      {catalog.categories.length > 1 && selectedFormat && <Row label="Format">{selectedFormat.name}</Row>}
                      <Row label="Lasts">{catalog.expiry_hours} hours after “Get proxy”</Row>
                      <Row label="Balance">
                        <span style={{ color: hasBalance ? '#10b981' : '#f43f5e', fontWeight: 700 }}>₦{(profile?.wallet_balance || 0).toLocaleString()}</span>
                      </Row>
                      <div style={{ height: 1, background: 'var(--border)', margin: '0.1rem 0' }} />
                      <Row label="Total" bold>
                        <span style={{ color: 'var(--gold)', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem' }}>₦{total.toLocaleString()}</span>
                      </Row>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border)', fontSize: '0.7rem', color: 'var(--muted)' }}>
                      <span style={{ color: '#f0b429', display: 'flex' }}><WarnIcon color="#f0b429" size={14} /></span>
                      Non-refundable once bought. The timer starts when you tap “Get proxy”.
                    </div>
                  </div>

                  {!hasBalance && (
                    <div style={{ background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 12, padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#f43f5e', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Insufficient balance</span>
                      <Link href="/dashboard/wallet" style={{ color: '#f43f5e', fontWeight: 700, textDecoration: 'none', fontSize: '0.75rem' }}>Fund Wallet →</Link>
                    </div>
                  )}
                  {error && <ErrorBox text={error} />}

                  <button onClick={handleBuy} disabled={ordering || !hasBalance} className="px-buy"
                    style={{ width: '100%', padding: '1rem', background: !hasBalance ? 'var(--card2)' : ordering ? 'var(--purple2)' : 'var(--purple)', color: !hasBalance ? 'var(--muted)' : '#fff', border: 'none', borderRadius: 14, fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem', fontWeight: 700, cursor: ordering || !hasBalance ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', opacity: !hasBalance ? 0.6 : 1 }}>
                    {ordering ? (<><Spinner size={18} /> Buying your proxy…</>) : `Buy proxy — ₦${total.toLocaleString()}`}
                  </button>
                </div>
              )}

              {error && !plan && <ErrorBox text={error} />}
            </div>
          ) : (
            <div key="mine" style={{ animation: mounted ? 'fadeSlideIn 0.35s ease both' : 'none' }}>
              {orders.length === 0 ? (
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: '2.5rem 1.2rem', textAlign: 'center' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 20, margin: '0 auto 1rem', background: 'rgba(108,78,242,0.1)', border: '1px solid rgba(108,78,242,0.25)', color: 'var(--purple2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><GlobeIcon size={28} /></div>
                  <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', marginBottom: '0.3rem' }}>No proxies yet</div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginBottom: '1.1rem', lineHeight: 1.5 }}>Buy a residential proxy to get a real IP in the country you need.</div>
                  <button onClick={() => setTab('buy')} className="px-buy" style={{ padding: '0.7rem 1.5rem', background: 'var(--purple)', color: '#fff', border: 'none', borderRadius: 12, fontSize: '0.85rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif', cursor: 'pointer' }}>Buy a proxy</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {runningOrders.length > 0 && (
                    <>
                      <MiniLabel>Running · {runningOrders.length}</MiniLabel>
                      {runningOrders.map((o) => <ProxyCard key={o.id} order={o} flags={flags} expiryHours={catalog.expiry_hours} onChanged={handleChanged} />)}
                    </>
                  )}
                  {pastOrders.length > 0 && (
                    <>
                      <div style={{ marginTop: runningOrders.length ? '0.4rem' : 0 }}><MiniLabel>History</MiniLabel></div>
                      {pastOrders.map((o) => <ProxyCard key={o.id} order={o} flags={flags} expiryHours={catalog.expiry_hours} onChanged={handleChanged} />)}
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

// One purchased proxy. Credentials live only in this component's memory.
function ProxyCard({ order, flags, expiryHours, onChanged }) {
  const [now, setNow] = useState(Date.now())
  const [creds, setCreds] = useState(null)
  const [busy, setBusy] = useState('') // which action is running
  const [msg, setMsg] = useState('')
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState('')
  const [showPw, setShowPw] = useState(false)

  const active = order.status === 'active'
  const pending = order.status === 'pending'
  const expiresMs = order.expires_at ? Date.parse(order.expires_at) : NaN
  const left = active && Number.isFinite(expiresMs) ? Math.max(0, Math.ceil((expiresMs - now) / 1000)) : 0
  const totalSecs = (expiryHours || 6) * 3600
  const pct = Math.min(100, Math.max(0, (left / totalSecs) * 100))
  const urgent = left <= 600

  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [active])

  // When the timer hits zero, refresh so the server marks it expired.
  useEffect(() => {
    if (active && Number.isFinite(expiresMs) && left === 0) onChanged?.()
  }, [active, expiresMs, left, onChanged])

  const copy = (key, value) => {
    if (!value) return
    navigator.clipboard.writeText(String(value))
    setCopied(key)
    setTimeout(() => setCopied(''), 1800)
  }

  const run = async (action) => {
    if (busy) return
    setBusy(action)
    setMsg('')
    setNote('')
    try {
      const res = await fetch('/api/proxy/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: order.id, action }) })
      const data = await res.json()
      if (!res.ok) {
        setMsg(data.error || 'Something went wrong. Please try again.')
        if (data.status) { setCreds(null); onChanged?.() }
        return
      }
      if (action === 'verify') {
        setNote(data.checked === false ? 'Could not run the check right now.' : data.alive ? 'Your proxy is alive and working.' : 'This proxy is no longer alive.')
        if (data.alive === false) { setCreds(null); onChanged?.() }
        return
      }
      if (action === 'stop') { setCreds(null); onChanged?.(); return }
      if (data.credentials) setCreds(data.credentials)
      if (action === 'rotate') setNote('Your IP was changed. The new details are shown below.')
      onChanged?.()
    } catch {
      setMsg('Something went wrong. Please try again.')
    } finally {
      setBusy('')
    }
  }

  const stop = () => {
    if (window.confirm('Stop this proxy? It will be released and cannot be started again.')) run('stop')
  }

  const where = order.state ? `${order.country} · ${order.state}` : order.country
  const flag = flags?.[String(order.country || '').toLowerCase()] || ''
  const meta = `${fmtDate(order.created_at)} · ₦${Number(order.amount).toLocaleString()}`
  const badge = active ? { t: 'Active', c: '#34d399', bg: 'rgba(52,211,153,0.12)' }
    : pending ? { t: 'Not started', c: '#f0b429', bg: 'rgba(240,180,41,0.12)' }
    : order.status === 'expired' ? { t: 'Expired', c: 'var(--muted)', bg: 'var(--card2)' }
    : { t: 'Stopped', c: 'var(--muted)', bg: 'var(--card2)' }

  const Badge = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.2rem 0.65rem', borderRadius: 50, background: badge.bg, color: badge.c, fontSize: '0.68rem', fontWeight: 700, flexShrink: 0 }}>
      {active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', animation: 'pulse 1.6s ease infinite' }} />}
      {badge.t}
    </span>
  )
  const Lead = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', minWidth: 0 }}>
      <span style={{ fontSize: '1.6rem', lineHeight: 1, flexShrink: 0, display: 'flex', opacity: active || pending ? 1 : 0.55 }}>{flag || <GlobeIcon size={24} />}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{where}</div>
        <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{meta}</div>
      </div>
    </div>
  )

  // ── Expired / stopped: compact, quiet ──
  if (!active && !pending) {
    return (
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '0.9rem 1rem', animation: 'fadeSlideIn 0.3s ease both' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem' }}>
          {Lead}
          {Badge}
        </div>
        <div style={{ marginTop: '0.7rem', paddingTop: '0.6rem', borderTop: '1px dashed var(--border)', fontSize: '0.72rem', color: 'var(--muted)', lineHeight: 1.5 }}>
          {order.status === 'expired' ? 'This proxy has expired. Buy a new one to keep going.' : 'This proxy was stopped and released.'}
        </div>
      </div>
    )
  }

  return (
    <div className={active ? 'px-live' : undefined}
      style={{ borderRadius: 20, padding: '1.25rem', position: 'relative', overflow: 'hidden', animation: 'scaleIn 0.3s ease both', ...(active ? {} : { background: 'linear-gradient(135deg, rgba(240,180,41,0.06) 0%, rgba(108,78,242,0.06) 100%)', border: '1px solid rgba(240,180,41,0.28)' }) }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', marginBottom: '1.1rem' }}>
        {Lead}
        {Badge}
      </div>

      {pending && (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '0.85rem', marginBottom: '0.85rem' }}>
            <span style={{ flexShrink: 0, marginTop: '0.1rem', display: 'flex' }}><InfoIcon size={15} color="var(--purple2)" /></span>
            <div style={{ fontSize: '0.78rem', color: 'var(--text)', lineHeight: 1.55 }}>
              Bought and ready. Tap below to start it and get your connection details.
              <div style={{ color: 'var(--muted)', marginTop: '0.15rem' }}>The {expiryHours || 6}-hour timer starts when you do.</div>
            </div>
          </div>
          <ActionBtn primary icon={<PlayIcon />} onClick={() => run('extract')} busy={busy === 'extract'} disabled={!!busy}>Get proxy</ActionBtn>
        </>
      )}

      {active && (
        <>
          {/* Timer */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '0.95rem', textAlign: 'center', marginBottom: '0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem' }}>
              <ClockIcon color={urgent ? '#f43f5e' : 'var(--muted)'} />
              <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.6rem', letterSpacing: '0.02em', color: urgent ? '#f43f5e' : 'var(--text)' }}>{fmtClock(left)}</span>
            </div>
            <div style={{ fontSize: '0.64rem', color: 'var(--muted)', marginTop: '0.15rem', marginBottom: '0.7rem' }}>Time left on this proxy</div>
            <div style={{ height: 3, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 99, background: urgent ? '#f43f5e' : 'var(--purple)', width: `${pct}%`, transition: 'width 1s linear, background 0.5s' }} />
            </div>
          </div>

          {/* Credentials */}
          {creds && (
            <div style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 16, padding: '0.5rem 0.95rem 0.95rem', marginBottom: '0.8rem', animation: 'smsReveal 0.4s ease both' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0 0.2rem' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px #34d399' }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#34d399', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Connection details</span>
              </div>
              {[['Host', creds.host], ['Port', creds.port], ['Username', creds.username], ['Password', creds.password]].map(([label, value], i, arr) => {
                const isPw = label === 'Password'
                const shown = isPw && !showPw ? '•'.repeat(Math.min(String(value ?? '').length || 8, 14)) : value
                return (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', padding: '0.5rem 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(52,211,153,0.12)' : 'none' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.6rem', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)', wordBreak: 'break-all', letterSpacing: isPw && !showPw ? '0.12em' : 'normal' }}>{shown}</div>
                    </div>
                    {isPw && (
                      <button onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'} className="px-copy"
                        style={{ width: 32, height: 32, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', color: 'var(--muted)' }}>
                        {showPw ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    )}
                    <CopyBtn done={copied === label} onClick={() => copy(label, value)} />
                  </div>
                )
              })}

              {creds.url && (
                <div style={{ marginTop: '0.4rem', paddingTop: '0.7rem', borderTop: '1px dashed rgba(52,211,153,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Full string</div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text)', wordBreak: 'break-all', lineHeight: 1.4, marginTop: '0.1rem' }}>
                      {showPw ? creds.url : String(creds.url).replace(creds.password || '\u0000', '••••••')}
                    </div>
                  </div>
                  <CopyBtn done={copied === 'url'} onClick={() => copy('url', creds.url)} />
                </div>
              )}

              <button onClick={() => copy('all', `${creds.host}:${creds.port}:${creds.username}:${creds.password}`)} className="px-act"
                style={{ width: '100%', marginTop: '0.75rem', padding: '0.6rem', borderRadius: 11, cursor: 'pointer', background: copied === 'all' ? 'rgba(52,211,153,0.12)' : 'transparent', border: `1px solid ${copied === 'all' ? 'rgba(52,211,153,0.4)' : 'var(--border)'}`, color: copied === 'all' ? '#34d399' : 'var(--text)', fontSize: '0.74rem', fontWeight: 600, fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                {copied === 'all' ? <><CheckIcon size={12} color="#34d399" /> Copied</> : <><CopyIcon /> Copy as host:port:user:pass</>}
              </button>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <ActionBtn icon={creds ? <RefreshIcon /> : <EyeIcon />} onClick={() => run('reveal')} busy={busy === 'reveal'} disabled={!!busy}>{creds ? 'Refresh details' : 'Show details'}</ActionBtn>
            <ActionBtn icon={<PulseIcon />} onClick={() => run('verify')} busy={busy === 'verify'} disabled={!!busy}>Check proxy</ActionBtn>
            <ActionBtn icon={<ShuffleIcon />} onClick={() => run('rotate')} busy={busy === 'rotate'} disabled={!!busy}>Change IP</ActionBtn>
            <ActionBtn danger icon={<StopIcon />} onClick={stop} busy={busy === 'stop'} disabled={!!busy}>Stop</ActionBtn>
          </div>
        </>
      )}

      {note && (
        <div style={{ marginTop: '0.8rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.78rem', color: '#34d399', lineHeight: 1.45 }}>
          <span style={{ flexShrink: 0, marginTop: '0.12rem', display: 'flex' }}><CheckIcon size={13} color="#34d399" /></span>
          {note}
        </div>
      )}
      {msg && <ErrorBox text={msg} style={{ marginTop: '0.7rem', marginBottom: 0 }} />}
    </div>
  )
}

// ── Small pieces ────────────────────────────────────────────────────────
function CountryChip({ c, selected, onClick, index, mounted }) {
  const flag = flagOf(c.code)
  return (
    <button className="px-chip" onClick={onClick} aria-pressed={selected} title={c.name}
      style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.7rem 0.8rem', minWidth: 0, background: selected ? 'rgba(108,78,242,0.1)' : 'var(--card)', border: `1.5px solid ${selected ? 'var(--purple)' : 'var(--border)'}`, borderRadius: 12, cursor: 'pointer', textAlign: 'left', boxShadow: selected ? '0 4px 16px rgba(108,78,242,0.18)' : 'none', animation: mounted ? `fadeSlideIn 0.3s ease ${Math.min(index * 0.025, 0.25)}s both` : 'none' }}>
      <span style={{ fontSize: '1.3rem', lineHeight: 1, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24 }}>
        {flag || <span style={{ fontSize: '0.58rem', fontWeight: 800, color: ACCENT, background: 'rgba(45,212,191,0.12)', borderRadius: 6, padding: '0.15rem 0.3rem' }}>{c.code}</span>}
      </span>
      <span style={{ flex: 1, minWidth: 0, fontSize: '0.76rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
      {selected && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--purple)', flexShrink: 0 }} />}
    </button>
  )
}

function ActionBtn({ children, onClick, busy, disabled, primary, danger, icon }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`px-act${danger ? ' danger' : ''}${primary ? ' px-buy' : ''}`}
      style={{ width: '100%', padding: primary ? '0.9rem' : '0.75rem 0.6rem', borderRadius: 12, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: primary ? '0.92rem' : '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', opacity: disabled && !busy ? 0.6 : 1,
        background: primary ? 'var(--purple)' : 'transparent',
        color: primary ? '#fff' : danger ? '#f43f5e' : 'var(--text)',
        border: primary ? 'none' : `1px solid ${danger ? 'rgba(244,63,94,0.35)' : 'var(--border)'}` }}>
      {busy ? <Spinner /> : icon}
      {children}
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
        <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: muted ? 'var(--muted)' : '#34d399', display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '50%' }}>
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
    <button onClick={onClick} className="px-copy" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.8rem', flexShrink: 0, background: done ? 'rgba(52,211,153,0.12)' : 'var(--card)', border: `1px solid ${done ? 'rgba(52,211,153,0.4)' : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', color: done ? '#34d399' : 'var(--text)', fontSize: '0.74rem', fontWeight: 600 }}>
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
function GlobeIcon({ size = 18 }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> }
function PlusIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function InfoIcon({ size = 16, color = 'currentColor' }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> }
function WarnIcon({ size = 17, color = 'currentColor' }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> }
function ClockIcon({ color = 'currentColor' }) { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> }
function ShuffleIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg> }
function EyeIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> }
function EyeOffIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> }
function RefreshIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> }
function PulseIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> }
function StopIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="5" width="14" height="14" rx="2"/></svg> }
function PlayIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg> }