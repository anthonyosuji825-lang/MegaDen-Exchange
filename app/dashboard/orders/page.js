'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [activeFilter, setActiveFilter] = useState('all')

  useEffect(() => {
    setMounted(true)
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      setOrders(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filters = ['all', 'completed', 'pending', 'failed']

  const filtered = activeFilter === 'all' ? orders : orders.filter(o => o.status === activeFilter)

  const categoryIcon = (type) => {
    if (type === 'number') return <PhoneIcon />
    if (type === 'log') return <LogIcon />
    if (type === 'boosting') return <BoostIcon />
    return <PackageIcon />
  }

  const categoryColor = (type) => {
    if (type === 'number') return 'var(--purple)'
    if (type === 'log') return '#f0b429'
    if (type === 'boosting') return '#1d9e75'
    return 'var(--muted)'
  }

  const statusStyle = (status) => {
    if (status === 'completed') return { bg: 'rgba(29,158,117,0.12)', color: '#34d399' }
    if (status === 'pending') return { bg: 'rgba(240,180,41,0.12)', color: '#f0b429' }
    if (status === 'failed') return { bg: 'rgba(220,50,50,0.12)', color: '#ff6b6b' }
    return { bg: 'var(--card2)', color: 'var(--muted)' }
  }

  return (
    <main style={{ background: 'var(--navy)', minHeight: '100vh', paddingBottom: '2rem' }}>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .filter-chip { transition: background 0.18s, color 0.18s, border-color 0.18s, transform 0.15s; cursor: pointer; }
        .filter-chip:hover { transform: translateY(-1px); }
        .order-card { transition: transform 0.18s, box-shadow 0.18s; }
        .order-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.12); }
        .back-btn { transition: background 0.18s, transform 0.18s; }
        .back-btn:hover { background: var(--card2) !important; transform: translateX(-2px); }
      `}</style>

      {/* HEADER */}
      <div style={{ padding: '1.1rem 1.4rem', display: 'flex', alignItems: 'center', gap: '0.9rem', position: 'sticky', top: 0, zIndex: 100, background: 'var(--navy)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/dashboard" className="back-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '10px', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', textDecoration: 'none' }}>
          <BackIcon />
        </Link>
        <div style={{ animation: mounted ? 'fadeSlideIn 0.4s ease' : 'none' }}>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>My Orders</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{orders.length} total orders</div>
        </div>
      </div>

      <div style={{ padding: '1.2rem 1.4rem' }}>

        {/* STATS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.7rem', marginBottom: '1.4rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.05s both' : 'none' }}>
          {[
            { label: 'Total', value: orders.length, color: 'var(--purple2)' },
            { label: 'Completed', value: orders.filter(o => o.status === 'completed').length, color: '#34d399' },
            { label: 'Pending', value: orders.filter(o => o.status === 'pending').length, color: '#f0b429' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '0.9rem', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* FILTERS */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.2rem', overflowX: 'auto', paddingBottom: '0.2rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.1s both' : 'none' }}>
          {filters.map(f => (
            <button key={f} className="filter-chip"
              onClick={() => setActiveFilter(f)}
              style={{ padding: '0.45rem 1rem', borderRadius: '50px', border: `1px solid ${activeFilter === f ? 'var(--purple)' : 'var(--border)'}`, background: activeFilter === f ? 'rgba(108,78,242,0.12)' : 'var(--card)', color: activeFilter === f ? 'var(--purple2)' : 'var(--muted)', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif' }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== 'all' && <span style={{ marginLeft: '0.4rem', background: activeFilter === f ? 'var(--purple)' : 'var(--card2)', color: activeFilter === f ? '#fff' : 'var(--muted)', borderRadius: '50px', padding: '0 0.4rem', fontSize: '0.68rem' }}>
                {orders.filter(o => o.status === f).length}
              </span>}
            </button>
          ))}
        </div>

        {/* ORDERS LIST */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)', fontSize: '0.85rem' }}>Loading orders...</div>
        ) : filtered.length === 0 ? (
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '3rem', textAlign: 'center', animation: 'fadeSlideIn 0.4s ease' }}>
            <div style={{ color: 'var(--muted)', marginBottom: '0.5rem' }}><PackageIcon size={36} /></div>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', marginBottom: '0.3rem' }}>No orders yet</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.82rem', marginBottom: '1rem' }}>Start by buying a number or social media log.</div>
            <Link href="/dashboard/numbers" style={{ display: 'inline-block', padding: '0.55rem 1.3rem', background: 'var(--purple)', color: '#fff', borderRadius: '10px', fontSize: '0.82rem', textDecoration: 'none', fontWeight: 600 }}>Browse Services</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {filtered.map((order, i) => {
              const s = statusStyle(order.status)
              return (
                <div key={order.id} className="order-card"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1rem 1.1rem', animation: mounted ? `fadeSlideIn 0.35s ease ${0.05 * i}s both` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: 40, height: 40, borderRadius: '11px', background: `${categoryColor(order.product_type)}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: categoryColor(order.product_type), flexShrink: 0 }}>
                        {categoryIcon(order.product_type)}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text)' }}>{order.product_name || 'Order'}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.1rem', textTransform: 'capitalize' }}>{order.product_type || 'Service'}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.9rem', color: 'var(--gold)' }}>₦{order.amount?.toLocaleString()}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
                      {new Date(order.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style={{ padding: '0.2rem 0.7rem', borderRadius: '50px', background: s.bg, color: s.color, fontSize: '0.7rem', fontWeight: 600, textTransform: 'capitalize' }}>
                      {order.status}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    <BottomNav />
    </main>
  )
}

function BackIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
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
function BoostIcon({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
}