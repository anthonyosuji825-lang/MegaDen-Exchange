// app/dashboard/numbers/rent/page.js
//
// Rebuilt after Fleexa confirmed the real API shape (2026-09-16/18):
//   - /rent/apps returns hundreds of real services (not one flat plan)
//   - Not every service supports rental — /rent/durations comes back
//     with an empty array for most of them (confirmed: telegram,
//     google, instagram all empty; whatsapp has all 3 tiers)
//   - There's no bulk "which services are rentable" endpoint, and
//     checking all several hundred services up front would blow
//     through Fleexa's 60 req/min rate limit for no reason — so this
//     page checks durations LAZILY, only for the one service the user
//     actually picks. If that service turns out to have no rental
//     tiers, it says so inline and lets them pick another, rather than
//     pre-filtering the whole list.
//   - Duration pricing is no longer an estimate — GET /rent/durations
//     returns the real, exact price_ngn per tier, confirmed live.

'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import LoadingScreen from '@/components/RouteLoader'
import BottomNav from '@/components/BottomNav'
import DesktopSidebar from '@/components/DesktopSidebar'

const FALLBACK_COUNTRIES = [{ code: 'US', name: 'United States', flag: '🇺🇸' }]
const MONTH_LABELS = { 1: '1 Month', 3: '3 Months', 12: '1 Year' }

