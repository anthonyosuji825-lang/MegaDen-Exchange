'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import LoadingScreen from '@/components/LoadingScreen'

const DEFAULT_SERVICES = [
  {
    id: 'spotify',
    name: 'Spotify',
    color: '#1db954',
    bg: '#1db95415',
    desc: 'Premium music streaming',
    icon: 'spotify',
    plans: [
      { id: 'spotify_1m', name: '1 Month', duration: '30 days', price: 2500, originalPrice: 4000, badge: null },
      { id: 'spotify_3m', name: '3 Months', duration: '90 days', price: 6500, originalPrice: 11000, badge: 'Popular' },
      { id: 'spotify_6m', name: '6 Months', duration: '180 days', price: 12000, originalPrice: 20000, badge: null },
      { id: 'spotify_1y', name: '1 Year', duration: '365 days', price: 22000, originalPrice: 38000, badge: 'Best Value' },
    ]
  },
  {
    id: 'netflix',
    name: 'Netflix',
    color: '#e50914',
    bg: '#e5091415',
    desc: 'Movies, series & more',
    icon: 'netflix',
    plans: [
      { id: 'netflix_1m', name: '1 Month', duration: '30 days', price: 3500, originalPrice: 5500, badge: null },
      { id: 'netflix_3m', name: '3 Months', duration: '90 days', price: 9500, originalPrice: 15000, badge: 'Popular' },
      { id: 'netflix_6m', name: '6 Months', duration: '180 days', price: 18000, originalPrice: 28000, badge: null },
      { id: 'netflix_1y', name: '1 Year', duration: '365 days', price: 33000, originalPrice: 55000, badge: 'Best Value' },
    ]
  },
  {
    id: 'youtube',
    name: 'YouTube Premium',
    color: '#ff0000',
    bg: '#ff000015',
    desc: 'Ad-free YouTube + Music',
    icon: 'youtube',
    plans: [
      { id: 'yt_1m', name: '1 Month', duration: '30 days', price: 2000, originalPrice: 3500, badge: null },
      { id: 'yt_3m', name: '3 Months', duration: '90 days', price: 5500, originalPrice: 9500, badge: 'Popular' },
      { id: 'yt_6m', name: '6 Months', duration: '180 days', price: 10000, originalPrice: 18000, badge: null },
      { id: 'yt_1y', name: '1 Year', duration: '365 days', price: 18000, originalPrice: 34000, badge: 'Best Value' },
    ]
  },
  {
    id: 'canva',
    name: 'Canva Pro',
    color: '#7d2ae8',
    bg: '#7d2ae815',
    desc: 'Professional design tool',
    icon: 'canva',
    plans: [
      { id: 'canva_1m', name: '1 Month', duration: '30 days', price: 3000, originalPrice: 5000, badge: null },
      { id: 'canva_3m', name: '3 Months', duration: '90 days', price: 8000, originalPrice: 13500, badge: 'Popular' },
      { id: 'canva_6m', name: '6 Months', duration: '180 days', price: 14000, originalPrice: 25000, badge: null },
      { id: 'canva_1y', name: '1 Year', duration: '365 days', price: 25000, originalPrice: 48000, badge: 'Best Value' },
    ]
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT Plus',
    color: '#10a37f',
    bg: '#10a37f15',
    desc: 'GPT-4 powered AI assistant',
    icon: 'chatgpt',
    plans: [
      { id: 'chatgpt_1m', name: '1 Month', duration: '30 days', price: 8000, originalPrice: 12000, badge: null },
      { id: 'chatgpt_3m', name: '3 Months', duration: '90 days', price: 22000, originalPrice: 34000, badge: 'Popular' },
      { id: 'chatgpt_6m', name: '6 Months', duration: '180 days', price: 40000, originalPrice: 65000, badge: null },
      { id: 'chatgpt_1y', name: '1 Year', duration: '365 days', price: 75000, originalPrice: 125000, badge: 'Best Value' },
    ]
  },
]

