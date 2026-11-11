'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import LoadingScreen from '@/components/RouteLoader'
import BottomNav from '@/components/BottomNav'
import DesktopSidebar from '@/components/DesktopSidebar'

const ACCENT = '#a78bfa'

const SCOPES = [
  { id: 'country', label: 'Countries' },
  { id: 'regional', label: 'Regions' },
  { id: 'global', label: 'Global' },
]
const TYPES = [
  { id: 'data', label: 'Data' },
  { id: 'unlimited', label: 'Unlimited' },
  { id: 'calling', label: 'Calling' },
]

// Popular travel destinations are shown first when browsing countries.
const POPULAR_CODES = ['US', 'GB', 'AE', 'CA', 'TR', 'FR', 'DE', 'IT', 'ES', 'ZA', 'GH', 'EG', 'SA', 'IN', 'CN', 'TH', 'JP', 'NL']

const fmtData = (mb, unlimited) => {
  if (unlimited) return 'Unlimited'
  if (mb === null || mb === undefined) return '—'
  return mb >= 1024 ? `${Math.round((mb / 1024) * 10) / 10} GB` : `${mb} MB`
}
const fmtDays = (d) => (d === null || d === undefined ? '' : `${d} ${d === 1 ? 'day' : 'days'}`)

// Two-letter country code -> flag emoji. Anything else returns null (we show a globe instead).
const flagOf = (code) => {
  if (typeof code !== 'string' || !/^[A-Za-z]{2}$/.test(code)) return null
  return String.fromCodePoint(...code.toUpperCase().split('').map((c) => 127397 + c.charCodeAt(0)))
}

