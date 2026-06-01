'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

const countries = [
  { code: 'US', name: 'United States', flag: '🇺🇸', price: 150 },
  { code: 'UK', name: 'United Kingdom', flag: '🇬🇧', price: 180 },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', price: 160 },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', price: 200 },
  { code: 'FR', name: 'France', flag: '🇫🇷', price: 190 },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', price: 210 },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', price: 195 },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪', price: 185 },
  { code: 'NO', name: 'Norway', flag: '🇳🇴', price: 200 },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰', price: 195 },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭', price: 220 },
  { code: 'IT', name: 'Italy', flag: '🇮🇹', price: 185 },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', price: 175 },
  { code: 'PL', name: 'Poland', flag: '🇵🇱', price: 155 },
  { code: 'RU', name: 'Russia', flag: '🇷🇺', price: 140 },
  { code: 'IN', name: 'India', flag: '🇮🇳', price: 120 },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', price: 145 },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽', price: 140 },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', price: 230 },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷', price: 220 },
]

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
  const [success, setSuccess] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [hoveredCountry, setHoveredCountry] = useState(null)
  const [hoveredService, setHoveredService] = useState(null)

  useEffect(() => { setMounted(true) }, [])

  const filtered = countries.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  )

  const handleOrder = async () => {
    if (!selectedCountry || !selectedService) return
    setOrdering(true)
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setOrdering(false); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('wallet_balance')
      .eq('id', user.id)
      .single()

    const balance = profile?.wallet_balance || 0
    const price = selectedCountry.price

    if (balance < price) {
      setOrdering(false)
      setError('Insufficient wallet balance. Please fund your wallet first.')
      return
    }

    await supabase.from('profiles').update({ wallet_balance: balance - price }).eq('id', user.id)

    await supabase.from('orders').insert({
      user_id: user.id,
      product_type: 'number',
      product_name: `${selectedCountry.flag} ${selectedCountry.name} Number (${selectedService.name})`,
      amount: price,
      status: 'completed',
      details: { country: selectedCountry.name, service: selectedService.name, code: selectedCountry.code }
    })

    await supabase.from('transactions').insert({
      user_id: user.id,
      type: 'debit',
      amount: price,
      description: `${selectedCountry.name} Number - ${selectedService.name}`,
      reference: `NUM-${Date.now()}`
    })

    setOrdering(false)
    setSuccess(true)
  }

  return (
    <main style={{ background: 'var(--navy)', minHeight: '100vh', paddingBottom: '2rem' }}>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes successPop {
          0% { transform: scale(0); opacity: 0; }
          70% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }

        .country-card {
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease;
        }
        .country-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(108,78,242,0.15);
        }
        .service-chip {
          transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
        }
        .service-chip:hover { transform: translateY(-2px); }
        .buy-btn {
          transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
        }
        .buy-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(108,78,242,0.35);
        }
        .buy-btn:active:not(:disabled) { transform: translateY(0); }
        .search-input:focus {
          border-color: var(--purple) !important;
          box-shadow: 0 0 0 3px rgba(108,78,242,0.12);
        }
        .back-btn { transition: background 0.18s, transform 0.18s; }
        .back-btn:hover { background: var(--card2) !important; transform: translateX(-2px); }

        /* COUNTRY GRID — 2 cols on mobile, 3+ on wider screens */
        .country-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.55rem;
        }
        /* SERVICE GRID — 2 cols always, wraps nicely */
        .service-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.55rem;
        }

        @media (min-width: 480px) {
          .country-grid { grid-template-columns: repeat(2, 1fr); gap: 0.65rem; }
          .service-grid { grid-template-columns: repeat(4, 1fr); }
        }
        @media (min-width: 640px) {
          .country-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (min-width: 900px) {
          .country-grid { grid-template-columns: repeat(4, 1fr); }
        }

        /* On very small screens tighten flag text */
        @media (max-width: 360px) {
          .country-name { font-size: 0.72rem !important; }
          .country-price { font-size: 0.65rem !important; }
          .country-card { padding: 0.65rem 0.6rem !important; }
          .country-flag { font-size: 1.25rem !important; }
        }
      `}</style>

      {/* HEADER */}
      <div style={{
        padding: '1rem 1.1rem',
        display: 'flex', alignItems: 'center', gap: '0.9rem',
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(11,14,26,0.95)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <Link href="/dashboard" className="back-btn" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: '10px',
          background: 'var(--card)', border: '1px solid var(--border)',
          color: 'var(--text)', textDecoration: 'none', flexShrink: 0,
        }}>
          <BackIcon />
        </Link>
        <div style={{ animation: mounted ? 'fadeSlideIn 0.4s ease' : 'none', minWidth: 0 }}>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>Foreign Numbers</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Buy virtual numbers from 40+ countries</div>
        </div>
      </div>

      {/* BODY */}
      <div style={{ padding: '1.1rem 1rem', maxWidth: '680px', margin: '0 auto' }}>

        {success ? (
          /* SUCCESS STATE */
          <div style={{ textAlign: 'center', padding: '3rem 1rem', animation: 'fadeIn 0.4s ease' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(29,158,117,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.2rem', color: '#34d399', animation: 'successPop 0.5s cubic-bezier(0.175,0.885,0.32,1.275)' }}>
              <CheckIcon size={36} />
            </div>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.3rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.4rem' }}>Order Placed!</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Your number will be delivered to your dashboard shortly.</div>
            <div style={{ display: 'inline-block', background: 'rgba(108,78,242,0.1)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.6rem 1.2rem', margin: '0.5rem 0 1.5rem', fontSize: '0.82rem', color: 'var(--purple2)' }}>
              {selectedCountry?.flag} {selectedCountry?.name} · {selectedService?.name}
            </div>
            <br />
            <button
              onClick={() => { setSuccess(false); setSelectedCountry(null); setSelectedService(null) }}
              className="buy-btn"
              style={{ padding: '0.75rem 1.8rem', background: 'var(--purple)', color: '#fff', border: 'none', borderRadius: '12px', fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' }}>
              Buy Another
            </button>
          </div>
        ) : (
          <>
            {/* ERROR BANNER */}
            {error && (
              <div style={{ background: 'rgba(220,50,50,0.1)', border: '1px solid rgba(220,50,50,0.3)', color: '#ff6b6b', borderRadius: '12px', padding: '0.8rem 1rem', fontSize: '0.84rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <span>{error}</span>
                <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: '1.1rem', flexShrink: 0 }}>×</button>
              </div>
            )}

            {/* SEARCH */}
            <div style={{ position: 'relative', marginBottom: '1.2rem', animation: mounted ? 'fadeSlideIn 0.35s ease 0.05s both' : 'none' }}>
              <div style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }}>
                <SearchIcon size={16} />
              </div>
              <input
                className="search-input"
                placeholder="Search country..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '0.78rem 1rem 0.78rem 2.5rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)', fontSize: '0.88rem', outline: 'none', fontFamily: 'Inter, sans-serif', transition: 'border-color 0.2s, box-shadow 0.2s' }}
              />
            </div>

            {/* STEP 1 — SELECT COUNTRY */}
            <div style={{ marginBottom: '1.5rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.1s both' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>1</div>
                <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>Select Country</span>
                {selectedCountry && (
                  <span style={{ fontSize: '0.72rem', color: '#34d399', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                    <CheckIcon size={12} /> {selectedCountry.flag} {selectedCountry.name}
                  </span>
                )}
              </div>

              <div className="country-grid">
                {filtered.map((c, i) => {
                  const isSelected = selectedCountry?.code === c.code
                  return (
                    <button
                      key={c.code}
                      className="country-card"
                      onClick={() => setSelectedCountry(c)}
                      onMouseEnter={() => setHoveredCountry(c.code)}
                      onMouseLeave={() => setHoveredCountry(null)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.55rem',
                        padding: '0.75rem 0.8rem',
                        background: isSelected ? 'rgba(108,78,242,0.1)' : hoveredCountry === c.code ? 'var(--card2)' : 'var(--card)',
                        border: `1px solid ${isSelected ? 'var(--purple)' : 'var(--border)'}`,
                        borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
                        animation: mounted ? `fadeSlideIn 0.35s ease ${Math.min(i * 0.03, 0.3)}s both` : 'none',
                        width: '100%',
                      }}
                    >
                      <span className="country-flag" style={{ fontSize: '1.4rem', lineHeight: 1, flexShrink: 0 }}>{c.flag}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="country-name" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                        <div className="country-price" style={{ fontSize: '0.68rem', color: 'var(--gold)', fontWeight: 600, marginTop: '0.1rem' }}>₦{c.price}</div>
                      </div>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: isSelected ? 'var(--purple)' : 'transparent', border: isSelected ? 'none' : '1.5px solid var(--border)', flexShrink: 0, transition: 'background 0.2s' }} />
                    </button>
                  )
                })}
              </div>

              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
                  No countries found for "{search}"
                </div>
              )}
            </div>

            {/* STEP 2 — SELECT SERVICE */}
            {selectedCountry && (
              <div style={{ marginBottom: '1.5rem', animation: 'fadeSlideIn 0.35s ease both' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>2</div>
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
                      <button
                        key={s.id}
                        className="service-chip"
                        onClick={() => setSelectedService(s)}
                        onMouseEnter={() => setHoveredService(s.id)}
                        onMouseLeave={() => setHoveredService(null)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.55rem',
                          padding: '0.72rem 0.85rem',
                          background: isSelected ? 'rgba(108,78,242,0.1)' : hoveredService === s.id ? 'var(--card2)' : 'var(--card)',
                          border: `1px solid ${isSelected ? 'var(--purple)' : 'var(--border)'}`,
                          borderRadius: '12px', cursor: 'pointer',
                          animation: `fadeSlideIn 0.3s ease ${0.04 * i}s both`,
                          width: '100%',
                        }}
                      >
                        <div style={{ width: 9, height: 9, borderRadius: '50%', background: s.color, flexShrink: 0, boxShadow: isSelected ? `0 0 8px ${s.color}88` : 'none', transition: 'box-shadow 0.2s' }} />
                        <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ORDER SUMMARY */}
            {selectedCountry && selectedService && (
              <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.1rem', marginBottom: '0.9rem', animation: 'scaleIn 0.3s ease both' }}>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)', marginBottom: '0.85rem' }}>Order Summary</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--muted)', flexShrink: 0 }}>Country</span>
                    <span style={{ color: 'var(--text)', fontWeight: 500, textAlign: 'right' }}>{selectedCountry.flag} {selectedCountry.name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--muted)', flexShrink: 0 }}>Service</span>
                    <span style={{ color: 'var(--text)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: selectedService.color, flexShrink: 0 }} />
                      {selectedService.name}
                    </span>
                  </div>
                  <div style={{ height: 1, background: 'var(--border)', margin: '0.15rem 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem' }}>
                    <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Total</span>
                    <span style={{ color: 'var(--gold)', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>₦{selectedCountry.price}</span>
                  </div>
                </div>
              </div>
            )}

            {/* BUY BUTTON */}
            {selectedCountry && selectedService && (
              <button
                onClick={handleOrder}
                disabled={ordering}
                className="buy-btn"
                style={{ width: '100%', padding: '0.95rem', background: ordering ? 'var(--purple2)' : 'var(--purple)', color: '#fff', border: 'none', borderRadius: '12px', fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem', fontWeight: 700, cursor: ordering ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', animation: 'scaleIn 0.3s ease both' }}
              >
                {ordering ? (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                    Processing...
                  </>
                ) : `Buy Number — ₦${selectedCountry.price}`}
              </button>
            )}
          </>
        )}
      </div>
    </main>
  )
}

function BackIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
}
function SearchIcon({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
}
function CheckIcon({ size = 24 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
}