const ServiceIcon = ({ id, size = 26 }) => {
  const icons = {
    spotify: <svg width={size} height={size} viewBox="0 0 24 24" fill="#1db954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>,
    netflix: <svg width={size} height={size} viewBox="0 0 24 24" fill="#e50914"><path d="M5.398 0v.006c3.028 8.556 5.37 15.175 8.348 23.678.299.832 1.548.832 1.548 0L21.898 0H16.7L12.354 12.255 8.3 0H5.398z"/></svg>,
    youtube: <svg width={size} height={size} viewBox="0 0 24 24" fill="#ff0000"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>,
    canva: <svg width={size} height={size} viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#7d2ae8"/><text x="12" y="17" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="Arial">C</text></svg>,
    chatgpt: <svg width={size} height={size} viewBox="0 0 24 24" fill="#10a37f"><path d="M22.282 9.821a5.985 5.985 0 00-.516-4.91 6.046 6.046 0 00-6.51-2.9A6.065 6.065 0 004.981 4.18a5.985 5.985 0 00-3.998 2.9 6.046 6.046 0 00.743 7.097 5.98 5.98 0 00.51 4.911 6.051 6.051 0 006.515 2.9A5.985 5.985 0 0013.26 24a6.056 6.056 0 005.772-4.206 5.99 5.99 0 003.997-2.9 6.056 6.056 0 00-.747-7.073zM13.26 22.43a4.476 4.476 0 01-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 00.392-.681v-6.737l2.02 1.168a.071.071 0 01.038.052v5.583a4.504 4.504 0 01-4.494 4.494zM3.6 18.304a4.47 4.47 0 01-.535-3.014l.142.085 4.783 2.759a.771.771 0 00.78 0l5.843-3.369v2.332a.08.08 0 01-.033.062L9.74 19.95a4.5 4.5 0 01-6.14-1.646zM2.34 7.896a4.485 4.485 0 012.366-1.973V11.6a.766.766 0 00.388.677l5.815 3.355-2.02 1.168a.076.076 0 01-.071 0l-4.83-2.786A4.504 4.504 0 012.34 7.872zm16.597 3.855l-5.843-3.369 2.02-1.168a.076.076 0 01.071 0l4.83 2.791a4.494 4.494 0 01-.676 8.105v-5.678a.79.79 0 00-.402-.681zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 00-.785 0L9.409 9.23V6.897a.066.066 0 01.028-.061l4.83-2.787a4.5 4.5 0 016.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 01-.038-.057V6.075a4.5 4.5 0 017.375-3.453l-.142.08L8.704 5.46a.795.795 0 00-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/></svg>,
  }
  return icons[id] || <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--purple)' }} />
}

