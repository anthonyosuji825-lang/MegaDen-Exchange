'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function Login() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })
    if (loginError) { setError(loginError.message); setLoading(false); return }
    router.push('/dashboard')
    setLoading(false)
  }

  return (
    <main style={{ background: 'var(--navy)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @keyframes orb1 {
          0%, 100% { transform: translate(0,0) scale(1); }
          33% { transform: translate(40px,-30px) scale(1.08); }
          66% { transform: translate(-25px,20px) scale(0.94); }
        }
        @keyframes orb2 {
          0%, 100% { transform: translate(0,0) scale(1); }
          33% { transform: translate(-30px,20px) scale(1.1); }
          66% { transform: translate(25px,-30px) scale(0.92); }
        }
        @keyframes orb3 {
          0%, 100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(20px,15px) scale(1.05); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { opacity: 0.4; }
          50% { opacity: 0.7; }
          100% { opacity: 0.4; }
        }
        .auth-input {
          width: 100%;
          padding: 0.78rem 1rem;
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--border);
          border-radius: 12px;
          color: var(--text);
          font-size: 0.92rem;
          outline: none;
          font-family: 'Inter', sans-serif;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .auth-input:focus {
          border-color: var(--purple);
          background: rgba(108,78,242,0.06);
          box-shadow: 0 0 0 3px rgba(108,78,242,0.12);
        }
        .auth-input::placeholder { color: var(--muted); opacity: 0.6; }
        .submit-btn {
          width: 100%;
          margin-top: 0.5rem;
          padding: 0.88rem;
          border-radius: 12px;
          background: var(--purple);
          color: #fff;
          font-family: 'Outfit', sans-serif;
          font-size: 0.95rem;
          font-weight: 700;
          border: none;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
          letter-spacing: 0.2px;
        }
        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(108,78,242,0.4);
          background: var(--purple2);
        }
        .submit-btn:active:not(:disabled) { transform: translateY(0); }
        .submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .auth-card {
          animation: fadeUp 0.5s ease both;
        }
      `}</style>

      {/* ── PREMIUM BACKGROUND ── */}
      {/* Animated radial orbs */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,78,242,0.18) 0%, transparent 65%)', top: '-20%', left: '-15%', animation: 'orb1 14s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(240,180,41,0.1) 0%, transparent 65%)', bottom: '-15%', right: '-10%', animation: 'orb2 18s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,78,242,0.1) 0%, transparent 65%)', top: '35%', right: '5%', animation: 'orb3 22s ease-in-out infinite' }} />
      </div>

      {/* Fine dot grid */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(108,78,242,0.25) 1px, transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none', opacity: 0.4 }} />

      {/* Subtle diagonal lines */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(45deg, rgba(108,78,242,0.03) 0px, rgba(108,78,242,0.03) 1px, transparent 1px, transparent 40px)', pointerEvents: 'none' }} />

      {/* Corner glow accents */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: 300, height: 300, background: 'radial-gradient(circle at 0% 0%, rgba(108,78,242,0.15) 0%, transparent 60%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 0, right: 0, width: 300, height: 300, background: 'radial-gradient(circle at 100% 100%, rgba(240,180,41,0.1) 0%, transparent 60%)', pointerEvents: 'none' }} />

      {/* Horizontal shimmer line */}
      <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent 0%, rgba(108,78,242,0.15) 30%, rgba(240,180,41,0.1) 70%, transparent 100%)', pointerEvents: 'none', animation: 'shimmer 4s ease-in-out infinite' }} />

      {/* ── LOGO ── */}
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none', marginBottom: '2rem', position: 'relative', zIndex: 1 }}>
        <LogoMark size={36} />
        <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.3rem', color: 'var(--text)', letterSpacing: '-0.3px' }}>
          Mega<span style={{ color: 'var(--purple2)' }}>Den</span>
        </span>
      </Link>

      {/* ── CARD ── */}
      <div className="auth-card" style={{
        background: 'rgba(22,27,48,0.75)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(108,78,242,0.22)',
        borderRadius: '24px',
        padding: '2.5rem',
        width: '100%',
        maxWidth: '440px',
        position: 'relative',
        zIndex: 1,
        boxShadow: '0 24px 64px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}>
        {/* Card top shimmer line */}
        <div style={{ position: 'absolute', top: 0, left: '8%', right: '8%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(108,78,242,0.5), rgba(240,180,41,0.3), transparent)', borderRadius: '50%' }} />

        <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.65rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.35rem', letterSpacing: '-0.5px' }}>Welcome Back</h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.88rem', marginBottom: '2rem', fontFamily: 'Inter, sans-serif' }}>Log in to your MegaDen Exchange account</p>

        {error && (
          <div style={{ background: 'rgba(220,50,50,0.1)', border: '1px solid rgba(220,50,50,0.3)', color: '#ff6b6b', borderRadius: '12px', padding: '0.75rem 1rem', fontSize: '0.85rem', marginBottom: '1.2rem', fontFamily: 'Inter, sans-serif' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'block', marginBottom: '0.45rem', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>Email Address</label>
            <input name="email" type="email" placeholder="you@example.com" required value={form.email} onChange={handleChange} className="auth-input" />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--muted)', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>Password</label>
              <Link href="/forgot-password" style={{ fontSize: '0.78rem', color: 'var(--purple2)', textDecoration: 'none', fontFamily: 'Inter, sans-serif' }}>Forgot password?</Link>
            </div>
            <input name="password" type="password" placeholder="Your password" required value={form.password} onChange={handleChange} className="auth-input" />
          </div>

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Logging in...' : 'Log In →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--muted)', fontFamily: 'Inter, sans-serif' }}>
          Don&apos;t have an account?{' '}
          <Link href="/signup" style={{ color: 'var(--purple2)', textDecoration: 'none', fontWeight: 600 }}>Sign Up</Link>
        </p>
      </div>

      {/* Bottom tagline */}
      <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--muted)', opacity: 0.5, fontFamily: 'Inter, sans-serif', position: 'relative', zIndex: 1 }}>
        Trusted by 15,000+ users worldwide
      </p>
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