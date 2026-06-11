'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import LoadingScreen from '@/components/LoadingScreen'

const vpnProviders = [
  {
    id: 'nordvpn', name: 'NordVPN', color: '#4687ff', bg: '#4687ff15',
    desc: 'The most trusted VPN worldwide',
    features: ['6 devices', 'No logs policy', '60+ countries', '24/7 support'],
    plans: [
      { id: 'nord_1m', name: '1 Month', price: 3500, originalPrice: 5000, delivery: '5 mins' },
      { id: 'nord_6m', name: '6 Months', price: 18000, originalPrice: 28000, delivery: '5 mins', badge: 'Popular' },
      { id: 'nord_1y', name: '1 Year', price: 32000, originalPrice: 55000, delivery: '5 mins', badge: 'Best Value' },
    ]
  },
  {
    id: 'expressvpn', name: 'ExpressVPN', color: '#da3940', bg: '#da394015',
    desc: 'Lightning fast speeds, ultra secure',
    features: ['5 devices', 'No logs policy', '94+ countries', '24/7 support'],
    plans: [
      { id: 'express_1m', name: '1 Month', price: 4000, originalPrice: 6000, delivery: '5 mins' },
      { id: 'express_6m', name: '6 Months', price: 20000, originalPrice: 32000, delivery: '5 mins', badge: 'Popular' },
      { id: 'express_1y', name: '1 Year', price: 36000, originalPrice: 60000, delivery: '5 mins', badge: 'Best Value' },
    ]
  },
  {
    id: 'surfshark', name: 'Surfshark', color: '#1bc5c5', bg: '#1bc5c515',
    desc: 'Unlimited devices, unbeatable price',
    features: ['Unlimited devices', 'No logs policy', '100+ countries', '24/7 support'],
    plans: [
      { id: 'surf_1m', name: '1 Month', price: 3000, originalPrice: 4500, delivery: '5 mins' },
      { id: 'surf_6m', name: '6 Months', price: 15000, originalPrice: 24000, delivery: '5 mins', badge: 'Popular' },
      { id: 'surf_1y', name: '1 Year', price: 28000, originalPrice: 48000, delivery: '5 mins', badge: 'Best Value' },
    ]
  },
  {
    id: 'cyberghost', name: 'CyberGhost', color: '#ffcc00', bg: '#ffcc0015',
    desc: 'Best for streaming & torrenting',
    features: ['7 devices', 'No logs policy', '90+ countries', '24/7 support'],
    plans: [
      { id: 'cyber_1m', name: '1 Month', price: 3200, originalPrice: 4800, delivery: '5 mins' },
      { id: 'cyber_6m', name: '6 Months', price: 16000, originalPrice: 26000, delivery: '5 mins', badge: 'Popular' },
      { id: 'cyber_1y', name: '1 Year', price: 29000, originalPrice: 50000, delivery: '5 mins', badge: 'Best Value' },
    ]
  },
]

