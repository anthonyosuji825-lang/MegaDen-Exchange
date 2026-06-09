'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function ResetPassword() {
  const router = useRouter()
  const [form, setForm] = useState({ password: '', confirm_password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [validSession, setValidSession] = useState(false)
  const [checking, setChecking] = useState(true)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // Supabase puts the reset token in the URL hash — we need to detect a valid session
    const supabase = createClient()
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setValidSession(true)
      }
      setChecking(false)
    })
  }, [])

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm_password) return setError('Passwords do not match')
    if (form.password.length < 6) return setError('Password must be at least 6 characters')
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: form.password })
    if (error) { setError(error.message); setLoading(false); return }
    setSuccess(true)
    setLoading(false)
    // Redirect to login after 3 seconds
    setTimeout(() => router.push('/login'), 3000)
  }

  return (
    <main style={{ background:'var(--navy)', minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'1.5rem', position:'relative', overflow:'hidden' }}>
      <style>{`
        @keyframes orb1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(40px,-30px) scale(1.08)} 66%{transform:translate(-25px,20px) scale(0.94)} }
        @keyframes orb2 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-30px,20px) scale(1.1)} 66%{transform:translate(25px,-30px) scale(0.92)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{opacity:0.4} 50%{opacity:0.7} 100%{opacity:0.4} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes successPop { 0%{transform:scale(0);opacity:0} 70%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes checkDraw { from{stroke-dashoffset:50} to{stroke-dashoffset:0} }
        .auth-input {
          width:100%; padding:0.78rem 2.8rem 0.78rem 2.6rem;
          background:rgba(255,255,255,0.04); border:1px solid var(--border);
          border-radius:12px; color:var(--text); font-size:0.92rem;
          outline:none; font-family:'Inter',sans-serif;
          transition:border-color 0.2s,box-shadow 0.2s,background 0.2s;
        }
        .auth-input:focus { border-color:var(--purple); background:rgba(108,78,242,0.06); box-shadow:0 0 0 3px rgba(108,78,242,0.12); }
        .auth-input::placeholder { color:var(--muted); opacity:0.6; }
        .submit-btn {
          width:100%; padding:0.9rem; border-radius:12px;
          background:var(--purple); color:#fff;
          font-family:'Outfit',sans-serif; font-size:0.95rem; font-weight:700;
          border:none; cursor:pointer;
          transition:transform 0.2s,box-shadow 0.2s;
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
        background:'rgba(22,27,48,0.75)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)',
        border:'1px solid rgba(108,78,242,0.22)', borderRadius:'24px', padding:'2rem',
        width:'100%', maxWidth:'420px', position:'relative', zIndex:1,
        boxShadow:'0 24px 64px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}>
        <div style={{ position:'absolute', top:0, left:'8%', right:'8%', height:'1px', background:'linear-gradient(90deg, transparent, rgba(108,78,242,0.5), rgba(240,180,41,0.3), transparent)' }} />

        {/* Checking session */}
        {checking ? (
          <div style={{ textAlign:'center', padding:'2rem 0' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2.5" strokeLinecap="round" style={{ animation:'spin 0.8s linear infinite' }}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
            <p style={{ color:'var(--muted)', fontSize:'0.85rem', fontFamily:'Inter, sans-serif', marginTop:'0.75rem' }}>Verifying reset link…</p>
          </div>

        ) : success ? (
          /* ── SUCCESS STATE ── */
          <div style={{ textAlign:'center', padding:'1rem 0' }}>
            <div style={{ animation:'successPop 0.5s cubic-bezier(0.175,0.885,0.32,1.275) both', marginBottom:'1.4rem' }}>
              <div style={{
                width:72, height:72, borderRadius:'50%', margin:'0 auto',
                background:'rgba(52,211,153,0.12)', border:'1px solid rgba(52,211,153,0.3)',
                display:'flex', alignItems:'center', justifyContent:'center',
                animation:'float 3s ease-in-out infinite',
                boxShadow:'0 8px 32px rgba(52,211,153,0.2)',
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" strokeDasharray="50" strokeDashoffset="0" style={{ animation:'checkDraw 0.4s ease 0.3s both' }}/>
                </svg>
              </div>
            </div>

            <h1 style={{ fontFamily:'Outfit, sans-serif', fontSize:'1.5rem', fontWeight:800, color:'var(--text)', marginBottom:'0.5rem', letterSpacing:'-0.3px' }}>
              Password Updated!
            </h1>
            <p style={{ color:'var(--muted)', fontSize:'0.86rem', lineHeight:1.6, fontFamily:'Inter, sans-serif', marginBottom:'1.5rem' }}>
              Your password has been reset successfully. Redirecting you to login…
            </p>

            <div style={{ height:3, borderRadius:99, background:'var(--border)', overflow:'hidden', marginBottom:'1.5rem' }}>
              <div style={{
                height:'100%', borderRadius:99, background:'#34d399',
                animation:'shimmer 3s linear forwards',
                width:'100%',
              }} />
            </div>

            <Link href="/login" style={{
              display:'inline-flex', alignItems:'center', gap:'0.4rem',
              padding:'0.75rem 1.5rem',
              background:'var(--purple)', color:'#fff', textDecoration:'none',
              borderRadius:'12px', fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.88rem',
            }}>
              Go to Login →
            </Link>
          </div>

        ) : !validSession ? (
          /* ── INVALID/EXPIRED LINK ── */
          <div style={{ textAlign:'center', padding:'1rem 0' }}>
            <div style={{ width:64, height:64, borderRadius:'18px', margin:'0 auto 1.2rem', background:'rgba(244,63,94,0.1)', border:'1px solid rgba(244,63,94,0.25)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
            <h1 style={{ fontFamily:'Outfit, sans-serif', fontSize:'1.5rem', fontWeight:800, color:'var(--text)', marginBottom:'0.5rem' }}>Link Expired</h1>
            <p style={{ color:'var(--muted)', fontSize:'0.86rem', lineHeight:1.6, fontFamily:'Inter, sans-serif', marginBottom:'1.5rem' }}>
              This reset link has expired or already been used. Request a new one.
            </p>
            <Link href="/forgot-password" style={{
              display:'inline-flex', alignItems:'center', gap:'0.4rem',
              padding:'0.75rem 1.5rem',
              background:'var(--purple)', color:'#fff', textDecoration:'none',
              borderRadius:'12px', fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.88rem',
            }}>
              Request New Link →
            </Link>
          </div>

        ) : (
          /* ── RESET FORM ── */
          <>
            {/* Lock icon */}
            <div style={{ width:52, height:52, borderRadius:'14px', background:'rgba(108,78,242,0.1)', border:'1px solid rgba(108,78,242,0.2)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'1.1rem', boxShadow:'0 4px 16px rgba(108,78,242,0.15)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--purple2)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
            </div>

            <h1 style={{ fontFamily:'Outfit, sans-serif', fontSize:'1.6rem', fontWeight:800, color:'var(--text)', marginBottom:'0.3rem', letterSpacing:'-0.5px' }}>Set New Password</h1>
            <p style={{ color:'var(--muted)', fontSize:'0.85rem', marginBottom:'1.6rem', fontFamily:'Inter, sans-serif', lineHeight:1.5 }}>
              Choose a strong password for your MegaDen account.
            </p>

            {error && (
              <div style={{ background:'rgba(220,50,50,0.1)', border:'1px solid rgba(220,50,50,0.3)', color:'#ff6b6b', borderRadius:'12px', padding:'0.75rem 1rem', fontSize:'0.84rem', marginBottom:'1.1rem', fontFamily:'Inter, sans-serif' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'0.9rem' }}>
              <div>
                <label style={{ fontSize:'0.78rem', color:'var(--muted)', display:'block', marginBottom:'0.4rem', fontFamily:'Inter, sans-serif', fontWeight:500 }}>New Password</label>
                <div style={{ position:'relative' }}>
                  <span className="input-icon"><LockIcon /></span>
                  <input name="password" type={showPass ? 'text' : 'password'} placeholder="Min. 6 characters" required value={form.password} onChange={handleChange} className="auth-input" />
                  <button type="button" className="eye-btn" onClick={() => setShowPass(p => !p)}>
                    {showPass ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize:'0.78rem', color:'var(--muted)', display:'block', marginBottom:'0.4rem', fontFamily:'Inter, sans-serif', fontWeight:500 }}>Confirm New Password</label>
                <div style={{ position:'relative' }}>
                  <span className="input-icon"><LockIcon /></span>
                  <input name="confirm_password" type={showConfirm ? 'text' : 'password'} placeholder="Repeat new password" required value={form.confirm_password} onChange={handleChange} className="auth-input" />
                  <button type="button" className="eye-btn" onClick={() => setShowConfirm(p => !p)}>
                    {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              {/* Password strength hint */}
              {form.password.length > 0 && (
                <div style={{ display:'flex', gap:'0.3rem', alignItems:'center' }}>
                  {[1,2,3,4].map(i => (
                    <div key={i} style={{
                      flex:1, height:3, borderRadius:99,
                      background: form.password.length >= i * 3
                        ? i <= 1 ? '#f43f5e' : i <= 2 ? '#f59e0b' : i <= 3 ? '#3b82f6' : '#34d399'
                        : 'var(--border)',
                      transition:'background 0.3s',
                    }} />
                  ))}
                  <span style={{ fontSize:'0.68rem', color:'var(--muted)', marginLeft:'0.3rem', fontFamily:'Inter, sans-serif', whiteSpace:'nowrap' }}>
                    {form.password.length < 3 ? 'Too short' : form.password.length < 6 ? 'Weak' : form.password.length < 9 ? 'Good' : form.password.length < 12 ? 'Strong' : 'Very strong'}
                  </span>
                </div>
              )}

              <button type="submit" disabled={loading} className="submit-btn" style={{ marginTop:'0.3rem' }}>
                {loading
                  ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation:'spin 0.8s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                      Updating Password…
                    </span>
                  : 'Update Password →'
                }
              </button>
            </form>
          </>
        )}
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
function LockIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> }
function EyeIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> }
function EyeOffIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> }