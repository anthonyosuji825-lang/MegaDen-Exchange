'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import LoadingScreen from '@/components/LoadingScreen'

const VPN_PLANS = [
  { id: '1m', name: '1 Month', days: 30, price: 1500, badge: null, desc: 'Great for short-term use' },
  { id: '3m', name: '3 Months', days: 90, price: 4000, badge: 'Popular', desc: 'Save vs monthly' },
  { id: '6m', name: '6 Months', days: 180, price: 7500, badge: null, desc: 'Best for regular users' },
  { id: '12m', name: '1 Year', days: 365, price: 14000, badge: 'Best Value', desc: 'Maximum savings' },
]

const VPN_FEATURES = [
  '79+ server locations',
  'OpenVPN & WireGuard',
  'Unlimited bandwidth',
  'Military-grade encryption',
  'No logs policy',
  'Instant delivery',
]

export default function VPN() {
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [ordering, setOrdering] = useState(false)
  const [success, setSuccess] = useState(false)
  const [credentials, setCredentials] = useState(null)
  const [copiedUser, setCopiedUser] = useState(false)
  const [copiedPass, setCopiedPass] = useState(false)
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

  const copy = (text, setCopied) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadOvpn = () => {
    if (!credentials?.ovpn_config) return
    const blob = new Blob([credentials.ovpn_config], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = credentials.ovpn_filename || 'megaden-vpn.ovpn'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleOrder = async () => {
    if (!selectedPlan) return
    setOrdering(true)
    setError('')

    try {
      const res = await fetch('/api/vpn/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selectedPlan.id }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || 'Something went wrong. Please try again.')
        setOrdering(false)
        return
      }

      setProfile(prev => ({ ...prev, wallet_balance: (prev?.wallet_balance || 0) - selectedPlan.price }))
      setCredentials({
        vpn_username: data.vpn_username,
        vpn_password: data.vpn_password,
        ovpn_config: data.ovpn_config,
        ovpn_filename: data.ovpn_filename,
        expires_at: data.expires_at,
      })
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
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes successPop {
          0% { transform: scale(0); opacity: 0; }
          70% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        .back-btn { transition: background 0.18s, transform 0.18s; }
        .back-btn:hover { background: var(--card2) !important; transform: translateX(-2px); }
        .plan-card { transition: border-color 0.18s, background 0.18s, box-shadow 0.18s; cursor: pointer; }
        .plan-card:hover { border-color: var(--purple) !important; }
        .buy-btn { transition: transform 0.18s, box-shadow 0.18s; cursor: pointer; }
        .buy-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(108,78,242,0.35); }
        .copy-btn { transition: background 0.15s, transform 0.15s; cursor: pointer; }
        .copy-btn:hover { transform: scale(1.05); }
        .feature-pill { display: inline-flex; align-items: center; gap: 0.35rem; }
      `}</style>

      {/* HEADER */}
      <div style={{ padding: '1.1rem 1.4rem', display: 'flex', alignItems: 'center', gap: '0.9rem', position: 'sticky', top: 0, zIndex: 100, background: 'var(--navy)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/dashboard" className="back-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '10px', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', textDecoration: 'none' }}>
          <BackIcon />
        </Link>
        <div style={{ animation: mounted ? 'fadeSlideIn 0.4s ease' : 'none' }}>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>VPN Subscriptions</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Secure, fast and private</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>Wallet</div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.9rem', color: 'var(--gold)' }}>₦{balance.toLocaleString()}</div>
        </div>
      </div>

      <div style={{ padding: '1.2rem 1.4rem', maxWidth: 560, margin: '0 auto' }}>

        {success && credentials ? (
          /* ── SUCCESS STATE ── */
          <div style={{ animation: 'scaleIn 0.35s ease' }}>
            {/* Success banner */}
            <div style={{ borderRadius: '22px', padding: '2rem 1.5rem', background: 'linear-gradient(145deg, #0a2e1a 0%, #0d4a28 60%, #1a5c35 100%)', marginBottom: '1.2rem', textAlign: 'center', boxShadow: '0 16px 48px rgba(52,211,153,0.15)' }}>
              <div style={{ animation: 'successPop 0.5s cubic-bezier(0.175,0.885,0.32,1.275) both', marginBottom: '1rem' }}>
                <div style={{ width: 64, height: 64, borderRadius: '18px', margin: '0 auto', background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldIcon size={30} color="#34d399" />
                </div>
              </div>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.3rem', color: '#fff', marginBottom: '0.3rem' }}>VPN Active!</div>
              <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)' }}>
                Expires {new Date(credentials.expires_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>

            {/* Credentials */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '18px', padding: '1.3rem', marginBottom: '1rem' }}>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)', marginBottom: '1rem' }}>Your VPN Credentials</div>

              {[
                { label: 'Username', value: credentials.vpn_username, copied: copiedUser, setCopied: setCopiedUser },
                { label: 'Password', value: credentials.vpn_password, copied: copiedPass, setCopied: setCopiedPass },
              ].map(field => (
                <div key={field.label} style={{ marginBottom: '0.8rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '0.3rem', fontWeight: 500 }}>{field.label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'var(--navy2)', borderRadius: '10px', padding: '0.7rem 1rem' }}>
                    <span style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text)', wordBreak: 'break-all' }}>{field.value}</span>
                    <button className="copy-btn" onClick={() => copy(field.value, field.setCopied)}
                      style={{ padding: '0.35rem 0.7rem', background: field.copied ? 'rgba(52,211,153,0.15)' : 'rgba(108,78,242,0.12)', border: `1px solid ${field.copied ? '#34d399' : 'var(--purple)'}`, borderRadius: '7px', color: field.copied ? '#34d399' : 'var(--purple2)', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {field.copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              ))}

              {credentials.ovpn_config && (
                <button onClick={downloadOvpn} style={{ width: '100%', padding: '0.8rem', background: 'rgba(108,78,242,0.1)', border: '1px solid var(--purple)', borderRadius: '10px', color: 'var(--purple2)', fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '0.4rem' }}>
                  <DownloadIcon size={16} /> Download .ovpn Config File
                </button>
              )}
            </div>

            {/* How to connect */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '18px', padding: '1.3rem', marginBottom: '1rem' }}>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)', marginBottom: '0.9rem' }}>How to Connect</div>
              {[
                'Download OpenVPN Connect (Android/iOS/PC)',
                'Import the .ovpn file or enter credentials manually',
                'Connect and enjoy private, secure browsing',
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: i < 2 ? '0.75rem' : 0 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{i + 1}</div>
                  <span style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.5 }}>{step}</span>
                </div>
              ))}
            </div>

            <button onClick={() => { setSuccess(false); setSelectedPlan(null); setCredentials(null) }}
              style={{ width: '100%', padding: '0.85rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)', fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer' }}>
              Buy Another Plan
            </button>
          </div>

        ) : (
          /* ── PURCHASE STATE ── */
          <>
            {/* Hero banner */}
            <div style={{ borderRadius: '22px', padding: '1.8rem 1.5rem', background: 'linear-gradient(145deg, #0a1a3e 0%, #1a2a6c 50%, #0d3a5c 100%)', marginBottom: '1.4rem', position: 'relative', overflow: 'hidden', animation: mounted ? 'fadeSlideIn 0.4s ease' : 'none', boxShadow: '0 16px 40px rgba(70,135,255,0.18)' }}>
              <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.9rem' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '13px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShieldIcon size={24} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.1rem', color: '#fff' }}>MegaDen VPN</div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)' }}>Premium private network access</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {VPN_FEATURES.map(f => (
                    <span key={f} className="feature-pill" style={{ fontSize: '0.68rem', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)', borderRadius: '50px', padding: '0.25rem 0.65rem', fontWeight: 500 }}>
                      <span style={{ color: '#34d399', fontSize: '0.6rem' }}>✓</span> {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <div style={{ background: 'rgba(220,50,50,0.1)', border: '1px solid rgba(220,50,50,0.3)', color: '#ff6b6b', borderRadius: '12px', padding: '0.75rem 1rem', fontSize: '0.84rem', marginBottom: '1rem' }}>
                {error}
              </div>
            )}

            {/* How it works */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '18px', padding: '1.2rem', marginBottom: '1.4rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.06s both' : 'none' }}>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)', marginBottom: '1rem' }}>How It Works</div>
              {[
                { icon: '🛒', title: 'Purchase a plan', desc: 'Select your preferred duration and pay from your wallet — instant activation.' },
                { icon: '📋', title: 'Get your credentials', desc: 'You receive a username, password, and a config file (.ovpn) immediately after purchase.' },
                { icon: '📱', title: 'Download OpenVPN Connect', desc: 'Free app available on Android, iOS, Windows and Mac. No account needed.' },
                { icon: '🔒', title: 'Connect & browse privately', desc: 'Import your config file or enter credentials manually — one tap to connect.' },
              ].map((step, i, arr) => (
                <div key={i} style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start', paddingBottom: i < arr.length - 1 ? '0.85rem' : 0, marginBottom: i < arr.length - 1 ? '0.85rem' : 0, borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(108,78,242,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>{step.icon}</div>
                  <div>
                    <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)', marginBottom: '0.2rem' }}>{step.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.55 }}>{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Plan selection */}
            <div style={{ marginBottom: '1.4rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.08s both' : 'none' }}>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)', marginBottom: '0.8rem' }}>Select a Plan</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {VPN_PLANS.map((plan, i) => {
                  const isSelected = selectedPlan?.id === plan.id
                  const canAfford = balance >= plan.price
                  return (
                    <button key={plan.id} className="plan-card"
                      onClick={() => setSelectedPlan(plan)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.1rem', background: isSelected ? 'rgba(108,78,242,0.1)' : 'var(--card)', border: `1.5px solid ${isSelected ? 'var(--purple)' : 'var(--border)'}`, borderRadius: '14px', boxShadow: isSelected ? '0 4px 16px rgba(108,78,242,0.2)' : 'none', animation: mounted ? `fadeSlideIn 0.3s ease ${0.05 * i}s both` : 'none', opacity: canAfford ? 1 : 0.6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: isSelected ? 'var(--purple)' : 'var(--muted)', transition: 'all 0.2s', boxShadow: isSelected ? '0 0 8px var(--purple)' : 'none', flexShrink: 0 }} />
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: isSelected ? 'var(--purple2)' : 'var(--text)', fontFamily: 'Outfit, sans-serif' }}>{plan.name}</span>
                            {plan.badge && <span style={{ fontSize: '0.62rem', background: plan.badge === 'Best Value' ? 'var(--gold)' : 'var(--purple)', color: plan.badge === 'Best Value' ? '#0b0e1a' : '#fff', borderRadius: '50px', padding: '0.15rem 0.5rem', fontWeight: 700 }}>{plan.badge}</span>}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{plan.desc} · {plan.days} days</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.95rem', color: 'var(--gold)' }}>₦{plan.price.toLocaleString()}</div>
                        {!canAfford && <div style={{ fontSize: '0.62rem', color: '#ff6b6b' }}>Low balance</div>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Order summary + buy */}
            {selectedPlan && (
              <div style={{ animation: 'scaleIn 0.3s ease both' }}>
                <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.1rem', marginBottom: '0.8rem' }}>
                  <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)', marginBottom: '0.8rem' }}>Order Summary</div>
                  {[
                    { label: 'Plan', value: `${selectedPlan.name} (${selectedPlan.days} days)` },
                    { label: 'Delivery', value: 'Instant' },
                    { label: 'Servers', value: '79+ locations worldwide' },
                    { label: 'Protocols', value: 'OpenVPN, WireGuard' },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.45rem' }}>
                      <span style={{ color: 'var(--muted)' }}>{row.label}</span>
                      <span style={{ color: 'var(--text)', fontWeight: 500 }}>{row.value}</span>
                    </div>
                  ))}
                  <div style={{ height: 1, background: 'var(--border)', margin: '0.6rem 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem' }}>
                    <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Total</span>
                    <span style={{ color: 'var(--gold)', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>₦{selectedPlan.price.toLocaleString()}</span>
                  </div>
                </div>

                {!hasBalance && (
                  <div style={{ background: 'rgba(220,50,50,0.08)', border: '1px solid rgba(220,50,50,0.25)', borderRadius: '10px', padding: '0.7rem 1rem', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8rem', color: '#ff6b6b' }}>Insufficient balance. Fund your wallet first.</span>
                    <Link href="/dashboard/wallet" style={{ fontSize: '0.75rem', color: 'var(--purple2)', fontWeight: 700, textDecoration: 'none', flexShrink: 0, marginLeft: '0.5rem' }}>Fund →</Link>
                  </div>
                )}

                <button onClick={handleOrder} disabled={ordering || !hasBalance} className="buy-btn"
                  style={{ width: '100%', padding: '0.95rem', background: !hasBalance ? 'var(--card)' : ordering ? 'var(--purple2)' : 'var(--purple)', color: !hasBalance ? 'var(--muted)' : '#fff', border: !hasBalance ? '1px solid var(--border)' : 'none', borderRadius: '12px', fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
                  {ordering ? (
                    <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>Activating VPN...</>
                  ) : `Activate VPN — ₦${selectedPlan.price.toLocaleString()}`}
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
function ShieldIcon({ size = 24, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z"/></svg>
}
function DownloadIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
}