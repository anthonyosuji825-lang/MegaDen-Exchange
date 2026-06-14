'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function About() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  return (
    <main style={{ background: 'var(--navy)', minHeight: '100vh', overflowX: 'hidden' }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes orb1 {
          0%, 100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(30px,-20px) scale(1.08); }
        }
        @keyframes orb2 {
          0%, 100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(-20px,25px) scale(1.06); }
        }
        .back-btn { transition: background 0.18s, transform 0.18s; }
        .back-btn:hover { opacity: 0.8; transform: translateX(-2px); }
        .contact-card { transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s; }
        .contact-card:hover { transform: translateY(-3px); box-shadow: 0 8px 28px rgba(108,78,242,0.18); border-color: var(--purple) !important; }
        .value-card { transition: transform 0.18s, box-shadow 0.18s; }
        .value-card:hover { transform: translateY(-2px); }
      `}</style>

      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
        <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,78,242,0.12) 0%, transparent 70%)', top: '-15%', left: '-10%', animation: 'orb1 14s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(240,180,41,0.08) 0%, transparent 70%)', bottom: '-10%', right: '-8%', animation: 'orb2 18s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(108,78,242,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(108,78,242,0.03) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      </div>

      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(var(--navy-rgb, 11,14,26), 0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none' }}>
          <LogoMark size={32} />
          <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.1rem', color: 'var(--text)' }}>
            Mega<span style={{ color: 'var(--purple2)' }}>Den</span>
          </span>
        </Link>
        <div style={{ display: 'flex', gap: '0.7rem' }}>
          <Link href="/login" style={{ padding: '0.5rem 1.1rem', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text)', fontSize: '0.88rem', fontWeight: 600, textDecoration: 'none', fontFamily: 'Outfit, sans-serif' }}>Log In</Link>
          <Link href="/signup" style={{ padding: '0.5rem 1.1rem', background: 'var(--purple)', borderRadius: '10px', color: '#fff', fontSize: '0.88rem', fontWeight: 700, textDecoration: 'none', fontFamily: 'Outfit, sans-serif' }}>Get Started</Link>
        </div>
      </nav>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 720, margin: '0 auto', padding: '3rem 1.4rem 5rem' }}>

        {/* HERO */}
        <div style={{ textAlign: 'center', marginBottom: '4rem', animation: mounted ? 'fadeUp 0.6s ease both' : 'none' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(108,78,242,0.1)', border: '1px solid rgba(108,78,242,0.25)', color: 'var(--purple2)', borderRadius: '50px', padding: '0.4rem 1.1rem', fontSize: '0.78rem', fontWeight: 500, marginBottom: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--purple2)', display: 'inline-block' }} />
            Our Story
          </div>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: 'clamp(2rem, 6vw, 3rem)', color: 'var(--text)', letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: '1.2rem' }}>
            Making Digital Access<br />
            <span style={{ color: 'var(--purple2)' }}>Simple</span> for Everyone
          </h1>
          <p style={{ fontSize: '1rem', color: 'var(--muted)', lineHeight: 1.75, fontFamily: 'Inter, sans-serif', maxWidth: 540, margin: '0 auto' }}>
            MegaDen Exchange was built with one goal — to give everyone fast, affordable access to the digital services they need, without the hassle.
          </p>
        </div>

        {/* MISSION */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '22px', padding: '2rem', marginBottom: '1.5rem', animation: mounted ? 'fadeUp 0.6s ease 0.1s both' : 'none', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: '8%', right: '8%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(108,78,242,0.4), rgba(240,180,41,0.2), transparent)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: '11px', background: 'rgba(108,78,242,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MissionIcon />
            </div>
            <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.05rem', color: 'var(--text)' }}>Our Mission</span>
          </div>
          <p style={{ fontSize: '0.92rem', color: 'var(--muted)', lineHeight: 1.8, fontFamily: 'Inter, sans-serif', margin: 0 }}>
            We believe that access to digital tools shouldn't be complicated or expensive. Whether you need a foreign number for verification, a boost for your social media presence, a secure VPN, or a premium digital subscription — MegaDen makes it instant, reliable, and affordable.
          </p>
        </div>

        {/* WHAT WE OFFER */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '22px', padding: '2rem', marginBottom: '1.5rem', animation: mounted ? 'fadeUp 0.6s ease 0.15s both' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.3rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: '11px', background: 'rgba(240,180,41,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ServicesIcon />
            </div>
            <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.05rem', color: 'var(--text)' }}>What We Offer</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
            {[
              { emoji: '📱', title: 'Foreign Numbers', desc: 'Virtual numbers from 40+ countries for any platform verification' },
              { emoji: '⚡', title: 'Account Boosting', desc: 'Real engagement boosts for TikTok, Instagram, YouTube & more' },
              { emoji: '🔒', title: 'VPN Access', desc: 'Secure, private browsing with 79+ global server locations' },
              { emoji: '🎬', title: 'Digital Subscriptions', desc: 'Premium streaming & software subscriptions at great prices' },
            ].map((item, i) => (
              <div key={i} className="value-card" style={{ background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: '14px', padding: '1rem' }}>
                <div style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>{item.emoji}</div>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)', marginBottom: '0.3rem' }}>{item.title}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* WHY US */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '22px', padding: '2rem', marginBottom: '1.5rem', animation: mounted ? 'fadeUp 0.6s ease 0.2s both' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.3rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: '11px', background: 'rgba(52,211,153,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <WhyIcon />
            </div>
            <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.05rem', color: 'var(--text)' }}>Why MegaDen?</span>
          </div>
          {[
            { title: 'Instant delivery', desc: 'Most orders are fulfilled in seconds — no waiting, no manual processing.' },
            { title: 'Wallet-based payments', desc: 'Fund once, spend flexibly. No repeated card entries or payment failures.' },
            { title: 'Trusted providers', desc: 'We partner with established global platforms to ensure reliable, working services every time.' },
            { title: 'Built for Nigerians', desc: 'Priced in Naira, funded via Paystack — designed for the Nigerian digital experience.' },
            { title: '24/7 support', desc: 'Real humans available via WhatsApp and email whenever you need help.' },
          ].map((item, i, arr) => (
            <div key={i} style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start', paddingBottom: i < arr.length - 1 ? '1rem' : 0, marginBottom: i < arr.length - 1 ? '1rem' : 0, borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)', marginBottom: '0.2rem' }}>{item.title}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.6 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* SOURCING NOTE */}
        <div style={{ background: 'linear-gradient(135deg, rgba(108,78,242,0.08), rgba(240,180,41,0.05))', border: '1px solid rgba(108,78,242,0.18)', borderRadius: '22px', padding: '1.8rem 2rem', marginBottom: '1.5rem', animation: mounted ? 'fadeUp 0.6s ease 0.25s both' : 'none' }}>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--text)', marginBottom: '0.6rem' }}>How We Source Our Services</div>
          <p style={{ fontSize: '0.86rem', color: 'var(--muted)', lineHeight: 1.75, fontFamily: 'Inter, sans-serif', margin: 0 }}>
            We work with a curated network of trusted global providers and platforms to deliver each service on MegaDen. Every provider is selected based on reliability, uptime, and delivery speed — so you get a consistent experience every time you order.
          </p>
        </div>

        {/* CONTACT */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '22px', padding: '2rem', marginBottom: '2rem', animation: mounted ? 'fadeUp 0.6s ease 0.3s both' : 'none' }}>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.05rem', color: 'var(--text)', marginBottom: '0.4rem' }}>Get in Touch</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '1.2rem', fontFamily: 'Inter, sans-serif' }}>We're always happy to help — reach us through any of these channels.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            <a href="https://wa.me/17656822078" target="_blank" rel="noopener noreferrer" className="contact-card" style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', padding: '0.9rem 1rem', background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: '12px', textDecoration: 'none' }}>
              <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ChatIcon color="#10b981" />
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>WhatsApp Support</div>
                <div style={{ fontSize: '0.73rem', color: 'var(--muted)' }}>Chat with us directly</div>
              </div>
            </a>
            <a href="mailto:support@megad.name.ng" className="contact-card" style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', padding: '0.9rem 1rem', background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: '12px', textDecoration: 'none' }}>
              <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(108,78,242,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MailIcon />
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Email Support</div>
                <div style={{ fontSize: '0.73rem', color: 'var(--muted)' }}>support@megad.name.ng</div>
              </div>
            </a>
            <a href="https://t.me/+3cblEJBfh1owOTJk" target="_blank" rel="noopener noreferrer" className="contact-card" style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', padding: '0.9rem 1rem', background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: '12px', textDecoration: 'none' }}>
              <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(70,135,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ChatIcon color="#4687ff" />
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Telegram Channel</div>
                <div style={{ fontSize: '0.73rem', color: 'var(--muted)' }}>Updates & announcements</div>
              </div>
            </a>
          </div>
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center', animation: mounted ? 'fadeUp 0.6s ease 0.35s both' : 'none' }}>
          <Link href="/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.9rem 2rem', background: 'var(--purple)', color: '#fff', borderRadius: '14px', textDecoration: 'none', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.95rem', boxShadow: '0 8px 28px rgba(108,78,242,0.3)' }}>
            Get Started — It's Free
          </Link>
          <div style={{ marginTop: '1rem', fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'Inter, sans-serif' }}>
            Already have an account? <Link href="/login" style={{ color: 'var(--purple2)', textDecoration: 'none', fontWeight: 600 }}>Log In</Link>
          </div>
        </div>
      </div>
    </main>
  )
}

function LogoMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: size * 0.25, flexShrink: 0 }}>
      <rect x="0" y="0" width="80" height="80" rx="20" fill="#0f0c24"/>
      <line x1="18" y1="58" x2="18" y2="22" stroke="#ffffff" strokeWidth="5" strokeLinecap="round"/>
      <line x1="18" y1="22" x2="40" y2="44" stroke="#ffffff" strokeWidth="5" strokeLinecap="round"/>
      <line x1="40" y1="44" x2="62" y2="22" stroke="#ffffff" strokeWidth="5" strokeLinecap="round"/>
      <line x1="62" y1="22" x2="62" y2="58" stroke="#ffffff" strokeWidth="5" strokeLinecap="round"/>
      <path d="M0 66 L80 66 L80 80 Q80 80 60 80 L20 80 Q0 80 0 80 Z" fill="#f0b429"/>
      <path d="M0 0 L5 0 L5 55 Q0 66 0 66 Z" fill="#6c4ef2"/>
    </svg>
  )
}
function MissionIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--purple2)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
}
function ServicesIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
}
function WhyIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
}
function ChatIcon({ color = 'currentColor' }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
}
function MailIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--purple2)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
}