'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export default function Referral() {
  const [profile, setProfile] = useState(null)
  const [referrals, setReferrals] = useState([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setMounted(true)
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(profileData)
      const { data: refs } = await supabase.from('profiles').select('full_name, created_at').eq('referred_by', profileData?.referral_code)
      setReferrals(refs || [])
      setLoading(false)
    }
    load()
  }, [])

  const referralLink = `https://megaden-exchange.vercel.app/signup?ref=${profile?.referral_code}`

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: 'MegaDen Exchange', text: 'Join MegaDen Exchange and get foreign numbers, social media logs & more!', url: referralLink })
    } else {
      handleCopy()
    }
  }

  const earnings = referrals.length * 200

  if (loading) return (
    <main style={{ background: 'var(--navy)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Loading...</div>
    </main>
  )

  return (
    <main style={{ background: 'var(--navy)', minHeight: '100vh', paddingBottom: '2rem' }}>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes successPop {
          0% { transform: scale(0); opacity: 0; }
          70% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .copy-btn { transition: transform 0.18s, background 0.18s, box-shadow 0.18s; cursor: pointer; }
        .copy-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(108,78,242,0.3); }
        .share-btn { transition: transform 0.18s, box-shadow 0.18s; cursor: pointer; }
        .share-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(240,180,41,0.3); }
        .back-btn { transition: background 0.18s, transform 0.18s; }
        .back-btn:hover { background: var(--card2) !important; transform: translateX(-2px); }
        .ref-card { transition: transform 0.18s, box-shadow 0.18s; }
        .ref-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.1); }
      `}</style>

      {/* HEADER */}
      <div style={{ padding: '1.1rem 1.4rem', display: 'flex', alignItems: 'center', gap: '0.9rem', position: 'sticky', top: 0, zIndex: 100, background: 'var(--navy)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/dashboard" className="back-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '10px', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', textDecoration: 'none' }}>
          <BackIcon />
        </Link>
        <div style={{ animation: mounted ? 'fadeSlideIn 0.4s ease' : 'none' }}>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>Refer & Earn</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Invite friends and earn ₦200 per referral</div>
        </div>
      </div>

      <div style={{ padding: '1.2rem 1.4rem' }}>

        {/* HERO BANNER */}
        <div style={{ borderRadius: '22px', padding: '1.8rem 1.5rem', background: 'linear-gradient(135deg, #1a0a5e 0%, #6c4ef2 55%, #c0781a 100%)', marginBottom: '1.4rem', position: 'relative', overflow: 'hidden', textAlign: 'center', animation: mounted ? 'fadeSlideIn 0.4s ease' : 'none' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ position: 'absolute', bottom: -30, left: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem', animation: 'float 3s ease-in-out infinite' }}>🎁</div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.3rem', fontWeight: 800, color: '#fff', marginBottom: '0.3rem' }}>Invite & Earn ₦200</div>
          <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', maxWidth: '280px', margin: '0 auto' }}>
            For every friend who signs up and makes their first purchase using your link
          </div>
        </div>

        {/* STATS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.7rem', marginBottom: '1.4rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.08s both' : 'none' }}>
          {[
            { label: 'Total Referrals', value: referrals.length, color: 'var(--purple2)' },
            { label: 'Total Earned', value: `₦${earnings.toLocaleString()}`, color: 'var(--gold)' },
            { label: 'Pending', value: '₦0', color: 'var(--muted)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '0.9rem 0.5rem', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.2rem', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: '0.2rem', lineHeight: 1.3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* REFERRAL CODE */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.2rem', marginBottom: '1rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.12s both' : 'none' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.5rem', fontWeight: 500 }}>Your Referral Code</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--navy2)', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
            <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.3rem', color: 'var(--purple2)', letterSpacing: '2px' }}>{profile?.referral_code || 'XXXXXX'}</span>
            <button onClick={handleCopy} className="copy-btn"
              style={{ padding: '0.4rem 0.9rem', background: copied ? 'rgba(29,158,117,0.15)' : 'rgba(108,78,242,0.12)', border: `1px solid ${copied ? '#34d399' : 'var(--purple)'}`, borderRadius: '8px', color: copied ? '#34d399' : 'var(--purple2)', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {copied ? <><CheckIcon size={12} /> Copied!</> : <><CopyIcon size={12} /> Copy Code</>}
            </button>
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.5rem', fontWeight: 500 }}>Your Referral Link</div>
          <div style={{ background: 'var(--navy2)', borderRadius: '10px', padding: '0.65rem 1rem', marginBottom: '1rem', fontSize: '0.75rem', color: 'var(--muted)', wordBreak: 'break-all', lineHeight: 1.5 }}>
            {referralLink}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
            <button onClick={handleCopy} className="copy-btn"
              style={{ padding: '0.75rem', background: 'rgba(108,78,242,0.1)', border: '1px solid var(--purple)', borderRadius: '10px', color: 'var(--purple2)', fontSize: '0.82rem', fontWeight: 600, fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              <CopyIcon size={14} /> {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <button onClick={handleShare} className="share-btn"
              style={{ padding: '0.75rem', background: 'var(--gold)', border: 'none', borderRadius: '10px', color: '#0b0e1a', fontSize: '0.82rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              <ShareIcon size={14} /> Share Link
            </button>
          </div>
        </div>

        {/* HOW IT WORKS */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.2rem', marginBottom: '1.2rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.16s both' : 'none' }}>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)', marginBottom: '1rem' }}>How It Works</div>
          {[
            { step: '01', title: 'Share your link', desc: 'Send your unique referral link to friends and family' },
            { step: '02', title: 'They sign up', desc: 'Your friend creates an account using your link' },
            { step: '03', title: 'They make a purchase', desc: 'When they complete their first order on MegaDen' },
            { step: '04', title: 'You earn ₦200', desc: 'Credit is automatically added to your wallet' },
          ].map((s, i) => (
            <div key={s.step} style={{ display: 'flex', gap: '0.9rem', alignItems: 'flex-start', paddingBottom: i < 3 ? '0.9rem' : 0, marginBottom: i < 3 ? '0.9rem' : 0, borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.4rem', fontWeight: 800, color: 'rgba(108,78,242,0.2)', minWidth: '36px', lineHeight: 1 }}>{s.step}</div>
              <div>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.84rem', color: 'var(--text)', marginBottom: '0.15rem' }}>{s.title}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* REFERRALS LIST */}
        <div style={{ animation: mounted ? 'fadeSlideIn 0.4s ease 0.2s both' : 'none' }}>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.92rem', color: 'var(--text)', marginBottom: '0.9rem' }}>
            Your Referrals ({referrals.length})
          </div>
          {referrals.length === 0 ? (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👥</div>
              <div style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>No referrals yet. Share your link to start earning!</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {referrals.map((r, i) => (
                <div key={i} className="ref-card"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '0.85rem 1.1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--purple), var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.85rem', color: '#fff' }}>
                      {r.full_name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text)' }}>{r.full_name || 'Anonymous'}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.1rem' }}>Joined {new Date(r.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.85rem', color: '#34d399' }}>+₦200</div>
                </div>
              ))}
            </div>
          )}
        </div>

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
function CopyIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
}
function ShareIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
}