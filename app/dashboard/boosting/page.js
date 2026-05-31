'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

const boostingServices = [
  {
    id: 'instagram', name: 'Instagram', color: '#e1306c', bg: '#e1306c15',
    packages: [
      { id: 'followers_1k', name: '1,000 Followers', price: 1500, delivery: '24hrs', desc: 'Real-looking profiles' },
      { id: 'followers_5k', name: '5,000 Followers', price: 6000, delivery: '48hrs', desc: 'Gradual delivery' },
      { id: 'followers_10k', name: '10,000 Followers', price: 11000, delivery: '72hrs', desc: 'Best value' },
      { id: 'likes_1k', name: '1,000 Likes', price: 800, delivery: '12hrs', desc: 'Per post' },
      { id: 'views_10k', name: '10,000 Views', price: 600, delivery: '6hrs', desc: 'Reel/Video views' },
    ]
  },
  {
    id: 'tiktok', name: 'TikTok', color: '#ff0050', bg: '#ff005015',
    packages: [
      { id: 'followers_1k', name: '1,000 Followers', price: 1200, delivery: '24hrs', desc: 'Real-looking profiles' },
      { id: 'followers_5k', name: '5,000 Followers', price: 5000, delivery: '48hrs', desc: 'Gradual delivery' },
      { id: 'likes_1k', name: '1,000 Likes', price: 600, delivery: '6hrs', desc: 'Per video' },
      { id: 'views_50k', name: '50,000 Views', price: 1000, delivery: '12hrs', desc: 'Video views' },
    ]
  },
  {
    id: 'twitter', name: 'Twitter / X', color: '#e7e7e7', bg: '#e7e7e715',
    packages: [
      { id: 'followers_1k', name: '1,000 Followers', price: 1800, delivery: '24hrs', desc: 'Quality accounts' },
      { id: 'followers_5k', name: '5,000 Followers', price: 7500, delivery: '72hrs', desc: 'Gradual delivery' },
      { id: 'likes_500', name: '500 Likes', price: 700, delivery: '6hrs', desc: 'Per tweet' },
      { id: 'retweets_500', name: '500 Retweets', price: 1000, delivery: '12hrs', desc: 'Per tweet' },
    ]
  },
  {
    id: 'facebook', name: 'Facebook', color: '#1877f2', bg: '#1877f215',
    packages: [
      { id: 'pagelikes_1k', name: '1,000 Page Likes', price: 2000, delivery: '48hrs', desc: 'Real-looking' },
      { id: 'followers_1k', name: '1,000 Followers', price: 1800, delivery: '24hrs', desc: 'Profile followers' },
      { id: 'postlikes_500', name: '500 Post Likes', price: 800, delivery: '12hrs', desc: 'Per post' },
    ]
  },
  {
    id: 'youtube', name: 'YouTube', color: '#ff0000', bg: '#ff000015',
    packages: [
      { id: 'subscribers_1k', name: '1,000 Subscribers', price: 5000, delivery: '72hrs', desc: 'Retention safe' },
      { id: 'views_10k', name: '10,000 Views', price: 2000, delivery: '48hrs', desc: 'Watch time counted' },
      { id: 'likes_500', name: '500 Likes', price: 1000, delivery: '24hrs', desc: 'Per video' },
    ]
  },
  {
    id: 'telegram', name: 'Telegram', color: '#0088cc', bg: '#0088cc15',
    packages: [
      { id: 'members_1k', name: '1,000 Members', price: 3000, delivery: '48hrs', desc: 'Channel/Group' },
      { id: 'members_5k', name: '5,000 Members', price: 12000, delivery: '72hrs', desc: 'Gradual delivery' },
      { id: 'views_10k', name: '10,000 Post Views', price: 800, delivery: '6hrs', desc: 'Per post' },
    ]
  },
]

const PlatformIcon = ({ id, size = 26 }) => {
  const icons = {
    instagram: <svg width={size} height={size} viewBox="0 0 24 24"><defs><linearGradient id="ig2" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#f09433"/><stop offset="50%" stopColor="#dc2743"/><stop offset="100%" stopColor="#bc1888"/></linearGradient></defs><path fill="url(#ig2)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>,
    tiktok: <svg width={size} height={size} viewBox="0 0 24 24"><path fill="#ff0050" d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.52V6.75a4.85 4.85 0 01-1.02-.06z"/></svg>,
    twitter: <svg width={size} height={size} viewBox="0 0 24 24" fill="#e7e7e7"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
    facebook: <svg width={size} height={size} viewBox="0 0 24 24" fill="#1877f2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
    youtube: <svg width={size} height={size} viewBox="0 0 24 24" fill="#ff0000"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>,
    telegram: <svg width={size} height={size} viewBox="0 0 24 24" fill="#0088cc"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>,
  }
  return icons[id] || null
}

