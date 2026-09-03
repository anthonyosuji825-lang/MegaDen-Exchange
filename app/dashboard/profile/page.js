'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import LoadingScreen from '@/components/RouteLoader'
import BottomNav from '@/components/BottomNav'

// TODO: replace with your real channel links
const WHATSAPP_CHANNEL_URL = 'https://whatsapp.com/channel/REPLACE_ME'
const TELEGRAM_CHANNEL_URL = 'https://t.me/REPLACE_ME'

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
  const fileInputRef = useRef(null)

  // Modals
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showPhoneModal, setShowPhoneModal] = useState(false)

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

  if (loading) return <LoadingScreen />

  const firstName = profile?.full_name?.split(' ')[0] || 'User'

  return (
    <main className="profile-main" style={{ background: 'var(--navy)', minHeight: '100vh', paddingBottom: '2.5rem' }}>
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
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes shimmer { 0%{opacity:0.5} 50%{opacity:1} 100%{opacity:0.5} }

        .menu-item { transition: background 0.18s, transform 0.15s; cursor: pointer; }
        .menu-item:hover { background: var(--card2) !important; transform: translateX(3px); }
        .save-btn { transition: transform 0.18s, box-shadow 0.18s; cursor: pointer; }
        .save-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(108,78,242,0.35); }
        .back-btn { transition: background 0.18s, transform 0.18s; }
        .back-btn:hover { background: var(--card2) !important; transform: translateX(-2px); }
        .edit-input:focus { border-color: var(--purple) !important; box-shadow: 0 0 0 3px rgba(108,78,242,0.12); }
        .logout-btn { transition: background 0.18s, border-color 0.18s, transform 0.15s; cursor: pointer; }
        .logout-btn:hover { background: rgba(220,50,50,0.08) !important; border-color: #ff6b6b !important; transform: translateY(-1px); }
        .avatar-upload { transition: opacity 0.2s, transform 0.2s; cursor: pointer; }
        .avatar-upload:hover { opacity: 0.85; transform: scale(1.06); }
        .premium-card {
          position: relative;
          background: linear-gradient(160deg, rgba(108,78,242,0.10) 0%, rgba(22,27,48,0.6) 55%);
          border: 1px solid rgba(108,78,242,0.18);
          overflow: hidden;
        }
        .premium-card::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(circle at 85% -10%, rgba(240,180,41,0.16) 0%, transparent 55%);
          pointer-events: none;
        }
        .premium-card::after {
          content: '';
          position: absolute; top: 0; left: 8%; right: 8%; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(108,78,242,0.5), rgba(240,180,41,0.3), transparent);
        }
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(8,10,22,0.7);
          backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: 1.2rem; animation: overlayIn 0.2s ease;
        }
        .modal-box {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 20px; padding: 1.6rem; width: 100%; max-width: 420px;
          animation: modalIn 0.32s cubic-bezier(0.2,0.8,0.2,1) both;
          box-shadow: 0 24px 64px rgba(0,0,0,0.45);
          position: relative;
        }
        .close-btn {
          position: absolute; top: 1.1rem; right: 1.1rem;
          width: 30px; height: 30px; border-radius: 8px;
          background: var(--card2); border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          color: var(--muted); cursor: pointer; transition: all 0.15s;
        }
        .close-btn:hover { background: rgba(220,50,50,0.1); color: #ff6b6b; border-color: #ff6b6b; }
        .modal-input:focus { border-color: var(--purple) !important; box-shadow: 0 0 0 3px rgba(108,78,242,0.12); }
        .modal-submit { transition: transform 0.18s, box-shadow 0.18s, opacity 0.18s; cursor: pointer; }
        .modal-submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(108,78,242,0.35); }
        .modal-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .code-input {
          letter-spacing: 0.5em; text-align: center; font-weight: 800;
          font-family: 'Outfit', sans-serif; font-size: 1.3rem !important;
        }
        .resend-link { background: none; border: none; color: var(--purple2); font-size: 0.78rem; font-weight: 600; cursor: pointer; font-family: 'Inter', sans-serif; transition: opacity 0.15s; }
        .resend-link:hover:not(:disabled) { opacity: 0.7; }
        .resend-link:disabled { color: var(--muted); cursor: not-allowed; }
        .verified-pill { display:inline-flex; align-items:center; gap:0.35rem; }
        .pulse-dot { animation: shimmer 2s ease-in-out infinite; }
        .section-label { font-size: 0.72rem; color: var(--muted); font-weight: 600; letter-spacing: 0.03em; margin-bottom: 0.5rem; padding: 0 0.2rem; }
        main.profile-main { position: relative; }
        main.profile-main::before {
          content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background: radial-gradient(640px circle at 50% -8%, rgba(108,78,242,0.12), transparent 62%);
        }
        .profile-shell { position: relative; z-index: 1; padding: 1.2rem 1.4rem; max-width: 560px; margin: 0 auto; }
        @media (min-width: 860px) {
          .profile-shell {
            max-width: 640px; margin: 1.75rem auto 0;
            background: var(--card); border: 1px solid var(--border);
            border-radius: 28px; padding: 2.2rem 2.4rem 2.6rem;
            box-shadow: 0 32px 80px rgba(0,0,0,0.32);
          }
        }
        .whatsapp-item:hover { background: rgba(37,211,102,0.06) !important; }
        .telegram-item:hover { background: rgba(34,158,217,0.06) !important; }
      `}</style>

      {/* HEADER */}
      <div style={{ padding: '1.1rem 1.4rem', display: 'flex', alignItems: 'center', gap: '0.9rem', position: 'sticky', top: 0, zIndex: 100, background: 'var(--navy)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/dashboard" className="back-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '10px', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', textDecoration: 'none' }}>
          <BackIcon />
        </Link>
        <div style={{ animation: mounted ? 'fadeSlideIn 0.4s ease' : 'none' }}>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>My Profile</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Manage your account details</div>
        </div>
        <button onClick={() => setEditing(!editing)} style={{ marginLeft: 'auto', padding: '0.4rem 0.9rem', background: editing ? 'rgba(220,50,50,0.1)' : 'rgba(108,78,242,0.1)', border: `1px solid ${editing ? '#ff6b6b' : 'var(--purple)'}`, borderRadius: '8px', color: editing ? '#ff6b6b' : 'var(--purple2)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all 0.2s' }}>
          {editing ? 'Cancel' : 'Edit Profile'}
        </button>
      </div>

      <div className="profile-shell">

        {/* AVATAR / PREMIUM CARD */}
        <div className="premium-card" style={{ borderRadius: '22px', padding: '2rem 1.8rem', textAlign: 'center', marginBottom: '1.2rem', animation: mounted ? 'fadeSlideIn 0.4s ease' : 'none' }}>

          {/* Avatar */}
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '1.1rem', zIndex: 1 }}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar"
                style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--purple)', boxShadow: '0 8px 28px rgba(108,78,242,0.35)' }} />
            ) : (
              <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'linear-gradient(135deg, var(--purple), var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '2rem', color: '#fff', border: '3px solid var(--border)', boxShadow: '0 8px 28px rgba(108,78,242,0.35)' }}>
                {firstName[0]?.toUpperCase()}
              </div>
            )}

            {/* Upload button */}
            <button className="avatar-upload" onClick={() => fileInputRef.current?.click()}
              style={{ position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: '50%', background: 'var(--purple)', border: '2px solid var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              {uploadingAvatar ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              ) : (
                <CameraIcon />
              )}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
          </div>

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.3rem', color: 'var(--text)', marginBottom: '0.25rem', letterSpacing: '-0.3px' }}>{profile?.full_name}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '0.9rem' }}>{profile?.email}</div>
            <div className="verified-pill" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: '50px', padding: '0.35rem 1rem', fontSize: '0.74rem', color: '#34d399', fontWeight: 700 }}>
              <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
              Active Account
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.9rem', opacity: 0.8 }}>
              Tap the camera icon to change your photo
            </div>
          </div>
        </div>

        {/* EDIT FORM */}
        {editing && (
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '18px', padding: '1.3rem', marginBottom: '1.2rem', animation: 'scaleIn 0.3s ease' }}>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)', marginBottom: '1rem' }}>Edit Details</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginBottom: '1.1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>Full Name</label>
                <input className="edit-input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text)', fontSize: '0.9rem', outline: 'none', fontFamily: 'Inter, sans-serif', transition: 'border-color 0.2s, box-shadow 0.2s' }} />
              </div>
            </div>
            <button onClick={handleSave} disabled={saving} className="save-btn"
              style={{ width: '100%', padding: '0.85rem', background: saving ? 'var(--purple2)' : 'var(--purple)', color: '#fff', border: 'none', borderRadius: '10px', fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Changes'}
            </button>
          </div>
        )}

        {/* INFO CARDS */}
        <div className="section-label">Account details</div>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '18px', padding: '0.3rem 0', marginBottom: '1.2rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.1s both' : 'none' }}>
          {[
            { label: 'Email', value: profile?.email, icon: <MailIcon /> },
            { label: 'Phone', value: profile?.phone || 'Not set', icon: <PhoneIcon /> },
            { label: 'Referral Code', value: profile?.referral_code, icon: <GiftIcon /> },
            { label: 'Wallet Balance', value: `₦${(profile?.wallet_balance || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`, icon: <WalletIcon /> },
            { label: 'Member Since', value: new Date(profile?.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }), icon: <CalendarIcon /> },
          ].map((item, i, arr) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', padding: '0.9rem 1.1rem', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width: 34, height: 34, borderRadius: '9px', background: 'rgba(108,78,242,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--purple2)', flexShrink: 0 }}>
                {item.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '0.1rem' }}>{item.label}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* SECURITY */}
        <div className="section-label">Security</div>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '18px', padding: '0.3rem 0', marginBottom: '1.2rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.13s both' : 'none' }}>
          <div
            className="menu-item"
            onClick={() => setShowPhoneModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', padding: '0.9rem 1.1rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 34, height: 34, borderRadius: '9px', background: 'rgba(108,78,242,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--purple2)', flexShrink: 0 }}>
              <PhoneIcon />
            </div>
            <span style={{ flex: 1, fontSize: '0.86rem', fontWeight: 500, color: 'var(--text)' }}>Update Phone Number</span>
            <ChevronIcon />
          </div>
          <div
            className="menu-item"
            onClick={() => setShowPasswordModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', padding: '0.9rem 1.1rem' }}>
            <div style={{ width: 34, height: 34, borderRadius: '9px', background: 'rgba(108,78,242,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--purple2)', flexShrink: 0 }}>
              <LockIcon />
            </div>
            <span style={{ flex: 1, fontSize: '0.86rem', fontWeight: 500, color: 'var(--text)' }}>Change Password</span>
            <ChevronIcon />
          </div>
        </div>

        {/* MENU LINKS */}
        <div className="section-label">More</div>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '18px', padding: '0.3rem 0', marginBottom: '1.2rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.15s both' : 'none' }}>
          {[
            { label: 'My Orders', icon: <PackageIcon />, href: '/dashboard/orders' },
            { label: 'Wallet & Transactions', icon: <WalletIcon />, href: '/dashboard/wallet' },
            { label: 'Refer & Earn', icon: <GiftIcon />, href: '/dashboard/referral' },
          ].map((item, i, arr) => (
            <Link key={item.label} href={item.href} className="menu-item"
              style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', padding: '0.9rem 1.1rem', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', textDecoration: 'none', background: 'transparent' }}>
              <div style={{ width: 34, height: 34, borderRadius: '9px', background: 'rgba(108,78,242,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--purple2)', flexShrink: 0 }}>
                {item.icon}
              </div>
              <span style={{ flex: 1, fontSize: '0.86rem', fontWeight: 500, color: 'var(--text)' }}>{item.label}</span>
              <ChevronIcon />
            </Link>
          ))}
        </div>

        {/* COMMUNITY */}
        <div className="section-label">Community</div>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '18px', padding: '0.3rem 0', marginBottom: '1.2rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.17s both' : 'none' }}>
          <a href={WHATSAPP_CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="menu-item whatsapp-item"
            style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', padding: '0.9rem 1.1rem', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}>
            <div style={{ width: 34, height: 34, borderRadius: '9px', background: 'rgba(37,211,102,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <WhatsAppIcon />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.86rem', fontWeight: 500, color: 'var(--text)' }}>Join our WhatsApp Channel</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.1rem' }}>Updates, offers & announcements</div>
            </div>
            <ExternalLinkIcon />
          </a>
          <a href={TELEGRAM_CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="menu-item telegram-item"
            style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', padding: '0.9rem 1.1rem', textDecoration: 'none' }}>
            <div style={{ width: 34, height: 34, borderRadius: '9px', background: 'rgba(34,158,217,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <TelegramIcon />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.86rem', fontWeight: 500, color: 'var(--text)' }}>Join our Telegram Channel</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.1rem' }}>Updates, offers & announcements</div>
            </div>
            <ExternalLinkIcon />
          </a>
        </div>

        {/* LOGOUT */}
        <button onClick={handleLogout} className="logout-btn"
          style={{ width: '100%', padding: '0.9rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '14px', color: '#ff6b6b', fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.2s both' : 'none' }}>
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
    <BottomNav />
    </main>
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}><CloseIcon /></button>

        <div style={{ width: 48, height: 48, borderRadius: '13px', background: 'rgba(108,78,242,0.1)', border: '1px solid rgba(108,78,242,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
          <PhoneIcon size={22} />
        </div>

        <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.25rem', color: 'var(--text)', marginBottom: '0.35rem' }}>
          {step === 1 ? 'Update Phone Number' : 'Verify It\'s You'}
        </div>
        <div style={{ fontSize: '0.84rem', color: 'var(--muted)', marginBottom: '1.3rem', lineHeight: 1.5 }}>
          {step === 1
            ? `Current: ${currentPhone || 'Not set'}. Enter your new phone number — we'll email you a code to confirm.`
            : <>We sent a 6-digit code to your email. Enter it below to confirm updating your phone to <strong style={{ color: 'var(--text)' }}>{phone}</strong>.</>
          }
        </div>

        {error && (
          <div style={{ background: 'rgba(220,50,50,0.1)', border: '1px solid rgba(220,50,50,0.3)', color: '#ff6b6b', borderRadius: '10px', padding: '0.7rem 1rem', fontSize: '0.82rem', marginBottom: '1rem' }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399', borderRadius: '10px', padding: '0.7rem 1rem', fontSize: '0.82rem', marginBottom: '1rem' }}>
            ✓ {success}
          </div>
        )}

        {step === 1 ? (
          <>
            <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>New Phone Number</label>
            <input className="modal-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+234..."
              style={{ width: '100%', padding: '0.8rem 1rem', background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text)', fontSize: '0.9rem', outline: 'none', fontFamily: 'Inter, sans-serif', marginBottom: '1.2rem', transition: 'border-color 0.2s, box-shadow 0.2s' }} />
            <button onClick={sendCode} disabled={loading} className="modal-submit"
              style={{ width: '100%', padding: '0.85rem', background: loading ? 'var(--purple2)' : 'var(--purple)', color: '#fff', border: 'none', borderRadius: '10px', fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', fontWeight: 700 }}>
              {loading ? 'Sending code…' : 'Send Verification Code'}
            </button>
          </>
        ) : (
          <>
            <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>Verification Code</label>
            <input className="modal-input code-input" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6}
              style={{ width: '100%', padding: '0.9rem 1rem', background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text)', outline: 'none', marginBottom: '0.8rem', transition: 'border-color 0.2s, box-shadow 0.2s' }} />
            <div style={{ textAlign: 'right', marginBottom: '1.2rem' }}>
              <button className="resend-link" disabled={resendCooldown > 0 || loading} onClick={sendCode}>
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </button>
            </div>
            <button onClick={verifyCode} disabled={loading || !!success} className="modal-submit"
              style={{ width: '100%', padding: '0.85rem', background: loading ? 'var(--purple2)' : 'var(--purple)', color: '#fff', border: 'none', borderRadius: '10px', fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', fontWeight: 700 }}>
              {loading ? 'Verifying…' : success ? '✓ Updated!' : 'Confirm & Update'}
            </button>
          </>
        )}
      </div>
    </div>
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}><CloseIcon /></button>

        <div style={{ width: 48, height: 48, borderRadius: '13px', background: 'rgba(108,78,242,0.1)', border: '1px solid rgba(108,78,242,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
          <LockIcon size={22} />
        </div>

        <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.25rem', color: 'var(--text)', marginBottom: '0.35rem' }}>
          {step === 1 ? 'Change Password' : 'Verify It\'s You'}
        </div>
        <div style={{ fontSize: '0.84rem', color: 'var(--muted)', marginBottom: '1.3rem', lineHeight: 1.5 }}>
          {step === 1
            ? 'Enter your current and new password. We\'ll email you a code to confirm this change.'
            : 'We sent a 6-digit code to your email. Enter it below to confirm your new password.'
          }
        </div>

        {error && (
          <div style={{ background: 'rgba(220,50,50,0.1)', border: '1px solid rgba(220,50,50,0.3)', color: '#ff6b6b', borderRadius: '10px', padding: '0.7rem 1rem', fontSize: '0.82rem', marginBottom: '1rem' }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399', borderRadius: '10px', padding: '0.7rem 1rem', fontSize: '0.82rem', marginBottom: '1rem' }}>
            ✓ {success}
          </div>
        )}

        {step === 1 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginBottom: '1.2rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>Current Password</label>
              <input className="modal-input" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••••"
                style={{ width: '100%', padding: '0.8rem 1rem', background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text)', fontSize: '0.9rem', outline: 'none', fontFamily: 'Inter, sans-serif', transition: 'border-color 0.2s, box-shadow 0.2s' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>New Password</label>
              <input className="modal-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 6 characters"
                style={{ width: '100%', padding: '0.8rem 1rem', background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text)', fontSize: '0.9rem', outline: 'none', fontFamily: 'Inter, sans-serif', transition: 'border-color 0.2s, box-shadow 0.2s' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>Confirm New Password</label>
              <input className="modal-input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter new password"
                style={{ width: '100%', padding: '0.8rem 1rem', background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text)', fontSize: '0.9rem', outline: 'none', fontFamily: 'Inter, sans-serif', transition: 'border-color 0.2s, box-shadow 0.2s' }} />
            </div>
          </div>
        ) : (
          <>
            <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>Verification Code</label>
            <input className="modal-input code-input" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6}
              style={{ width: '100%', padding: '0.9rem 1rem', background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text)', outline: 'none', marginBottom: '0.8rem', transition: 'border-color 0.2s, box-shadow 0.2s' }} />
            <div style={{ textAlign: 'right', marginBottom: '1.2rem' }}>
              <button className="resend-link" disabled={resendCooldown > 0 || loading} onClick={requestCode}>
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </button>
            </div>
          </>
        )}

        <button onClick={step === 1 ? requestCode : confirmChange} disabled={loading || !!success} className="modal-submit"
          style={{ width: '100%', padding: '0.85rem', background: loading ? 'var(--purple2)' : 'var(--purple)', color: '#fff', border: 'none', borderRadius: '10px', fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', fontWeight: 700 }}>
          {loading
            ? (step === 1 ? 'Sending code…' : 'Verifying…')
            : success
              ? '✓ Done!'
              : (step === 1 ? 'Send Verification Code' : 'Confirm & Change Password')
          }
        </button>
      </div>
    </div>
  )
}

function BackIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
}
function CameraIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
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
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
}
function WalletIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 12h2"/><path d="M2 10h20"/></svg>
}
function CalendarIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function PackageIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
}
function ChevronIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 15 6"/></svg>
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
    <svg width="17" height="17" viewBox="0 0 24 24" fill="#25D366">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm5.8 14.03c-.24.68-1.4 1.32-1.93 1.4-.5.08-1.1.11-1.78-.11-.41-.13-.94-.3-1.62-.6-2.85-1.23-4.71-4.1-4.85-4.29-.14-.19-1.16-1.54-1.16-2.94 0-1.4.73-2.09.99-2.38.26-.29.57-.36.76-.36h.55c.18 0 .41-.02.63.49.24.55.81 1.9.88 2.04.07.14.11.31.02.5-.09.19-.14.31-.28.48-.14.17-.29.37-.42.5-.14.14-.29.29-.12.57.17.29.75 1.24 1.62 2.01 1.11.99 2.05 1.3 2.34 1.45.29.14.46.12.63-.07.17-.19.71-.83.9-1.11.19-.29.38-.24.63-.14.26.1 1.62.77 1.9.91.28.14.46.21.53.33.07.12.07.68-.17 1.36z"/>
    </svg>
  )
}
function TelegramIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="#229ED9">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8-1.6 7.54c-.12.54-.44.67-.88.42l-2.44-1.8-1.18 1.13c-.13.13-.24.24-.49.24l.18-2.5 4.55-4.11c.2-.18-.04-.27-.31-.1L8.1 13.28l-2.44-.76c-.53-.17-.54-.53.11-.78l9.54-3.68c.44-.16.83.1.69.74z"/>
    </svg>
  )
}