export default function RentNumbers() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)

  const [tab, setTab] = useState('buy') // 'buy' | 'mine'
  const [country] = useState(FALLBACK_COUNTRIES[0])

  const [services, setServices] = useState([])
  const [loadingServices, setLoadingServices] = useState(true)
  const [servicesError, setServicesError] = useState('')
  const [selectedService, setSelectedService] = useState(null) // { appName, qty }
  const [tipsDismissed, setTipsDismissed] = useState(true) // default true until localStorage check runs, to avoid a flash
  const [tiers, setTiers] = useState(null) // { [months]: { durationKey, priceNgn } } | null
  const [loadingTiers, setLoadingTiers] = useState(false)
  const [tiersError, setTiersError] = useState('')
  const [tiersThrottled, setTiersThrottled] = useState(false)
  const [selectedMonths, setSelectedMonths] = useState(null)

  const [ordering, setOrdering] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [copiedMsg, setCopiedMsg] = useState(null)

  const [rentals, setRentals] = useState([])
  const [loadingRentals, setLoadingRentals] = useState(false)

  const [activeRental, setActiveRental] = useState(null)

  const orderingRef = useRef(false)
  const pollRef = useRef(null)

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
    window.location.href = '/'
  }

  useEffect(() => {
    setMounted(true)
    try {
      setTipsDismissed(localStorage.getItem('megaden_rent_tips_dismissed') === 'true')
    } catch {
      setTipsDismissed(false) // localStorage unavailable — default to showing the tip
    }
    // Deep link from the Orders page and the notification bell:
    // /dashboard/numbers/rent?tab=mine opens straight to My Rentals. Read from
    // window.location instead of useSearchParams, which would require wrapping
    // the page in a Suspense boundary.
    try {
      if (new URLSearchParams(window.location.search).get('tab') === 'mine') setTab('mine')
    } catch {}
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUser(user)
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(profileData)
      setPageLoading(false)
    }
    load()
    fetchServices()
  }, [])

  const fetchServices = async () => {
    setLoadingServices(true)
    setServicesError('')
    try {
      const res = await fetch(`/api/numbers/rent/apps?countryId=${country.code}`)
      const data = await res.json()
      if (data.error) {
        setServicesError(data.error)
        setServices([])
      } else {
        setServices(data.apps || [])
      }
    } catch {
      setServicesError('Failed to load services. Please refresh.')
    }
    setLoadingServices(false)
  }

  const fetchRentals = async () => {
    setLoadingRentals(true)
    try {
      const res = await fetch('/api/numbers/rent')
      const data = await res.json()
      setRentals(data.rentals || [])
    } catch {
      setError('Failed to load your rentals.')
    }
    setLoadingRentals(false)
  }

  useEffect(() => {
    if (tab === 'mine') fetchRentals()
  }, [tab])

  // Lazy per-service duration check — only fires once a service is
  // actually selected, never for the whole list.
  const fetchTiers = async (appName) => {
    setLoadingTiers(true)
    setTiersError('')
    setTiersThrottled(false)
    setTiers(null)
    setSelectedMonths(null)
    try {
      const res = await fetch(`/api/numbers/rent/durations?appName=${encodeURIComponent(appName)}`)
      const data = await res.json()
      if (data.error || !data.tiers || !Object.keys(data.tiers).length) {
        // A throttled response is retryable — it means Fleexa's
        // backend rate-limited this specific check, not that the
        // service genuinely lacks rental support. Their durations
        // cache successful lookups for 2 hours, so a retry a few
        // seconds later is cheap and often succeeds.
        setTiersThrottled(Boolean(data.throttled))
        setTiersError(data.error || 'This service isn\u2019t available for long-term rental right now — try another.')
      } else {
        setTiers(data.tiers)
        setSelectedMonths(Number(Object.keys(data.tiers)[0]))
      }
    } catch {
      setTiersError('Failed to load pricing. Please try again.')
    }
    setLoadingTiers(false)
  }

  useEffect(() => {
    if (!selectedService) { setTiers(null); return }
    fetchTiers(selectedService.appName)
  }, [selectedService])

  useEffect(() => {
    if (!activeRental || activeRental.status !== 'active') return
    const orderId = activeRental.order_id

    const poll = async () => {
      try {
        const res = await fetch(`/api/numbers/rent/sms?order_id=${orderId}`)
        const data = await res.json()
        if (!res.ok) return
        setActiveRental((prev) => (prev && prev.order_id === orderId ? {
          ...prev,
          status: data.status,
          messages: data.messages || prev.messages,
          expires_at: data.expires_at || prev.expires_at,
        } : prev))
      } catch (e) {
        console.error('[rent SMS poll]', e)
      }
    }

    poll()
    pollRef.current = setInterval(poll, 25000)
    return () => clearInterval(pollRef.current)
  }, [activeRental?.order_id, activeRental?.status])

  const handleBuy = async () => {
    if (!selectedService || !selectedMonths || orderingRef.current) return
    orderingRef.current = true
    setOrdering(true)
    setError('')
    try {
      const res = await fetch('/api/numbers/rent/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appName: selectedService.appName, months: selectedMonths }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Rental purchase failed. Try again.')
        return
      }
      setProfile((p) => ({ ...p, wallet_balance: (p.wallet_balance || 0) - data.price_ngn }))
      setActiveRental({
        order_id: data.order_id,
        phone: data.phone,
        expires_at: data.expires_at,
        months: selectedMonths,
        plan_name: selectedService.appName,
        status: 'active',
        messages: [],
      })
      setSelectedService(null)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      orderingRef.current = false
      setOrdering(false)
    }
  }

  const openRental = (r) => {
    setActiveRental({
      order_id: r.order_id,
      phone: r.phone,
      expires_at: r.expires_at,
      months: r.months,
      plan_name: r.plan_name,
      status: r.status,
      messages: [],
    })
  }

  const closeRental = () => {
    clearInterval(pollRef.current)
    setActiveRental(null)
    setError('')
  }

  const dismissTips = () => {
    setTipsDismissed(true)
    try { localStorage.setItem('megaden_rent_tips_dismissed', 'true') } catch {}
  }

  const copyMsg = (i, code) => {
    if (!code) return
    navigator.clipboard.writeText(String(code))
    setCopiedMsg(i)
    setTimeout(() => setCopiedMsg(null), 1800)
  }

  const copyPhone = () => {
    if (!activeRental?.phone) return
    navigator.clipboard.writeText(activeRental.phone)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const daysRemaining = (expiresAt) => {
    if (!expiresAt) return null
    const ms = new Date(expiresAt).getTime() - Date.now()
    return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))
  }

  const totalDurationDays = activeRental?.months ? activeRental.months * 30 : 30
  const remaining = activeRental ? daysRemaining(activeRental.expires_at) : null
  const progressPct = activeRental && remaining !== null
    ? Math.max(0, Math.min(100, (remaining / totalDurationDays) * 100))
    : 0

  const selectedPrice = tiers && selectedMonths ? tiers[selectedMonths]?.priceNgn : null
  const hasBalance = selectedPrice !== null && (profile?.wallet_balance || 0) >= (selectedPrice || Infinity)

  const activeRentals = rentals.filter((r) => r.status === 'active')
  const pastRentals = rentals.filter((r) => r.status !== 'active')

  if (pageLoading) return <LoadingScreen />

  return (
    <main style={{ background: 'var(--navy)', minHeight: '100vh', display: isDesktop ? 'flex' : 'block' }}>
      <style>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes smsReveal { from { opacity: 0; transform: translateY(10px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        * { box-sizing: border-box; }
        .plan-chip, .duration-chip, .rental-card, .tab-pill, .service-row { transition: transform 0.15s ease, border-color 0.15s, background 0.15s, box-shadow 0.15s; }
        .plan-chip:hover, .duration-chip:hover, .rental-card:hover, .service-row:hover { background: var(--card2); }
        .buy-btn { transition: transform 0.18s ease, box-shadow 0.18s, background 0.18s; }
        .buy-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 32px rgba(108,78,242,0.45); }
        .buy-btn:active:not(:disabled) { transform: scale(0.98); }
        .back-btn { transition: background 0.15s, transform 0.15s; }
        .back-btn:hover { background: var(--card2) !important; transform: translateX(-2px); }
        .copy-btn:hover { transform: scale(1.05); }
        .copy-btn:active { transform: scale(0.95); }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes glow { 0%, 100% { box-shadow: 0 0 12px rgba(108,78,242,0.25); } 50% { box-shadow: 0 0 26px rgba(108,78,242,0.5); } }
        .skel { background: linear-gradient(90deg, var(--card) 25%, var(--card2) 50%, var(--card) 75%); background-size: 200% 100%; animation: shimmer 1.4s linear infinite; border: 1px solid var(--border); }
        .bal-pill { transition: background 0.15s, border-color 0.15s; }
        .bal-pill:hover { background: var(--card2) !important; border-color: rgba(108,78,242,0.4) !important; }
        .service-row:hover, .duration-chip:hover, .rental-card:hover { transform: translateY(-2px); }
        .service-row:active, .duration-chip:active, .rental-card:active { transform: scale(0.98); }
        .service-row:focus-visible, .duration-chip:focus-visible, .rental-card:focus-visible, .buy-btn:focus-visible, .tab-pill:focus-visible, .copy-btn:focus-visible, .back-btn:focus-visible, .bal-pill:focus-visible { outline: 2px solid var(--purple); outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; } }
        .number-display { background: linear-gradient(135deg, rgba(108,78,242,0.08) 0%, rgba(192,120,26,0.06) 100%); border: 1px solid rgba(108,78,242,0.25); animation: glow 3s ease infinite; }
        .service-list::-webkit-scrollbar { width: 6px; }
        .service-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }
      `}</style>

      {isDesktop && <DesktopSidebar profile={profile} onLogout={handleLogout} />}

      <div style={{ flex: isDesktop ? 1 : 'none', minWidth: 0, paddingBottom: isDesktop ? '2rem' : '6.5rem' }}>
        <div style={{
          padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.85rem',
          position: 'sticky', top: 0, zIndex: 100,
          background: 'rgba(var(--navy-rgb, 10,10,30), 0.92)', backdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border)',
        }}>
          {activeRental || selectedService ? (
            <button onClick={activeRental ? closeRental : () => setSelectedService(null)} className="back-btn" aria-label="Back" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: '10px',
              background: 'var(--card)', border: '1px solid var(--border)',
              color: 'var(--text)', flexShrink: 0, cursor: 'pointer',
            }}>
              <BackIcon />
            </button>
          ) : (
            <Link href="/dashboard/numbers" className="back-btn" aria-label="Back to numbers" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: '10px',
              background: 'var(--card)', border: '1px solid var(--border)',
              color: 'var(--text)', textDecoration: 'none', flexShrink: 0,
            }}>
              <BackIcon />
            </Link>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--text)', letterSpacing: '-0.02em' }}>
              Rent Numbers
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.05rem' }}>
              Monthly rental · Multiple SMS
            </div>
          </div>
          <Link href="/dashboard/wallet" className="bal-pill" aria-label="Fund wallet" style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.4rem 0.35rem 0.75rem',
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '20px', flexShrink: 0, textDecoration: 'none',
          }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>BAL</span>
            <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem', color: 'var(--gold)' }}>
              ₦{(profile?.wallet_balance || 0).toLocaleString()}
            </span>
            <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--purple)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </span>
          </Link>
        </div>

        <div style={{ padding: '1.2rem', maxWidth: 480, margin: '0 auto' }}>

          {activeRental ? (
            /* ── RENTAL DETAIL VIEW ────────────────────────────────── */
            <div style={{ animation: 'scaleIn 0.35s ease both' }}>
              <div className="number-display" style={{ borderRadius: '20px', padding: '1.5rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: activeRental.status === 'active' ? '#34d399' : '#f43f5e',
                      boxShadow: activeRental.status === 'active' ? '0 0 10px #34d399' : 'none',
                      animation: activeRental.status === 'active' ? 'pulse 2s ease infinite' : 'none',
                    }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>
                      {activeRental.plan_name || 'Rental'} · {country.flag} {country.name}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                    color: activeRental.status === 'active' ? '#34d399' : '#f43f5e',
                  }}>
                    {activeRental.status}
                  </span>
                </div>

                <div style={{ marginBottom: '1.2rem' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                    Your Number
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: 'var(--text)', letterSpacing: '0.02em', flex: 1 }}>
                      {activeRental.phone || '—'}
                    </span>
                    <button onClick={copyPhone} className="copy-btn" style={{
                      display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem',
                      background: copied ? 'rgba(52,211,153,0.12)' : 'var(--card)',
                      border: `1px solid ${copied ? 'rgba(52,211,153,0.4)' : 'var(--border)'}`,
                      borderRadius: '10px', cursor: 'pointer',
                      color: copied ? '#34d399' : 'var(--text)', fontSize: '0.75rem', fontWeight: 600,
                    }}>
                      {copied ? <><CheckIcon size={12} color="#34d399" /> Copied</> : <><CopyIcon /> Copy</>}
                    </button>
                  </div>
                </div>

                {remaining !== null && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '0.4rem' }}>
                      <span>{remaining} day{remaining === 1 ? '' : 's'} remaining</span>
                      <span>{activeRental.months} month{activeRental.months === 1 ? '' : 's'} total</span>
                    </div>
                    <div style={{ height: 3, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 99,
                        background: remaining < 3 ? '#f43f5e' : 'var(--purple)',
                        width: `${progressPct}%`, transition: 'width 1s linear, background 0.5s',
                      }} />
                    </div>
                  </>
                )}
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
                  Messages {activeRental.messages.length > 0 && `(${activeRental.messages.length})`}
                </div>
                {activeRental.messages.length === 0 ? (
                  <div style={{
                    background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px',
                    padding: '1.2rem', textAlign: 'center',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      {activeRental.status === 'active' && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1.2s linear infinite' }}>
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                        </svg>
                      )}
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>
                        No messages yet
                      </span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
                      You can receive SMS on this number anytime during the rental period. We check for new messages every 25 seconds.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {[...activeRental.messages].reverse().map((m, i) => (
                      <div key={i} style={{
                        background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.25)',
                        borderRadius: '14px', padding: '1rem', animation: 'smsReveal 0.4s ease both',
                      }}>
                        {m.from && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginBottom: '0.35rem' }}>{m.from}</div>
                        )}
                        {m.code && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '0.35rem' }}>
                            <div style={{
                              fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: '1.5rem',
                              color: 'var(--text)', letterSpacing: '0.12em', flex: 1, minWidth: 0, wordBreak: 'break-all',
                            }}>
                              {m.code}
                            </div>
                            <button onClick={() => copyMsg(i, m.code)} className="copy-btn" style={{
                              display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', flexShrink: 0,
                              background: copiedMsg === i ? 'rgba(52,211,153,0.12)' : 'var(--card)',
                              border: `1px solid ${copiedMsg === i ? 'rgba(52,211,153,0.4)' : 'var(--border)'}`,
                              borderRadius: '10px', cursor: 'pointer',
                              color: copiedMsg === i ? '#34d399' : 'var(--text)', fontSize: '0.72rem', fontWeight: 600,
                            }}>
                              {copiedMsg === i ? <><CheckIcon size={12} color="#34d399" /> Copied</> : <><CopyIcon /> Copy</>}
                            </button>
                          </div>
                        )}
                        <div style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.5 }}>{m.text}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={closeRental} className="buy-btn" style={{
                width: '100%', padding: '0.85rem', background: 'var(--card2)', color: 'var(--text)',
                border: '1px solid var(--border)', borderRadius: '12px', cursor: 'pointer',
                fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', fontWeight: 700,
              }}>
                Back to Rentals
              </button>
            </div>

          ) : (
            <>
              {!selectedService && (
                <div role="tablist" style={{ display: 'flex', gap: '0.3rem', padding: '0.3rem', marginBottom: '1.3rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14 }}>
                  {[{ id: 'buy', label: 'New Rental', icon: <PlusIcon /> }, { id: 'mine', label: 'My Rentals', icon: <ClockIcon /> }].map((t) => {
                    const on = tab === t.id
                    return (
                      <button key={t.id} role="tab" aria-selected={on} onClick={() => setTab(t.id)} className="tab-pill" style={{
                        flex: 1, padding: '0.6rem 0.5rem', borderRadius: 10, cursor: 'pointer',
                        fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem',
                        background: on ? 'rgba(108,78,242,0.14)' : 'transparent',
                        color: on ? 'var(--purple2)' : 'var(--muted)',
                        border: `1px solid ${on ? 'rgba(108,78,242,0.4)' : 'transparent'}`,
                      }}>
                        {t.icon}{t.label}
                      </button>
                    )
                  })}
                </div>
              )}

              {tab === 'buy' ? (
                <div style={{ animation: mounted ? 'fadeSlideIn 0.35s ease 0.05s both' : 'none' }}>
                  {!tipsDismissed && (
                    <div style={{
                      display: 'flex', gap: '0.6rem', padding: '0.85rem 1rem', marginBottom: '1.2rem',
                      background: 'rgba(108,78,242,0.06)', border: '1px solid rgba(108,78,242,0.2)', borderRadius: '12px',
                    }}>
                      <InfoIcon size={16} color="var(--purple)" />
                      <div style={{ fontSize: '0.72rem', color: 'var(--muted)', lineHeight: 1.6, flex: 1 }}>
                        <strong style={{ color: 'var(--text)' }}>Before you rent:</strong> A rented number can receive SMS anytime during its rental period, not just once — check back on it whenever you need a new code. US numbers only, for now. The service list below reflects what's currently confirmed available and can change day to day, so a service missing today may return later. Rentals currently can't be cancelled or refunded once purchased, so double-check your service and duration before confirming.
                      </div>
                      <button onClick={dismissTips} style={{
                        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)',
                        padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center', height: 'fit-content',
                      }} aria-label="Dismiss tip">
                        <CloseIcon />
                      </button>
                    </div>
                  )}

                  {!selectedService ? (
                    /* ── STEP: pick a service ── */
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.85rem' }}>
                        <StepBadge n={1} done />
                        <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>
                          Country
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginLeft: 'auto' }}>
                          {country.flag} {country.name} only, for now
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.85rem' }}>
                        <StepBadge n={2} />
                        <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>
                          Choose a Service
                        </span>
                      </div>

                      {loadingServices ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                          {[0, 1, 2, 3].map((i) => <div key={i} className="skel" style={{ height: 112, borderRadius: 16 }} />)}
                        </div>
                      ) : servicesError ? (
                        <ErrorBanner>{servicesError}</ErrorBanner>
                      ) : services.length === 0 ? (
                        <ErrorBanner>No services are available for rental right now — please check back later.</ErrorBanner>
                      ) : (
                        // Fleexa confirmed via a has_durations=true filter which
                        // services genuinely support rental (2026-09-19) — a small,
                        // known-good list (5 at time of writing), so a simple grid
                        // of cards fits better than a search-through-hundreds list.
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                          {services.map((s) => (
                            <button key={s.appName} className="service-row" onClick={() => setSelectedService(s)} style={{
                              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.7rem',
                              padding: '1rem', background: 'var(--card)', border: '1px solid var(--border)',
                              borderRadius: '16px', cursor: 'pointer', textAlign: 'left', minWidth: 0,
                              animation: mounted ? 'fadeSlideIn 0.3s ease both' : 'none',
                            }}>
                              <ServiceIcon appName={s.appName} size={42} />
                              <div style={{ minWidth: 0, width: '100%' }}>
                                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {s.description || s.appName}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.66rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399' }} />
                                  Available to rent
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    /* ── STEP: duration + confirm, for the selected service ── */
                    <div style={{ animation: 'scaleIn 0.3s ease both' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.85rem' }}>
                        <StepBadge n={2} done />
                        <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>Service</span>
                      </div>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0.85rem', marginBottom: '1.4rem',
                        background: 'rgba(108,78,242,0.08)', border: '1.5px solid var(--purple)', borderRadius: '14px',
                        boxShadow: '0 4px 16px rgba(108,78,242,0.18)', animation: 'scaleIn 0.25s ease both',
                      }}>
                        <ServiceIcon appName={selectedService.appName} size={36} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedService.appName}</div>
                          <div style={{ fontSize: '0.66rem', color: 'var(--muted)', marginTop: '0.05rem' }}>{country.flag} {country.name} number</div>
                        </div>
                        <button onClick={() => setSelectedService(null)} className="bal-pill" style={{
                          padding: '0.4rem 0.8rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px',
                          color: 'var(--text)', fontSize: '0.74rem', fontWeight: 600, fontFamily: 'Outfit, sans-serif', cursor: 'pointer',
                        }}>
                          Change
                        </button>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.85rem' }}>
                        <StepBadge n={3} done={!!tiers} />
                        <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>
                          Choose Duration
                        </span>
                      </div>

                      {loadingTiers ? (
                        <div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            {[0, 1].map((i) => <div key={i} className="skel" style={{ height: 84, borderRadius: 14 }} />)}
                            <div className="skel" style={{ height: 84, borderRadius: 14, gridColumn: '1 / -1' }} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.9rem', color: 'var(--muted)', fontSize: '0.76rem' }}>
                            <Spinner /> Checking availability…
                          </div>
                        </div>
                      ) : tiersError ? (
                        <div style={{ animation: 'fadeSlideIn 0.3s ease both' }}>
                          <ErrorBanner>{tiersError}</ErrorBanner>
                          {tiersThrottled ? (
                            <button onClick={() => fetchTiers(selectedService.appName)} className="buy-btn" style={{
                              width: '100%', padding: '0.85rem', marginTop: '0.75rem', background: 'var(--purple)', color: '#fff',
                              border: 'none', borderRadius: '12px', cursor: 'pointer',
                              fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', fontWeight: 700,
                            }}>
                              Try Again
                            </button>
                          ) : (
                          <button onClick={() => setSelectedService(null)} className="buy-btn" style={{
                            width: '100%', padding: '0.85rem', marginTop: '0.75rem', background: 'var(--card2)', color: 'var(--text)',
                            border: '1px solid var(--border)', borderRadius: '12px', cursor: 'pointer',
                            fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', fontWeight: 700,
                          }}>
                            Choose a Different Service
                          </button>
                          )}
                        </div>
                      ) : tiers && (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.2rem' }}>
                            {Object.entries(tiers).map(([months, tier]) => {
                              const m = Number(months)
                              const isSelected = selectedMonths === m
                              const base = tiers[1]?.priceNgn
                              const save = base && m > 1 ? Math.round((1 - tier.priceNgn / (base * m)) * 100) : 0
                              const perMo = Math.round(tier.priceNgn / m)
                              return (
                                <button key={m} className="duration-chip" aria-pressed={isSelected} onClick={() => setSelectedMonths(m)} style={{
                                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem',
                                  padding: '0.9rem 1rem', minWidth: 0,
                                  background: isSelected ? 'rgba(108,78,242,0.1)' : 'var(--card)',
                                  border: `1.5px solid ${isSelected ? 'var(--purple)' : 'var(--border)'}`,
                                  boxShadow: isSelected ? '0 4px 16px rgba(108,78,242,0.18)' : 'none',
                                  borderRadius: '14px', cursor: 'pointer', textAlign: 'left',
                                  gridColumn: m === 12 ? '1 / -1' : 'auto',
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', width: '100%' }}>
                                    <span style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, border: `2px solid ${isSelected ? 'var(--purple)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      {isSelected && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--purple)' }} />}
                                    </span>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' }}>
                                      {MONTH_LABELS[m] || `${m} months`}
                                    </span>
                                    {save > 0 && (
                                      <span style={{ marginLeft: 'auto', padding: '0.1rem 0.45rem', borderRadius: 99, background: 'rgba(52,211,153,0.12)', color: '#34d399', fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Save {save}%</span>
                                    )}
                                  </div>
                                  <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1rem', color: 'var(--gold)', fontWeight: 800, marginTop: '0.15rem' }}>
                                    ₦{tier.priceNgn.toLocaleString()}
                                  </span>
                                  {m > 1 && <span style={{ fontSize: '0.66rem', color: 'var(--muted)' }}>≈ ₦{perMo.toLocaleString()} / month</span>}
                                </button>
                              )
                            })}
                          </div>

                          {selectedMonths && (
                            <div style={{ animation: 'scaleIn 0.3s ease both' }}>
                              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1rem', marginBottom: '0.75rem' }}>
                                <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)', marginBottom: '0.75rem' }}>
                                  Order Summary
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                  <SummaryRow label="Service">
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', textTransform: 'capitalize' }}>
                                      <ServiceIcon appName={selectedService.appName} size={18} />
                                      {selectedService.appName}
                                    </span>
                                  </SummaryRow>
                                  <SummaryRow label="Country">{country.flag} {country.name}</SummaryRow>
                                  <SummaryRow label="Duration">{MONTH_LABELS[selectedMonths] || `${selectedMonths} months`}</SummaryRow>
                                  <SummaryRow label="Balance">
                                    <span style={{ color: hasBalance ? '#10b981' : '#f43f5e', fontWeight: 700 }}>
                                      ₦{(profile?.wallet_balance || 0).toLocaleString()}
                                    </span>
                                  </SummaryRow>
                                  <div style={{ height: 1, background: 'var(--border)', margin: '0.1rem 0' }} />
                                  <SummaryRow label="Total" bold>
                                    <span style={{ color: 'var(--gold)', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem' }}>
                                      ₦{selectedPrice?.toLocaleString()}
                                    </span>
                                  </SummaryRow>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border)', fontSize: '0.7rem', color: 'var(--muted)' }}>
                                  <span style={{ color: '#f0b429', display: 'flex' }}><WarnIcon /></span>
                                  Rentals can’t be cancelled or refunded once purchased.
                                </div>
                              </div>

                              {!hasBalance && (
                                <div style={{
                                  background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)',
                                  borderRadius: '12px', padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#f43f5e',
                                  marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                }}>
                                  <span>Insufficient balance</span>
                                  <Link href="/dashboard/wallet" style={{ color: '#f43f5e', fontWeight: 700, textDecoration: 'none', fontSize: '0.75rem' }}>
                                    Fund Wallet →
                                  </Link>
                                </div>
                              )}

                              {error && <ErrorBanner>{error}</ErrorBanner>}

                              <button onClick={handleBuy} disabled={ordering || !hasBalance} className="buy-btn" style={{
                                width: '100%', padding: '1rem', marginTop: error || !hasBalance ? '0.75rem' : 0,
                                background: !hasBalance ? 'var(--card2)' : ordering ? 'var(--purple2)' : 'var(--purple)',
                                color: !hasBalance ? 'var(--muted)' : '#fff', border: 'none', borderRadius: '14px',
                                fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem', fontWeight: 700,
                                cursor: ordering || !hasBalance ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                                opacity: !hasBalance ? 0.6 : 1,
                              }}>
                                {ordering ? (
                                  <><Spinner color="currentColor" /> Setting up your rental…</>
                                ) : (
                                  `Rent Now — ₦${selectedPrice?.toLocaleString()}`
                                )}
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* ── MY RENTALS LIST ── */
                <div style={{ animation: 'fadeSlideIn 0.3s ease both' }}>
                  {loadingRentals ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {[0, 1, 2].map((i) => <div key={i} className="skel" style={{ height: 72, borderRadius: 16 }} />)}
                    </div>
                  ) : rentals.length === 0 ? (
                    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: '2.5rem 1.2rem', textAlign: 'center' }}>
                      <div style={{ width: 64, height: 64, borderRadius: 20, margin: '0 auto 1rem', background: 'rgba(108,78,242,0.1)', border: '1px solid rgba(108,78,242,0.25)', color: 'var(--purple2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <PhoneIcon />
                      </div>
                      <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', marginBottom: '0.3rem' }}>No rentals yet</div>
                      <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginBottom: '1.1rem', lineHeight: 1.5 }}>Rent a number to receive SMS anytime, for a month or more.</div>
                      <button onClick={() => setTab('buy')} className="buy-btn" style={{ padding: '0.7rem 1.5rem', background: 'var(--purple)', color: '#fff', border: 'none', borderRadius: 12, fontSize: '0.85rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif', cursor: 'pointer' }}>Rent a number</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {activeRentals.length > 0 && (
                        <>
                          <MiniLabel>Active · {activeRentals.length}</MiniLabel>
                          {activeRentals.map((r) => <RentalCard key={r.order_id} r={r} days={daysRemaining(r.expires_at)} onOpen={() => openRental(r)} />)}
                        </>
                      )}
                      {pastRentals.length > 0 && (
                        <>
                          <div style={{ marginTop: activeRentals.length ? '0.4rem' : 0 }}><MiniLabel>History</MiniLabel></div>
                          {pastRentals.map((r) => <RentalCard key={r.order_id} r={r} days={daysRemaining(r.expires_at)} onOpen={() => openRental(r)} />)}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {!isDesktop && <BottomNav />}
    </main>
  )
}