export default function DigitalSubscriptions() {
  const [profile, setProfile] = useState(null)
  const [services, setServices] = useState(DEFAULT_SERVICES)
  const [selectedService, setSelectedService] = useState(null)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [ordering, setOrdering] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [deliveredKey, setDeliveredKey] = useState('')
  const [copiedKey, setCopiedKey] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setMounted(true)
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }

      const [profileRes, pricesRes] = await Promise.all([
        supabase.from('profiles').select('wallet_balance').eq('id', user.id).single(),
        supabase.from('subscription_prices').select('plan_id, price'),
      ])

      if (profileRes.data) setProfile(profileRes.data)

      // Merge live prices from admin over defaults
      if (pricesRes.data?.length) {
        const priceMap = {}
        pricesRes.data.forEach(p => { priceMap[p.plan_id] = p.price })
        setServices(DEFAULT_SERVICES.map(service => ({
          ...service,
          plans: service.plans.map(plan => ({
            ...plan,
            price: priceMap[plan.id] ?? plan.price,
          }))
        })))
      }

      setLoading(false)
    }
    load()
  }, [])

  const balance = profile?.wallet_balance || 0
  const hasBalance = balance >= (selectedPlan?.price || 0)

  const copyKey = () => {
    navigator.clipboard.writeText(deliveredKey)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
  }

  const handleOrder = async () => {
    if (!selectedService || !selectedPlan) return
    setOrdering(true)
    setError('')

    try {
      const res = await fetch('/api/subscriptions/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: selectedService.name,
          service_id: selectedService.id,
          plan: selectedPlan.name,
          plan_id: selectedPlan.id,
          price: selectedPlan.price,
        })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || 'Something went wrong. Please try again.')
        setOrdering(false)
        return
      }

      setProfile(prev => ({ ...prev, wallet_balance: (prev?.wallet_balance || 0) - selectedPlan.price }))
      setDeliveredKey(data.key)
      setOrdering(false)
      setSuccess(true)

    } catch {
      setError('Network error. Please try again.')
      setOrdering(false)
    }
  }

  if (loading) return <LoadingScreen />

  return (
    <main style={{ background: 'var(--navy)', minHeight: '100vh', paddingBottom: '2rem' }}>
      <style>{`
        @keyframes fadeSlideIn { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scaleIn { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }
        @keyframes successPop { 0%{transform:scale(0);opacity:0} 70%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        .svc-card { transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease; cursor: pointer; border: none; text-align: left; }
        .svc-card:hover { transform: translateY(-2px); }
        .plan-card { transition: transform 0.15s ease, border-color 0.18s, background 0.18s; cursor: pointer; border: none; width: 100%; text-align: left; }
        .plan-card:hover { transform: translateY(-2px); }
        .buy-btn { transition: transform 0.18s ease, box-shadow 0.18s ease; cursor: pointer; }
        .buy-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(108,78,242,0.4); }
        .copy-btn { transition: background 0.15s, transform 0.15s; cursor: pointer; border: none; }
        .copy-btn:hover { transform: scale(1.04); }
        .back-btn { transition: background 0.18s, transform 0.18s; }
        .back-btn:hover { background: var(--card2) !important; transform: translateX(-2px); }
      `}</style>

      {/* HEADER */}
      <div style={{ padding: '1.1rem 1.4rem', display: 'flex', alignItems: 'center', gap: '0.9rem', position: 'sticky', top: 0, zIndex: 100, background: 'var(--header-bg)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/dashboard" className="back-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '10px', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', textDecoration: 'none', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </Link>
        <div style={{ flex: 1, animation: mounted ? 'fadeSlideIn 0.4s ease' : 'none' }}>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--header-text)' }}>Digital Subscriptions</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--header-muted)' }}>Premium access, instant delivery</div>
        </div>
        {/* BAL pill — matches other pages */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '20px', flexShrink: 0 }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>BAL</span>
          <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem', color: 'var(--gold)' }}>₦{balance.toLocaleString()}</span>
        </div>
      </div>

      <div style={{ padding: '1.2rem 1.4rem' }}>
        {success ? (
          /* SUCCESS SCREEN */
          <div style={{ animation: 'fadeSlideIn 0.4s ease' }}>
            <div style={{ textAlign: 'center', padding: '2rem 0 1.5rem' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(29,185,84,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.2rem', animation: 'successPop 0.5s cubic-bezier(0.175,0.885,0.32,1.275)' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#1db954" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.3rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.4rem' }}>Access Delivered!</div>
              <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Your subscription key is ready. Copy and activate it now.</div>
            </div>

            {/* Order pill */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.8rem 1.2rem', marginBottom: '1.2rem' }}>
              <ServiceIcon id={selectedService?.id} size={18} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text)', fontWeight: 500 }}>{selectedService?.name} · {selectedPlan?.name}</span>
              <span style={{ color: 'var(--gold)', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>₦{selectedPlan?.price.toLocaleString()}</span>
            </div>

            {/* Key box */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.2rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Access Key</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                <div style={{ flex: 1, background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.8rem 1rem', fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--text)', wordBreak: 'break-all', lineHeight: 1.5 }}>
                  {deliveredKey}
                </div>
                <button onClick={copyKey} className="copy-btn"
                  style={{ flexShrink: 0, width: 42, height: 42, borderRadius: '10px', background: copiedKey ? 'rgba(29,185,84,0.15)' : 'var(--purple)', color: copiedKey ? '#1db954' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {copiedKey
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
                </button>
              </div>
              {copiedKey && <div style={{ fontSize: '0.72rem', color: '#1db954', marginTop: '0.5rem', textAlign: 'center' }}>Copied to clipboard!</div>}
            </div>

            {/* Activation instructions */}
            <div style={{ background: `${selectedService?.color}0d`, border: `1px solid ${selectedService?.color}25`, borderRadius: '12px', padding: '1rem', marginBottom: '1.2rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.5rem' }}>How to activate</div>
              {[
                `Download or open the ${selectedService?.name} app`,
                'Go to Settings or Account section',
                'Enter or paste your access key / redeem code',
                'Enjoy your premium access!',
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', marginBottom: '0.4rem' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: selectedService?.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: '#fff', flexShrink: 0, marginTop: '0.05rem' }}>{i + 1}</div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.5 }}>{step}</span>
                </div>
              ))}
            </div>

            <button onClick={() => { setSuccess(false); setSelectedService(null); setSelectedPlan(null); setDeliveredKey('') }} className="buy-btn"
              style={{ width: '100%', padding: '0.85rem', background: 'var(--purple)', color: '#fff', border: 'none', borderRadius: '12px', fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' }}>
              Buy Another
            </button>
          </div>
        ) : (
          <>
            {/* ERROR */}
            {error && (
              <div style={{ background: 'rgba(220,50,50,0.1)', border: '1px solid rgba(220,50,50,0.3)', color: '#ff6b6b', borderRadius: '12px', padding: '0.8rem 1rem', fontSize: '0.84rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{error}</span>
                <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}>×</button>
              </div>
            )}

            {/* STEP 1 — SERVICE SELECTOR */}
            <div style={{ marginBottom: '1.6rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.05s both' : 'none' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Choose Service</span>
                {selectedService && <span style={{ color: '#34d399', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {selectedService.name}
                </span>}
              </div>

              {/* Service grid — same style as platform selector on boosting */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.55rem' }}>
                {services.map((s, i) => {
                  const isSelected = selectedService?.id === s.id
                  return (
                    <button key={s.id} className="svc-card"
                      onClick={() => { setSelectedService(s); setSelectedPlan(null) }}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
                        padding: '0.9rem 0.5rem',
                        background: isSelected ? s.bg : 'var(--card)',
                        border: `1.5px solid ${isSelected ? s.color : 'var(--border)'}`,
                        borderRadius: '14px',
                        boxShadow: isSelected ? `0 0 16px ${s.color}30` : 'none',
                        animation: mounted ? `fadeSlideIn 0.3s ease ${0.05 * i}s both` : 'none',
                        position: 'relative', overflow: 'hidden',
                      }}>
                      {/* Glow dot — same as boosting page */}
                      {isSelected && <div style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: '50%', background: s.color, boxShadow: `0 0 8px ${s.color}` }} />}
                      <div style={{ filter: isSelected ? 'none' : 'grayscale(20%) opacity(0.85)', transition: 'filter 0.2s' }}>
                        <ServiceIcon id={s.id} size={28} />
                      </div>
                      <span style={{ fontSize: '0.6rem', fontWeight: 600, color: isSelected ? s.color : 'var(--muted)', textAlign: 'center', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', transition: 'color 0.2s' }}>
                        {s.name.replace(' Premium', '').replace(' Plus', '+')}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* STEP 2 — PLAN SELECTOR */}
            {selectedService && (
              <div style={{ marginBottom: '1.6rem', animation: 'fadeSlideIn 0.35s ease both' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Select Plan</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <ServiceIcon id={selectedService.id} size={13} />
                    <span style={{ color: selectedService.color, fontSize: '0.72rem', fontWeight: 700 }}>{selectedService.name}</span>
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {selectedService.plans.map((plan, i) => {
                    const isSelected = selectedPlan?.id === plan.id
                    const discount = Math.round((1 - plan.price / plan.originalPrice) * 100)
                    return (
                      <button key={plan.id} className="plan-card"
                        onClick={() => setSelectedPlan(plan)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', background: isSelected ? `${selectedService.color}12` : 'var(--card)', border: `1px solid ${isSelected ? selectedService.color : 'var(--border)'}`, borderRadius: '12px', animation: `fadeSlideIn 0.25s ease ${0.04 * i}s both` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: isSelected ? selectedService.color : 'var(--border)', transition: 'all 0.2s', boxShadow: isSelected ? `0 0 8px ${selectedService.color}` : 'none', flexShrink: 0 }} />
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text)' }}>{plan.name}</span>
                              {plan.badge && <span style={{ fontSize: '0.6rem', background: selectedService.color, color: '#fff', borderRadius: '50px', padding: '0.15rem 0.45rem', fontWeight: 700 }}>{plan.badge}</span>}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{plan.duration} · Save {discount}% · Instant delivery</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '0.5rem' }}>
                          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--gold)', fontFamily: 'Outfit, sans-serif' }}>₦{plan.price.toLocaleString()}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textDecoration: 'line-through' }}>₦{plan.originalPrice.toLocaleString()}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ORDER SUMMARY + BUY */}
            {selectedService && selectedPlan && (
              <div style={{ animation: 'scaleIn 0.3s ease both' }}>
                <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.1rem', marginBottom: '0.8rem' }}>
                  <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)', marginBottom: '0.8rem' }}>Order Summary</div>
                  {[
                    { label: 'Service', value: <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'flex-end' }}><ServiceIcon id={selectedService.id} size={13} />{selectedService.name}</span> },
                    { label: 'Plan', value: selectedPlan.name },
                    { label: 'Duration', value: selectedPlan.duration },
                    { label: 'Delivery', value: 'Instant' },
                    { label: 'Balance', value: <span style={{ color: 'var(--gold)' }}>₦{balance.toLocaleString()}</span> },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', marginBottom: '0.45rem' }}>
                      <span style={{ color: 'var(--muted)' }}>{row.label}</span>
                      <span style={{ color: 'var(--text)', fontWeight: 500 }}>{row.value}</span>
                    </div>
                  ))}
                  <div style={{ height: 1, background: 'var(--border)', margin: '0.6rem 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.92rem' }}>
                    <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Total</span>
                    <span style={{ color: 'var(--gold)', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>₦{selectedPlan.price.toLocaleString()}</span>
                  </div>
                </div>

                {/* Insufficient balance warning */}
                {!hasBalance && (
                  <div style={{ background: 'rgba(220,50,50,0.08)', border: '1px solid rgba(220,50,50,0.25)', borderRadius: '10px', padding: '0.7rem 1rem', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8rem', color: '#ff6b6b' }}>Insufficient balance. Fund your wallet first.</span>
                    <Link href="/dashboard/wallet" style={{ fontSize: '0.75rem', color: 'var(--purple2)', fontWeight: 700, textDecoration: 'none', flexShrink: 0, marginLeft: '0.5rem' }}>Fund →</Link>
                  </div>
                )}

                <button onClick={handleOrder} disabled={ordering || !hasBalance} className="buy-btn"
                  style={{ width: '100%', padding: '0.95rem', background: !hasBalance ? 'var(--card)' : ordering ? 'var(--purple2)' : 'var(--purple)', color: !hasBalance ? 'var(--muted)' : '#fff', border: !hasBalance ? '1px solid var(--border)' : 'none', borderRadius: '12px', fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', opacity: !hasBalance ? 0.7 : 1 }}>
                  {ordering
                    ? <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>Processing...</>
                    : `Buy Now — ₦${selectedPlan.price.toLocaleString()}`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}