export default function VPN() {
  const [selectedProvider, setSelectedProvider] = useState(null)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [ordering, setOrdering] = useState(false)
  const [success, setSuccess] = useState(false)
  const [deliveredKey, setDeliveredKey] = useState('')
  const [copiedKey, setCopiedKey] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    setMounted(true)
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      const { data: profileData } = await supabase
        .from('profiles')
        .select('wallet_balance, full_name')
        .eq('id', user.id)
        .single()
      setProfile(profileData)
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
    if (!selectedProvider || !selectedPlan) return
    setOrdering(true)
    setError('')

    try {
      const res = await fetch('/api/vpn/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider.name,
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

      // Update local wallet balance
      setProfile(prev => ({ ...prev, wallet_balance: (prev?.wallet_balance || 0) - selectedPlan.price }))
      setDeliveredKey(data.key)
      setOrdering(false)
      setSuccess(true)

    } catch (err) {
      setError('Network error. Please try again.')
      setOrdering(false)
    }
  }

  if (loading) return <LoadingScreen />

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
        .provider-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
          cursor: pointer;
        }
        .provider-card:hover { transform: translateY(-3px); box-shadow: 0 10px 28px rgba(0,0,0,0.15); }
        .plan-card {
          transition: transform 0.15s ease, border-color 0.18s, background 0.18s;
          cursor: pointer;
          position: relative;
        }
        .plan-card:hover { transform: translateY(-2px); }
        .buy-btn { transition: transform 0.18s ease, box-shadow 0.18s ease; cursor: pointer; }
        .buy-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(108,78,242,0.4); }
        .back-btn { transition: background 0.18s, transform 0.18s; }
        .back-btn:hover { background: var(--card2) !important; transform: translateX(-2px); }
        .copy-btn { transition: background 0.15s, transform 0.15s; cursor: pointer; }
        .copy-btn:hover { transform: scale(1.04); }
      `}</style>

      {/* HEADER with wallet balance */}
      <div style={{ padding: '1.1rem 1.4rem', display: 'flex', alignItems: 'center', gap: '0.9rem', position: 'sticky', top: 0, zIndex: 100, background: 'var(--navy)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/dashboard" className="back-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '10px', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', textDecoration: 'none', flexShrink: 0 }}>
          <BackIcon />
        </Link>
        <div style={{ flex: 1, animation: mounted ? 'fadeSlideIn 0.4s ease' : 'none' }}>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>VPN Subscriptions</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Buy premium VPN keys from top providers</div>
        </div>
        {/* Wallet balance pill — matches numbers page */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.35rem 0.75rem',
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: '20px', flexShrink: 0,
        }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>BAL</span>
          <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem', color: 'var(--gold)' }}>
            ₦{balance.toLocaleString()}
          </span>
        </div>
      </div>

      <div style={{ padding: '1.2rem 1.4rem' }}>
        {success ? (
          /* SUCCESS SCREEN — shows delivered key */
          <div style={{ animation: 'fadeSlideIn 0.4s ease' }}>
            <div style={{ textAlign: 'center', padding: '2rem 0 1.5rem' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(29,158,117,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.2rem', color: '#34d399', animation: 'successPop 0.5s cubic-bezier(0.175,0.885,0.32,1.275)' }}>
                <CheckIcon size={36} />
              </div>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.3rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.4rem' }}>Key Delivered!</div>
              <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Your VPN activation key is ready. Copy and use it now.</div>
            </div>

            {/* Order info */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.8rem 1.2rem', marginBottom: '1.2rem' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: selectedProvider?.color }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text)', fontWeight: 500 }}>{selectedProvider?.name} · {selectedPlan?.name}</span>
              <span style={{ color: 'var(--gold)', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>₦{selectedPlan?.price.toLocaleString()}</span>
            </div>

            {/* VPN Key box */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.2rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Activation Key</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                <div style={{ flex: 1, background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.8rem 1rem', fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--text)', wordBreak: 'break-all', lineHeight: 1.5 }}>
                  {deliveredKey}
                </div>
                <button onClick={copyKey} className="copy-btn"
                  style={{ flexShrink: 0, width: 42, height: 42, borderRadius: '10px', background: copiedKey ? 'rgba(29,158,117,0.15)' : 'var(--purple)', border: `1px solid ${copiedKey ? 'rgba(29,158,117,0.4)' : 'transparent'}`, color: copiedKey ? '#34d399' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {copiedKey ? <CheckIcon size={16} /> : <CopyIcon />}
                </button>
              </div>
              {copiedKey && <div style={{ fontSize: '0.72rem', color: '#34d399', marginTop: '0.5rem', textAlign: 'center' }}>Copied to clipboard!</div>}
            </div>

            {/* Instructions */}
            <div style={{ background: 'rgba(108,78,242,0.06)', border: '1px solid rgba(108,78,242,0.15)', borderRadius: '12px', padding: '1rem', marginBottom: '1.2rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.5rem' }}>How to activate</div>
              {[
                `Download the ${selectedProvider?.name} app on your device`,
                'Open the app and go to Settings or Account',
                'Enter or paste your activation key',
                'Connect and enjoy secure browsing!',
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', marginBottom: '0.4rem' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: '#fff', flexShrink: 0, marginTop: '0.05rem' }}>{i + 1}</div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.5 }}>{step}</span>
                </div>
              ))}
            </div>

            <button onClick={() => { setSuccess(false); setSelectedProvider(null); setSelectedPlan(null); setDeliveredKey('') }} className="buy-btn"
              style={{ width: '100%', padding: '0.85rem', background: 'var(--purple)', color: '#fff', border: 'none', borderRadius: '12px', fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', fontWeight: 700 }}>
              Buy Another
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

            {/* STEP 1 — PROVIDER */}
            <div style={{ marginBottom: '1.6rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.05s both' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#fff' }}>1</div>
                <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>Select VPN Provider</span>
                {selectedProvider && <span style={{ fontSize: '0.75rem', color: '#34d399', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><CheckIcon size={12} /> {selectedProvider.name}</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.7rem' }}>
                {vpnProviders.map((p, i) => {
                  const isSelected = selectedProvider?.id === p.id
                  return (
                    <button key={p.id} className="provider-card"
                      onClick={() => { setSelectedProvider(p); setSelectedPlan(null) }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.7rem', padding: '1.1rem', background: isSelected ? p.bg : 'var(--card)', border: `1.5px solid ${isSelected ? p.color : 'var(--border)'}`, borderRadius: '16px', textAlign: 'left', boxShadow: isSelected ? `0 4px 16px ${p.color}33` : 'none', animation: mounted ? `fadeSlideIn 0.3s ease ${0.05 * i}s both` : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, boxShadow: isSelected ? `0 0 8px ${p.color}` : 'none' }} />
                        {isSelected && <CheckIcon size={14} color={p.color} />}
                      </div>
                      <div>
                        <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.92rem', color: isSelected ? p.color : 'var(--text)', marginBottom: '0.2rem' }}>{p.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', lineHeight: 1.4 }}>{p.desc}</div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {p.features.map(f => (
                          <span key={f} style={{ fontSize: '0.62rem', background: isSelected ? `${p.color}18` : 'var(--card2)', color: isSelected ? p.color : 'var(--muted)', borderRadius: '50px', padding: '0.2rem 0.5rem', fontWeight: 500 }}>{f}</span>
                        ))}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* STEP 2 — PLAN */}
            {selectedProvider && (
              <div style={{ marginBottom: '1.6rem', animation: 'fadeSlideIn 0.35s ease both' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.9rem' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#fff' }}>2</div>
                  <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>Select Plan</span>
                  {selectedPlan && <span style={{ fontSize: '0.75rem', color: '#34d399', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><CheckIcon size={12} /> {selectedPlan.name}</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {selectedProvider.plans.map((plan, i) => {
                    const isSelected = selectedPlan?.id === plan.id
                    const discount = Math.round((1 - plan.price / plan.originalPrice) * 100)
                    return (
                      <button key={plan.id} className="plan-card"
                        onClick={() => setSelectedPlan(plan)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.1rem', background: isSelected ? `${selectedProvider.color}12` : 'var(--card)', border: `1px solid ${isSelected ? selectedProvider.color : 'var(--border)'}`, borderRadius: '14px', animation: `fadeSlideIn 0.3s ease ${0.06 * i}s both` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: isSelected ? selectedProvider.color : 'var(--muted)', transition: 'all 0.2s', boxShadow: isSelected ? `0 0 8px ${selectedProvider.color}` : 'none' }} />
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' }}>{plan.name}</span>
                              {plan.badge && <span style={{ fontSize: '0.62rem', background: selectedProvider.color, color: '#fff', borderRadius: '50px', padding: '0.15rem 0.5rem', fontWeight: 700 }}>{plan.badge}</span>}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.1rem' }}>Instant delivery · Save {discount}%</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.92rem', color: 'var(--gold)' }}>₦{plan.price.toLocaleString()}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textDecoration: 'line-through' }}>₦{plan.originalPrice.toLocaleString()}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ORDER SUMMARY + BUY */}
            {selectedProvider && selectedPlan && (
              <div style={{ animation: 'scaleIn 0.3s ease both' }}>
                <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.1rem', marginBottom: '0.8rem' }}>
                  <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)', marginBottom: '0.8rem' }}>Order Summary</div>
                  {[
                    { label: 'Provider', value: selectedProvider.name },
                    { label: 'Plan', value: selectedPlan.name },
                    { label: 'Delivery', value: 'Instant' },
                    { label: 'You save', value: `₦${(selectedPlan.originalPrice - selectedPlan.price).toLocaleString()}` },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.45rem' }}>
                      <span style={{ color: 'var(--muted)' }}>{row.label}</span>
                      <span style={{ color: row.label === 'You save' ? '#34d399' : 'var(--text)', fontWeight: 500 }}>{row.value}</span>
                    </div>
                  ))}
                  <div style={{ height: 1, background: 'var(--border)', margin: '0.5rem 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem' }}>
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
                  {ordering ? (
                    <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>Processing...</>
                  ) : `Buy Now — ₦${selectedPlan.price.toLocaleString()}`}
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
function CheckIcon({ size = 24, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
}
function CopyIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
}