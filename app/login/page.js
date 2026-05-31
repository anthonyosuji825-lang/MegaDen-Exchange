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
    <main style={{ background: 'var(--navy)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>

      {/* LOGO */}
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none', marginBottom: '2rem' }}>
  <LogoMark size={36} />
  <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.3rem', color: 'var(--text)', letterSpacing: '-0.3px' }}>
    Mega<span style={{ color: 'var(--purple2)' }}>Den</span>
  </span>
</Link>

      {/* CARD */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '20px', padding: '2.5rem', width: '100%', maxWidth: '440px' }}>
        <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginBottom: '0.4rem' }}>Welcome Back</h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.88rem', marginBottom: '2rem' }}>Log in to your MegaDen Exchange account</p>

        {error && (
          <div style={{ background: 'rgba(220,50,50,0.1)', border: '1px solid rgba(220,50,50,0.3)', color: '#ff6b6b', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.85rem', marginBottom: '1.2rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.82rem', color: 'var(--muted)', display: 'block', marginBottom: '0.4rem' }}>Email Address</label>
            <input
              name="email" type="email" placeholder="you@example.com" required
              value={form.email} onChange={handleChange}
              style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: '10px', color: '#fff', fontSize: '0.92rem', outline: 'none' }}
            />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>Password</label>
              <Link href="/forgot-password" style={{ fontSize: '0.78rem', color: 'var(--purple2)', textDecoration: 'none' }}>Forgot password?</Link>
            </div>
            <input
              name="password" type="password" placeholder="Your password" required
              value={form.password} onChange={handleChange}
              style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: '10px', color: '#fff', fontSize: '0.92rem', outline: 'none' }}
            />
          </div>

          <button type="submit" disabled={loading} style={{
            marginTop: '0.5rem', padding: '0.85rem', borderRadius: '10px',
            background: loading ? 'var(--purple2)' : 'var(--purple)',
            color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: '0.95rem',
            fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer'
          }}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
          Don&apos;t have an account?{' '}
          <Link href="/signup" style={{ color: 'var(--purple2)', textDecoration: 'none', fontWeight: 500 }}>Sign Up</Link>
        </p>
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