export default function Boosting() {
  const [selectedPlatform, setSelectedPlatform] = useState(null)
  const [selectedPackage, setSelectedPackage] = useState(null)
  const [link, setLink] = useState('')
  const [ordering, setOrdering] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const handleOrder = async () => {
    if (!selectedPlatform || !selectedPackage || !link.trim()) return
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
    const price = selectedPackage.price

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
      product_type: 'boosting',
      product_name: `${selectedPlatform.name} - ${selectedPackage.name}`,
      amount: price,
      status: 'pending',
      details: { platform: selectedPlatform.name, package: selectedPackage.name, link, delivery: selectedPackage.delivery }
    })

    await supabase.from('transactions').insert({
      user_id: user.id,
      type: 'debit',
      amount: price,
      description: `${selectedPlatform.name} Boost - ${selectedPackage.name}`,
      reference: `BOOST-${Date.now()}`
    })

    setOrdering(false)
    setSuccess(true)
  }

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
        @keyframes spin { to { transform: rotate(360deg); } }
        .platform-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease;
          cursor: pointer;
        }
        .platform-card:hover { transform: translateY(-4px) scale(1.04); box-shadow: 0 10px 28px rgba(0,0,0,0.2); }
        .platform-card:active { transform: scale(0.97); }
        .pkg-card { transition: transform 0.15s ease, border-color 0.18s, background 0.18s; cursor: pointer; }
        .pkg-card:hover { transform: translateY(-2px); }
        .buy-btn { transition: transform 0.18s ease, box-shadow 0.18s ease; cursor: pointer; }
        .buy-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(108,78,242,0.4); }
        .buy-btn:active:not(:disabled) { transform: translateY(0); }
        .back-btn { transition: background 0.18s, transform 0.18s; }
        .back-btn:hover { background: var(--card2) !important; transform: translateX(-2px); }
        .link-input:focus { border-color: var(--purple) !important; box-shadow: 0 0 0 3px rgba(108,78,242,0.12); }
      `}</style>

      {/* HEADER */}
      <div style={{ padding: '1.1rem 1.4rem', display: 'flex', alignItems: 'center', gap: '0.9rem', position: 'sticky', top: 0, zIndex: 100, background: 'var(--navy)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/dashboard" className="back-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '10px', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', textDecoration: 'none' }}>
          <BackIcon />
        </Link>
        <div style={{ animation: mounted ? 'fadeSlideIn 0.4s ease' : 'none' }}>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>Account Boosting</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Grow your social media presence fast</div>
        </div>
      </div>

      <div style={{ padding: '1.2rem 1.4rem' }}>
        {success ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', animation: 'fadeSlideIn 0.4s ease' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(29,158,117,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.2rem', color: '#34d399', animation: 'successPop 0.5s cubic-bezier(0.175,0.885,0.32,1.275)' }}>
              <CheckIcon size={36} />
            </div>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.3rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.4rem' }}>Boost Order Placed!</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>Your boost will start within the delivery window.</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.8rem 1.4rem', margin: '0 0 1.5rem' }}>
              <PlatformIcon id={selectedPlatform?.id} size={18} />
              <span style={{ fontSize: '0.82rem', color: 'var(--text)' }}>{selectedPlatform?.name} · {selectedPackage?.name}</span>
              <span style={{ color: 'var(--gold)', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>₦{selectedPackage?.price.toLocaleString()}</span>
            </div>
            <br />
            <button onClick={() => { setSuccess(false); setSelectedPlatform(null); setSelectedPackage(null); setLink('') }} className="buy-btn" style={{ padding: '0.75rem 1.8rem', background: 'var(--purple)', color: '#fff', border: 'none', borderRadius: '12px', fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', fontWeight: 700 }}>
              Place Another Order
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.7rem' }}>
                {boostingServices.map((p, i) => {
                  const isSelected = selectedPlatform?.id === p.id
                  return (
                    <button key={p.id} className="platform-card"
                      onClick={() => { setSelectedPlatform(p); setSelectedPackage(null) }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '1rem 0.4rem', background: isSelected ? p.bg : 'var(--card)', border: `1.5px solid ${isSelected ? p.color : 'var(--border)'}`, borderRadius: '16px', boxShadow: isSelected ? `0 4px 16px ${p.color}33` : 'none', animation: mounted ? `fadeSlideIn 0.3s ease ${0.05 * i}s both` : 'none' }}>
                      <div style={{ filter: isSelected ? 'none' : 'grayscale(20%) opacity(0.85)', transition: 'filter 0.2s' }}>
                        <PlatformIcon id={p.id} size={26} />
                      </div>
                      <span style={{ fontSize: '0.62rem', fontWeight: 600, color: isSelected ? p.color : 'var(--muted)', textAlign: 'center', lineHeight: 1.3, transition: 'color 0.2s' }}>{p.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* STEP 2 — PACKAGE */}
            {selectedPlatform && (
              <div style={{ marginBottom: '1.6rem', animation: 'fadeSlideIn 0.35s ease both' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.9rem' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#fff' }}>2</div>
                  <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>Select Package</span>
                  {selectedPackage && <span style={{ fontSize: '0.75rem', color: '#34d399', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><CheckIcon size={12} /> Selected</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {selectedPlatform.packages.map((pkg, i) => {
                    const isSelected = selectedPackage?.id === pkg.id
                    return (
                      <button key={pkg.id} className="pkg-card"
                        onClick={() => setSelectedPackage(pkg)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1.1rem', background: isSelected ? `${selectedPlatform.color}12` : 'var(--card)', border: `1px solid ${isSelected ? selectedPlatform.color : 'var(--border)'}`, borderRadius: '12px', animation: `fadeSlideIn 0.3s ease ${0.06 * i}s both` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: isSelected ? selectedPlatform.color : 'var(--muted)', transition: 'all 0.2s', boxShadow: isSelected ? `0 0 8px ${selectedPlatform.color}` : 'none' }} />
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text)' }}>{pkg.name}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{pkg.desc} · {pkg.delivery} delivery</div>
                          </div>
                        </div>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--gold)', fontFamily: 'Outfit, sans-serif' }}>₦{pkg.price.toLocaleString()}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* STEP 3 — LINK */}
            {selectedPackage && (
              <div style={{ marginBottom: '1.4rem', animation: 'fadeSlideIn 0.3s ease both' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.9rem' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#fff' }}>3</div>
                  <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>Enter Your Link</span>
                </div>
                <input
                  className="link-input"
                  placeholder={`Paste your ${selectedPlatform.name} profile or post link...`}
                  value={link}
                  onChange={e => setLink(e.target.value)}
                  style={{ width: '100%', padding: '0.85rem 1rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)', fontSize: '0.88rem', outline: 'none', fontFamily: 'Inter, sans-serif', transition: 'border-color 0.2s, box-shadow 0.2s' }}
                />
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.4rem' }}>Make sure your account/post is public before ordering.</div>
              </div>
            )}

            {/* ORDER SUMMARY + BUY */}
            {selectedPlatform && selectedPackage && link.trim() && (
              <div style={{ animation: 'scaleIn 0.3s ease both' }}>
                <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.1rem', marginBottom: '1rem' }}>
                  <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)', marginBottom: '0.8rem' }}>Order Summary</div>
                  {[
                    { label: 'Platform', value: selectedPlatform.name },
                    { label: 'Package', value: selectedPackage.name },
                    { label: 'Delivery', value: selectedPackage.delivery },
                    { label: 'Link', value: link.length > 30 ? link.substring(0, 30) + '...' : link },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.45rem' }}>
                      <span style={{ color: 'var(--muted)' }}>{row.label}</span>
                      <span style={{ color: 'var(--text)', fontWeight: 500 }}>{row.value}</span>
                    </div>
                  ))}
                  <div style={{ height: 1, background: 'var(--border)', margin: '0.5rem 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem' }}>
                    <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Total</span>
                    <span style={{ color: 'var(--gold)', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>₦{selectedPackage.price.toLocaleString()}</span>
                  </div>
                </div>
                <button onClick={handleOrder} disabled={ordering} className="buy-btn"
                  style={{ width: '100%', padding: '0.95rem', background: ordering ? 'var(--purple2)' : 'var(--purple)', color: '#fff', border: 'none', borderRadius: '12px', fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
                  {ordering ? (
                    <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>Processing...</>
                  ) : `Boost Now — ₦${selectedPackage.price.toLocaleString()}`}
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