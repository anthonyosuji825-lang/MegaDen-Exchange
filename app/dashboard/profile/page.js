'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function Profile() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [form, setForm] = useState({ full_name: '', phone: '' })
  const fileInputRef = useRef(null)

  useEffect(() => {
    setMounted(true)
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data)
      setForm({ full_name: data?.full_name || '', phone: data?.phone || '' })
      setLoading(false)
    }
    load()
  }, [router])

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('profiles').update({ full_name: form.full_name, phone: form.phone }).eq('id', user.id)
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

  if (loading) return (
    <main style={{ background: 'var(--navy)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Loading profile...</div>
    </main>
  )

  const firstName = profile?.full_name?.split(' ')[0] || 'User'

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
        .menu-item { transition: background 0.18s, transform 0.15s; cursor: pointer; }
        .menu-item:hover { background: var(--card2) !important; transform: translateX(3px); }
        .save-btn { transition: transform 0.18s, box-shadow 0.18s; cursor: pointer; }
        .save-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(108,78,242,0.35); }
        .back-btn { transition: background 0.18s, transform 0.18s; }
        .back-btn:hover { background: var(--card2) !important; transform: translateX(-2px); }
        .edit-input:focus { border-color: var(--purple) !important; box-shadow: 0 0 0 3px rgba(108,78,242,0.12); }
        .logout-btn { transition: background 0.18s, border-color 0.18s, transform 0.15s; cursor: pointer; }
        .logout-btn:hover { background: rgba(220,50,50,0.08) !important; border-color: #ff6b6b !important; transform: translateY(-1px); }
        .avatar-upload { transition: opacity 0.2s; cursor: pointer; }
        .avatar-upload:hover { opacity: 0.85; }
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

      <div style={{ padding: '1.2rem 1.4rem' }}>

        {/* AVATAR CARD */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '20px', padding: '1.8rem', textAlign: 'center', marginBottom: '1.2rem', animation: mounted ? 'fadeSlideIn 0.4s ease' : 'none' }}>

          {/* Avatar */}
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '1rem' }}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar"
                style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--purple)' }} />
            ) : (
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, var(--purple), var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.8rem', color: '#fff', border: '3px solid var(--border)' }}>
                {firstName[0]?.toUpperCase()}
              </div>
            )}

            {/* Upload button */}
            <button className="avatar-upload" onClick={() => fileInputRef.current?.click()}
              style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: '50%', background: 'var(--purple)', border: '2px solid var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              {uploadingAvatar ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              ) : (
                <CameraIcon />
              )}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
          </div>

          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.2rem', color: 'var(--text)', marginBottom: '0.2rem' }}>{profile?.full_name}</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '0.8rem' }}>{profile?.email}</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(108,78,242,0.1)', border: '1px solid var(--border)', borderRadius: '50px', padding: '0.3rem 0.9rem', fontSize: '0.75rem', color: 'var(--purple2)', fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
            Active Account
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.8rem' }}>
            Tap the camera icon to change your photo
          </div>
        </div>

        {/* EDIT FORM */}
        {editing && (
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.2rem', marginBottom: '1.2rem', animation: 'scaleIn 0.3s ease' }}>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)', marginBottom: '1rem' }}>Edit Details</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginBottom: '1.1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>Full Name</label>
                <input className="edit-input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text)', fontSize: '0.9rem', outline: 'none', fontFamily: 'Inter, sans-serif', transition: 'border-color 0.2s, box-shadow 0.2s' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>Phone Number</label>
                <input className="edit-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+234..."
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
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '0.3rem 0', marginBottom: '1.2rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.1s both' : 'none' }}>
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

        {/* MENU LINKS */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '0.3rem 0', marginBottom: '1.2rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.15s both' : 'none' }}>
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

        {/* LOGOUT */}
        <button onClick={handleLogout} className="logout-btn"
          style={{ width: '100%', padding: '0.9rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '14px', color: '#ff6b6b', fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.2s both' : 'none' }}>
          <LogoutIcon /> Sign Out
        </button>

      </div>
    </main>
  )
}

function BackIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
}
function CameraIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
}
function MailIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
}
function PhoneIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1"/></svg>
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
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
}
function LogoutIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
}