// ── Small reusable components ──────────────────────────────────────────
function StepBadge({ n, done }) {
  return (
    <div style={{
      width: 22, height: 22, borderRadius: '50%',
      background: done ? '#34d399' : 'var(--purple)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      {done ? <CheckIcon size={11} color="#fff" /> : <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#fff' }}>{n}</span>}
    </div>
  )
}
function SummaryRow({ label, children, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', gap: '0.5rem' }}>
      <span style={{ color: 'var(--muted)', flexShrink: 0, fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ color: 'var(--text)', fontWeight: bold ? 700 : 500, textAlign: 'right' }}>{children}</span>
    </div>
  )
}
function ErrorBanner({ children }) {
  return (
    <div role="alert" style={{
      background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)',
      borderRadius: '12px', padding: '0.8rem 1rem', fontSize: '0.8rem', color: '#f43f5e',
      display: 'flex', alignItems: 'flex-start', gap: '0.55rem', lineHeight: 1.45,
    }}>
      <span style={{ flexShrink: 0, marginTop: '0.1rem', display: 'flex' }}><InfoIcon size={15} color="#f43f5e" /></span>
      <span>{children}</span>
    </div>
  )
}
function Spinner({ color = 'var(--purple)' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>
  )
}
function BackIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
}
function InfoIcon({ size = 16, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
}
function CloseIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
}
function CheckIcon({ size = 14, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
}
function CopyIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
}

