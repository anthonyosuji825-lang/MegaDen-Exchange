'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

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

const stats = [
  { num: '15K+', label: 'Happy Customers' },
  { num: '50+', label: 'Countries' },
  { num: '99%', label: 'Success Rate' },
  { num: '24/7', label: 'Support' },
]

const services = [
  { icon: <PhoneIcon />, title: 'Foreign Numbers', desc: 'Real virtual numbers from USA, UK, Canada & 40+ countries for any SMS verification.', tag: '40+ Countries', color: 'rgba(108,78,242,0.12)', tagColor: 'var(--purple2)' },
  { icon: <LogIcon />, title: 'Social Media Logs', desc: 'Verified accounts across all major platforms — Facebook, Instagram, TikTok, Gmail & more.', tag: 'All Platforms', color: 'rgba(240,180,41,0.1)', tagColor: 'var(--gold)' },
  { icon: <BoostIcon />, title: 'Account Boosting', desc: 'Grow your social media presence with real follower boosts and engagement packages.', tag: 'All Platforms', color: 'rgba(29,158,117,0.1)', tagColor: '#34d399' },
]

const platforms = [
  { name: 'Facebook', color: '#1877f2' },
  { name: 'Instagram', color: '#e1306c' },
  { name: 'Twitter / X', color: '#e7e7e7' },
  { name: 'TikTok', color: '#ff0050' },
  { name: 'Snapchat', color: '#fffc00' },
  { name: 'Gmail', color: '#ea4335' },
  { name: 'Telegram', color: '#0088cc' },
  { name: 'WhatsApp', color: '#25d366' },
  { name: 'Threads', color: '#833ab4' },
  { name: 'LinkedIn', color: '#0a66c2' },
]

const steps = [
  { num: '01', title: 'Create Your Account', desc: 'Sign up in seconds. Your account comes with a built-in wallet and full order history.' },
  { num: '02', title: 'Fund Your Wallet', desc: 'Top up via Paystack or Flutterwave — card, bank transfer, or USSD.' },
  { num: '03', title: 'Browse & Purchase', desc: 'Pick your desired numbers, social media logs, or boosting package instantly.' },
  { num: '04', title: 'Instant Delivery', desc: 'Receive your purchase directly in your dashboard. No waiting, no stress.' },
]

