'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import LoadingScreen from '@/components/RouteLoader'
import BottomNav from '@/components/BottomNav'
import DesktopSidebar from '@/components/DesktopSidebar'

const WHATSAPP_CHANNEL_URL = 'https://wa.me/17656822078'
const TELEGRAM_CHANNEL_URL = 'https://t.me/+3cblEJBfh1owOTJk'

export default function Profile() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [form, setForm] = useState({ full_name: '' })
  const [copiedRef, setCopiedRef] = useState(false) // design-only: referral copy feedback
  const fileInputRef = useRef(null)

  // Modals
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showPhoneModal, setShowPhoneModal] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    setIsDesktop(mq.matches)
    const handleChange = (e) => setIsDesktop(e.matches)
    mq.addEventListener('change', handleChange)
    return () => mq.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    setMounted(true)
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data)
      setForm({ full_name: data?.full_name || '' })
      setLoading(false)
    }
    load()
  }, [router])

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('profiles').update({ full_name: form.full_name }).eq('id', user.id)
    setProfile(p => ({ ...p, ...form }))
    setSaving(false)
    setSaved(true)
    setEditing(false)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be less than 2MB')
      return
    }
    setUploadingAvatar(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const fileExt = file.name.split('.').pop()
    const filePath = `${user.id}/avatar.${fileExt}`

    const { error } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true })
    if (error) { console.error(error); setUploadingAvatar(false); return }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath)
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
    setProfile(p => ({ ...p, avatar_url: publicUrl }))
    setUploadingAvatar(false)
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  const copyReferral = () => {
    if (!profile?.referral_code) return
    try { navigator.clipboard.writeText(profile.referral_code) } catch { /* ignore */ }
    setCopiedRef(true)
    setTimeout(() => setCopiedRef(false), 1800)
  }

  if (loading) return <LoadingScreen />

  const firstName = profile?.full_name?.split(' ')[0] || 'User'
  const memberSince = profile?.created_at ? new Date(profile.created_at) : null
  const memberLong = memberSince ? memberSince.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
  const memberShort = memberSince ? memberSince.toLocaleDateString('en-NG', { month: 'short', year: 'numeric' }) : '—'

  return (
    <main className="profile-main" style={{ background: 'var(--navy)', minHeight: '100vh', display: isDesktop ? 'flex' : 'block' }}>
      <style>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes modalIn { from { opacity: 0; transform: translateY(24px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes shimmer { 0%{opacity:0.5} 50%{opacity:1} 100%{opacity:0.5} }
        @keyframes successPop { 0% { transform: scale(0.5); opacity: 0; } 70% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
        * { box-sizing: border-box; }

        .menu-item { transition: background 0.18s, transform 0.15s; cursor: pointer; }
        .menu-item:hover { background: var(--card2) !important; }
        .menu-item:active { transform: scale(0.99); }
        .tile { transition: transform 0.18s, border-color 0.18s, background 0.18s; }
        .tile:hover { transform: translateY(-2px); border-color: var(--purple) !important; background: var(--card2) !important; }
        .save-btn { transition: transform 0.18s, box-shadow 0.18s; cursor: pointer; }
        .save-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(108,78,242,0.35); }
        .back-btn { transition: background 0.18s, transform 0.18s; }
        .back-btn:hover { background: var(--card2) !important; transform: translateX(-2px); }
        .edit-input:focus, .modal-input:focus { border-color: var(--purple) !important; box-shadow: 0 0 0 3px rgba(108,78,242,0.12); }
        .logout-btn { transition: background 0.18s, border-color 0.18s, transform 0.15s; cursor: pointer; }
        .logout-btn:hover { background: rgba(244,63,94,0.08) !important; border-color: #f43f5e !important; transform: translateY(-1px); }
        .avatar-upload { transition: opacity 0.2s, transform 0.2s; cursor: pointer; }
        .avatar-upload:hover { transform: scale(1.08); }
        .chip-btn { transition: background 0.15s, border-color 0.15s, color 0.15s; cursor: pointer; }
        .chip-btn:hover { border-color: var(--purple) !important; }
        .hero {
          position: relative; overflow: hidden;
          background: linear-gradient(160deg, rgba(108,78,242,0.14) 0%, rgba(22,27,48,0.55) 58%);
          border: 1px solid rgba(108,78,242,0.22);
        }
        .hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at 88% -12%, rgba(240,180,41,0.18) 0%, transparent 55%); pointer-events: none; }
        .hero::after { content: ''; position: absolute; top: 0; left: 8%; right: 8%; height: 1px; background: linear-gradient(90deg, transparent, rgba(108,78,242,0.55), rgba(240,180,41,0.35), transparent); }
        .modal-overlay { position: fixed; inset: 0; background: rgba(8,10,22,0.7); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); display: flex; align-items: flex-end; justify-content: center; z-index: 1000; animation: overlayIn 0.2s ease; }
        .modal-box { background: var(--card); border: 1px solid var(--border); border-radius: 24px 24px 0 0; padding: 1.2rem 1.4rem calc(1.4rem + env(safe-area-inset-bottom, 0px)); width: 100%; max-width: 440px; max-height: 92vh; overflow-y: auto; animation: sheetUp 0.3s cubic-bezier(0.2,0.8,0.2,1) both; box-shadow: 0 -20px 60px rgba(0,0,0,0.4); position: relative; }
        @media (min-width: 640px) {
          .modal-overlay { align-items: center; padding: 1.2rem; }
          .modal-box { border-radius: 22px; padding: 1.7rem; animation: modalIn 0.32s cubic-bezier(0.2,0.8,0.2,1) both; box-shadow: 0 24px 64px rgba(0,0,0,0.45); }
          .sheet-grip { display: none !important; }
        }
        .close-btn { position: absolute; top: 1rem; right: 1rem; width: 32px; height: 32px; border-radius: 10px; background: var(--card2); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; color: var(--muted); cursor: pointer; transition: all 0.15s; }
        .close-btn:hover { background: rgba(244,63,94,0.1); color: #f43f5e; border-color: #f43f5e; }
        .modal-submit { transition: transform 0.18s, box-shadow 0.18s, opacity 0.18s; cursor: pointer; }
        .modal-submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(108,78,242,0.35); }
        .modal-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .code-input { letter-spacing: 0.5em; text-align: center; font-weight: 800; font-family: 'Outfit', sans-serif; font-size: 1.4rem !important; }
        .resend-link { background: none; border: none; color: var(--purple2); font-size: 0.78rem; font-weight: 600; cursor: pointer; font-family: 'Inter', sans-serif; transition: opacity 0.15s; padding: 0.2rem 0; }
        .resend-link:hover:not(:disabled) { opacity: 0.7; }
        .resend-link:disabled { color: var(--muted); cursor: not-allowed; }
        .pulse-dot { animation: shimmer 2s ease-in-out infinite; }
        .section-label { font-size: 0.68rem; color: var(--muted); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin: 0 0 0.55rem; padding: 0 0.2rem; }
        main.profile-main { position: relative; }
        main.profile-main::before { content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 0; background: radial-gradient(640px circle at 50% -8%, rgba(108,78,242,0.12), transparent 62%); }
        .profile-shell { position: relative; z-index: 1; padding: 1.2rem 1.2rem; max-width: 560px; margin: 0 auto; }
        @media (min-width: 860px) {
          .profile-shell { max-width: 640px; margin: 1.75rem auto 0; background: var(--card); border: 1px solid var(--border); border-radius: 28px; padding: 2.2rem 2.4rem 2.6rem; box-shadow: 0 32px 80px rgba(0,0,0,0.32); }
        }
        .whatsapp-item:hover { background: rgba(37,211,102,0.06) !important; }
        .telegram-item:hover { background: rgba(34,158,217,0.06) !important; }
        .menu-item:focus-visible, .tile:focus-visible, .back-btn:focus-visible, .chip-btn:focus-visible, .save-btn:focus-visible, .logout-btn:focus-visible, .avatar-upload:focus-visible, .modal-submit:focus-visible, .close-btn:focus-visible { outline: 2px solid var(--purple); outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; } }
      `}</style>

      {isDesktop && <DesktopSidebar profile={profile} onLogout={handleLogout} />}

      <div style={{ flex: isDesktop ? 1 : 'none', minWidth: 0, paddingBottom: isDesktop ? '2.5rem' : '6.5rem' }}>
      {/* HEADER */}
      <div style={{ padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.85rem', position: 'sticky', top: 0, zIndex: 100, background: 'rgba(var(--navy-rgb, 10,10,30), 0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/dashboard" aria-label="Back to dashboard" className="back-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', textDecoration: 'none', flexShrink: 0 }}>
          <BackIcon />
        </Link>
        <div style={{ flex: 1, minWidth: 0, animation: mounted ? 'fadeSlideIn 0.4s ease' : 'none' }}>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--text)', letterSpacing: '-0.02em' }}>My Profile</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Manage your account details</div>
        </div>
        <button onClick={() => setEditing(!editing)} className="chip-btn"
          style={{ padding: '0.45rem 0.95rem', background: editing ? 'rgba(244,63,94,0.1)' : 'rgba(108,78,242,0.1)', border: `1px solid ${editing ? '#f43f5e' : 'var(--purple)'}`, borderRadius: 10, color: editing ? '#f43f5e' : 'var(--purple2)', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
          {editing ? 'Cancel' : <><EditIcon /> Edit</>}
        </button>
      </div>

      <div className="profile-shell">

        {/* HERO */}
        <div className="hero" style={{ borderRadius: 24, padding: '1.8rem 1.4rem 1.4rem', textAlign: 'center', marginBottom: '0.8rem', animation: mounted ? 'fadeSlideIn 0.4s ease' : 'none' }}>
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '1rem', zIndex: 1 }}>
            <div style={{ padding: 3, borderRadius: '50%', background: 'linear-gradient(135deg, var(--purple), var(--gold))', boxShadow: '0 10px 32px rgba(108,78,242,0.35)' }}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Your avatar"
                  style={{ display: 'block', width: 92, height: 92, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--navy)', opacity: uploadingAvatar ? 0.5 : 1, transition: 'opacity 0.2s' }} />
              ) : (
                <div style={{ width: 92, height: 92, borderRadius: '50%', background: 'var(--card2)', border: '3px solid var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '2.1rem', color: 'var(--text)' }}>
                  {firstName[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <button className="avatar-upload" aria-label="Change profile photo" onClick={() => fileInputRef.current?.click()}
              style={{ position: 'absolute', bottom: 2, right: 2, width: 32, height: 32, borderRadius: '50%', background: 'var(--purple)', border: '2px solid var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              {uploadingAvatar ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              ) : (
                <CameraIcon />
              )}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
          </div>

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.35rem', color: 'var(--text)', marginBottom: '0.2rem', letterSpacing: '-0.02em' }}>{profile?.full_name}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.8rem', wordBreak: 'break-all' }}>{profile?.email}</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 50, padding: '0.3rem 0.9rem', fontSize: '0.72rem', color: '#34d399', fontWeight: 700 }}>
              <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
              Active Account
            </div>
          </div>
        </div>

        {/* EDIT FORM */}
        {editing && (
          <form onSubmit={(e) => { e.preventDefault(); handleSave() }} style={{ background: 'var(--card)', border: '1px solid rgba(108,78,242,0.3)', borderRadius: 20, padding: '1.2rem', marginBottom: '0.8rem', animation: 'scaleIn 0.3s ease' }}>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)', marginBottom: '0.9rem' }}>Edit Details</div>
            <label htmlFor="full-name" style={{ fontSize: '0.74rem', color: 'var(--muted)', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>Full Name</label>
            <input id="full-name" className="edit-input" value={form.full_name} autoFocus autoComplete="name" onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              style={{ width: '100%', padding: '0.8rem 1rem', background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: '0.9rem', outline: 'none', fontFamily: 'Inter, sans-serif', marginBottom: '1rem', transition: 'border-color 0.2s, box-shadow 0.2s' }} />
            <button type="submit" disabled={saving} className="save-btn"
              style={{ width: '100%', padding: '0.85rem', background: saving ? 'var(--purple2)' : 'var(--purple)', color: '#fff', border: 'none', borderRadius: 12, fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        )}
        {saved && !editing && (
          <div role="status" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399', borderRadius: 12, padding: '0.65rem 0.9rem', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.8rem', animation: 'scaleIn 0.25s ease' }}>
            <CheckIcon size={14} /> Profile updated
          </div>
        )}

        {/* STAT TILES */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: '0.5rem', marginBottom: '1.4rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.08s both' : 'none' }}>
          <Link href="/dashboard/wallet" className="tile" style={{ textDecoration: 'none', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '0.8rem 0.85rem', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '0.64rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
              Balance <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--purple)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PlusIcon /></span>
            </div>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--gold)', marginTop: '0.35rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>₦{(profile?.wallet_balance || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</div>
          </Link>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '0.8rem 0.85rem', minWidth: 0 }}>
            <div style={{ color: 'var(--muted)', fontSize: '0.64rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Member</div>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.86rem', color: 'var(--text)', marginTop: '0.4rem', whiteSpace: 'nowrap' }}>{memberShort}</div>
          </div>
          <button onClick={copyReferral} disabled={!profile?.referral_code} aria-label="Copy referral code" className="tile" style={{ textAlign: 'left', cursor: profile?.referral_code ? 'pointer' : 'default', background: 'var(--card)', border: `1px solid ${copiedRef ? 'rgba(52,211,153,0.4)' : 'var(--border)'}`, borderRadius: 16, padding: '0.8rem 0.85rem', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: copiedRef ? '#34d399' : 'var(--muted)', fontSize: '0.64rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
              {copiedRef ? 'Copied' : 'Referral'} {copiedRef ? <CheckIcon size={11} /> : <CopyIcon />}
            </div>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.86rem', color: 'var(--text)', marginTop: '0.4rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile?.referral_code || '—'}</div>
          </button>
        </div>

        {/* ACCOUNT DETAILS */}
        <div className="section-label">Account details</div>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '0.2rem 0', marginBottom: '1.4rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.1s both' : 'none' }}>
          {[
            { label: 'Email', value: profile?.email, icon: <MailIcon /> },
            { label: 'Phone', value: profile?.phone || 'Not set', icon: <PhoneIcon />, action: { label: profile?.phone ? 'Change' : 'Add', onClick: () => setShowPhoneModal(true) } },
            { label: 'Member since', value: memberLong, icon: <CalendarIcon /> },
          ].map((item, i, arr) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem 1.1rem', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <IconTile>{item.icon}</IconTile>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginBottom: '0.1rem' }}>{item.label}</div>
                <div style={{ fontSize: '0.86rem', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.value}</div>
              </div>
              {item.action && (
                <button onClick={item.action.onClick} className="chip-btn" style={{ padding: '0.35rem 0.8rem', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 50, color: 'var(--purple2)', fontSize: '0.72rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif', flexShrink: 0 }}>{item.action.label}</button>
              )}
            </div>
          ))}
        </div>

        {/* QUICK LINKS */}
        <div className="section-label">Shortcuts</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1.4rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.12s both' : 'none' }}>
          {[
            { label: 'My Orders', icon: <PackageIcon />, href: '/dashboard/orders' },
            { label: 'Wallet', icon: <WalletIcon />, href: '/dashboard/wallet' },
            { label: 'Refer & Earn', icon: <GiftIcon />, href: '/dashboard/referral' },
          ].map((item) => (
            <Link key={item.label} href={item.href} className="tile"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.55rem', padding: '1rem 0.4rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, textDecoration: 'none' }}>
              <IconTile size={40}>{item.icon}</IconTile>
              <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text)', textAlign: 'center' }}>{item.label}</span>
            </Link>
          ))}
        </div>

        {/* SECURITY */}
        <div className="section-label">Security</div>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '0.2rem 0', marginBottom: '1.4rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.14s both' : 'none' }}>
          {[
            { label: 'Update Phone Number', sub: 'Confirmed with a code sent to your email', icon: <PhoneIcon />, onClick: () => setShowPhoneModal(true) },
            { label: 'Change Password', sub: 'Confirmed with a code sent to your email', icon: <LockIcon />, onClick: () => setShowPasswordModal(true) },
          ].map((item, i, arr) => (
            <button key={item.label} className="menu-item" onClick={item.onClick}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem 1.1rem', background: 'transparent', border: 'none', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', textAlign: 'left', fontFamily: 'inherit' }}>
              <IconTile>{item.icon}</IconTile>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text)' }}>{item.label}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{item.sub}</div>
              </div>
              <ChevronIcon />
            </button>
          ))}
        </div>

        {/* COMMUNITY */}
        <div className="section-label">Community</div>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '0.2rem 0', marginBottom: '1.4rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.17s both' : 'none' }}>
          <a href={WHATSAPP_CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="menu-item whatsapp-item"
            style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem 1.1rem', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: 'rgba(37,211,102,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <WhatsAppIcon />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text)' }}>Join our WhatsApp Channel</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '0.1rem' }}>Updates, offers & announcements</div>
            </div>
            <ExternalLinkIcon />
          </a>
          <a href={TELEGRAM_CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="menu-item telegram-item"
            style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem 1.1rem', textDecoration: 'none' }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: 'rgba(34,158,217,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <TelegramIcon />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text)' }}>Join our Telegram Channel</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '0.1rem' }}>Updates, offers & announcements</div>
            </div>
            <ExternalLinkIcon />
          </a>
        </div>

        {/* LOGOUT */}
        <button onClick={handleLogout} className="logout-btn"
          style={{ width: '100%', padding: '0.9rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: 14, color: '#f43f5e', fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.2s both' : 'none' }}>
          <LogoutIcon /> Sign Out
        </button>

      </div>

      {/* PHONE UPDATE MODAL */}
      {showPhoneModal && (
        <PhoneModal
          currentPhone={profile?.phone}
          onClose={() => setShowPhoneModal(false)}
          onSuccess={(newPhone) => {
            setProfile(p => ({ ...p, phone: newPhone }))
            setShowPhoneModal(false)
          }}
        />
      )}

      {/* PASSWORD CHANGE MODAL */}
      {showPasswordModal && (
        <PasswordModal onClose={() => setShowPasswordModal(false)} />
      )}
      </div>

      {!isDesktop && <BottomNav />}
    </main>
  )
}

// ── SHARED MODAL PIECES (design only) ──
function ModalShell({ onClose, icon, title, subtitle, step, steps = 2, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="sheet-grip" style={{ width: 38, height: 4, borderRadius: 99, background: 'var(--border)', margin: '0 auto 1rem' }} />
        <button className="close-btn" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(108,78,242,0.1)', border: '1px solid rgba(108,78,242,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.9rem', color: 'var(--purple2)' }}>
          {icon}
        </div>
        <div style={{ display: 'flex', gap: 5, marginBottom: '0.7rem' }} aria-label={`Step ${step} of ${steps}`}>
          {Array.from({ length: steps }).map((_, i) => (
            <span key={i} style={{ height: 4, width: i + 1 === step ? 22 : 10, borderRadius: 3, background: i + 1 <= step ? 'var(--purple)' : 'var(--border)', transition: 'all 0.3s' }} />
          ))}
        </div>
        <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.25rem', color: 'var(--text)', marginBottom: '0.35rem', letterSpacing: '-0.02em' }}>{title}</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '1.2rem', lineHeight: 1.55 }}>{subtitle}</div>
        {children}
      </div>
    </div>
  )
}

function Banner({ kind, children }) {
  const ok = kind === 'success'
  return (
    <div role={ok ? 'status' : 'alert'} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', background: ok ? 'rgba(52,211,153,0.1)' : 'rgba(244,63,94,0.08)', border: `1px solid ${ok ? 'rgba(52,211,153,0.3)' : 'rgba(244,63,94,0.28)'}`, color: ok ? '#34d399' : '#f43f5e', borderRadius: 12, padding: '0.7rem 0.9rem', fontSize: '0.8rem', marginBottom: '1rem', animation: 'scaleIn 0.2s ease' }}>
      <span style={{ display: 'flex', flexShrink: 0, marginTop: 1 }}>{ok ? <CheckIcon size={14} /> : <AlertIcon />}</span>
      <span>{children}</span>
    </div>
  )
}

const inputStyle = { width: '100%', padding: '0.8rem 1rem', background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: '0.9rem', outline: 'none', fontFamily: 'Inter, sans-serif', transition: 'border-color 0.2s, box-shadow 0.2s' }
const labelStyle = { fontSize: '0.74rem', color: 'var(--muted)', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }
const submitStyle = (loading) => ({ width: '100%', padding: '0.9rem', background: loading ? 'var(--purple2)' : 'var(--purple)', color: '#fff', border: 'none', borderRadius: 12, fontFamily: 'Outfit, sans-serif', fontSize: '0.92rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' })

function PasswordField({ id, label, value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input id={id} className="modal-input" type={show ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder} autoComplete={autoComplete}
          style={{ ...inputStyle, paddingRight: '2.8rem' }} />
        <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}
          style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 34, height: 34, borderRadius: 9, background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  )
}

// ── PHONE UPDATE MODAL ──
function PhoneModal({ currentPhone, onClose, onSuccess }) {
  const [step, setStep] = useState(1) // 1 = enter phone, 2 = enter code
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setInterval(() => setResendCooldown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(t)
  }, [resendCooldown])

  const sendCode = async () => {
    setError('')
    if (!phone.trim() || phone.trim().length < 7) {
      setError('Please enter a valid phone number')
      return
    }
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/verification/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ purpose: 'phone_change', new_phone: phone.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to send code'); setLoading(false); return }
      setStep(2)
      setResendCooldown(60)
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  const verifyCode = async () => {
    setError('')
    if (code.trim().length !== 6) {
      setError('Enter the 6-digit code')
      return
    }
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/verification/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ purpose: 'phone_change', code: code.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Verification failed'); setLoading(false); return }
      setSuccess('Phone number updated successfully!')
      setTimeout(() => onSuccess(data.phone), 1200)
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  return (
    <ModalShell onClose={onClose} icon={<PhoneIcon size={22} />} step={step}
      title={step === 1 ? 'Update Phone Number' : 'Verify It\'s You'}
      subtitle={step === 1
        ? `Current: ${currentPhone || 'Not set'}. Enter your new phone number — we'll email you a code to confirm.`
        : <>We sent a 6-digit code to your email. Enter it below to confirm updating your phone to <strong style={{ color: 'var(--text)' }}>{phone}</strong>.</>
      }>
      {error && <Banner kind="error">{error}</Banner>}
      {success && <Banner kind="success">{success}</Banner>}

      {step === 1 ? (
        <form onSubmit={(e) => { e.preventDefault(); sendCode() }}>
          <label htmlFor="new-phone" style={labelStyle}>New Phone Number</label>
          <input id="new-phone" className="modal-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+234..." type="tel" inputMode="tel" autoComplete="tel" autoFocus
            style={{ ...inputStyle, marginBottom: '1.2rem' }} />
          <button type="submit" disabled={loading} className="modal-submit" style={submitStyle(loading)}>
            {loading ? 'Sending code…' : 'Send Verification Code'}
          </button>
        </form>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); verifyCode() }}>
          <label htmlFor="phone-code" style={labelStyle}>Verification Code</label>
          <input id="phone-code" className="modal-input code-input" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} inputMode="numeric" autoComplete="one-time-code" autoFocus
            style={{ ...inputStyle, padding: '0.9rem 1rem', marginBottom: '0.6rem' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
            <button type="button" className="resend-link" onClick={() => { setStep(1); setCode(''); setError('') }} style={{ color: 'var(--muted)' }}>← Change number</button>
            <button type="button" className="resend-link" disabled={resendCooldown > 0 || loading} onClick={sendCode}>
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
            </button>
          </div>
          <button type="submit" disabled={loading || !!success} className="modal-submit" style={submitStyle(loading)}>
            {loading ? 'Verifying…' : success ? '✓ Updated!' : 'Confirm & Update'}
          </button>
        </form>
      )}
    </ModalShell>
  )
}

