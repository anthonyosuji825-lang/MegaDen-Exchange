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

const fmtData = (mb, unlimited) => {
  if (unlimited) return 'Unlimited'
  if (mb === null || mb === undefined) return '—'
  return mb >= 1024 ? `${Math.round((mb / 1024) * 10) / 10} GB` : `${mb} MB`
}
const fmtDays = (d) => (d === null || d === undefined ? '' : `${d} ${d === 1 ? 'day' : 'days'}`)

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

  const orderingRef = useRef(false)
  const destReqRef = useRef(0)
  const planReqRef = useRef(0)

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
  const hasBalance = (profile?.wallet_balance || 0) >= (plan?.price_ngn || 0)
  const topLevel = orders.filter((o) => o.kind !== 'topup')
  const topupsFor = (id) => orders.filter((o) => o.kind === 'topup' && o.parent_order_id === id)
  const liveCount = topLevel.filter((o) => o.status === 'completed' || o.status === 'pending').length

  if (pageLoading) return <LoadingScreen />

  return (
    <main style={{ background: 'var(--navy)', minHeight: '100vh', display: isDesktop ? 'flex' : 'block' }}>
      <style>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        * { box-sizing: border-box; }
        .es-chip { transition: transform 0.15s ease, border-color 0.15s, background 0.15s; }
        .es-chip:hover { transform: translateY(-1px); }
        .es-chip:active { transform: scale(0.98); }
        .es-buy { transition: transform 0.18s ease, box-shadow 0.18s; }
        .es-buy:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 32px rgba(108,78,242,0.45); }
        .es-search:focus { border-color: var(--purple) !important; box-shadow: 0 0 0 3px rgba(108,78,242,0.12); }
        .es-back:hover { background: var(--card2) !important; }
      `}</style>

      {isDesktop && <DesktopSidebar profile={profile} onLogout={handleLogout} />}

      <div style={{ flex: isDesktop ? 1 : 'none', minWidth: 0, paddingBottom: isDesktop ? '2rem' : '6.5rem' }}>
        {/* HEADER */}
        <div style={{ padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.85rem', position: 'sticky', top: 0, zIndex: 100, background: 'rgba(var(--navy-rgb, 10,10,30), 0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)' }}>
          <Link href="/dashboard" className="es-back" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', textDecoration: 'none', flexShrink: 0 }}>
            <BackIcon />
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--text)', letterSpacing: '-0.02em' }}>Travel eSIM</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.05rem' }}>Mobile data for 100+ destinations, no SIM swap</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, flexShrink: 0 }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>BAL</span>
            <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem', color: 'var(--gold)' }}>₦{(profile?.wallet_balance || 0).toLocaleString()}</span>
          </div>
        </div>

        <div style={{ padding: '1.2rem', maxWidth: 520, margin: '0 auto' }}>
          {/* TABS */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.2rem' }}>
            {[{ id: 'buy', label: 'Buy eSIM' }, { id: 'mine', label: `My eSIMs${liveCount ? ` (${liveCount})` : ''}` }].map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: '0.6rem', borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem', border: `1px solid ${tab === t.id ? 'var(--purple)' : 'var(--border)'}`, background: tab === t.id ? 'rgba(108,78,242,0.12)' : 'var(--card)', color: tab === t.id ? 'var(--purple2)' : 'var(--muted)' }}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'buy' ? (
            <div style={{ animation: mounted ? 'fadeSlideIn 0.35s ease both' : 'none' }}>
              <div style={{ background: 'rgba(240,180,41,0.08)', border: '1px solid rgba(240,180,41,0.3)', borderRadius: 12, padding: '0.7rem 0.9rem', marginBottom: '1.2rem', fontSize: '0.75rem', color: 'var(--text)', lineHeight: 1.5 }}>
                <strong>Before you buy:</strong> your phone must be eSIM-compatible and network-unlocked. eSIMs cannot be refunded once delivered.
              </div>

              {/* Type + scope */}
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
                {SCOPES.map((s) => (
                  <Pill key={s.id} active={scope === s.id} onClick={() => { setScope(s.id); setSearch('') }}>{s.label}</Pill>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.2rem' }}>
                {TYPES.map((t) => (
                  <Pill key={t.id} small active={type === t.id} onClick={() => setType(t.id)}>{t.label}</Pill>
                ))}
              </div>

              {/* STEP 1: destination */}
              <StepTitle n={1} done={!!destination} title="Select destination" right={destination?.name} />
              {scope !== 'global' && (
                <div style={{ position: 'relative', marginBottom: '0.7rem' }}>
                  <div style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }}><SearchIcon /></div>
                  <input className="es-search" placeholder="Search destination…" value={search} onChange={(e) => setSearch(e.target.value)}
                    style={{ width: '100%', padding: '0.7rem 1rem 0.7rem 2.4rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: '0.85rem', outline: 'none', fontFamily: 'Inter, sans-serif' }} />
                </div>
              )}
              {loadingDest ? (
                <Loading text="Loading destinations…" />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', maxHeight: 300, overflowY: 'auto', paddingRight: 2, marginBottom: '1.4rem' }}>
                  {filteredDest.map((d) => {
                    const sel = destination?.key === d.key
                    return (
                      <button key={d.key} className="es-chip" onClick={() => handleDestination(d)}
                        style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.7rem 0.8rem', borderRadius: 12, cursor: 'pointer', textAlign: 'left', background: sel ? 'rgba(108,78,242,0.1)' : 'var(--card)', border: `1.5px solid ${sel ? 'var(--purple)' : 'var(--border)'}` }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{d.name}</span>
                        <span style={{ fontSize: '0.66rem', color: 'var(--muted)' }}>from <span style={{ color: 'var(--gold)', fontWeight: 700 }}>₦{d.from_price_ngn.toLocaleString()}</span> · {d.plan_count} {d.plan_count === 1 ? 'plan' : 'plans'}</span>
                      </button>
                    )
                  })}
                  {filteredDest.length === 0 && (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '1.5rem', color: 'var(--muted)', fontSize: '0.82rem' }}>{search ? `No destination found for “${search}”` : 'No destinations available right now.'}</div>
                  )}
                </div>
              )}

              {/* STEP 2: plan */}
              {destination && (
                <div style={{ marginBottom: '1.4rem', animation: 'fadeSlideIn 0.3s ease both' }}>
                  <StepTitle n={2} done={!!plan} title="Choose a plan" right={plan ? fmtData(plan.data_mb, plan.is_unlimited) : null} />
                  {loadingPlans ? (
                    <Loading text="Loading plans…" />
                  ) : plans.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--muted)', fontSize: '0.82rem' }}>No plans available for this destination right now.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {plans.map((p) => {
                        const sel = plan?.id === p.id
                        return (
                          <button key={p.id} className="es-chip" onClick={() => { setPlan(p); setError('') }}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', padding: '0.8rem 0.95rem', borderRadius: 12, cursor: 'pointer', background: sel ? 'rgba(108,78,242,0.1)' : 'var(--card)', border: `1.5px solid ${sel ? 'var(--purple)' : 'var(--border)'}` }}>
                            <div style={{ textAlign: 'left', minWidth: 0 }}>
                              <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text)' }}>{fmtData(p.data_mb, p.is_unlimited)} · {fmtDays(p.validity_days)}</div>
                              <div style={{ fontSize: '0.66rem', color: 'var(--muted)', marginTop: '0.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {p.networks.length ? p.networks.join(', ') : p.name}{p.supports_topup ? ' · top-up available' : ''}
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
                <div style={{ animation: 'fadeSlideIn 0.3s ease both' }}>
                  <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '1rem', marginBottom: '0.75rem' }}>
                    <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)', marginBottom: '0.75rem' }}>Order summary</div>
                    <Row label="Destination">{destination.name}</Row>
                    <Row label="Data">{fmtData(plan.data_mb, plan.is_unlimited)}</Row>
                    <Row label="Valid for">{fmtDays(plan.validity_days)}</Row>
                    <Row label="Balance"><span style={{ color: hasBalance ? '#10b981' : '#f43f5e', fontWeight: 700 }}>₦{(profile?.wallet_balance || 0).toLocaleString()}</span></Row>
                    <div style={{ height: 1, background: 'var(--border)', margin: '0.5rem 0' }} />
                    <Row label="Total" bold><span style={{ color: 'var(--gold)', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem' }}>₦{plan.price_ngn.toLocaleString()}</span></Row>
                  </div>

                  {!hasBalance && (
                    <div style={{ background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 12, padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#f43f5e', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Insufficient balance</span>
                      <Link href="/dashboard/wallet" style={{ color: '#f43f5e', fontWeight: 700, textDecoration: 'none', fontSize: '0.75rem' }}>Fund Wallet →</Link>
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
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '2.5rem 1rem', textAlign: 'center' }}>
                  <div style={{ color: 'var(--muted)', marginBottom: '0.5rem', display: 'flex', justifyContent: 'center' }}><ChipIcon size={32} /></div>
                  <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.92rem', color: 'var(--text)', marginBottom: '0.3rem' }}>No eSIMs yet</div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginBottom: '1rem' }}>Buy a travel eSIM to get mobile data abroad.</div>
                  <button onClick={() => setTab('buy')} style={{ padding: '0.55rem 1.3rem', background: 'var(--purple)', color: '#fff', border: 'none', borderRadius: 10, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>Buy an eSIM</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {topLevel.map((o) => <EsimCard key={o.id} order={o} topups={topupsFor(o.id)} onChanged={handleChanged} />)}
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

  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(108,78,242,0.08) 0%, rgba(167,139,250,0.05) 100%)', border: '1px solid rgba(108,78,242,0.25)', borderRadius: 18, padding: '1.1rem', opacity: completed || pending ? 1 : 0.75 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.6rem' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)' }}>{order.country_name || order.plan_name || 'eSIM'}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.1rem' }}>
            {fmtData(order.data_mb, order.is_unlimited)}{order.validity_days ? ` · ${fmtDays(order.validity_days)}` : ''} · ₦{Number(order.amount).toLocaleString()}
          </div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.2rem 0.65rem', borderRadius: 50, background: badge.bg, color: badge.c, fontSize: '0.68rem', fontWeight: 700, flexShrink: 0 }}>
          {pending && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', animation: 'pulse 1.6s ease infinite' }} />}
          {badge.t}
        </span>
      </div>

      {expiresText && completed && <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.5rem' }}>Valid until {expiresText}</div>}
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
        <button onClick={() => setOpen((v) => !v)} style={{ width: '100%', marginTop: '0.8rem', padding: '0.7rem', background: open ? 'transparent' : 'var(--purple)', color: open ? 'var(--text)' : '#fff', border: open ? '1px solid var(--border)' : 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem', fontWeight: 700 }}>
          {open ? 'Hide details' : completed ? 'Install & manage' : 'View status'}
        </button>
      )}

      {open && (
        <div style={{ marginTop: '0.9rem' }}>
          {!d ? (
            <Loading text="Loading your eSIM…" />
          ) : pending ? (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '0.9rem', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <Spinner color="var(--purple)" />
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>Your eSIM is being set up…</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>This page updates by itself. If it fails you are refunded automatically.</div>
            </div>
          ) : completed ? (
            <>
              {/* Install */}
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '0.9rem', marginBottom: '0.7rem' }}>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)', marginBottom: '0.6rem' }}>Install this eSIM</div>
                {qr?.qr_data_url && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.7rem' }}>
                    <img src={qr.qr_data_url} alt="eSIM QR code" width={190} height={190} style={{ background: '#fff', padding: 8, borderRadius: 12, imageRendering: 'pixelated' }} />
                  </div>
                )}
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '0.7rem' }}>
                  On your phone open <strong style={{ color: 'var(--text)' }}>Settings → Mobile data / Cellular → Add eSIM</strong> and scan this QR code with the phone you want to install it on (use a second screen or print it). Or enter the details below by hand.
                </div>
                {[['LPA string', d.lpa_string], ['SM-DP+ address', d.smdp_address], ['Activation code', d.activation_code], ['ICCID', d.iccid]].filter(([, v]) => v).map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', padding: '0.3rem 0' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.6rem', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', wordBreak: 'break-all' }}>{value}</div>
                    </div>
                    <CopyBtn done={copied === label} onClick={() => copy(label, value)} />
                  </div>
                ))}
                {(safeLink(d.install_urls?.ios) || safeLink(d.install_urls?.android)) && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.7rem' }}>
                    {safeLink(d.install_urls?.ios) && <a href={d.install_urls.ios} target="_blank" rel="noopener noreferrer" style={linkBtn}>Install on iPhone</a>}
                    {safeLink(d.install_urls?.android) && <a href={d.install_urls.android} target="_blank" rel="noopener noreferrer" style={linkBtn}>Install on Android</a>}
                  </div>
                )}
                <div style={{ fontSize: '0.66rem', color: '#f0b429', marginTop: '0.7rem', lineHeight: 1.5 }}>Keep these details private. The eSIM can only be installed once.</div>
              </div>

              {/* Usage */}
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '0.9rem', marginBottom: '0.7rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)' }}>Data usage</div>
                  <button onClick={checkUsage} disabled={!!busy} style={miniBtn}>{busy === 'usage' ? <Spinner /> : usage ? 'Refresh' : 'Check usage'}</button>
                </div>
                {usage && (usage.tracking_supported === false ? (
                  <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginTop: '0.5rem' }}>{usage.reason || 'This carrier does not report usage for this eSIM.'}</div>
                ) : (
                  <div style={{ marginTop: '0.6rem' }}>
                    {usage.total_mb ? (
                      <div style={{ height: 8, background: 'var(--card2)', borderRadius: 50, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, ((usage.total_mb - (usage.remaining_mb ?? 0)) / usage.total_mb) * 100))}%`, background: 'var(--purple)' }} />
                      </div>
                    ) : null}
                    <div style={{ fontSize: '0.78rem', color: 'var(--text)', marginTop: '0.4rem', fontWeight: 600 }}>
                      {usage.remaining_mb !== null ? `${fmtData(usage.remaining_mb)} left` : 'Usage unavailable'}{usage.total_mb ? ` of ${fmtData(usage.total_mb)}` : ''}
                    </div>
                  </div>
                ))}
              </div>

              {/* Top-up */}
              {order.supports_topup && (
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '0.9rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)' }}>Need more data?</div>
                    <button onClick={openTopups} disabled={!!busy} style={miniBtn}>{busy === 'topups' ? <Spinner /> : showTopup ? 'Close' : 'Top up'}</button>
                  </div>
                  {showTopup && pkgs && (
                    pkgs.length === 0 ? (
                      <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginTop: '0.5rem' }}>No top-up packages are available for this eSIM right now.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.7rem' }}>
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

function Pill({ children, active, onClick, small }) {
  return (
    <button onClick={onClick} style={{ flex: 1, padding: small ? '0.4rem' : '0.55rem', borderRadius: 50, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: small ? '0.72rem' : '0.78rem', border: `1px solid ${active ? 'var(--purple)' : 'var(--border)'}`, background: active ? 'rgba(108,78,242,0.12)' : 'var(--card)', color: active ? 'var(--purple2)' : 'var(--muted)' }}>
      {children}
    </button>
  )
}

function StepTitle({ n, done, title, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.8rem' }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', background: done ? '#34d399' : 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {done ? <CheckIcon size={11} color="#fff" /> : <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#fff' }}>{n}</span>}
      </div>
      <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>{title}</span>
      {right && <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#34d399' }}>{right}</span>}
    </div>
  )
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
  return <div style={{ background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 12, padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#f43f5e', marginBottom: '0.75rem', ...style }}>{text}</div>
}

function Loading({ text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', padding: '2rem', color: 'var(--muted)', fontSize: '0.82rem' }}>
      <Spinner color="var(--purple)" /> {text}
    </div>
  )
}

function CopyBtn({ done, onClick }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.7rem', flexShrink: 0, background: done ? 'rgba(52,211,153,0.12)' : 'var(--card)', border: `1px solid ${done ? 'rgba(52,211,153,0.4)' : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', color: done ? '#34d399' : 'var(--text)', fontSize: '0.72rem', fontWeight: 600 }}>
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
function SearchIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> }
function CheckIcon({ size = 14, color = 'currentColor' }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> }
function CopyIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> }
function ChipIcon({ size = 18 }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 7h6M9 11h6M9 15h3"/></svg> }