export default function Home() {
  const [mounted, setMounted] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeService, setActiveService] = useState(null)

  useEffect(() => {
    setMounted(true)
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <main style={{ background: 'var(--navy)', minHeight: '100vh', overflowX: 'hidden' }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes orb1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.05); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
        @keyframes orb2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-25px, 15px) scale(1.08); }
          66% { transform: translate(20px, -25px) scale(0.92); }
        }
        @keyframes countUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .nav-link {
          color: var(--muted);
          text-decoration: none;
          font-size: 0.88rem;
          font-weight: 500;
          transition: color 0.2s;
          position: relative;
        }
        .nav-link::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          width: 0;
          height: 1.5px;
          background: var(--purple2);
          transition: width 0.25s ease;
        }
        .nav-link:hover { color: var(--text); }
        .nav-link:hover::after { width: 100%; }
        .btn-primary {
          padding: 0.75rem 1.8rem;
          borderRadius: 10px;
          background: var(--purple);
          color: #fff;
          border: none;
          font-family: 'Outfit', sans-serif;
          font-size: 0.92rem;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          display: inline-block;
          transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(108,78,242,0.4);
          background: var(--purple2);
        }
        .btn-outline {
          padding: 0.75rem 1.8rem;
          border-radius: 10px;
          background: transparent;
          color: var(--text);
          border: 1px solid rgba(255,255,255,0.15);
          font-family: 'Outfit', sans-serif;
          font-size: 0.92rem;
          font-weight: 500;
          cursor: pointer;
          text-decoration: none;
          display: inline-block;
          transition: transform 0.2s, border-color 0.2s, background 0.2s;
        }
        .btn-outline:hover {
          transform: translateY(-2px);
          border-color: rgba(255,255,255,0.3);
          background: rgba(255,255,255,0.05);
        }
        .service-card {
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
          cursor: default;
        }
        .service-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.2);
          border-color: rgba(108,78,242,0.4) !important;
        }
        .platform-chip {
          transition: transform 0.2s, background 0.2s, border-color 0.2s;
          cursor: default;
        }
        .platform-chip:hover {
          transform: translateY(-2px);
          background: var(--card2) !important;
          border-color: rgba(108,78,242,0.3) !important;
        }
        .step-item {
          transition: transform 0.2s, background 0.2s;
        }
        .step-item:hover {
          transform: translateX(6px);
        }
        .cta-btn {
          transition: transform 0.2s, box-shadow 0.2s;
          cursor: pointer;
        }
        .cta-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 36px rgba(240,180,41,0.4);
        }
        .marquee-track {
          display: flex;
          gap: 0.8rem;
          animation: marquee 25s linear infinite;
          width: max-content;
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* NAV */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1rem 2.5rem', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        background: scrolled ? 'rgba(11,14,26,0.95)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--border)' : 'none',
        transition: 'all 0.3s ease',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none' }}>
          <LogoMark size={34} />
          <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.15rem', color: 'var(--text)', letterSpacing: '-0.3px' }}>
            Mega<span style={{ color: 'var(--purple2)' }}>Den</span>
          </span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }} className="nav-links-desktop">
          {[['#services', 'Services'], ['#platforms', 'Platforms'], ['#how', 'How it works']].map(([href, label]) => (
            <a key={href} href={href} className="nav-link">{label}</a>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.7rem' }}>
          <Link href="/login" style={{ padding: '0.5rem 1.1rem', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.85rem', fontWeight: 500, textDecoration: 'none', transition: 'all 0.2s', fontFamily: 'Inter, sans-serif' }}
            onMouseEnter={e => { e.target.style.borderColor = 'var(--purple)'; e.target.style.color = 'var(--purple2)' }}
            onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text)' }}>
            Log In
          </Link>
          <Link href="/signup" className="btn-primary" style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem' }}>
            Get Started
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '8rem 2rem 4rem', position: 'relative', overflow: 'hidden' }}>

        {/* Animated orbs */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,78,242,0.2) 0%, transparent 70%)', top: '-10%', left: '-10%', animation: 'orb1 12s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(240,180,41,0.12) 0%, transparent 70%)', bottom: '-5%', right: '-5%', animation: 'orb2 15s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,78,242,0.1) 0%, transparent 70%)', top: '40%', right: '10%', animation: 'orb1 18s ease-in-out infinite reverse' }} />
        </div>

        {/* Grid pattern */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(108,78,242,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(108,78,242,0.03) 1px, transparent 1px)', backgroundSize: '60px 60px', pointerEvents: 'none' }} />

        {/* Badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(108,78,242,0.1)', border: '1px solid rgba(108,78,242,0.25)', color: 'var(--purple2)', borderRadius: '50px', padding: '0.4rem 1.1rem', fontSize: '0.78rem', fontWeight: 500, marginBottom: '2rem', animation: mounted ? 'fadeUp 0.6s ease both' : 'none', fontFamily: 'Inter, sans-serif', letterSpacing: '0.3px' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--purple2)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
          Trusted Digital Exchange Platform
        </div>

        {/* Headline */}
        <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(2.8rem, 7vw, 5rem)', fontWeight: 900, lineHeight: 1.05, letterSpacing: '-2px', marginBottom: '1.5rem', maxWidth: '900px', color: 'var(--text)', animation: mounted ? 'fadeUp 0.6s ease 0.1s both' : 'none' }}>
          Your Gateway to{' '}
          <span style={{ color: 'var(--purple2)', position: 'relative' }}>Foreign Numbers</span>
          {' '}&amp;{' '}
          <span style={{ color: 'var(--gold)' }}>Social Accounts</span>
        </h1>

        {/* Subtext */}
        <p style={{ color: 'var(--muted)', fontSize: '1.1rem', maxWidth: '560px', lineHeight: 1.75, marginBottom: '2.5rem', fontFamily: 'Inter, sans-serif', fontWeight: 400, animation: mounted ? 'fadeUp 0.6s ease 0.2s both' : 'none' }}>
          Buy verified foreign virtual numbers, social media logs, and boost your online presence — fast, secure, and affordable.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '4rem', animation: mounted ? 'fadeUp 0.6s ease 0.3s both' : 'none' }}>
          <Link href="/signup" className="btn-primary" style={{ padding: '0.85rem 2.2rem', fontSize: '0.95rem' }}>
            Start Shopping →
          </Link>
          <a href="#services" className="btn-outline" style={{ padding: '0.85rem 2.2rem', fontSize: '0.95rem' }}>
            View Services
          </a>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '3rem', flexWrap: 'wrap', justifyContent: 'center', animation: mounted ? 'fadeUp 0.6s ease 0.4s both' : 'none' }}>
          {stats.map((s, i) => (
            <div key={s.label} style={{ textAlign: 'center', animation: mounted ? `countUp 0.5s ease ${0.4 + i * 0.1}s both` : 'none' }}>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2rem', fontWeight: 800, color: 'var(--gold)', lineHeight: 1 }}>{s.num}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.3rem', fontFamily: 'Inter, sans-serif' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Scroll indicator */}
        <div style={{ position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', animation: 'float 2.5s ease-in-out infinite', opacity: 0.5 }}>
          <div style={{ width: 1, height: 40, background: 'linear-gradient(to bottom, transparent, var(--purple2))' }} />
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--purple2)' }} />
        </div>
      </section>

      {/* MARQUEE PLATFORMS */}
      <div style={{ padding: '2rem 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', overflow: 'hidden', background: 'rgba(108,78,242,0.03)' }}>
        <div className="marquee-track">
          {[...platforms, ...platforms].map((p, i) => (
            <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '50px', padding: '0.5rem 1.2rem', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', flexShrink: 0, fontFamily: 'Inter, sans-serif' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block', flexShrink: 0 }} />
              {p.name}
            </div>
          ))}
        </div>
      </div>

      {/* SERVICES */}
      <section id="services" style={{ padding: '7rem 2rem', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <div style={{ fontSize: '0.72rem', letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--purple2)', fontWeight: 600, marginBottom: '0.8rem', fontFamily: 'Inter, sans-serif' }}>What we offer</div>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-1px', marginBottom: '1rem' }}>Everything You Need,<br />All in One Place</h2>
          <p style={{ color: 'var(--muted)', fontSize: '1rem', maxWidth: '480px', margin: '0 auto', lineHeight: 1.7, fontFamily: 'Inter, sans-serif' }}>Access premium digital services from across the globe — no hassle, no borders.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {services.map((s, i) => (
            <div key={s.title} className="service-card"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '20px', padding: '2rem', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, var(--purple), var(--gold))`, opacity: 0.6 }} />
              <div style={{ width: 52, height: 52, borderRadius: '14px', background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.2rem', color: s.tagColor }}>{s.icon}</div>
              <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.15rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.6rem' }}>{s.title}</h3>
              <p style={{ color: 'var(--muted)', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '1.2rem', fontFamily: 'Inter, sans-serif' }}>{s.desc}</p>
              <span style={{ display: 'inline-block', background: s.color, border: `1px solid ${s.tagColor}33`, color: s.tagColor, borderRadius: '50px', padding: '0.25rem 0.9rem', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>{s.tag}</span>
            </div>
          ))}
        </div>
      </section>

      {/* PLATFORMS */}
      <section id="platforms" style={{ background: 'var(--navy2)', padding: '6rem 2rem', textAlign: 'center' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ fontSize: '0.72rem', letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--purple2)', fontWeight: 600, marginBottom: '0.8rem', fontFamily: 'Inter, sans-serif' }}>Supported platforms</div>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-1px', marginBottom: '0.8rem' }}>Every Major Platform Covered</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.97rem', marginBottom: '3rem', fontFamily: 'Inter, sans-serif' }}>We stock accounts and services for all the platforms that matter.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem', justifyContent: 'center' }}>
            {platforms.map((p, i) => (
              <div key={p.name} className="platform-chip"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '50px', padding: '0.55rem 1.3rem', fontSize: '0.88rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: p.color, display: 'inline-block', flexShrink: 0 }} />
                {p.name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" style={{ padding: '7rem 2rem', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <div style={{ fontSize: '0.72rem', letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--purple2)', fontWeight: 600, marginBottom: '0.8rem', fontFamily: 'Inter, sans-serif' }}>Simple process</div>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-1px' }}>How MegaDen Exchange Works</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {steps.map((step, i) => (
            <div key={step.num} className="step-item"
              style={{ display: 'flex', gap: '1.8rem', alignItems: 'flex-start', padding: '1.8rem', borderRadius: '16px', borderBottom: i < steps.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '3rem', fontWeight: 900, color: 'rgba(108,78,242,0.15)', minWidth: '60px', lineHeight: 1 }}>{step.num}</div>
              <div>
                <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.4rem' }}>{step.title}</h3>
                <p style={{ color: 'var(--muted)', fontSize: '0.88rem', lineHeight: 1.7, fontFamily: 'Inter, sans-serif' }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '5rem 2rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,78,242,0.12) 0%, transparent 70%)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
        </div>
        <div style={{ maxWidth: '660px', margin: '0 auto', background: 'var(--card2)', border: '1px solid rgba(108,78,242,0.25)', borderRadius: '28px', padding: '4rem 3rem', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px', background: 'linear-gradient(90deg, transparent, var(--purple), transparent)' }} />
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2.5rem', marginBottom: '0.8rem', animation: 'float 3s ease-in-out infinite' }}>⚡</div>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-1px', marginBottom: '1rem' }}>Ready to Get Started?</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.97rem', marginBottom: '2.2rem', lineHeight: 1.7, fontFamily: 'Inter, sans-serif' }}>
            Join thousands of users who trust MegaDen Exchange for fast, verified, and affordable digital services.
          </p>
          <Link href="/signup" className="cta-btn"
            style={{ padding: '1rem 2.8rem', borderRadius: '12px', background: 'var(--gold)', color: '#0b0e1a', fontSize: '1rem', fontWeight: 800, textDecoration: 'none', display: 'inline-block', fontFamily: 'Outfit, sans-serif' }}>
            Create Free Account
          </Link>
          <div style={{ marginTop: '1.2rem', fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'Inter, sans-serif' }}>
            No hidden fees &nbsp;·&nbsp; Instant delivery &nbsp;·&nbsp; 24/7 support
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '2.5rem 2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none' }}>
          <LogoMark size={28} />
          <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>
            Mega<span style={{ color: 'var(--purple2)' }}>Den</span>
          </span>
        </Link>
        <div style={{ color: 'var(--muted)', fontSize: '0.8rem', fontFamily: 'Inter, sans-serif' }}>© 2026 MegaDen Exchange. All rights reserved.</div>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          {['Privacy', 'Terms', 'Support'].map(link => (
            <a key={link} href="#" style={{ color: 'var(--muted)', fontSize: '0.82rem', textDecoration: 'none', fontFamily: 'Inter, sans-serif', transition: 'color 0.2s' }}
              onMouseEnter={e => e.target.style.color = 'var(--text)'}
              onMouseLeave={e => e.target.style.color = 'var(--muted)'}>
              {link}
            </a>
          ))}
        </div>
      </footer>
    </main>
  )
}
function PhoneIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1"/></svg>
}
function LogIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
}
function BoostIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
}