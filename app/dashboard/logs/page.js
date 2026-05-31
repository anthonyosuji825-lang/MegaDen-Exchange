'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

const platforms = [
  {
    id: 'facebook', name: 'Facebook', color: '#1877f2', bg: '#1877f215',
    types: [
      { id: 'aged', name: 'Aged Account (1yr+)', price: 2500 },
      { id: 'fresh', name: 'Fresh Account', price: 800 },
      { id: 'verified', name: 'Verified Account', price: 4500 },
      { id: 'marketplace', name: 'Marketplace Account', price: 3500 },
    ]
  },
  {
    id: 'instagram', name: 'Instagram', color: '#e1306c', bg: '#e1306c15',
    types: [
      { id: 'aged', name: 'Aged Account (1yr+)', price: 2000 },
      { id: 'fresh', name: 'Fresh Account', price: 700 },
      { id: 'followers', name: 'With Followers (1k+)', price: 5000 },
      { id: 'verified', name: 'Verified Account', price: 8000 },
    ]
  },
  {
    id: 'tiktok', name: 'TikTok', color: '#ff0050', bg: '#ff005015',
    types: [
      { id: 'fresh', name: 'Fresh Account', price: 600 },
      { id: 'aged', name: 'Aged Account', price: 1800 },
      { id: 'followers', name: 'With Followers (5k+)', price: 6000 },
    ]
  },
  {
    id: 'twitter', name: 'Twitter / X', color: '#e7e7e7', bg: '#e7e7e715',
    types: [
      { id: 'fresh', name: 'Fresh Account', price: 700 },
      { id: 'aged', name: 'Aged Account (2yr+)', price: 2500 },
      { id: 'verified', name: 'Blue Tick Account', price: 9000 },
    ]
  },
  {
    id: 'snapchat', name: 'Snapchat', color: '#fffc00', bg: '#fffc0015',
    types: [
      { id: 'fresh', name: 'Fresh Account', price: 500 },
      { id: 'aged', name: 'Aged Account', price: 1500 },
    ]
  },
  {
    id: 'gmail', name: 'Gmail', color: '#ea4335', bg: '#ea433515',
    types: [
      { id: 'fresh', name: 'Fresh Account', price: 400 },
      { id: 'aged', name: 'Aged Account (2yr+)', price: 1200 },
      { id: 'pva', name: 'Phone Verified (PVA)', price: 900 },
    ]
  },
  {
    id: 'telegram', name: 'Telegram', color: '#0088cc', bg: '#0088cc15',
    types: [
      { id: 'fresh', name: 'Fresh Account', price: 500 },
      { id: 'aged', name: 'Aged Account', price: 1500 },
      { id: 'members', name: 'Channel with Members', price: 7000 },
    ]
  },
  {
    id: 'linkedin', name: 'LinkedIn', color: '#0a66c2', bg: '#0a66c215',
    types: [
      { id: 'fresh', name: 'Fresh Account', price: 800 },
      { id: 'aged', name: 'Aged Account (2yr+)', price: 3000 },
      { id: 'connections', name: 'With 500+ Connections', price: 6500 },
    ]
  },
]

