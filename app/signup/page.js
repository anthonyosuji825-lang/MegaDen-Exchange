'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function SignUp() {
  const router = useRouter()
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm_password: '' })
  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState('')
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSocial = async (provider) => {
    setSocialLoading(provider)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
    if (error) { setError(error.message); setSocialLoading('') }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm_password) return setError('Passwords do not match')
    if (form.password.length < 6) return setError('Password must be at least 6 characters')
    setLoading(true)
    const supabase = createClient()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.full_name } }
    })
    if (signUpError) { setError(signUpError.message); setLoading(false); return }
    if (data.user) {
      const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase()
      await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: form.full_name,
        email: form.email,
        referral_code: referralCode,
        wallet_balance: 0
      })
      router.push('/dashboard')
    }
    setLoading(false)
  }

  return (
    <main style={{ background: 'var(--navy)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @keyframes orb1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(40px,-30px) scale(1.08)} 66%{transform:translate(-25px,20px) scale(0.94)} }
        @keyframes orb2 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-30px,20px) scale(1.1)} 66%{transform:translate(25px,-30px) scale(0.92)} }
        @keyframes orb3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(20px,15px) scale(1.05)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{opacity:0.4} 50%{opacity:0.7} 100%{opacity:0.4} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .auth-input {
          width:100%; padding:0.78rem 1rem 0.78rem 2.6rem;
          background:var(--navy2); border:1px solid var(--border);
          border-radius:12px; color:var(--text); font-size:0.92rem;
          outline:none; font-family:'Inter',sans-serif;
          transition:border-color 0.2s,box-shadow 0.2s,background 0.2s;
        }
        .auth-input:focus { border-color:var(--purple); background:var(--card2); box-shadow:0 0 0 3px rgba(108,78,242,0.12); }
        .auth-input::placeholder { color:var(--muted); opacity:0.6; }
        .social-btn {
          flex:1; display:flex; align-items:center; justify-content:center; gap:0.6rem;
          padding:0.78rem 0.5rem;
          background:var(--navy2); border:1px solid var(--border);
          border-radius:12px; color:var(--text); font-family:'Inter',sans-serif;
          font-size:0.85rem; font-weight:600; cursor:pointer;
          transition:background 0.2s,border-color 0.2s,transform 0.15s,box-shadow 0.15s;
        }
        .social-btn:hover { background:var(--card2); border-color:var(--purple); transform:translateY(-1px); box-shadow:0 4px 16px rgba(108,78,242,0.15); }
        .social-btn:active { transform:scale(0.98); }
        .submit-btn {
          width:100%; padding:0.9rem; border-radius:12px;
          background:var(--purple); color:#fff;
          font-family:'Outfit',sans-serif; font-size:0.95rem; font-weight:700;
          border:none; cursor:pointer;
          transition:transform 0.2s,box-shadow 0.2s,background 0.2s;
        }
        .submit-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 28px rgba(108,78,242,0.4); }
        .submit-btn:active:not(:disabled) { transform:translateY(0); }
        .submit-btn:disabled { opacity:0.7; cursor:not-allowed; }
        .auth-card { animation:fadeUp 0.5s ease both; }
        .eye-btn { position:absolute; right:0.9rem; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:var(--muted); padding:0.2rem; transition:color 0.15s; }
        .eye-btn:hover { color:var(--text); }
        .input-icon { position:absolute; left:0.85rem; top:50%; transform:translateY(-50%); color:var(--muted); pointer-events:none; }
      `}</style>

      {/* Background */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden' }}>
        <div style={{ position:'absolute', width:700, height:700, borderRadius:'50%', background:'radial-gradient(circle, rgba(108,78,242,0.18) 0%, transparent 65%)', top:'-20%', left:'-15%', animation:'orb1 14s ease-in-out infinite' }} />
        <div style={{ position:'absolute', width:600, height:600, borderRadius:'50%', background:'radial-gradient(circle, rgba(240,180,41,0.1) 0%, transparent 65%)', bottom:'-15%', right:'-10%', animation:'orb2 18s ease-in-out infinite' }} />
        <div style={{ position:'absolute', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle, rgba(108,78,242,0.1) 0%, transparent 65%)', top:'35%', right:'5%', animation:'orb3 22s ease-in-out infinite' }} />
      </div>
      <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(rgba(108,78,242,0.25) 1px, transparent 1px)', backgroundSize:'28px 28px', pointerEvents:'none', opacity:0.4 }} />
      <div style={{ position:'absolute', inset:0, backgroundImage:'repeating-linear-gradient(45deg, rgba(108,78,242,0.03) 0px, rgba(108,78,242,0.03) 1px, transparent 1px, transparent 40px)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', top:0, left:0, width:300, height:300, background:'radial-gradient(circle at 0% 0%, rgba(108,78,242,0.15) 0%, transparent 60%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:0, right:0, width:300, height:300, background:'radial-gradient(circle at 100% 100%, rgba(240,180,41,0.1) 0%, transparent 60%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', top:'50%', left:0, right:0, height:'1px', background:'linear-gradient(90deg, transparent 0%, rgba(108,78,242,0.15) 30%, rgba(240,180,41,0.1) 70%, transparent 100%)', pointerEvents:'none', animation:'shimmer 4s ease-in-out infinite' }} />

      {/* Logo */}
      <Link href="/" style={{ display:'flex', alignItems:'center', gap:'0.6rem', textDecoration:'none', marginBottom:'1.6rem', position:'relative', zIndex:1 }}>
        <LogoMark size={36} />
        <span style={{ fontFamily:'Outfit, sans-serif', fontWeight:800, fontSize:'1.3rem', color:'var(--text)', letterSpacing:'-0.3px' }}>
          Mega<span style={{ color:'var(--purple2)' }}>Den</span>
        </span>
      </Link>

      {/* Card */}
      <div className="auth-card" style={{
        background:'var(--card)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)',
        border:'1px solid var(--border)', borderRadius:'24px', padding:'2rem',
        width:'100%', maxWidth:'420px', position:'relative', zIndex:1,
        boxShadow:'0 24px 64px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}>
        <div style={{ position:'absolute', top:0, left:'8%', right:'8%', height:'1px', background:'linear-gradient(90deg, transparent, rgba(108,78,242,0.5), rgba(240,180,41,0.3), transparent)' }} />

        <h1 style={{ fontFamily:'Outfit, sans-serif', fontSize:'1.6rem', fontWeight:800, color:'var(--text)', marginBottom:'0.3rem', letterSpacing:'-0.5px' }}>Create Account</h1>
        <p style={{ color:'var(--muted)', fontSize:'0.85rem', marginBottom:'1.6rem', fontFamily:'Inter, sans-serif' }}>Join MegaDen and start buying today</p>

        {/* ── SOCIAL BUTTONS ── */}
        <div style={{ display:'flex', gap:'0.7rem', marginBottom:'1.4rem' }}>
          <button className="social-btn" onClick={() => handleSocial('google')} disabled={!!socialLoading}>
            {socialLoading === 'google'
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation:'spin 0.8s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              : <GoogleIcon />
            }
            Google
          </button>
          <button className="social-btn" onClick={() => handleSocial('apple')} disabled={!!socialLoading}>
            {socialLoading === 'apple'
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation:'spin 0.8s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              : <AppleIcon />
            }
            Apple
          </button>
        </div>

        {/* Divider */}
        <div style={{ display:'flex', alignItems:'center', gap:'0.85rem', marginBottom:'1.4rem' }}>
          <div style={{ flex:1, height:'1px', background:'var(--border)' }} />
          <span style={{ fontSize:'0.72rem', color:'var(--muted)', fontFamily:'Inter, sans-serif', whiteSpace:'nowrap' }}>or sign up with email</span>
          <div style={{ flex:1, height:'1px', background:'var(--border)' }} />
        </div>

        {error && (
          <div style={{ background:'rgba(220,50,50,0.1)', border:'1px solid rgba(220,50,50,0.3)', color:'#ff6b6b', borderRadius:'12px', padding:'0.75rem 1rem', fontSize:'0.84rem', marginBottom:'1.1rem', fontFamily:'Inter, sans-serif' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'0.9rem' }}>
          {/* Full Name */}
          <div>
            <label style={{ fontSize:'0.78rem', color:'var(--muted)', display:'block', marginBottom:'0.4rem', fontFamily:'Inter, sans-serif', fontWeight:500 }}>Full Name</label>
            <div style={{ position:'relative' }}>
              <span className="input-icon"><UserIcon /></span>
              <input name="full_name" type="text" placeholder="John Doe" required value={form.full_name} onChange={handleChange} className="auth-input" />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={{ fontSize:'0.78rem', color:'var(--muted)', display:'block', marginBottom:'0.4rem', fontFamily:'Inter, sans-serif', fontWeight:500 }}>Password</label>
            <div style={{ position:'relative' }}>
              <span className="input-icon"><LockIcon /></span>
              <input name="password" type={showPass ? 'text' : 'password'} placeholder="Min. 6 characters" required value={form.password} onChange={handleChange} className="auth-input" style={{ paddingRight:'2.8rem' }} />
              <button type="button" className="eye-btn" onClick={() => setShowPass(p => !p)}>
                {showPass ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label style={{ fontSize:'0.78rem', color:'var(--muted)', display:'block', marginBottom:'0.4rem', fontFamily:'Inter, sans-serif', fontWeight:500 }}>Confirm Password</label>
            <div style={{ position:'relative' }}>
              <span className="input-icon"><LockIcon /></span>
              <input name="confirm_password" type={showConfirm ? 'text' : 'password'} placeholder="Repeat your password" required value={form.confirm_password} onChange={handleChange} className="auth-input" style={{ paddingRight:'2.8rem' }} />
              <button type="button" className="eye-btn" onClick={() => setShowConfirm(p => !p)}>
                {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {/* Email — last */}
          <div>
            <label style={{ fontSize:'0.78rem', color:'var(--muted)', display:'block', marginBottom:'0.4rem', fontFamily:'Inter, sans-serif', fontWeight:500 }}>Email Address</label>
            <div style={{ position:'relative' }}>
              <span className="input-icon"><MailIcon /></span>
              <input name="email" type="email" placeholder="you@example.com" required value={form.email} onChange={handleChange} className="auth-input" />
            </div>
          </div>

          <button type="submit" disabled={loading} className="submit-btn" style={{ marginTop:'0.3rem' }}>
            {loading
              ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation:'spin 0.8s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                  Creating Account…
                </span>
              : 'Create Account →'
            }
          </button>
        </form>

        <div style={{ display:'flex', justifyContent:'center', gap:'1.5rem', marginTop:'1.4rem', paddingTop:'1.1rem', borderTop:'1px solid var(--border)' }}>
          {['🔒 Secure', '⚡ Instant', '24/7 Support'].map(b => (
            <span key={b} style={{ fontSize:'0.7rem', color:'var(--muted)', fontFamily:'Inter, sans-serif' }}>{b}</span>
          ))}
        </div>

        <p style={{ textAlign:'center', marginTop:'1.1rem', fontSize:'0.84rem', color:'var(--muted)', fontFamily:'Inter, sans-serif' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color:'var(--purple2)', textDecoration:'none', fontWeight:600 }}>Log In</Link>
        </p>
      </div>

      <p style={{ marginTop:'1.4rem', fontSize:'0.74rem', color:'var(--muted)', opacity:0.5, fontFamily:'Inter, sans-serif', position:'relative', zIndex:1 }}>
        Trusted by 15,000+ users worldwide
      </p>
    </main>
  )
}

function LogoMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius:size*0.25, flexShrink:0 }}>
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
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}
function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--text)">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  )
}
function UserIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> }
function MailIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> }
function LockIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> }
function EyeIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> }
function EyeOffIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> }