// ── PASSWORD CHANGE MODAL ──
function PasswordModal({ onClose }) {
  const [step, setStep] = useState(1) // 1 = enter passwords, 2 = enter code
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setInterval(() => setResendCooldown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(t)
  }, [resendCooldown])

  const requestCode = async () => {
    setError('')
    if (!currentPassword) { setError('Enter your current password'); return }
    if (newPassword.length < 6) { setError('New password must be at least 6 characters'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return }

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/verification/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ purpose: 'password_change' }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to send code'); setLoading(false); return }
      setStep(2)
      setResendCooldown(60)
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  const confirmChange = async () => {
    setError('')
    if (code.trim().length !== 6) { setError('Enter the 6-digit code'); return }

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/verification/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          purpose: 'password_change',
          code: code.trim(),
          current_password: currentPassword,
          new_password: newPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Verification failed'); setLoading(false); return }
      setSuccess('Password changed successfully!')
      setTimeout(onClose, 1500)
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  // Display-only strength hint
  const score = (newPassword.length >= 6 ? 1 : 0) + (newPassword.length >= 10 ? 1 : 0) + (/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) ? 1 : 0) + (/\d/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword) ? 1 : 0)
  const strength = [{ t: '', c: 'var(--border)' }, { t: 'Weak', c: '#f43f5e' }, { t: 'Okay', c: '#f0b429' }, { t: 'Good', c: '#34d399' }, { t: 'Strong', c: '#34d399' }][newPassword ? Math.max(1, score) : 0]
  const mismatch = confirmPassword && newPassword !== confirmPassword
  const match = confirmPassword && newPassword === confirmPassword

  return (
    <ModalShell onClose={onClose} icon={<LockIcon size={22} />} step={step}
      title={step === 1 ? 'Change Password' : 'Verify It\'s You'}
      subtitle={step === 1
        ? 'Enter your current and new password. We\'ll email you a code to confirm this change.'
        : 'We sent a 6-digit code to your email. Enter it below to confirm your new password.'
      }>
      {error && <Banner kind="error">{error}</Banner>}
      {success && <Banner kind="success">{success}</Banner>}

      <form onSubmit={(e) => { e.preventDefault(); if (step === 1) requestCode(); else confirmChange() }}>
        {step === 1 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginBottom: '1.2rem' }}>
            <PasswordField id="cur-pw" label="Current Password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
            <div>
              <PasswordField id="new-pw" label="New Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />
              {newPassword && (
                <div style={{ marginTop: '0.45rem' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[1, 2, 3, 4].map(n => <span key={n} style={{ flex: 1, height: 4, borderRadius: 2, background: n <= Math.max(1, score) ? strength.c : 'var(--border)', transition: 'background 0.25s' }} />)}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: strength.c, marginTop: '0.3rem', fontWeight: 600 }}>{strength.t}</div>
                </div>
              )}
            </div>
            <div>
              <PasswordField id="conf-pw" label="Confirm New Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" autoComplete="new-password" />
              {(mismatch || match) && (
                <div style={{ fontSize: '0.7rem', marginTop: '0.35rem', color: match ? '#34d399' : '#f43f5e', fontWeight: 600 }}>{match ? '✓ Passwords match' : 'Passwords don’t match yet'}</div>
              )}
            </div>
          </div>
        ) : (
          <>
            <label htmlFor="pw-code" style={labelStyle}>Verification Code</label>
            <input id="pw-code" className="modal-input code-input" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} inputMode="numeric" autoComplete="one-time-code" autoFocus
              style={{ ...inputStyle, padding: '0.9rem 1rem', marginBottom: '0.6rem' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <button type="button" className="resend-link" onClick={() => { setStep(1); setCode(''); setError('') }} style={{ color: 'var(--muted)' }}>← Back</button>
              <button type="button" className="resend-link" disabled={resendCooldown > 0 || loading} onClick={requestCode}>
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </button>
            </div>
          </>
        )}

        <button type="submit" disabled={loading || !!success} className="modal-submit" style={submitStyle(loading)}>
          {loading
            ? (step === 1 ? 'Sending code…' : 'Verifying…')
            : success
              ? '✓ Done!'
              : (step === 1 ? 'Send Verification Code' : 'Confirm & Change Password')
          }
        </button>
      </form>
    </ModalShell>
  )
}