const PlatformIcon = ({ id, size = 28 }) => {
  const icons = {
    facebook: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#1877f2">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    instagram: (
      <svg width={size} height={size} viewBox="0 0 24 24">
        <defs>
          <linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f09433"/>
            <stop offset="25%" stopColor="#e6683c"/>
            <stop offset="50%" stopColor="#dc2743"/>
            <stop offset="75%" stopColor="#cc2366"/>
            <stop offset="100%" stopColor="#bc1888"/>
          </linearGradient>
        </defs>
        <path fill="url(#ig)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
    tiktok: (
      <svg width={size} height={size} viewBox="0 0 24 24">
        <path fill="#ff0050" d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.52V6.75a4.85 4.85 0 01-1.02-.06z"/>
      </svg>
    ),
    twitter: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#e7e7e7">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    snapchat: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#fffc00">
        <path d="M12.166.006C9.834-.072 7.2.637 5.51 2.341 4.073 3.786 3.42 5.836 3.34 7.835c-.05 1.215-.01 2.43-.01 3.644-.31.156-.636.23-.968.252-.347.024-.706-.027-1.02-.177-.186-.09-.4-.232-.604-.166-.21.068-.332.292-.334.506-.003.29.212.527.46.645.82.387 1.693.4 2.566.553.1.463.275.902.572 1.28.07.09.004.226-.073.295-.28.247-.595.44-.904.637-.424.269-.87.568-1.117 1.017-.145.264-.146.6.044.843.208.266.553.326.863.3.468-.04.91-.225 1.355-.375.333-.113.688-.228 1.04-.188.32.036.598.205.856.39.567.406 1.103.876 1.793 1.117.747.26 1.54.295 2.326.3h.194c.786-.005 1.58-.04 2.327-.3.69-.241 1.226-.711 1.793-1.117.258-.185.535-.354.855-.39.353-.04.708.075 1.041.188.445.15.887.334 1.355.375.31.026.655-.034.863-.3.19-.243.189-.579.044-.843-.247-.449-.693-.748-1.117-1.017-.31-.197-.624-.39-.904-.637-.077-.069-.144-.206-.073-.295.297-.378.471-.817.572-1.28.873-.153 1.746-.166 2.566-.553.248-.118.463-.355.46-.645-.002-.214-.123-.438-.334-.506-.204-.066-.418.076-.604.166-.314.15-.673.2-1.02.177-.332-.022-.658-.096-.968-.252 0-1.215.04-2.43-.01-3.644-.08-1.999-.733-4.05-2.17-5.494C16.8.637 14.165-.072 12.166.006"/>
      </svg>
    ),
    gmail: (
      <svg width={size} height={size} viewBox="0 0 24 24">
        <path fill="#ea4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.907 1.528-1.148C21.69 2.28 24 3.434 24 5.457z"/>
      </svg>
    ),
    telegram: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#0088cc">
        <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    ),
    linkedin: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#0a66c2">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
  }
  return icons[id] || null
}