export default function EsimPage() {
  const [isDesktop, setIsDesktop] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [tab, setTab] = useState('buy')

  const [scope, setScope] = useState('country')
  const [type, setType] = useState('data')
  const [destinations, setDestinations] = useState([])
  const [loadingDest, setLoadingDest] = useState(true)
  const [search, setSearch] = useState('')
  const [destination, setDestination] = useState(null)
  const [plans, setPlans] = useState([])
  const [loadingPlans, setLoadingPlans] = useState(false)
  const [plan, setPlan] = useState(null)
  const [ordering, setOrdering] = useState(false)
  const [error, setError] = useState('')
  const [orders, setOrders] = useState([])

  // Design-only state: swipe-grid paging.
  const [destPage, setDestPage] = useState(0)
  const [destPages, setDestPages] = useState(1)

  const orderingRef = useRef(false)
  const destReqRef = useRef(0)
  const planReqRef = useRef(0)
  const destGridRef = useRef(null)
  const step2Ref = useRef(null)
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
      const res = await fetch('/api/esim/orders')
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

  // Destination grid - reloads when the scope or plan type changes.
  useEffect(() => {
    const reqId = ++destReqRef.current
    setLoadingDest(true)
    setDestination(null)
    setPlans([])
    setPlan(null)
    const load = async () => {
      try {
        const res = await fetch(`/api/esim/destinations?scope=${scope}&type=${type}`)
        const data = await res.json()
        if (reqId !== destReqRef.current) return
        if (!res.ok) { setError(data.error || 'Could not load destinations.'); setDestinations([]) }
        else { setError(''); setDestinations(data.destinations || []) }
      } catch {
        if (reqId === destReqRef.current) setError('Could not load destinations. Please refresh.')
      }
      if (reqId === destReqRef.current) setLoadingDest(false)
    }
    load()
  }, [scope, type])

  const handleDestination = async (d) => {
    setDestination(d)
    setPlan(null)
    setPlans([])
    setError('')
    setLoadingPlans(true)
    const reqId = ++planReqRef.current
    const qs = new URLSearchParams({ type })
    if (d.scope === 'country' && d.code) { qs.set('scope', 'country'); qs.set('country', d.code) }
    else if (d.scope === 'regional') { qs.set('scope', 'regional'); qs.set('region', (d.code || d.key.replace(/^region-/, '')).toLowerCase()) }
    else qs.set('scope', 'global')
    try {
      const res = await fetch(`/api/esim/plans?${qs}`)
      const data = await res.json()
      if (reqId !== planReqRef.current) return
      if (!res.ok) setError(data.error || 'Could not load plans.')
      else setPlans(data.plans || [])
    } catch {
      if (reqId === planReqRef.current) setError('Could not load plans. Please try again.')
    }
    if (reqId === planReqRef.current) setLoadingPlans(false)
  }

  const handleBuy = async () => {
    if (!plan || !user || orderingRef.current) return
    orderingRef.current = true
    setOrdering(true)
    setError('')
    try {
      // Provisioning can take a little while on Fleexa's side - the button
      // stays in its "buying" state until the answer comes back.
      const res = await fetch('/api/esim/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: plan.id, expected_price_ngn: plan.price_ngn }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409 && data.code === 'PRICE_CHANGED' && Number.isFinite(data.price_ngn)) {
          const id = plan.id
          setPlan((p) => (p && p.id === id ? { ...p, price_ngn: data.price_ngn } : p))
          setPlans((list) => list.map((x) => (x.id === id ? { ...x, price_ngn: data.price_ngn } : x)))
        }
        setError(data.error || 'Purchase failed. Try again.')
        return
      }
      await Promise.all([loadOrders(), refreshBalance(user.id)])
      setPlan(null)
      setDestination(null)
      setPlans([])
      setTab('mine')
    } catch {
      setError('Something went wrong. Please check My eSIMs before trying again.')
    } finally {
      orderingRef.current = false
      setOrdering(false)
    }
  }

  const handleChanged = useCallback(() => {
    loadOrders()
    if (user) refreshBalance(user.id)
  }, [loadOrders, refreshBalance, user])

  const filteredDest = destinations.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()) || (d.code || '').toLowerCase() === search.toLowerCase())
  // Popular countries first, but only while browsing (not while searching).
  const shownDest = (scope === 'country' && !search)
    ? [
        ...POPULAR_CODES.map((c) => filteredDest.find((d) => (d.code || '').toUpperCase() === c)).filter(Boolean),
        ...filteredDest.filter((d) => !POPULAR_CODES.includes((d.code || '').toUpperCase())),
      ]
    : filteredDest
  const hasBalance = (profile?.wallet_balance || 0) >= (plan?.price_ngn || 0)
  const topLevel = orders.filter((o) => o.kind !== 'topup')
  const topupsFor = (id) => orders.filter((o) => o.kind === 'topup' && o.parent_order_id === id)
  const liveCount = topLevel.filter((o) => o.status === 'completed' || o.status === 'pending').length
  const activeOrders = topLevel.filter((o) => o.status === 'completed' || o.status === 'pending')
  const pastOrders = topLevel.filter((o) => o.status !== 'completed' && o.status !== 'pending')

  // Cheapest per-GB capped plan gets a "Best value" tag (only when there is a real choice).
  const bestValueId = (() => {
    const capped = plans.filter((p) => !p.is_unlimited && p.data_mb && p.price_ngn)
    if (capped.length < 3) return null
    return capped.reduce((best, p) => (p.price_ngn / p.data_mb < best.price_ngn / best.data_mb ? p : best)).id
  })()

  // Swipe grid paging
  const measureDest = useCallback(() => {
    const el = destGridRef.current
    if (!el || !el.clientWidth) return
    const pages = Math.max(1, Math.round(el.scrollWidth / el.clientWidth))
    setDestPages(pages)
    setDestPage(Math.min(pages - 1, Math.round(el.scrollLeft / el.clientWidth)))
  }, [])

  useEffect(() => {
    if (destGridRef.current) destGridRef.current.scrollLeft = 0
    const id = requestAnimationFrame(measureDest)
    return () => cancelAnimationFrame(id)
  }, [shownDest.length, loadingDest, search, scope, type, isDesktop, measureDest])

  // Auto-scroll to the next step as it appears.
  useEffect(() => {
    if (!destination) return
    const t = setTimeout(() => step2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
    return () => clearTimeout(t)
  }, [destination])
  useEffect(() => {
    if (!plan) return
    const t = setTimeout(() => summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120)
    return () => clearTimeout(t)
  }, [plan?.id])

  if (pageLoading) return <LoadingScreen />

  return (
    <main style={{ background: 'var(--navy)', minHeight: '100vh', display: isDesktop ? 'flex' : 'block' }}>
      <style>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(108,78,242,0.0); } 50% { box-shadow: 0 0 28px 0 rgba(108,78,242,0.18); } }
        * { box-sizing: border-box; }
        .es-chip { transition: transform 0.15s ease, border-color 0.15s, background 0.15s; }
        .es-chip:hover:not(:disabled) { transform: translateY(-1px); }
        .es-chip:active:not(:disabled) { transform: scale(0.98); }
        .es-buy { transition: transform 0.18s ease, box-shadow 0.18s; }
        .es-buy:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 32px rgba(108,78,242,0.45); }
        .es-search:focus { border-color: var(--purple) !important; box-shadow: 0 0 0 3px rgba(108,78,242,0.12); }
        .es-back:hover { background: var(--card2) !important; }
        .es-pill { transition: border-color 0.15s, background 0.15s; }
        .es-pill:hover { border-color: var(--purple) !important; background: var(--card2) !important; }
        .es-swipe { scrollbar-width: none; -ms-overflow-style: none; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; }
        .es-swipe::-webkit-scrollbar { display: none; }
        .es-swipe > * { scroll-snap-align: start; }
        .skel { background: linear-gradient(90deg, var(--card) 25%, var(--card2) 50%, var(--card) 75%); background-size: 200% 100%; animation: shimmer 1.4s linear infinite; }
        .es-chip:focus-visible, .es-buy:focus-visible, .es-back:focus-visible, .es-pill:focus-visible, .es-tab:focus-visible { outline: 2px solid var(--purple); outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; } }
      `}</style>

      {isDesktop && <DesktopSidebar profile={profile} onLogout={handleLogout} />}

      <div style={{ flex: isDesktop ? 1 : 'none', minWidth: 0, paddingBottom: isDesktop ? '2rem' : '6.5rem' }}>
        {/* HEADER */}
        <div style={{ padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.85rem', position: 'sticky', top: 0, zIndex: 100, background: 'rgba(var(--navy-rgb, 10,10,30), 0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)' }}>
          <Link href="/dashboard" aria-label="Back to dashboard" className="es-back" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', textDecoration: 'none', flexShrink: 0 }}>
            <BackIcon />
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--text)', letterSpacing: '-0.02em' }}>Travel eSIM</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.05rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Mobile data abroad, no SIM swap</div>
          </div>
          <Link href="/dashboard/wallet" aria-label="Fund wallet" className="es-pill" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.35rem 0.3rem 0.75rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, flexShrink: 0, textDecoration: 'none' }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>BAL</span>
            <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem', color: 'var(--gold)' }}>₦{(profile?.wallet_balance || 0).toLocaleString()}</span>
            <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--purple)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PlusIcon /></span>
          </Link>
        </div>

        <div style={{ padding: '1.2rem', maxWidth: 520, margin: '0 auto' }}>
          {/* TABS */}
          <div role="tablist" style={{ display: 'flex', gap: '0.3rem', padding: '0.25rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, marginBottom: '1.2rem' }}>
            {[{ id: 'buy', label: 'Buy eSIM' }, { id: 'mine', label: 'My eSIMs', count: liveCount }].map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} className="es-tab" onClick={() => setTab(t.id)}
                style={{ flex: 1, padding: '0.6rem', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem', border: 'none', background: tab === t.id ? 'var(--purple)' : 'transparent', color: tab === t.id ? '#fff' : 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'background 0.2s, color 0.2s' }}>
                {t.label}
                {t.count > 0 && <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: tab === t.id ? 'rgba(255,255,255,0.22)' : 'rgba(108,78,242,0.18)', color: tab === t.id ? '#fff' : 'var(--purple2)', fontSize: '0.66rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{t.count}</span>}
              </button>
            ))}
          </div>

          {tab === 'buy' ? (
            <div style={{ animation: mounted ? 'fadeSlideIn 0.35s ease both' : 'none' }}>
              {/* Before you buy */}
              <div style={{ display: 'flex', gap: '0.7rem', background: 'rgba(240,180,41,0.08)', border: '1px solid rgba(240,180,41,0.3)', borderRadius: 14, padding: '0.8rem 0.9rem', marginBottom: '1.3rem' }}>
                <span style={{ color: '#f0b429', flexShrink: 0, marginTop: 1 }}><InfoIcon /></span>
                <div style={{ fontSize: '0.75rem', color: 'var(--text)', lineHeight: 1.55 }}>
                  <strong>Before you buy:</strong> your phone must be eSIM-compatible and network-unlocked. eSIMs cannot be refunded once delivered.
                </div>
              </div>

              {/* Scope + type */}
              <div style={{ marginBottom: '1.3rem' }}>
                <Segmented items={SCOPES} value={scope} onChange={(id) => { setScope(id); setSearch('') }} />
                <div style={{ height: '0.5rem' }} />
                <Segmented small items={TYPES} value={type} onChange={setType} />
              </div>

              {/* STEP 1: destination */}
              <StepTitle n={1} done={!!destination} title="Select destination" right={destination?.name} />
              {scope !== 'global' && (
                <div style={{ position: 'relative', marginBottom: '0.7rem' }}>
                  <div style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }}><SearchIcon /></div>
                  <input className="es-search" placeholder={scope === 'country' ? 'Search country…' : 'Search region…'} aria-label="Search destination" value={search} onChange={(e) => setSearch(e.target.value)}
                    style={{ width: '100%', padding: '0.7rem 2.4rem 0.7rem 2.4rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: '0.85rem', outline: 'none', fontFamily: 'Inter, sans-serif' }} />
                  {search && (
                    <button onClick={() => setSearch('')} aria-label="Clear search" style={{ position: 'absolute', right: '0.55rem', top: '50%', transform: 'translateY(-50%)', width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'var(--card2)', color: 'var(--muted)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                  )}
                </div>
              )}
              {loadingDest ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginBottom: '1.4rem' }} aria-label="Loading destinations">
                  {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skel" style={{ height: 62, borderRadius: 14, border: '1px solid var(--border)' }} />)}
                </div>
              ) : shownDest.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.6rem 1rem', marginBottom: '1.4rem', background: 'var(--card)', border: '1px dashed var(--border)', borderRadius: 14, color: 'var(--muted)', fontSize: '0.82rem' }}>
                  {search ? `No destination found for “${search}”` : 'No destinations available right now.'}
                </div>
              ) : (
                <div style={{ marginBottom: '1.4rem' }}>
                  <div ref={destGridRef} className="es-swipe" onScroll={measureDest}
                    style={{ display: 'grid', gridTemplateRows: 'repeat(3, auto)', gridAutoFlow: 'column', gridAutoColumns: 'calc(50% - 0.25rem)', gap: '0.5rem', overflowX: 'auto', paddingBottom: 2 }}>
                    {shownDest.map((d) => {
                      const sel = destination?.key === d.key
                      const flag = d.scope === 'country' ? flagOf(d.code) : null
                      return (
                        <button key={d.key} className="es-chip" onClick={() => handleDestination(d)} aria-pressed={sel}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.7rem', borderRadius: 14, cursor: 'pointer', textAlign: 'left', minWidth: 0, background: sel ? 'rgba(108,78,242,0.12)' : 'var(--card)', border: `1.5px solid ${sel ? 'var(--purple)' : 'var(--border)'}`, boxShadow: sel ? '0 0 0 3px rgba(108,78,242,0.12)' : 'none' }}>
                          <span aria-hidden style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--card2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0, color: ACCENT }}>
                            {flag || (d.scope === 'regional' ? <MapIcon /> : <GlobeIcon />)}
                          </span>
                          <span style={{ display: 'flex', flexDirection: 'column', gap: '0.12rem', minWidth: 0, flex: 1 }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</span>
                            <span style={{ fontSize: '0.64rem', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>from <span style={{ color: 'var(--gold)', fontWeight: 700 }}>₦{d.from_price_ngn.toLocaleString()}</span> · {d.plan_count} {d.plan_count === 1 ? 'plan' : 'plans'}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {destPages > 1 && (
                    <div style={{ marginTop: '0.7rem' }}>
                      {destPages <= 7 ? (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }} aria-hidden>
                          {Array.from({ length: destPages }).map((_, i) => (
                            <span key={i} style={{ width: i === destPage ? 18 : 6, height: 6, borderRadius: 3, background: i === destPage ? 'var(--purple)' : 'var(--border)', transition: 'width 0.25s, background 0.25s' }} />
                          ))}
                        </div>
                      ) : (
                        <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }} aria-hidden>
                          <div style={{ height: '100%', width: `${((destPage + 1) / destPages) * 100}%`, background: 'var(--purple)', borderRadius: 2, transition: 'width 0.25s' }} />
                        </div>
                      )}
                      <div style={{ textAlign: 'center', fontSize: '0.64rem', color: 'var(--muted)', marginTop: '0.45rem' }}>
                        {destPage >= destPages - 1 ? 'That’s everything ←' : 'Swipe for more →'}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: plan */}
              {destination && (
                <div ref={step2Ref} style={{ marginBottom: '1.4rem', animation: 'fadeSlideIn 0.3s ease both', scrollMarginTop: 80 }}>
                  <StepTitle n={2} done={!!plan} title="Choose a plan" right={plan ? fmtData(plan.data_mb, plan.is_unlimited) : null} />
                  {loadingPlans ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }} aria-label="Loading plans">
                      {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skel" style={{ height: 70, borderRadius: 14, border: '1px solid var(--border)' }} />)}
                    </div>
                  ) : plans.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--muted)', fontSize: '0.82rem', background: 'var(--card)', border: '1px dashed var(--border)', borderRadius: 14 }}>No plans available for this destination right now.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {plans.map((p) => {
                        const sel = plan?.id === p.id
                        return (
                          <button key={p.id} className="es-chip" onClick={() => { setPlan(p); setError('') }} aria-pressed={sel}
                            style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.7rem', padding: '0.85rem 0.95rem', borderRadius: 14, cursor: 'pointer', background: sel ? 'rgba(108,78,242,0.1)' : 'var(--card)', border: `1.5px solid ${sel ? 'var(--purple)' : 'var(--border)'}`, boxShadow: sel ? '0 0 0 3px rgba(108,78,242,0.12)' : 'none' }}>
                            {bestValueId === p.id && (
                              <span style={{ position: 'absolute', top: -8, left: 12, padding: '0.1rem 0.5rem', borderRadius: 50, background: '#34d399', color: '#04241a', fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Best value</span>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                              <div style={{ width: 54, flexShrink: 0, textAlign: 'center', padding: '0.4rem 0', borderRadius: 12, background: sel ? 'rgba(108,78,242,0.16)' : 'var(--card2)' }}>
                                <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: p.is_unlimited ? '0.7rem' : '1rem', lineHeight: 1.1, color: 'var(--text)' }}>{fmtData(p.data_mb, p.is_unlimited)}</div>
                              </div>
                              <div style={{ textAlign: 'left', minWidth: 0 }}>
                                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text)' }}>{fmtDays(p.validity_days) || 'Flexible validity'}</div>
                                <div style={{ fontSize: '0.64rem', color: 'var(--muted)', marginTop: '0.12rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {p.networks.length ? p.networks.join(', ') : p.name}{p.supports_topup ? ' · top-up available' : ''}
                                </div>
                              </div>
                            </div>
                            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.95rem', color: 'var(--gold)', flexShrink: 0 }}>₦{p.price_ngn.toLocaleString()}</div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* SUMMARY + BUY */}
              {destination && plan && (
                <div ref={summaryRef} style={{ animation: 'fadeSlideIn 0.3s ease both', scrollMarginTop: 90 }}>
                  <StepTitle n={3} done={false} title="Review & buy" />
                  <div style={{ background: 'linear-gradient(135deg, rgba(108,78,242,0.08) 0%, rgba(167,139,250,0.05) 100%)', border: '1px solid rgba(108,78,242,0.25)', borderRadius: 18, padding: '1rem', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '0.8rem', paddingBottom: '0.8rem', borderBottom: '1px dashed var(--border)' }}>
                      <span aria-hidden style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', color: ACCENT }}>
                        {(destination.scope === 'country' && flagOf(destination.code)) || (destination.scope === 'regional' ? <MapIcon /> : <GlobeIcon />)}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{destination.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{fmtData(plan.data_mb, plan.is_unlimited)}{plan.validity_days ? ` · ${fmtDays(plan.validity_days)}` : ''}</div>
                      </div>
                    </div>
                    <Row label="Data">{fmtData(plan.data_mb, plan.is_unlimited)}</Row>
                    <Row label="Valid for">{fmtDays(plan.validity_days) || '—'}</Row>
                    <Row label="Your balance"><span style={{ color: hasBalance ? '#10b981' : '#f43f5e', fontWeight: 700 }}>₦{(profile?.wallet_balance || 0).toLocaleString()}</span></Row>
                    {hasBalance && <Row label="Balance after">₦{((profile?.wallet_balance || 0) - plan.price_ngn).toLocaleString()}</Row>}
                    <div style={{ height: 1, background: 'var(--border)', margin: '0.5rem 0' }} />
                    <Row label="Total" bold><span style={{ color: 'var(--gold)', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.05rem' }}>₦{plan.price_ngn.toLocaleString()}</span></Row>
                    <div style={{ marginTop: '0.7rem', fontSize: '0.68rem', color: 'var(--muted)', lineHeight: 1.5, display: 'flex', gap: '0.45rem' }}>
                      <span style={{ color: '#f0b429', flexShrink: 0, display: 'flex', marginTop: 1 }}><InfoIcon size={12} /></span>
                      <span>Non-refundable once delivered. If setup fails, you’re refunded automatically. Your QR code will appear in My eSIMs.</span>
                    </div>
                  </div>

                  {!hasBalance && (
                    <div style={{ background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 12, padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#f43f5e', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Insufficient balance · need ₦{(plan.price_ngn - (profile?.wallet_balance || 0)).toLocaleString()} more</span>
                      <Link href="/dashboard/wallet" style={{ color: '#f43f5e', fontWeight: 700, textDecoration: 'none', fontSize: '0.75rem', flexShrink: 0 }}>Fund Wallet →</Link>
                    </div>
                  )}
                  {error && <ErrorBox text={error} />}

                  <button onClick={handleBuy} disabled={ordering || !hasBalance} className="es-buy"
                    style={{ width: '100%', padding: '1rem', background: !hasBalance ? 'var(--card2)' : ordering ? 'var(--purple2)' : 'var(--purple)', color: !hasBalance ? 'var(--muted)' : '#fff', border: 'none', borderRadius: 14, fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem', fontWeight: 700, cursor: ordering || !hasBalance ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', opacity: !hasBalance ? 0.6 : 1 }}>
                    {ordering ? (<><Spinner /> Setting up your eSIM…</>) : `Buy eSIM — ₦${plan.price_ngn.toLocaleString()}`}
                  </button>
                  {ordering && <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.5rem' }}>This can take up to a minute. Please don’t close this page.</div>}
                </div>
              )}

              {error && !plan && <ErrorBox text={error} />}
            </div>
          ) : (
            <div style={{ animation: mounted ? 'fadeSlideIn 0.35s ease both' : 'none' }}>
              {topLevel.length === 0 ? (
                <div style={{ background: 'var(--card)', border: '1px dashed var(--border)', borderRadius: 18, padding: '2.5rem 1rem', textAlign: 'center' }}>
                  <div style={{ width: 60, height: 60, borderRadius: 18, margin: '0 auto 0.9rem', background: 'rgba(108,78,242,0.1)', border: '1px solid rgba(108,78,242,0.25)', color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChipIcon size={28} /></div>
                  <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', marginBottom: '0.3rem' }}>No eSIMs yet</div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginBottom: '1.1rem' }}>Buy a travel eSIM to get mobile data abroad.</div>
                  <button onClick={() => setTab('buy')} className="es-buy" style={{ padding: '0.65rem 1.5rem', background: 'var(--purple)', color: '#fff', border: 'none', borderRadius: 12, fontFamily: 'Outfit, sans-serif', fontSize: '0.84rem', fontWeight: 700, cursor: 'pointer' }}>Buy an eSIM</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {activeOrders.length > 0 && <MiniLabel>Active · {activeOrders.length}</MiniLabel>}
                  {activeOrders.map((o) => <EsimCard key={o.id} order={o} topups={topupsFor(o.id)} onChanged={handleChanged} />)}
                  {pastOrders.length > 0 && <MiniLabel style={{ marginTop: activeOrders.length ? '0.6rem' : 0 }}>History</MiniLabel>}
                  {pastOrders.map((o) => <EsimCard key={o.id} order={o} topups={topupsFor(o.id)} onChanged={handleChanged} />)}
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

// One purchased eSIM. Install details are loaded only when it is opened.
function EsimCard({ order, topups, onChanged }) {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState(null)
  const [qr, setQr] = useState(null)
  const [usage, setUsage] = useState(null)
  const [pkgs, setPkgs] = useState(null) // null = not loaded
  const [showTopup, setShowTopup] = useState(false)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState('')
  const [showManual, setShowManual] = useState(false) // design-only: collapse manual-install details

  const status = detail?.status || order.status
  const completed = status === 'completed'
  const pending = status === 'pending' || status === 'resolving'

  const api = async (part) => {
    const res = await fetch(`/api/esim/order?order_id=${order.id}${part ? `&part=${part}` : ''}`)
    const data = await res.json()
    return { ok: res.ok, data }
  }

  const loadDetail = useCallback(async () => {
    try {
      const r = await api()
      if (r.ok) {
        setDetail(r.data)
        return r.data
      }
    } catch { /* try again later */ }
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id])

  // Opening a card loads its details (and QR once it is delivered).
  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      const d = await loadDetail()
      if (cancelled || !d) return
      if (d.status === 'completed') {
        const q = await api('qr').catch(() => null)
        if (!cancelled && q?.ok) setQr(q.data)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order.id])

  // A pending eSIM is checked every few seconds while its card is open.
  useEffect(() => {
    if (!open || !pending) return
    const iv = setInterval(async () => {
      const d = await loadDetail()
      if (d && d.status !== 'pending' && d.status !== 'resolving') onChanged?.()
    }, 8000)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pending, order.id])

  const copy = (key, value) => {
    if (!value) return
    navigator.clipboard.writeText(value)
    setCopied(key)
    setTimeout(() => setCopied(''), 1800)
  }

  const checkUsage = async () => {
    setBusy('usage'); setMsg('')
    try {
      const r = await api('usage')
      if (!r.ok) setMsg(r.data.error || 'Could not load usage.')
      else setUsage(r.data)
    } catch { setMsg('Could not load usage.') }
    setBusy('')
  }

  const openTopups = async () => {
    setShowTopup((v) => !v)
    if (pkgs !== null) return
    setBusy('topups'); setMsg('')
    try {
      const r = await api('topups')
      if (!r.ok) { setMsg(r.data.error || 'Could not load top-ups.'); setPkgs([]) }
      else setPkgs(r.data.packages || [])
    } catch { setMsg('Could not load top-ups.'); setPkgs([]) }
    setBusy('')
  }

  const buyTopup = async (pkg) => {
    if (busy) return
    if (!window.confirm(`Add ${pkg.name} for ₦${pkg.price_ngn.toLocaleString()}? This cannot be refunded.`)) return
    setBusy(`topup:${pkg.id}`); setMsg('')
    try {
      const res = await fetch('/api/esim/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: order.id, topup_package_id: pkg.id, expected_price_ngn: pkg.price_ngn }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409 && data.code === 'PRICE_CHANGED' && Number.isFinite(data.price_ngn)) {
          setPkgs((list) => (list || []).map((p) => (p.id === pkg.id ? { ...p, price_ngn: data.price_ngn } : p)))
        }
        setMsg(data.error || 'Top-up failed.')
      } else {
        setShowTopup(false)
        setUsage(null)
        setMsg('')
        onChanged?.()
      }
    } catch { setMsg('Something went wrong. Please check your orders before trying again.') }
    setBusy('')
  }

  const badge = completed ? { t: 'Ready', c: '#34d399', bg: 'rgba(52,211,153,0.12)' }
    : pending ? { t: 'Setting up', c: '#f0b429', bg: 'rgba(240,180,41,0.12)' }
    : status === 'expired' ? { t: 'Expired', c: 'var(--muted)', bg: 'var(--card2)' }
    : { t: 'Refunded', c: '#f0b429', bg: 'rgba(240,180,41,0.12)' }

  const expiresText = order.expires_at ? new Date(order.expires_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : null
  const safeLink = (u) => (typeof u === 'string' && u.startsWith('https://') ? u : null)
  const d = detail
  const flag = flagOf(order.country_code)
  const live = completed || pending

  return (
    <div style={{ background: live ? 'linear-gradient(135deg, rgba(108,78,242,0.08) 0%, rgba(167,139,250,0.05) 100%)' : 'var(--card)', border: `1px solid ${live ? 'rgba(108,78,242,0.25)' : 'var(--border)'}`, borderRadius: 18, padding: '1.1rem', opacity: live ? 1 : 0.8, animation: 'scaleIn 0.3s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.6rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', minWidth: 0 }}>
          <span aria-hidden style={{ width: 42, height: 42, borderRadius: 13, background: 'var(--card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', color: ACCENT, flexShrink: 0 }}>
            {flag || <ChipIcon size={20} />}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{order.country_name || order.plan_name || 'eSIM'}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.1rem' }}>
              {fmtData(order.data_mb, order.is_unlimited)}{order.validity_days ? ` · ${fmtDays(order.validity_days)}` : ''} · ₦{Number(order.amount).toLocaleString()}
            </div>
          </div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.2rem 0.65rem', borderRadius: 50, background: badge.bg, color: badge.c, fontSize: '0.68rem', fontWeight: 700, flexShrink: 0 }}>
          {pending && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', animation: 'pulse 1.6s ease infinite' }} />}
          {badge.t}
        </span>
      </div>

      {expiresText && completed && <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.7rem' }}>Valid until <span style={{ color: 'var(--text)', fontWeight: 600 }}>{expiresText}</span></div>}
      {topups.length > 0 && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--muted)' }}>
          {topups.map((t) => (
            <div key={t.id}>+ Top-up: {t.plan_name || 'extra data'} ({t.status === 'completed' ? 'applied' : t.status === 'pending' ? 'applying' : 'failed'})</div>
          ))}
        </div>
      )}

      {order.status === 'failed' ? (
        <div style={{ marginTop: '0.7rem', fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.5 }}>This eSIM could not be delivered — ₦{Number(order.amount).toLocaleString()} was returned to your wallet.</div>
      ) : order.status === 'expired' ? (
        <div style={{ marginTop: '0.7rem', fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.5 }}>This eSIM has expired. Buy a new one for your next trip.</div>
      ) : (
        <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="es-chip" style={{ width: '100%', marginTop: '0.8rem', padding: '0.7rem', background: open ? 'transparent' : 'var(--purple)', color: open ? 'var(--text)' : '#fff', border: open ? '1px solid var(--border)' : 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem', fontWeight: 700 }}>
          {open ? 'Hide details' : completed ? 'Install & manage' : 'View status'}
        </button>
      )}

      {open && (
        <div style={{ marginTop: '0.9rem', animation: 'fadeSlideIn 0.25s ease both' }}>
          {!d ? (
            <div className="skel" style={{ height: 120, borderRadius: 14, border: '1px solid var(--border)' }} aria-label="Loading your eSIM" />
          ) : pending ? (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '1rem', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <Spinner color="var(--purple)" />
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>Your eSIM is being set up…</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>This page updates by itself. If it fails you are refunded automatically.</div>
            </div>
          ) : completed ? (
            <>
              {/* Install */}
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '0.95rem', marginBottom: '0.7rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.8rem' }}>
                  <MiniBadge n={1} />
                  <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.84rem', color: 'var(--text)' }}>Install this eSIM</div>
                </div>
                {qr?.qr_data_url ? (
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.8rem' }}>
                    <div style={{ padding: 6, borderRadius: 18, background: 'linear-gradient(135deg, rgba(108,78,242,0.5), rgba(167,139,250,0.3))' }}>
                      <img src={qr.qr_data_url} alt="eSIM QR code" width={190} height={190} style={{ display: 'block', background: '#fff', padding: 8, borderRadius: 13, imageRendering: 'pixelated', maxWidth: '100%', height: 'auto' }} />
                    </div>
                  </div>
                ) : (
                  <div className="skel" style={{ width: 206, height: 206, borderRadius: 18, margin: '0 auto 0.8rem' }} aria-label="Loading QR code" />
                )}
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '0.7rem' }}>
                  On your phone open <strong style={{ color: 'var(--text)' }}>Settings → Mobile data / Cellular → Add eSIM</strong> and scan this QR code with the phone you want to install it on (use a second screen or print it).
                </div>
                {(safeLink(d.install_urls?.ios) || safeLink(d.install_urls?.android)) && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.7rem' }}>
                    {safeLink(d.install_urls?.ios) && <a href={d.install_urls.ios} target="_blank" rel="noopener noreferrer" style={linkBtn}>Install on iPhone</a>}
                    {safeLink(d.install_urls?.android) && <a href={d.install_urls.android} target="_blank" rel="noopener noreferrer" style={linkBtn}>Install on Android</a>}
                  </div>
                )}
                <button onClick={() => setShowManual((v) => !v)} aria-expanded={showManual} className="es-chip"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.8rem', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', color: 'var(--text)', fontSize: '0.76rem', fontWeight: 600 }}>
                  <span>Enter details manually</span>
                  <span style={{ display: 'flex', transform: showManual ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--muted)' }}><ChevronIcon /></span>
                </button>
                {showManual && (
                  <div style={{ marginTop: '0.4rem', animation: 'fadeSlideIn 0.2s ease both' }}>
                    {[['LPA string', d.lpa_string], ['SM-DP+ address', d.smdp_address], ['Activation code', d.activation_code], ['ICCID', d.iccid]].filter(([, v]) => v).map(([label, value], i, arr) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', padding: '0.55rem 0', borderBottom: i < arr.length - 1 ? '1px dashed var(--border)' : 'none' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.6rem', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', wordBreak: 'break-all' }}>{value}</div>
                        </div>
                        <CopyBtn done={copied === label} onClick={() => copy(label, value)} />
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.45rem', fontSize: '0.68rem', color: '#f0b429', marginTop: '0.8rem', lineHeight: 1.5 }}>
                  <span style={{ display: 'flex', flexShrink: 0, marginTop: 1 }}><InfoIcon size={12} /></span>
                  <span>Keep these details private. The eSIM can only be installed once.</span>
                </div>
              </div>

              {/* Usage */}
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '0.95rem', marginBottom: '0.7rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                    <MiniBadge n={2} />
                    <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.84rem', color: 'var(--text)' }}>Data usage</div>
                  </div>
                  <button onClick={checkUsage} disabled={!!busy} className="es-chip" style={miniBtn}>{busy === 'usage' ? <Spinner /> : usage ? 'Refresh' : 'Check usage'}</button>
                </div>
                {usage && (usage.tracking_supported === false ? (
                  <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginTop: '0.6rem' }}>{usage.reason || 'This carrier does not report usage for this eSIM.'}</div>
                ) : (
                  <div style={{ marginTop: '0.8rem' }}>
                    {usage.total_mb ? (
                      <div style={{ height: 8, background: 'var(--card2)', borderRadius: 50, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, ((usage.total_mb - (usage.remaining_mb ?? 0)) / usage.total_mb) * 100))}%`, background: 'linear-gradient(90deg, var(--purple), var(--purple2))', borderRadius: 50, transition: 'width 0.5s ease' }} />
                      </div>
                    ) : null}
                    <div style={{ fontSize: '0.8rem', color: 'var(--text)', marginTop: '0.5rem', fontWeight: 600 }}>
                      {usage.remaining_mb !== null ? `${fmtData(usage.remaining_mb)} left` : 'Usage unavailable'}{usage.total_mb ? <span style={{ color: 'var(--muted)', fontWeight: 400 }}> of {fmtData(usage.total_mb)}</span> : ''}
                    </div>
                  </div>
                ))}
              </div>

              {/* Top-up */}
              {order.supports_topup && (
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '0.95rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                      <MiniBadge n={3} />
                      <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.84rem', color: 'var(--text)' }}>Need more data?</div>
                    </div>
                    <button onClick={openTopups} disabled={!!busy} className="es-chip" style={miniBtn}>{busy === 'topups' ? <Spinner /> : showTopup ? 'Close' : 'Top up'}</button>
                  </div>
                  {showTopup && pkgs && (
                    pkgs.length === 0 ? (
                      <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginTop: '0.6rem' }}>No top-up packages are available for this eSIM right now.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.8rem' }}>
                        {pkgs.map((p) => (
                          <button key={p.id} className="es-chip" onClick={() => buyTopup(p)} disabled={!!busy}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.7rem 0.85rem', borderRadius: 12, cursor: busy ? 'not-allowed' : 'pointer', background: 'var(--card2)', border: '1px solid var(--border)' }}>
                            <div style={{ textAlign: 'left' }}>
                              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>{p.name || fmtData(p.data_mb, p.is_unlimited)}</div>
                              <div style={{ fontSize: '0.64rem', color: 'var(--muted)' }}>{fmtData(p.data_mb, p.is_unlimited)}{p.validity_days ? ` · ${fmtDays(p.validity_days)}` : ''}</div>
                            </div>
                            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.85rem', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              {busy === `topup:${p.id}` && <Spinner />}₦{p.price_ngn.toLocaleString()}
                            </div>
                          </button>
                        ))}
                      </div>
                    )
                  )}
                </div>
              )}
            </>
          ) : null}
          {msg && <ErrorBox text={msg} style={{ marginTop: '0.7rem', marginBottom: 0 }} />}
        </div>
      )}
    </div>
  )
}

