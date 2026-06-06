'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

const services = [
  { id: 'whatsapp', name: 'WhatsApp', color: '#25d366' },
  { id: 'telegram', name: 'Telegram', color: '#0088cc' },
  { id: 'facebook', name: 'Facebook', color: '#1877f2' },
  { id: 'instagram', name: 'Instagram', color: '#e1306c' },
  { id: 'tiktok', name: 'TikTok', color: '#ff0050' },
  { id: 'gmail', name: 'Gmail', color: '#ea4335' },
  { id: 'twitter', name: 'Twitter / X', color: '#1da1f2' },
  { id: 'any', name: 'Any SMS', color: '#6c4ef2' },
]

export default function BuyNumbers() {
  const [search, setSearch] = useState('')
  const [selectedCountry, setSelectedCountry] = useState(null)
  const [selectedService, setSelectedService] = useState(null)
  const [ordering, setOrdering] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [countries, setCountries] = useState([])
  const [loadingCountries, setLoadingCountries] = useState(false)
  const [purchased, setPurchased] = useState(null)
  const [sms, setSms] = useState([])
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    setMounted(true)
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
  }, [])

  const fetchCountries = async (serviceId) => {
    setLoadingCountries(true)
    setCountries([])
    setSelectedCountry(null)
    try {
      const res = await fetch(`/api/5sim/countries?service=${serviceId}`)
      const data = await res.json()
      setCountries(data.countries || [])
    } catch {
      setError('Failed to load countries. Please refresh.')
    }
    setLoadingCountries(false)
  }

  const handleServiceSelect = (service) => {
    setSelectedService(service)
    setSelectedCountry(null)
    fetchCountries(service.id)
  }

  useEffect(() => {
    if (!purchased) return
    setCountdown(purchased.expires_in)
    const cdTimer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(cdTimer); return 0 }
        return prev - 1
      })
    }, 1000)
    const pollTimer = setInterval(async () => {
      const res = await fetch(`/api/5sim/sms?id=${purchased.fivesim_id}&order_id=${purchased.order_id}`)
      const data = await res.json()
      if (data.sms && data.sms.length > 0) {
        setSms(data.sms)
        clearInterval(pollTimer)
        clearInterval(cdTimer)
      }
    }, 5000)
    return () => { clearInterval(cdTimer); clearInterval(pollTimer) }
  }, [purchased])

  const filtered = countries.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  )

  const handleOrder = async () => {
    if (!selectedCountry || !selectedService || !user) return
    setOrdering(true)
    setError('')
    const res = await fetch('/api/5sim/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country: selectedCountry.code,
        service: selectedService.id,
        userId: user.id,
        priceNgn: selectedCountry.price_ngn,
      })
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Purchase failed. Try again.')
      setOrdering(false)
      return
    }
    setProfile(p => ({ ...p, wallet_balance: (p.wallet_balance || 0) - selectedCountry.price_ngn }))
    setPurchased({
      phone: data.phone,
      fivesim_id: data.fivesim_id,
      order_id: data.order_id,
      expires_in: data.expires_in,
      country: selectedCountry,
      service: selectedService,
    })
    setOrdering(false)
  }

  const handleCancel = async () => {
    if (!purchased) return
    await fetch(`/api/5sim/sms?id=${purchased.fivesim_id}&order_id=${purchased.order_id}&user_id=${user.id}&amount=${purchased.country.price_ngn}`, {
      method: 'DELETE'
    })
    setPurchased(null)
    setSms([])
    setSelectedCountry(null)
    setSelectedService(null)
    setCountries([])
  }

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  if (pageLoading) return (
    <main style={{ background: 'var(--navy)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)' }}>Loading...</div>
      </div>
    </main>
  )

  return (
    <main style={{ background: 'var(--navy)', minHeight: '100vh', paddingBottom: '2rem' }}>
      <style>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        .service-chip { transition: transform 0.18s, border-color 0.18s, background 0.18s; cursor: pointer; }
        .service-chip:hover { transform: translateY(-2px); }
        .country-card { transition: transform 0.18s, border-color 0.18s, background 0.18s; cursor: pointer; }
        .country-card:hover { transform: translateY(-2px); }
        .buy-btn { transition: transform 0.18s, box-shadow 0.18s; }
        .buy-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(108,78,242,0.4); }
        .back-btn { transition: background 0.18s, transform 0.18s; }
        .back-btn:hover { background: var(--card2) !important; transform: translateX(-2px); }
        .service-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.6rem; }
        .country-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.6rem; }
        @media (min-width: 480px) { .country-grid { grid-template-columns: repeat(3, 1fr); } }
      `}</style>

      {/* HEADER */}
      <div style={{ padding: '1.1rem 1.4rem', display: 'flex', alignItems: 'center', gap: '0.9rem', position: 'sticky', top: 0, zIndex: 100, background: 'var(--navy)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/dashboard" className="back-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '10px', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', textDecoration: 'none' }}>
          <BackIcon />
        </Link>
        <div style={{ animation: mounted ? 'fadeSlideIn 0.4s ease' : 'none' }}>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>Foreign Numbers</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
            {profile && <span style={{ color: 'var(--gold)', fontWeight: 600 }}>₦{(profile.wallet_balance || 0).toLocaleString()}</span>} available
          </div>
        </div>
      </div>

      <div style={{ padding: '1.2rem 1.4rem' }}>

        {/* ERROR */}
        {error && (
          <div style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)', color: '#f43f5e', borderRadius: '12px', padding: '0.8rem 1rem', fontSize: '0.84rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{error}</span>
            <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}>×</button>
          </div>
        )}

        {/* PURCHASED — NUMBER WAITING FOR OTP */}
        {purchased ? (
          <div style={{ animation: 'fadeSlideIn 0.4s ease' }}>

            {/* Number display card */}
            <div style={{ background: 'linear-gradient(135deg, #1a0a5e, #6c4ef2)', borderRadius: '20px', padding: '1.8rem', marginBottom: '1.2rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Your Number</div>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.8rem', fontWeight: 800, color: '#fff', letterSpacing: 2, marginBottom: '0.5rem' }}>{purchased.phone}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#25d366', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                {purchased.service.name} · {purchased.country.flag} {purchased.country.name}
              </div>
            </div>

            {/* SMS received */}
            {sms.length > 0 ? (
              <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '16px', padding: '1.4rem', marginBottom: '1.2rem', animation: 'scaleIn 0.4s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.8rem' }}>
                  <CheckIcon size={18} color="#10b981" />
                  <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.9rem', color: '#10b981' }}>OTP Received!</span>
                </div>
                {sms.map((msg, i) => (
                  <div key={i} style={{ background: 'rgba(16,185,129,0.06)', borderRadius: '10px', padding: '0.8rem', marginBottom: i < sms.length - 1 ? '0.5rem' : 0 }}>
                    <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.6rem', color: '#10b981', letterSpacing: 3, marginBottom: '0.3rem' }}>{msg.code}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.5 }}>{msg.text}</div>
                  </div>
                ))}
                <button onClick={() => { setPurchased(null); setSms([]); setSelectedService(null); setSelectedCountry(null); setCountries([]) }}
                  style={{ marginTop: '1rem', width: '100%', padding: '0.75rem', background: 'var(--purple)', color: '#fff', border: 'none', borderRadius: '10px', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>
                  Buy Another Number
                </button>
              </div>
            ) : (
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.4rem', marginBottom: '1.2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1.2s linear infinite', color: 'var(--purple2)' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                    <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.88rem', color: 'var(--text)' }}>Waiting for OTP...</span>
                  </div>
                  <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: countdown < 60 ? '#f43f5e' : 'var(--gold)' }}>
                    {formatTime(countdown)}
                  </div>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '1rem' }}>
                  Use this number on <strong style={{ color: 'var(--text)' }}>{purchased.service.name}</strong> to receive your verification code. This number expires in {formatTime(countdown)}.
                </div>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <button onClick={() => navigator.clipboard.writeText(purchased.phone)}
                    style={{ flex: 1, padding: '0.65rem', background: 'rgba(108,78,242,0.1)', border: '1px solid var(--purple)', borderRadius: '10px', color: 'var(--purple2)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                    📋 Copy Number
                  </button>
                  <button onClick={handleCancel}
                    style={{ flex: 1, padding: '0.65rem', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: '10px', color: '#f43f5e', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                    ✕ Cancel & Refund
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* STEP 1 — SELECT SERVICE */}
            <div style={{ marginBottom: '1.5rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.05s both' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>1</div>
                <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>Select Service</span>
                {selectedService && (
                  <span style={{ fontSize: '0.72rem', color: '#34d399', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                    <CheckIcon size={12} /> {selectedService.name}
                  </span>
                )}
              </div>
              <div className="service-grid">
                {services.map((s, i) => {
                  const isSelected = selectedService?.id === s.id
                  return (
                    <button key={s.id} className="service-chip"
                      onClick={() => handleServiceSelect(s)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.8rem 0.9rem', background: isSelected ? 'rgba(108,78,242,0.1)' : 'var(--card)', border: `1px solid ${isSelected ? 'var(--purple)' : 'var(--border)'}`, borderRadius: '12px', cursor: 'pointer', animation: mounted ? `fadeSlideIn 0.3s ease ${0.04 * i}s both` : 'none', width: '100%', boxShadow: isSelected ? `0 0 0 1px var(--purple)` : 'none' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0, boxShadow: isSelected ? `0 0 8px ${s.color}` : 'none', transition: 'box-shadow 0.2s' }} />
                      <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* STEP 2 — SELECT COUNTRY */}
            {selectedService && (
              <div style={{ marginBottom: '1.5rem', animation: 'fadeSlideIn 0.35s ease both' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>2</div>
                  <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>Select Country</span>
                  {selectedCountry && (
                    <span style={{ fontSize: '0.72rem', color: '#34d399', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                      <CheckIcon size={12} /> {selectedCountry.flag} {selectedCountry.name}
                    </span>
                  )}
                </div>

                {/* Search */}
                <div style={{ position: 'relative', marginBottom: '0.8rem' }}>
                  <div style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }}>
                    <SearchIcon size={15} />
                  </div>
                  <input placeholder="Search country..." value={search} onChange={e => setSearch(e.target.value)}
                    style={{ width: '100%', padding: '0.72rem 1rem 0.72rem 2.4rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)', fontSize: '0.86rem', outline: 'none', fontFamily: 'Inter, sans-serif', transition: 'border-color 0.2s' }} />
                </div>

                {loadingCountries ? (
                  <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                    Loading countries for {selectedService.name}...
                  </div>
                ) : (
                  <div className="country-grid">
                    {filtered.map((c, i) => {
                      const isSelected = selectedCountry?.code === c.code
                      return (
                        <button key={c.code} className="country-card"
                          onClick={() => setSelectedCountry(c)}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.75rem 0.8rem', background: isSelected ? 'rgba(108,78,242,0.1)' : 'var(--card)', border: `1px solid ${isSelected ? 'var(--purple)' : 'var(--border)'}`, borderRadius: '12px', cursor: 'pointer', textAlign: 'left', animation: mounted ? `fadeSlideIn 0.35s ease ${Math.min(i * 0.03, 0.3)}s both` : 'none', width: '100%' }}>
                          <span style={{ fontSize: '1.4rem', lineHeight: 1, flexShrink: 0 }}>{c.flag}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--gold)', fontWeight: 600, marginTop: '0.1rem' }}>₦{c.price_ngn?.toLocaleString()}</div>
                          </div>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: isSelected ? 'var(--purple)' : 'transparent', border: isSelected ? 'none' : '1.5px solid var(--border)', flexShrink: 0, transition: 'background 0.2s' }} />
                        </button>
                      )
                    })}
                    {filtered.length === 0 && !loadingCountries && (
                      <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
                        No countries found for "{search}"
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ORDER SUMMARY */}
            {selectedCountry && selectedService && (
              <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.1rem', marginBottom: '0.9rem', animation: 'scaleIn 0.3s ease both' }}>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)', marginBottom: '0.85rem' }}>Order Summary</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--muted)', flexShrink: 0 }}>Service</span>
                    <span style={{ color: 'var(--text)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: selectedService.color }} />
                      {selectedService.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--muted)', flexShrink: 0 }}>Country</span>
                    <span style={{ color: 'var(--text)', fontWeight: 500 }}>{selectedCountry.flag} {selectedCountry.name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--muted)', flexShrink: 0 }}>Wallet</span>
                    <span style={{ color: (profile?.wallet_balance || 0) >= selectedCountry.price_ngn ? '#10b981' : '#f43f5e', fontWeight: 600 }}>₦{(profile?.wallet_balance || 0).toLocaleString()}</span>
                  </div>
                  <div style={{ height: 1, background: 'var(--border)', margin: '0.15rem 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem' }}>
                    <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Total</span>
                    <span style={{ color: 'var(--gold)', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>₦{selectedCountry.price_ngn?.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* INSUFFICIENT BALANCE */}
            {selectedCountry && selectedService && (profile?.wallet_balance || 0) < selectedCountry.price_ngn && (
              <div style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: '12px', padding: '0.8rem 1rem', fontSize: '0.82rem', color: '#f43f5e', marginBottom: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Insufficient balance.</span>
                <Link href="/dashboard/wallet" style={{ color: '#f43f5e', fontWeight: 700, textDecoration: 'none', fontSize: '0.78rem' }}>Fund Wallet →</Link>
              </div>
            )}

            {/* BUY BUTTON */}
            {selectedCountry && selectedService && (
              <button onClick={handleOrder}
                disabled={ordering || (profile?.wallet_balance || 0) < selectedCountry.price_ngn}
                className="buy-btn"
                style={{ width: '100%', padding: '0.95rem', background: ordering ? 'var(--purple2)' : 'var(--purple)', color: '#fff', border: 'none', borderRadius: '12px', fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem', fontWeight: 700, cursor: ordering || (profile?.wallet_balance || 0) < selectedCountry.price_ngn ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', animation: 'scaleIn 0.3s ease both', opacity: (profile?.wallet_balance || 0) < selectedCountry.price_ngn ? 0.5 : 1 }}>
                {ordering ? (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                    Getting your number...
                  </>
                ) : `Buy Number — ₦${selectedCountry.price_ngn?.toLocaleString()}`}
              </button>
            )}
          </>
        )}
      </div>
    </main>
  )
}

function BackIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> }
function SearchIcon({ size = 18 }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> }
function CheckIcon({ size = 24, color = 'currentColor' }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> }