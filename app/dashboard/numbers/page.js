'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import LoadingScreen from '@/components/LoadingScreen'

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
  const [hoveredCountry, setHoveredCountry] = useState(null)
  const [hoveredService, setHoveredService] = useState(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)

  // 5SIM live data
  const [countries, setCountries] = useState([])
  const [loadingCountries, setLoadingCountries] = useState(false)

  // After purchase
  const [purchased, setPurchased] = useState(null)
  const [sms, setSms] = useState([])
  const [countdown, setCountdown] = useState(0)
  const [cancelled, setCancelled] = useState(false)
  const pollRef = { current: null }
  const countdownRef = { current: null }

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
      // Load default countries (whatsapp)
      fetchCountries('whatsapp')
    }
    load()
  }, [])

  const fetchCountries = async (service = 'whatsapp') => {
    setLoadingCountries(true)
    try {
      const res = await fetch(`/api/5sim/countries?service=${service}`)
      const data = await res.json()
      setCountries(data.countries || [])
    } catch {
      setError('Failed to load countries. Please refresh.')
    }
    setLoadingCountries(false)
  }

  // When service changes, reload countries with new prices
  useEffect(() => {
    if (!selectedService) return
    setSelectedCountry(null)
    fetchCountries(selectedService.id)
  }, [selectedService])

  // Poll for OTP after purchase
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
      amount: selectedCountry.price_ngn,
    })
    setOrdering(false)
  }

  const handleCancel = async () => {
    if (!purchased) return
    await fetch(`/api/5sim/sms?id=${purchased.fivesim_id}&order_id=${purchased.order_id}&user_id=${user.id}&amount=${purchased.amount}`, { method: 'DELETE' })
    setCancelled(true)
    setProfile(p => ({ ...p, wallet_balance: (p.wallet_balance || 0) + purchased.amount }))
  }

  const resetAll = () => {
    setPurchased(null); setSms([]); setCancelled(false)
    setCountdown(0); setSelectedCountry(null); setSelectedService(null)
  }

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  if (pageLoading) return <LoadingScreen />

  return (
    <main style={{ background: 'var(--navy)', minHeight: '100vh', paddingBottom: '2rem' }}>
      <style>{`
        @keyframes fadeSlideIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes scaleIn { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes successPop { 0%{transform:scale(0);opacity:0} 70%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
        .country-card { transition:transform 0.18s ease,box-shadow 0.18s ease,border-color 0.18s ease,background 0.18s ease; }
        .country-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(108,78,242,0.15); }
        .service-chip { transition:transform 0.18s ease,border-color 0.18s ease,background 0.18s ease; }
        .service-chip:hover { transform:translateY(-2px); }
        .buy-btn { transition:transform 0.18s ease,box-shadow 0.18s ease,background 0.18s ease; }
        .buy-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 24px rgba(108,78,242,0.35); }
        .buy-btn:active:not(:disabled) { transform:translateY(0); }
        .search-input:focus { border-color:var(--purple) !important; box-shadow:0 0 0 3px rgba(108,78,242,0.12); }
        .back-btn { transition:background 0.18s,transform 0.18s; }
        .back-btn:hover { background:var(--card2) !important; transform:translateX(-2px); }
        .country-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:0.55rem; }
        .service-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:0.55rem; }
        @media(min-width:480px) { .country-grid{grid-template-columns:repeat(2,1fr);gap:0.65rem} .service-grid{grid-template-columns:repeat(4,1fr)} }
        @media(min-width:640px) { .country-grid{grid-template-columns:repeat(3,1fr)} }
        @media(min-width:900px) { .country-grid{grid-template-columns:repeat(4,1fr)} }
        @media(max-width:360px) { .country-name{font-size:0.72rem!important} .country-price{font-size:0.65rem!important} .country-card{padding:0.65rem 0.6rem!important} .country-flag{font-size:1.25rem!important} }
      `}</style>

      {/* HEADER */}
      <div style={{ padding:'1rem 1.1rem', display:'flex', alignItems:'center', gap:'0.9rem', position:'sticky', top:0, zIndex:100, background:'rgba(11,14,26,0.95)', backdropFilter:'blur(16px)', borderBottom:'1px solid var(--border)' }}>
        <Link href="/dashboard" className="back-btn" style={{ display:'flex', alignItems:'center', justifyContent:'center', width:36, height:36, borderRadius:'10px', background:'var(--card)', border:'1px solid var(--border)', color:'var(--text)', textDecoration:'none', flexShrink:0 }}>
          <BackIcon />
        </Link>
        <div style={{ animation: mounted ? 'fadeSlideIn 0.4s ease' : 'none', minWidth:0, flex:1 }}>
          <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:800, fontSize:'1rem', color:'var(--text)' }}>Foreign Numbers</div>
          <div style={{ fontSize:'0.7rem', color:'var(--muted)' }}>
            Wallet: <span style={{ color:'var(--gold)', fontWeight:700 }}>₦{(profile?.wallet_balance || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div style={{ padding:'1.1rem 1rem', maxWidth:'680px', margin:'0 auto' }}>

        {/* PURCHASED STATE */}
        {purchased && (
          <div style={{ animation:'fadeIn 0.4s ease' }}>
            {cancelled ? (
              <div style={{ textAlign:'center', padding:'3rem 1rem' }}>
                <div style={{ fontSize:'2.5rem', marginBottom:'0.8rem' }}>↩️</div>
                <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:800, fontSize:'1.2rem', color:'var(--text)', marginBottom:'0.4rem' }}>Number Cancelled</div>
                <div style={{ color:'var(--muted)', fontSize:'0.85rem', marginBottom:'1.5rem' }}>₦{purchased.amount.toLocaleString()} refunded to your wallet.</div>
                <button onClick={resetAll} className="buy-btn" style={{ padding:'0.75rem 1.8rem', background:'var(--purple)', color:'#fff', border:'none', borderRadius:'12px', fontFamily:'Outfit, sans-serif', fontSize:'0.9rem', fontWeight:700, cursor:'pointer' }}>Buy Another</button>
              </div>
            ) : sms.length > 0 ? (
              <div style={{ textAlign:'center', padding:'2rem 1rem', animation:'fadeIn 0.4s ease' }}>
                <div style={{ width:80, height:80, borderRadius:'50%', background:'rgba(16,185,129,0.12)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1.2rem', color:'#10b981', animation:'successPop 0.5s cubic-bezier(0.175,0.885,0.32,1.275)' }}>
                  <CheckIcon size={36} />
                </div>
                <div style={{ fontFamily:'Outfit, sans-serif', fontSize:'1.1rem', fontWeight:800, color:'var(--text)', marginBottom:'0.4rem' }}>OTP Received!</div>
                <div style={{ color:'var(--muted)', fontSize:'0.82rem', marginBottom:'1rem' }}>{purchased.phone}</div>
                {sms.map((msg, i) => (
                  <div key={i} style={{ background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:'16px', padding:'1rem', marginBottom:'0.6rem' }}>
                    <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:900, fontSize:'1.8rem', color:'#10b981', letterSpacing:'3px' }}>{msg.code}</div>
                    <div style={{ fontSize:'0.72rem', color:'var(--muted)', marginTop:'0.3rem', lineHeight:1.5 }}>{msg.text}</div>
                  </div>
                ))}
                <button onClick={resetAll} className="buy-btn" style={{ marginTop:'0.8rem', padding:'0.75rem 1.8rem', background:'var(--purple)', color:'#fff', border:'none', borderRadius:'12px', fontFamily:'Outfit, sans-serif', fontSize:'0.9rem', fontWeight:700, cursor:'pointer' }}>Buy Another</button>
              </div>
            ) : (
              <div>
                {/* Phone number */}
                <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'20px', padding:'1.5rem', marginBottom:'1rem', textAlign:'center', animation:'scaleIn 0.3s ease' }}>
                  <div style={{ fontSize:'0.72rem', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'0.5rem', fontWeight:600 }}>Your Number</div>
                  <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:900, fontSize:'1.8rem', color:'var(--text)', letterSpacing:'-0.5px', marginBottom:'0.7rem' }}>{purchased.phone}</div>
                  <button onClick={() => navigator.clipboard.writeText(purchased.phone)} style={{ padding:'0.4rem 1rem', background:'rgba(108,78,242,0.1)', border:'1px solid var(--border)', borderRadius:'8px', color:'var(--purple2)', fontSize:'0.78rem', fontWeight:600, cursor:'pointer' }}>
                    📋 Copy Number
                  </button>
                </div>
                {/* Waiting for OTP */}
                <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'20px', padding:'1.5rem', marginBottom:'1rem', textAlign:'center' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem', marginBottom:'0.8rem' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--purple2)" strokeWidth="2.5" strokeLinecap="round" style={{ animation:'spin 1s linear infinite' }}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                    <span style={{ fontSize:'0.85rem', color:'var(--muted)', animation:'pulse 2s infinite' }}>Waiting for OTP...</span>
                  </div>
                  <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:800, fontSize:'1.6rem', color: countdown < 60 ? '#f43f5e' : 'var(--text)' }}>{formatTime(countdown)}</div>
                  <div style={{ fontSize:'0.72rem', color:'var(--muted)', marginTop:'0.3rem', marginBottom:'1rem' }}>Time remaining</div>
                  {countdown === 0 && <div style={{ fontSize:'0.8rem', color:'#f43f5e', marginBottom:'0.8rem' }}>Time expired. No OTP received.</div>}
                  <button onClick={handleCancel} style={{ padding:'0.55rem 1.2rem', background:'rgba(244,63,94,0.1)', border:'1px solid rgba(244,63,94,0.3)', borderRadius:'10px', color:'#f43f5e', fontSize:'0.78rem', fontWeight:600, cursor:'pointer' }}>
                    Cancel & Refund
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PURCHASE FLOW */}
        {!purchased && (
          <>
            {error && (
              <div style={{ background:'rgba(220,50,50,0.1)', border:'1px solid rgba(220,50,50,0.3)', color:'#ff6b6b', borderRadius:'12px', padding:'0.8rem 1rem', fontSize:'0.84rem', marginBottom:'1rem', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'0.5rem' }}>
                <span>{error}</span>
                <button onClick={() => setError('')} style={{ background:'none', border:'none', color:'#ff6b6b', cursor:'pointer', fontSize:'1.1rem', flexShrink:0 }}>×</button>
              </div>
            )}

            {/* SEARCH */}
            <div style={{ position:'relative', marginBottom:'1.2rem', animation: mounted ? 'fadeSlideIn 0.35s ease 0.05s both' : 'none' }}>
              <div style={{ position:'absolute', left:'0.9rem', top:'50%', transform:'translateY(-50%)', color:'var(--muted)', pointerEvents:'none' }}>
                <SearchIcon size={16} />
              </div>
              <input className="search-input" placeholder="Search country..." value={search} onChange={e => setSearch(e.target.value)}
                style={{ width:'100%', padding:'0.78rem 1rem 0.78rem 2.5rem', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', color:'var(--text)', fontSize:'0.88rem', outline:'none', fontFamily:'Inter, sans-serif', transition:'border-color 0.2s, box-shadow 0.2s' }} />
            </div>

            {/* STEP 1 — SELECT COUNTRY */}
            <div style={{ marginBottom:'1.5rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.1s both' : 'none' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.85rem', flexWrap:'wrap' }}>
                <div style={{ width:22, height:22, borderRadius:'50%', background:'var(--purple)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem', fontWeight:700, color:'#fff', flexShrink:0 }}>1</div>
                <span style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.9rem', color:'var(--text)' }}>Select Country</span>
                {selectedCountry && (
                  <span style={{ fontSize:'0.72rem', color:'#34d399', marginLeft:'auto', display:'flex', alignItems:'center', gap:'0.3rem', flexShrink:0 }}>
                    <CheckIcon size={12} /> {selectedCountry.flag} {selectedCountry.name}
                  </span>
                )}
              </div>

              {loadingCountries ? (
                <div style={{ textAlign:'center', padding:'2rem', color:'var(--muted)', fontSize:'0.85rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation:'spin 0.8s linear infinite' }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                  Loading countries...
                </div>
              ) : (
                <div className="country-grid">
                  {filtered.map((c, i) => {
                    const isSelected = selectedCountry?.code === c.code
                    return (
                      <button key={c.code} className="country-card" onClick={() => setSelectedCountry(c)}
                        onMouseEnter={() => setHoveredCountry(c.code)} onMouseLeave={() => setHoveredCountry(null)}
                        style={{ display:'flex', alignItems:'center', gap:'0.55rem', padding:'0.75rem 0.8rem', background: isSelected ? 'rgba(108,78,242,0.1)' : hoveredCountry === c.code ? 'var(--card2)' : 'var(--card)', border:`1px solid ${isSelected ? 'var(--purple)' : 'var(--border)'}`, borderRadius:'12px', cursor:'pointer', textAlign:'left', animation: mounted ? `fadeSlideIn 0.35s ease ${Math.min(i * 0.03, 0.3)}s both` : 'none', width:'100%' }}>
                        <span className="country-flag" style={{ fontSize:'1.4rem', lineHeight:1, flexShrink:0 }}>{c.flag}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div className="country-name" style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.name}</div>
                          <div className="country-price" style={{ fontSize:'0.68rem', color:'var(--gold)', fontWeight:600, marginTop:'0.1rem' }}>₦{c.price_ngn?.toLocaleString()}</div>
                        </div>
                        <div style={{ width:7, height:7, borderRadius:'50%', background: isSelected ? 'var(--purple)' : 'transparent', border: isSelected ? 'none' : '1.5px solid var(--border)', flexShrink:0, transition:'background 0.2s' }} />
                      </button>
                    )
                  })}
                  {filtered.length === 0 && !loadingCountries && (
                    <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'2rem', color:'var(--muted)', fontSize:'0.85rem' }}>
                      No countries found for "{search}"
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* STEP 2 — SELECT SERVICE */}
            {selectedCountry && (
              <div style={{ marginBottom:'1.5rem', animation:'fadeSlideIn 0.35s ease both' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.85rem', flexWrap:'wrap' }}>
                  <div style={{ width:22, height:22, borderRadius:'50%', background:'var(--purple)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem', fontWeight:700, color:'#fff', flexShrink:0 }}>2</div>
                  <span style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.9rem', color:'var(--text)' }}>Select Service</span>
                  {selectedService && (
                    <span style={{ fontSize:'0.72rem', color:'#34d399', marginLeft:'auto', display:'flex', alignItems:'center', gap:'0.3rem', flexShrink:0 }}>
                      <CheckIcon size={12} /> {selectedService.name}
                    </span>
                  )}
                </div>
                <div className="service-grid">
                  {services.map((s, i) => {
                    const isSelected = selectedService?.id === s.id
                    return (
                      <button key={s.id} className="service-chip" onClick={() => setSelectedService(s)}
                        onMouseEnter={() => setHoveredService(s.id)} onMouseLeave={() => setHoveredService(null)}
                        style={{ display:'flex', alignItems:'center', gap:'0.55rem', padding:'0.72rem 0.85rem', background: isSelected ? 'rgba(108,78,242,0.1)' : hoveredService === s.id ? 'var(--card2)' : 'var(--card)', border:`1px solid ${isSelected ? 'var(--purple)' : 'var(--border)'}`, borderRadius:'12px', cursor:'pointer', animation:`fadeSlideIn 0.3s ease ${0.04 * i}s both`, width:'100%' }}>
                        <div style={{ width:9, height:9, borderRadius:'50%', background:s.color, flexShrink:0, boxShadow: isSelected ? `0 0 8px ${s.color}88` : 'none', transition:'box-shadow 0.2s' }} />
                        <span style={{ fontSize:'0.8rem', fontWeight:500, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ORDER SUMMARY */}
            {selectedCountry && selectedService && (
              <div style={{ background:'var(--card2)', border:'1px solid var(--border)', borderRadius:'16px', padding:'1.1rem', marginBottom:'0.9rem', animation:'scaleIn 0.3s ease both' }}>
                <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.85rem', color:'var(--text)', marginBottom:'0.85rem' }}>Order Summary</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.82rem', gap:'0.5rem' }}>
                    <span style={{ color:'var(--muted)', flexShrink:0 }}>Country</span>
                    <span style={{ color:'var(--text)', fontWeight:500, textAlign:'right' }}>{selectedCountry.flag} {selectedCountry.name}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.82rem', gap:'0.5rem' }}>
                    <span style={{ color:'var(--muted)', flexShrink:0 }}>Service</span>
                    <span style={{ color:'var(--text)', fontWeight:500, display:'flex', alignItems:'center', gap:'0.4rem' }}>
                      <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:selectedService.color, flexShrink:0 }} />
                      {selectedService.name}
                    </span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.82rem', gap:'0.5rem' }}>
                    <span style={{ color:'var(--muted)', flexShrink:0 }}>Wallet</span>
                    <span style={{ color: (profile?.wallet_balance || 0) >= selectedCountry.price_ngn ? '#10b981' : '#f43f5e', fontWeight:600 }}>₦{(profile?.wallet_balance || 0).toLocaleString()}</span>
                  </div>
                  <div style={{ height:1, background:'var(--border)', margin:'0.15rem 0' }} />
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.92rem' }}>
                    <span style={{ color:'var(--muted)', fontWeight:600 }}>Total</span>
                    <span style={{ color:'var(--gold)', fontWeight:800, fontFamily:'Outfit, sans-serif' }}>₦{selectedCountry.price_ngn?.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* INSUFFICIENT BALANCE WARNING */}
            {selectedCountry && selectedService && (profile?.wallet_balance || 0) < selectedCountry.price_ngn && (
              <div style={{ background:'rgba(244,63,94,0.08)', border:'1px solid rgba(244,63,94,0.25)', borderRadius:'12px', padding:'0.8rem 1rem', fontSize:'0.82rem', color:'#f43f5e', marginBottom:'0.9rem', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span>Insufficient balance.</span>
                <Link href="/dashboard/wallet" style={{ color:'#f43f5e', fontWeight:700, textDecoration:'none', fontSize:'0.78rem' }}>Fund Wallet →</Link>
              </div>
            )}

            {/* BUY BUTTON */}
            {selectedCountry && selectedService && (
              <button onClick={handleOrder} disabled={ordering || (profile?.wallet_balance || 0) < selectedCountry.price_ngn}
                className="buy-btn"
                style={{ width:'100%', padding:'0.95rem', background: ordering ? 'var(--purple2)' : 'var(--purple)', color:'#fff', border:'none', borderRadius:'12px', fontFamily:'Outfit, sans-serif', fontSize:'0.95rem', fontWeight:700, cursor: ordering || (profile?.wallet_balance || 0) < selectedCountry.price_ngn ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.6rem', animation:'scaleIn 0.3s ease both', opacity: (profile?.wallet_balance || 0) < selectedCountry.price_ngn ? 0.5 : 1 }}>
                {ordering ? (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation:'spin 0.8s linear infinite' }}>
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
function CheckIcon({ size = 24 }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> }