function IconTile({ children, size = 36 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size > 36 ? 13 : 11, background: 'rgba(108,78,242,0.1)', border: '1px solid rgba(108,78,242,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--purple2)', flexShrink: 0 }}>
      {children}
    </div>
  )
}

function BackIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
}
function EditIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
}
function PlusIcon() {
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function CheckIcon({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
}
function CopyIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
}
function AlertIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
}
function EyeIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
}
function EyeOffIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
}
function CameraIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
}
function CloseIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
}
function MailIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
}
function PhoneIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1"/></svg>
}
function LockIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
}
function GiftIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
}
function WalletIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 12h2"/><path d="M2 10h20"/></svg>
}
function CalendarIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function PackageIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
}
function ChevronIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
}
function LogoutIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
}
function ExternalLinkIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
}
// Recreated as an original mark using the brand's real color and silhouette
// (not the official artwork file) — reads as recognizable at a glance while
// staying original, in-code SVG.
function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm5.8 14.03c-.24.68-1.4 1.32-1.93 1.4-.5.08-1.1.11-1.78-.11-.41-.13-.94-.3-1.62-.6-2.85-1.23-4.71-4.1-4.85-4.29-.14-.19-1.16-1.54-1.16-2.94 0-1.4.73-2.09.99-2.38.26-.29.57-.36.76-.36h.55c.18 0 .41-.02.63.49.24.55.81 1.9.88 2.04.07.14.11.31.02.5-.09.19-.14.31-.28.48-.14.17-.29.37-.42.5-.14.14-.29.29-.12.57.17.29.75 1.24 1.62 2.01 1.11.99 2.05 1.3 2.34 1.45.29.14.46.12.63-.07.17-.19.71-.83.9-1.11.19-.29.38-.24.63-.14.26.1 1.62.77 1.9.91.28.14.46.21.53.33.07.12.07.68-.17 1.36z"/>
    </svg>
  )
}
function TelegramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#229ED9">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8-1.6 7.54c-.12.54-.44.67-.88.42l-2.44-1.8-1.18 1.13c-.13.13-.24.24-.49.24l.18-2.5 4.55-4.11c.2-.18-.04-.27-.31-.1L8.1 13.28l-2.44-.76c-.53-.17-.54-.53.11-.78l9.54-3.68c.44-.16.83.1.69.74z"/>
    </svg>
  )
}