// Brand glyphs for the services we've actually seen so far — but the
// rentable list genuinely rotates based on whatever Fleexa currently
// has cached/priced (confirmed live: it showed whatsapp/instagram/
// facebook/telegram one day, then signal/tiktok/match.com/victoria
// milan the next, with no overlap). A hardcoded icon set can never
// cover every service that might show up, so anything not in this map
// falls back to a colored initial badge instead of breaking or
// rendering blank.
const BRAND_ICONS = {
  whatsapp: { color: '#25D366', path: 'M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.85.5 3.68 1.45 5.26L2 22l4.99-1.6a9.9 9.9 0 0 0 5.05 1.38h.01c5.46 0 9.91-4.45 9.91-9.9 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m0 1.67a8.23 8.23 0 0 1 8.23 8.24c0 4.54-3.7 8.23-8.24 8.23a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12 1 1.02-3.02-.2-.32a8.2 8.2 0 0 1-1.26-4.38c.001-4.54 3.7-8.23 8.24-8.23m-2.3 4.16c-.16 0-.42.06-.64.31-.22.24-.85.83-.85 2.02s.87 2.34.99 2.51c.12.16 1.7 2.6 4.14 3.62 2.03.84 2.45.68 2.9.64.44-.04 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.44-1.34-1.68-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.32-.75-1.8-.2-.48-.4-.4-.55-.4Z' },
  telegram: { color: '#26A5E4', path: 'M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71l-4.14-3.05-2 1.93c-.23.23-.42.42-.82.42Z' },
  facebook: { color: '#1877F2', path: 'M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.2 2.23.2v2.45h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z' },
  instagram: { color: '#E1306C', path: 'M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.31-1.46.72-2.13 1.39C1.35 2.68.94 3.35.63 4.14c-.3.76-.5 1.64-.56 2.91C.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.31.79.72 1.46 1.39 2.13.67.67 1.34 1.08 2.13 1.39.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.79-.31 1.46-.72 2.13-1.39.67-.67 1.08-1.34 1.39-2.13.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91-.31-.79-.72-1.46-1.39-2.13C21.32 1.35 20.65.94 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0Zm0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84Zm0 10.16A4 4 0 1 1 16 12a4 4 0 0 1-4 4Zm6.41-10.4a1.44 1.44 0 1 1-1.44-1.44 1.44 1.44 0 0 1 1.44 1.44Z' },
}