export default function BuyLogs() {
  const [selectedPlatform, setSelectedPlatform] = useState(null)
  const [selectedType, setSelectedType] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [ordering, setOrdering] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const handleOrder = async () => {
    if (!selectedPlatform || !selectedType) return
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
    const price = selectedType.price * quantity

    if (balance < price) {
      setOrdering(false)
      setError('Insufficient wallet balance. Please fund your wallet first.')
      return
    }

    await supabase
      .from('profiles')
      .update({ wallet_balance: balance - price })
      .eq('id', user.id)

    await supabase.from('orders').insert({
      user_id: user.id,
      product_type: 'log',
      product_name: `${selectedPlatform.name} - ${selectedType.name} ×${quantity}`,
      amount: price,
      status: 'completed',
      details: { platform: selectedPlatform.name, type: selectedType.name, quantity }
    })

    await supabase.from('transactions').insert({
      user_id: user.id,
      type: 'debit',
      amount: price,
      description: `${selectedPlatform.name} Log - ${selectedType.name} ×${quantity}`,
      reference: `LOG-${Date.now()}`
    })

    setOrdering(false)
    setSuccess(true)
  }

  const total = selectedType ? selectedType.price * quantity : 0

  return (
    <main style={{ background: 'var(--navy)', minHeight: '100vh', paddingBottom: '2rem' }}>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes successPop {
          0% { transform: scale(0); opacity: 0; }
          70% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .platform-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease;
          cursor: pointer;
        }
        .platform-card:hover {
          transform: translateY(-4px) scale(1.03);
          box-shadow: 0 10px 28px rgba(0,0,0,0.2);
        }
        .platform-card:active {
          transform: scale(0.97);
        }
        .type-card {
          transition: transform 0.15s ease, border-color 0.18s ease, background 0.18s ease;
          cursor: pointer;
        }
        .type-card:hover { transform: translateY(-2px); }
        .qty-btn {
          transition: background 0.15s, transform 0.15s, color 0.15s;
          cursor: pointer;
        }
        .qty-btn:hover {
          background: var(--purple) !important;
          color: #fff !important;
          transform: scale(1.1);
        }
        .buy-btn {
          transition: transform 0.18s ease, box-shadow 0.18s ease;
          cursor: pointer;
        }
        .buy-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(108,78,242,0.4);
        }
        .buy-btn:active:not(:disabled) { transform: translateY(0); }
        .back-btn { transition: background 0.18s, transform 0.18s; }
        .back-btn:hover { background: var(--card2) !important; transform: translateX(-2px); }
      `}</style>

      {/* HEADER */}
      <div style={{ padding: '1.1rem 1.4rem', display: 'flex', alignItems: 'center', gap: '0.9rem', position: 'sticky', top: 0, zIndex: 100, background: 'var(--navy)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/dashboard" className="back-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '10px', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', textDecoration: 'none' }}>
          <BackIcon />
        </Link>
        <div style={{ animation: mounted ? 'fadeSlideIn 0.4s ease' : 'none' }}>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>Social Media Logs</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Buy verified accounts across all platforms</div>
        </div>
      </div>

      <div style={{ padding: '1.2rem 1.4rem' }}>
        {success ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', animation: 'fadeSlideIn 0.4s ease' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(29,158,117,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.2rem', color: '#34d399', animation: 'successPop 0.5s cubic-bezier(0.175,0.885,0.32,1.275)' }}>
              <CheckIcon size={36} />
            </div>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.3rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.4rem' }}>Order Placed!</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>Your logs will be delivered to your dashboard shortly.</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.8rem 1.4rem', margin: '0 0 1.5rem' }}>
              <PlatformIcon id={selectedPlatform?.id} size={20} />
              <span style={{ fontSize: '0.82rem', color: 'var(--text)' }}>{selectedPlatform?.name} · {selectedType?.name} × {quantity}</span>
              <span style={{ color: 'var(--gold)', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>₦{total.toLocaleString()}</span>
            </div>
            <br />
            <button onClick={() => { setSuccess(false); setSelectedPlatform(null); setSelectedType(null); setQuantity(1) }} className="buy-btn" style={{ padding: '0.75rem 1.8rem', background: 'var(--purple)', color: '#fff', border: 'none', borderRadius: '12px', fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', fontWeight: 700 }}>
              Buy More
            </button>
          </div>
        ) : (
          <>
          {error && (
  <div style={{ background: 'rgba(220,50,50,0.1)', border: '1px solid rgba(220,50,50,0.3)', color: '#ff6b6b', borderRadius: '12px', padding: '0.8rem 1rem', fontSize: '0.84rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <span>{error}</span>
    <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: '1rem' }}>×</button>
  </div>
)}
            {/* STEP 1 — PLATFORM */}
            <div style={{ marginBottom: '1.6rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.05s both' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#fff' }}>1</div>
                <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>Select Platform</span>
                {selectedPlatform && <span style={{ fontSize: '0.75rem', color: '#34d399', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><CheckIcon size={12} /> {selectedPlatform.name}</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.7rem' }}>
                {platforms.map((p, i) => {
                  const isSelected = selectedPlatform?.id === p.id
                  return (
                    <button key={p.id} className="platform-card"
                      onClick={() => { setSelectedPlatform(p); setSelectedType(null) }}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
                        padding: '1rem 0.4rem',
                        background: isSelected ? p.bg : 'var(--card)',
                        border: `1.5px solid ${isSelected ? p.color : 'var(--border)'}`,
                        borderRadius: '16px',
                        animation: mounted ? `fadeSlideIn 0.3s ease ${0.05 * i}s both` : 'none',
                        boxShadow: isSelected ? `0 4px 16px ${p.color}33` : 'none',
                      }}>
                      <div style={{ filter: isSelected ? 'none' : 'grayscale(20%) opacity(0.85)', transition: 'filter 0.2s' }}>
                        <PlatformIcon id={p.id} size={26} />
                      </div>
                      <span style={{ fontSize: '0.62rem', fontWeight: 600, color: isSelected ? p.color : 'var(--muted)', textAlign: 'center', lineHeight: 1.3, transition: 'color 0.2s' }}>{p.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* STEP 2 — TYPE */}
            {selectedPlatform && (
              <div style={{ marginBottom: '1.6rem', animation: 'fadeSlideIn 0.35s ease both' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.9rem' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#fff' }}>2</div>
                  <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>Select Account Type</span>
                  {selectedType && <span style={{ fontSize: '0.75rem', color: '#34d399', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><CheckIcon size={12} /> Selected</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                  {selectedPlatform.types.map((t, i) => {
                    const isSelected = selectedType?.id === t.id
                    return (
                      <button key={t.id} className="type-card"
                        onClick={() => setSelectedType(t)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '0.9rem 1.1rem',
                          background: isSelected ? `${selectedPlatform.color}12` : 'var(--card)',
                          border: `1px solid ${isSelected ? selectedPlatform.color : 'var(--border)'}`,
                          borderRadius: '12px',
                          animation: `fadeSlideIn 0.3s ease ${0.07 * i}s both`,
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: isSelected ? selectedPlatform.color : 'var(--muted)', transition: 'background 0.2s', boxShadow: isSelected ? `0 0 8px ${selectedPlatform.color}99` : 'none' }} />
                          <span style={{ fontSize: '0.84rem', fontWeight: 500, color: 'var(--text)' }}>{t.name}</span>
                        </div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--gold)', fontFamily: 'Outfit, sans-serif' }}>₦{t.price.toLocaleString()}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* STEP 3 — QUANTITY */}
            {selectedType && (
              <div style={{ marginBottom: '1.4rem', animation: 'fadeSlideIn 0.3s ease both' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.9rem' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#fff' }}>3</div>
                  <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>Quantity</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.8rem 1.1rem' }}>
                  <button className="qty-btn" onClick={() => setQuantity(q => Math.max(1, q - 1))} style={{ width: 36, height: 36, borderRadius: '9px', background: 'var(--card2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>−</button>
                  <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.2rem', color: 'var(--text)', minWidth: '2rem', textAlign: 'center' }}>{quantity}</span>
                  <button className="qty-btn" onClick={() => setQuantity(q => Math.min(50, q + 1))} style={{ width: 36, height: 36, borderRadius: '9px', background: 'var(--card2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>+</button>
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Total</div>
                    <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.05rem', color: 'var(--gold)' }}>₦{total.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}

            {/* ORDER SUMMARY + BUY */}
            {selectedPlatform && selectedType && (
              <div style={{ animation: 'scaleIn 0.3s ease both' }}>
                <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.1rem', marginBottom: '1rem' }}>
                  <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)', marginBottom: '0.8rem' }}>Order Summary</div>
                  {[
                    { label: 'Platform', value: <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'flex-end' }}><PlatformIcon id={selectedPlatform.id} size={14} />{selectedPlatform.name}</span> },
                    { label: 'Type', value: selectedType.name },
                    { label: 'Quantity', value: `×${quantity}` },
                    { label: 'Unit Price', value: `₦${selectedType.price.toLocaleString()}` },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', marginBottom: '0.45rem' }}>
                      <span style={{ color: 'var(--muted)' }}>{row.label}</span>
                      <span style={{ color: 'var(--text)', fontWeight: 500 }}>{row.value}</span>
                    </div>
                  ))}
                  <div style={{ height: 1, background: 'var(--border)', margin: '0.5rem 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem' }}>
                    <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Total</span>
                    <span style={{ color: 'var(--gold)', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>₦{total.toLocaleString()}</span>
                  </div>
                </div>
                <button onClick={handleOrder} disabled={ordering} className="buy-btn"
                  style={{ width: '100%', padding: '0.95rem', background: ordering ? 'var(--purple2)' : 'var(--purple)', color: '#fff', border: 'none', borderRadius: '12px', fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
                  {ordering ? (
                    <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>Processing...</>
                  ) : `Buy Now — ₦${total.toLocaleString()}`}
                </button>
              </div>
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
function CheckIcon({ size = 24 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
}