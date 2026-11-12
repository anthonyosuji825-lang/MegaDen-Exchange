'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import DesktopSidebar from '@/components/DesktopSidebar'

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [activeFilter, setActiveFilter] = useState('all')
  const [profile, setProfile] = useState(null)
  const [isDesktop, setIsDesktop] = useState(false)
  const [query, setQuery] = useState('') // design-only: search within the loaded orders

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
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      setOrders(data || [])
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(profileData)
      setLoading(false)
    }
    load()
  }, [])

  // 'active' only appears once the user actually has an active rental, so people
  // who never rent a number don't see an always-empty chip.
  const filters = ['all', 'completed', 'pending', ...(orders.some(o => o.status === 'active') ? ['active'] : []), 'failed', ...(orders.some(o => o.status === 'unresolved_billing') ? ['unresolved_billing'] : [])]

  const q = query.trim().toLowerCase()
  const byStatus = activeFilter === 'all' ? orders : orders.filter(o => o.status === activeFilter)
  const filtered = q
    ? byStatus.filter(o => `${o.product_name || ''} ${typeLabel(o.product_type)}`.toLowerCase().includes(q))
    : byStatus

  const categoryIcon = (type) => {
    if (type === 'number') return <PhoneIcon />
    if (type === 'log') return <LogIcon />
    if (type === 'boosting') return <BoostIcon />
    if (type === 'number_rental') return <CalendarIcon />
    if (type === 'email_otp') return <MailIcon />
    if (type === 'proxy') return <GlobeIcon />
    if (type === 'esim') return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 2h7l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><rect x="9" y="12" width="6" height="6" rx="1"/></svg>
    return <PackageIcon />
  }

  const categoryColor = (type) => {
    if (type === 'number') return 'var(--purple)'
    if (type === 'log') return '#f0b429'
    if (type === 'boosting') return '#1d9e75'
    if (type === 'number_rental') return '#2dd4bf'
    if (type === 'email_otp') return '#4687ff'
    if (type === 'proxy') return '#2dd4bf'
    if (type === 'esim') return '#a78bfa'
    return 'var(--muted)'
  }

  const statusStyle = (status) => {
    if (status === 'completed') return { bg: 'rgba(29,158,117,0.12)', color: '#34d399' }
    if (status === 'pending') return { bg: 'rgba(240,180,41,0.12)', color: '#f0b429' }
    if (status === 'failed') return { bg: 'rgba(244,63,94,0.12)', color: '#f43f5e' }
    if (status === 'active') return { bg: 'rgba(29,158,117,0.12)', color: '#34d399' }
    if (status === 'unresolved_billing') return { bg: 'rgba(240,180,41,0.12)', color: '#f0b429' }
    return { bg: 'var(--card2)', color: 'var(--muted)' }
  }

  // Raw status codes shouldn't leak into the UI ("Unresolved_billing").
  const statusLabel = (status) => status === 'unresolved_billing' ? 'Under review' : status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown'

  // Where the "manage" link for a product goes.
  const actionFor = (type) => {
    if (type === 'number_rental') return { href: '/dashboard/numbers/rent?tab=mine', label: 'View number and messages' }
    if (type === 'esim') return { href: '/dashboard/esim', label: 'Manage eSIM' }
    if (type === 'proxy') return { href: '/dashboard/proxy', label: 'Manage proxy' }
    if (type === 'email_otp') return { href: '/dashboard/email', label: 'View email and code' }
    return null
  }

  // Group orders under Today / Yesterday / This week / month headings.
  const groupLabel = (iso) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return 'Earlier'
    const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
    const diffDays = Math.round((startOf(new Date()) - startOf(d)) / 86400000)
    if (diffDays <= 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return 'This week'
    return d.toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })
  }
  const groups = []
  filtered.forEach((o) => {
    const label = groupLabel(o.created_at)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(o)
    else groups.push({ label, items: [o] })
  })

  const completedOrders = orders.filter(o => o.status === 'completed')
  const totalSpent = completedOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0)
  const filterLabel = (f) => f === 'unresolved_billing' ? 'Under review' : f.charAt(0).toUpperCase() + f.slice(1)

  let idx = 0

  return (
    <main style={{ background: 'var(--navy)', minHeight: '100vh', display: isDesktop ? 'flex' : 'block' }}>
      <style>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        * { box-sizing: border-box; }
        .filter-chip { transition: background 0.18s, color 0.18s, border-color 0.18s, transform 0.15s; cursor: pointer; flex-shrink: 0; }
        .filter-chip:hover { transform: translateY(-1px); }
        .order-card { transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s; }
        .order-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.14); border-color: rgba(108,78,242,0.35) !important; }
        .back-btn { transition: background 0.18s, transform 0.18s; }
        .back-btn:hover { background: var(--card2) !important; transform: translateX(-2px); }
        .o-pill { transition: border-color 0.15s, background 0.15s; }
        .o-pill:hover { border-color: var(--purple) !important; background: var(--card2) !important; }
        .o-search:focus { border-color: var(--purple) !important; box-shadow: 0 0 0 3px rgba(108,78,242,0.12); }
        .o-stat { transition: transform 0.15s, border-color 0.15s; cursor: pointer; font-family: inherit; }
        .o-stat:hover { transform: translateY(-2px); }
        .o-action { transition: background 0.15s, border-color 0.15s; }
        .o-action:hover { background: rgba(108,78,242,0.16) !important; border-color: var(--purple) !important; }
        .o-chips { scrollbar-width: none; -ms-overflow-style: none; }
        .o-chips::-webkit-scrollbar { display: none; }
        .skel { background: linear-gradient(90deg, var(--card) 25%, var(--card2) 50%, var(--card) 75%); background-size: 200% 100%; animation: shimmer 1.4s linear infinite; }
        .filter-chip:focus-visible, .o-stat:focus-visible, .back-btn:focus-visible, .o-pill:focus-visible, .o-action:focus-visible, .order-card:focus-visible { outline: 2px solid var(--purple); outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; } }
      `}</style>

      {isDesktop && <DesktopSidebar profile={profile} onLogout={handleLogout} />}

      <div style={{ flex: isDesktop ? 1 : 'none', minWidth: 0, paddingBottom: isDesktop ? '2rem' : '6.5rem' }}>
      {/* HEADER */}
      <div style={{ padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.85rem', position: 'sticky', top: 0, zIndex: 100, background: 'rgba(var(--navy-rgb, 10,10,30), 0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/dashboard" aria-label="Back to dashboard" className="back-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', textDecoration: 'none', flexShrink: 0 }}>
          <BackIcon />
        </Link>
        <div style={{ flex: 1, minWidth: 0, animation: mounted ? 'fadeSlideIn 0.4s ease' : 'none' }}>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--text)', letterSpacing: '-0.02em' }}>My Orders</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{orders.length} total {orders.length === 1 ? 'order' : 'orders'}</div>
        </div>
        <Link href="/dashboard/wallet" aria-label="Fund wallet" className="o-pill" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.35rem 0.3rem 0.75rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, flexShrink: 0, textDecoration: 'none' }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>BAL</span>
          <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem', color: 'var(--gold)' }}>₦{(profile?.wallet_balance || 0).toLocaleString()}</span>
          <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--purple)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PlusIcon /></span>
        </Link>
      </div>

      <div style={{ padding: '1.2rem', maxWidth: isDesktop ? 640 : 560, margin: '0 auto' }}>

        {/* SPEND SUMMARY */}
        <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, rgba(108,78,242,0.14) 0%, rgba(240,180,41,0.07) 100%)', border: '1px solid rgba(108,78,242,0.25)', borderRadius: 20, padding: '1.1rem 1.2rem', marginBottom: '0.7rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.03s both' : 'none' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>Total spent</div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: '1.9rem', color: 'var(--gold)', letterSpacing: '-0.02em', marginTop: '0.2rem' }}>
            {loading ? <span className="skel" style={{ display: 'inline-block', width: 150, height: 30, borderRadius: 8 }} /> : `₦${totalSpent.toLocaleString()}`}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
            across {completedOrders.length} completed {completedOrders.length === 1 ? 'order' : 'orders'}
          </div>
        </div>

        {/* STATS (tap to filter) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1.3rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.06s both' : 'none' }}>
          {[
            { label: 'Total', filter: 'all', value: orders.length, color: 'var(--purple2)' },
            { label: 'Completed', filter: 'completed', value: completedOrders.length, color: '#34d399' },
            { label: 'Pending', filter: 'pending', value: orders.filter(o => o.status === 'pending').length, color: '#f0b429' },
          ].map(s => {
            const on = activeFilter === s.filter
            return (
              <button key={s.label} className="o-stat" onClick={() => setActiveFilter(s.filter)} aria-pressed={on}
                style={{ background: on ? 'rgba(108,78,242,0.1)' : 'var(--card)', border: `1px solid ${on ? 'var(--purple)' : 'var(--border)'}`, borderRadius: 14, padding: '0.8rem 0.5rem', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.4rem', color: s.color, lineHeight: 1.1 }}>{s.value}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '0.25rem' }}>{s.label}</div>
              </button>
            )
          })}
        </div>

        {/* SEARCH */}
        {orders.length > 5 && (
          <div style={{ position: 'relative', marginBottom: '0.7rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.08s both' : 'none' }}>
            <div style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }}><SearchIcon /></div>
            <input className="o-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your orders…" aria-label="Search orders"
              style={{ width: '100%', padding: '0.7rem 2.4rem 0.7rem 2.4rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: '0.85rem', outline: 'none', fontFamily: 'Inter, sans-serif', transition: 'border-color 0.2s, box-shadow 0.2s' }} />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Clear search" style={{ position: 'absolute', right: '0.55rem', top: '50%', transform: 'translateY(-50%)', width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'var(--card2)', color: 'var(--muted)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            )}
          </div>
        )}

        {/* FILTERS */}
        <div className="o-chips" role="tablist" style={{ display: 'flex', gap: '0.45rem', marginBottom: '1.2rem', overflowX: 'auto', padding: '2px 2px 0.3rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.1s both' : 'none' }}>
          {filters.map(f => {
            const on = activeFilter === f
            return (
              <button key={f} role="tab" aria-selected={on} className="filter-chip"
                onClick={() => setActiveFilter(f)}
                style={{ padding: '0.45rem 0.95rem', borderRadius: 50, border: `1px solid ${on ? 'var(--purple)' : 'var(--border)'}`, background: on ? 'rgba(108,78,242,0.14)' : 'var(--card)', color: on ? 'var(--purple2)' : 'var(--muted)', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif', display: 'inline-flex', alignItems: 'center' }}>
                {filterLabel(f)}
                {f !== 'all' && <span style={{ marginLeft: '0.4rem', background: on ? 'var(--purple)' : 'var(--card2)', color: on ? '#fff' : 'var(--muted)', borderRadius: 50, padding: '0 0.45rem', fontSize: '0.68rem', minWidth: 18, textAlign: 'center' }}>
                  {orders.filter(o => o.status === f).length}
                </span>}
              </button>
            )
          })}
        </div>

        {/* ORDERS LIST */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }} aria-label="Loading orders">
            {[0, 1, 2, 3].map(i => <div key={i} className="skel" style={{ height: 96, borderRadius: 16, border: '1px solid var(--border)' }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: 'var(--card)', border: '1px dashed var(--border)', borderRadius: 20, padding: '2.6rem 1.2rem', textAlign: 'center', animation: 'fadeSlideIn 0.4s ease' }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, margin: '0 auto 0.9rem', background: 'rgba(108,78,242,0.1)', border: '1px solid rgba(108,78,242,0.25)', color: 'var(--purple2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PackageIcon size={28} /></div>
            {orders.length === 0 ? (
              <>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', marginBottom: '0.3rem' }}>No orders yet</div>
                <div style={{ color: 'var(--muted)', fontSize: '0.82rem', marginBottom: '1.1rem' }}>Start by buying a number or social media log.</div>
                <Link href="/dashboard/numbers" style={{ display: 'inline-block', padding: '0.65rem 1.4rem', background: 'var(--purple)', color: '#fff', borderRadius: 12, fontSize: '0.84rem', textDecoration: 'none', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>Browse Services</Link>
              </>
            ) : (
              <>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', marginBottom: '0.3rem' }}>
                  {q ? `No orders match “${query}”` : `No ${filterLabel(activeFilter).toLowerCase()} orders`}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: '0.82rem', marginBottom: '1.1rem' }}>Try a different filter or clear your search.</div>
                <button onClick={() => { setActiveFilter('all'); setQuery('') }} style={{ padding: '0.6rem 1.3rem', background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 12, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Show all orders</button>
              </>
            )}
          </div>
        ) : (
          <div>
            {groups.map((g) => (
              <section key={g.label} style={{ marginBottom: '1.3rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem', padding: '0 0.2rem' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{g.label}</span>
                  <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{g.items.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {g.items.map((order) => {
                    const s = statusStyle(order.status)
                    const act = actionFor(order.product_type)
                    const color = categoryColor(order.product_type)
                    const i = idx++
                    return (
                      <div key={order.id} className="order-card"
                        style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '0.95rem 1rem', animation: mounted ? `fadeSlideIn 0.35s ease ${Math.min(i, 10) * 0.04}s both` : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: 42, height: 42, borderRadius: 13, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
                            {categoryIcon(order.product_type)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{order.product_name || 'Order'}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.12rem', textTransform: 'capitalize' }}>{typeLabel(order.product_type)}</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.95rem', color: 'var(--gold)' }}>₦{(Number(order.amount) || 0).toLocaleString()}</div>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.25rem', padding: '0.15rem 0.6rem', borderRadius: 50, background: s.bg, color: s.color, fontSize: '0.66rem', fontWeight: 700 }}>
                              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', animation: order.status === 'pending' ? 'pulse 1.6s ease infinite' : 'none' }} />
                              {statusLabel(order.status)}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: '1px dashed var(--border)' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
                            {new Date(order.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                          {act && (
                            <Link href={act.href} className="o-action" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.75rem', borderRadius: 50, background: 'rgba(108,78,242,0.1)', border: '1px solid rgba(108,78,242,0.25)', fontSize: '0.72rem', fontWeight: 700, color: 'var(--purple2)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                              {act.label} <ArrowIcon />
                            </Link>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
      </div>

      {!isDesktop && <BottomNav />}
    </main>
  )
}

// Raw type codes shouldn't leak into the UI ("Number_rental").
function typeLabel(type) {
  return type === 'number_rental' ? 'Number rental' : type === 'email_otp' ? 'Email OTP' : type === 'proxy' ? 'Residential proxy' : type === 'esim' ? 'Travel eSIM' : (type || 'Service')
}

function BackIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
}
function PlusIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function SearchIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
}
function ArrowIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
}
function PackageIcon({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
}
function PhoneIcon({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1"/></svg>
}
function LogIcon({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
}
function CalendarIcon({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function GlobeIcon({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
}
function MailIcon({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>
}
function BoostIcon({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
}