// Deterministic fallback color for anything not in BRAND_ICONS, so the
// same service always gets the same color (not random per render).
const FALLBACK_PALETTE = ['#6C4EF2', '#F59E0B', '#10B981', '#EC4899', '#3B82F6', '#F43F5E', '#14B8A6', '#8B5CF6']
function fallbackColorFor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length]
}

function ServiceIcon({ appName, size = 34 }) {
  const key = (appName || '').toLowerCase()
  const brand = BRAND_ICONS[key]

  if (brand) {
    return (
      <div style={{
        width: size, height: size, borderRadius: Math.round(size * 0.3), background: brand.color, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="#fff"><path d={brand.path} /></svg>
      </div>
    )
  }

  // Fallback: colored initial badge — keeps every service (including
  // ones we've never seen before, like a future rotation of the
  // rentable list) looking intentional rather than broken.
  const initial = (appName || '?').trim().charAt(0).toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.3), background: fallbackColorFor(key || '?'), flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ color: '#fff', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: Math.round(size * 0.46) }}>{initial}</span>
    </div>
  )
}
function MiniLabel({ children }) {
  return <div style={{ fontSize: '0.62rem', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, margin: '0 0 0.1rem 0.15rem' }}>{children}</div>
}
function RentalCard({ r, days, onOpen }) {
  const isActive = r.status === 'active'
  const total = (r.months || 1) * 30
  const pct = isActive && days !== null ? Math.max(0, Math.min(100, (days / total) * 100)) : 0
  const low = isActive && days !== null && days < 3
  const badge = isActive
    ? { t: 'Active', c: '#34d399', bg: 'rgba(52,211,153,0.12)' }
    : r.status === 'expired'
      ? { t: 'Expired', c: '#f43f5e', bg: 'rgba(244,63,94,0.1)' }
      : { t: r.status, c: 'var(--muted)', bg: 'var(--card2)' }
  return (
    <button onClick={onOpen} className="rental-card" style={{
      display: 'flex', flexDirection: 'column', gap: '0.7rem', padding: '0.9rem 1rem', width: '100%',
      background: isActive ? 'linear-gradient(135deg, rgba(108,78,242,0.08) 0%, rgba(70,135,255,0.04) 100%)' : 'var(--card)',
      border: `1px solid ${isActive ? 'rgba(108,78,242,0.25)' : 'var(--border)'}`, borderRadius: '16px',
      cursor: 'pointer', textAlign: 'left', opacity: isActive ? 1 : 0.8, animation: 'fadeSlideIn 0.3s ease both',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <ServiceIcon appName={r.plan_name} size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.92rem', fontWeight: 800, color: 'var(--text)' }}>{r.phone || '—'}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.1rem', textTransform: 'capitalize' }}>
            {r.plan_name} · {r.months}mo · {r.message_count} message{r.message_count === 1 ? '' : 's'}
          </div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.2rem 0.65rem', borderRadius: 50, background: badge.bg, color: badge.c, fontSize: '0.68rem', fontWeight: 700, flexShrink: 0, textTransform: 'capitalize' }}>
          {isActive && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', animation: 'pulse 1.6s ease infinite' }} />}
          {badge.t}
        </span>
      </div>
      {isActive && days !== null && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', color: low ? '#f43f5e' : 'var(--muted)', marginBottom: '0.3rem' }}>
            <span>{days} day{days === 1 ? '' : 's'} left</span>
            <span>Tap to view messages →</span>
          </div>
          <div style={{ height: 3, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 99, background: low ? '#f43f5e' : 'var(--purple)', width: `${pct}%` }} />
          </div>
        </div>
      )}
    </button>
  )
}
function PlusIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function ClockIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> }
function WarnIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> }
function PhoneIcon() { return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg> }