// ── Small pieces ────────────────────────────────────────────────────────
const linkBtn = { flex: 1, textAlign: 'center', padding: '0.6rem', borderRadius: 10, background: 'var(--card2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '0.74rem', fontWeight: 700, textDecoration: 'none' }
const miniBtn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.4rem 0.85rem', borderRadius: 10, background: 'var(--card2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }

// Segmented control (replaces the loose pill rows).
function Segmented({ items, value, onChange, small }) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: '0.25rem', padding: '0.2rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: small ? 11 : 14 }}>
      {items.map((it) => {
        const active = value === it.id
        return (
          <button key={it.id} role="tab" aria-selected={active} className="es-tab" onClick={() => onChange(it.id)}
            style={{ flex: 1, padding: small ? '0.4rem' : '0.55rem', borderRadius: small ? 8 : 11, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: small ? '0.72rem' : '0.78rem', border: 'none', background: active ? 'rgba(108,78,242,0.16)' : 'transparent', color: active ? 'var(--purple2)' : 'var(--muted)', boxShadow: active ? 'inset 0 0 0 1px var(--purple)' : 'none', transition: 'background 0.2s, color 0.2s' }}>
            {it.label}
          </button>
        )
      })}
    </div>
  )
}

function StepTitle({ n, done, title, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.8rem' }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', background: done ? '#34d399' : 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.3s' }}>
        {done ? <CheckIcon size={11} color="#fff" /> : <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#fff' }}>{n}</span>}
      </div>
      <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>{title}</span>
      {right && <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#34d399', fontWeight: 600, maxWidth: '45%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{right}</span>}
    </div>
  )
}

function MiniBadge({ n }) {
  return <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(108,78,242,0.18)', color: 'var(--purple2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.64rem', fontWeight: 800, flexShrink: 0 }}>{n}</span>
}

function MiniLabel({ children, style }) {
  return <div style={{ fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, ...style }}>{children}</div>
}

function Row({ label, children, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', gap: '0.5rem', padding: '0.22rem 0' }}>
      <span style={{ color: 'var(--muted)', fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ color: 'var(--text)', fontWeight: bold ? 700 : 500, textAlign: 'right' }}>{children}</span>
    </div>
  )
}

function ErrorBox({ text, style }) {
  return (
    <div role="alert" style={{ display: 'flex', gap: '0.55rem', alignItems: 'flex-start', background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 12, padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#f43f5e', marginBottom: '0.75rem', ...style }}>
      <span style={{ display: 'flex', flexShrink: 0, marginTop: 2 }}><InfoIcon size={14} /></span>
      <span>{text}</span>
    </div>
  )
}

function CopyBtn({ done, onClick }) {
  return (
    <button onClick={onClick} className="es-chip" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.7rem', flexShrink: 0, background: done ? 'rgba(52,211,153,0.12)' : 'var(--card)', border: `1px solid ${done ? 'rgba(52,211,153,0.4)' : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', color: done ? '#34d399' : 'var(--text)', fontSize: '0.72rem', fontWeight: 600 }}>
      {done ? <><CheckIcon size={12} color="#34d399" /> Copied</> : <><CopyIcon /> Copy</>}
    </button>
  )
}

function Spinner({ color = 'currentColor' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.9s linear infinite', flexShrink: 0 }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  )
}
function BackIcon() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> }
function PlusIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function SearchIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> }
function CheckIcon({ size = 14, color = 'currentColor' }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> }
function CopyIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> }
function ChipIcon({ size = 18 }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 7h6M9 11h6M9 15h3"/></svg> }
function InfoIcon({ size = 16 }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> }
function GlobeIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> }
function MapIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg> }
function ChevronIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg> }