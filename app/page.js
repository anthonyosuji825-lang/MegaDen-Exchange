'use client'
import LoadingScreen from '@/components/LoadingScreen'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function Dashboard() {
  const router = useRouter()
  const [sliderIndex, setSliderIndex] = useState(0)
  const [profile, setProfile] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [balanceHidden, setBalanceHidden] = useState(false)
  const [activeTab, setActiveTab] = useState('home')
  const [showAllActions, setShowAllActions] = useState(false)
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('megaden-theme') || 'dark' } catch(e) { return 'dark' }
  })
  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [showGreeting, setShowGreeting] = useState(false)
  const [greetingLeaving, setGreetingLeaving] = useState(false)
  const timerRef = useRef(null)
  const notifRef = useRef(null)

  const unreadCount = notifications.filter(n => !n.is_read).length

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    try { localStorage.setItem('megaden-theme', next) } catch(e) {}
  }

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profileData } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile(profileData)
      const { data: ordersData } = await supabase
        .from('orders').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(5)
      setOrders(ordersData || [])
      const { data: notifData } = await supabase
        .from('notifications').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(20)
      setNotifications(notifData || [])
      setLoading(false)
      setTimeout(() => setShowGreeting(true), 300)
      setTimeout(() => setGreetingLeaving(true), 3000)
      setTimeout(() => { setShowGreeting(false); setGreetingLeaving(false) }, 3500)
    }
    load()
  }, [router])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showNotifications && notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showNotifications])

  const goToSlide = (i) => {
    setSliderIndex(i)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setSliderIndex(prev => (prev + 1) % slides.length)
    }, 10000)
  }

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSliderIndex(prev => (prev + 1) % 4)
    }, 10000)
    return () => clearInterval(timerRef.current)
  }, [])

  const markAllRead = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const markOneRead = async (id) => {
    const supabase = createClient()
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return <LoadingScreen />

  const firstName = profile?.full_name?.split(' ')[0] || 'User'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'

  const slides = [
    {
      bg: 'linear-gradient(140deg,#1a0755 0%,#4a1fa8 40%,#7c3af0 70%,#b06010 100%)',
      tag: 'PROMO', dotColor: '#8b6ff7',
      badge: { amt: '₦200', lbl: 'per referral' },
      title: 'Refer &\nEarn ₦200',
      desc: 'Invite friends, earn instantly when they make their first purchase.',
      btn: 'Invite Now', href: '/dashboard/referral',
    },
    {
      bg: 'linear-gradient(140deg,#5a3000 0%,#a05800 40%,#d48010 70%,#f0b429 100%)',
      tag: 'REFERRAL', dotColor: '#f0b429',
      badge: { amt: '∞', lbl: 'no limit' },
      title: 'Earn More,\nRefer More',
      desc: 'No cap on earnings. The more friends you bring, the more you stack.',
      btn: 'Share Link', href: '/dashboard/referral',
    },
    {
      bg: 'linear-gradient(140deg,#022a14 0%,#095c2e 40%,#0f8c49 70%,#1dba6a 100%)',
      tag: 'YOUR CODE', dotColor: '#1dba6a',
      badge: { amt: 'CODE', lbl: 'tap to copy' },
      title: `${profile?.referral_code || 'MG-XXXXX'}\nis yours`,
      desc: 'Share your unique code and your wallet grows automatically.',
      btn: 'Copy Code', href: '/dashboard/referral',
    },
    {
      bg: 'linear-gradient(140deg,#040e30 0%,#0b2670 40%,#1045c0 70%,#2870e8 100%)',
      tag: 'VPN', dotColor: '#2870e8',
      badge: { amt: 'NEW', lbl: 'just added' },
      title: 'Stay Secure\nOnline',
      desc: 'NordVPN, ExpressVPN & more at the best prices. One tap away.',
      btn: 'Buy VPN', href: '/dashboard/vpn',
    },
  ]

  const row1Actions = [
    { label: 'Fund Wallet', href: '/dashboard/wallet', icon: <WalletIcon size={18} color="#8b6ff7" />, bg: 'rgba(108,78,242,0.12)' },
    { label: 'Buy Number', href: '/dashboard/numbers', icon: <PhoneIcon size={18} color="#10b981" />, bg: 'rgba(16,185,129,0.12)' },
    { label: 'Buy Logs', href: '/dashboard/logs', icon: <LogsIcon size={18} color="#4687ff" />, bg: 'rgba(70,135,255,0.12)' },
    { label: 'Boosting', href: '/dashboard/boosting', icon: <BoostIcon size={18} color="#f43f5e" />, bg: 'rgba(244,63,94,0.12)' },
  ]

  const row2Actions = [
    { label: 'VPN', href: '/dashboard/vpn', icon: <VpnIcon size={18} color="#8b6ff7" />, bg: 'rgba(108,78,242,0.12)' },
    { label: 'Refer & Earn', href: '/dashboard/referral', icon: <ReferIcon size={18} color="#f0b429" />, bg: 'rgba(240,180,41,0.12)' },
    { label: 'View History', href: '/dashboard/orders', icon: <HistoryIcon size={18} color="#f0b429" />, bg: 'rgba(240,180,41,0.12)' },
    { label: 'Track Order', href: '/dashboard/orders/track', icon: <TrackIcon size={18} color="#10b981" />, bg: 'rgba(16,185,129,0.12)' },
  ]

  const services = [
    { title: 'Foreign Numbers', desc: 'USA, UK, Canada & 40+ countries', icon: <PhoneIcon size={22} color="#8b6ff7" />, bg: 'rgba(108,78,242,0.12)', href: '/dashboard/numbers', badge: 'HOT', badgeBg: 'rgba(108,78,242,0.12)', badgeColor: '#8b6ff7' },
    { title: 'Social Media Logs', desc: 'FB, IG, TikTok, Gmail & more', icon: <LogsIcon size={22} color="#f0b429" />, bg: 'rgba(240,180,41,0.12)', href: '/dashboard/logs' },
    { title: 'Account Boosting', desc: 'Grow your online presence fast', icon: <BoostIcon size={22} color="#10b981" />, bg: 'rgba(16,185,129,0.12)', href: '/dashboard/boosting' },
    { title: 'VPN Subscriptions', desc: 'NordVPN, ExpressVPN & more', icon: <VpnIcon size={22} color="#4687ff" />, bg: 'rgba(70,135,255,0.12)', href: '/dashboard/vpn', badge: 'NEW', badgeBg: 'rgba(16,185,129,0.12)', badgeColor: '#10b981' },
  ]

  const notifIcon = (type) => {
    if (type === 'order') return <PackageIcon size={16} color="#8b6ff7" />
    if (type === 'wallet') return <WalletIcon size={16} color="#10b981" />
    if (type === 'referral') return <ReferIcon size={16} color="#f0b429" />
    return <BellIcon size={16} color="#8b6ff7" />
  }

  const notifIconBg = (type) => {
    if (type === 'order') return 'rgba(108,78,242,0.1)'
    if (type === 'wallet') return 'rgba(16,185,129,0.1)'
    if (type === 'referral') return 'rgba(240,180,41,0.1)'
    return 'rgba(108,78,242,0.1)'
  }

  return (
    <main style={{ background: 'var(--navy)', minHeight: '100vh', paddingBottom: '5rem' }}>
      <style>{`
        @keyframes slideProgress { from{width:0%} to{width:100%} }
        @keyframes notifSlideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes greetIn { from{opacity:0;transform:translateY(18px) scale(0.96)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes greetOut { from{opacity:1;transform:translateY(0) scale(1)} to{opacity:0;transform:translateY(-14px) scale(0.97)} }
        .prog-bar { position:absolute; bottom:0; left:0; height:3px; width:0; border-radius:0 2px 2px 0; background:linear-gradient(90deg,rgba(255,255,255,0.3),rgba(255,255,255,0.75)); }
        .prog-bar.go { animation: slideProgress 10s linear forwards; }
        .w-act:hover { background: rgba(255,255,255,0.18) !important; }
        .qa:hover { border-color: rgba(108,78,242,0.4) !important; background: var(--card2) !important; }
        .svc-item:hover { border-color: rgba(108,78,242,0.35) !important; }
        .notif-item:hover { background: var(--card2) !important; }
        .bell-btn:hover { background: var(--card) !important; }
      `}</style>

      {/* TOP BAR */}
      <div style={{ padding: '1.1rem 1.25rem 0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, background: 'var(--header-bg)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <LogoMark size={30} />
          <div style={{ position: 'relative', overflow: 'hidden', minWidth: 120 }}>
            {showGreeting && (
              <div style={{
                position: 'absolute', top: 0, left: 0,
                animation: greetingLeaving
                  ? 'greetOut 0.45s cubic-bezier(0.4,0,1,1) forwards'
                  : 'greetIn 0.5s cubic-bezier(0.22,1,0.36,1) forwards',
                pointerEvents: 'none',
              }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--header-muted)' }}>{greeting},</div>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.9rem', color: 'var(--header-text)', whiteSpace: 'nowrap' }}>{firstName} 👋</div>
              </div>
            )}
            <div style={{ opacity: showGreeting ? 0 : 1, transition: 'opacity 0.4s ease' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--header-muted)', letterSpacing: '0.02em' }}>Welcome to</div>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.92rem', color: 'var(--header-text)' }}>Mega<span style={{ color: 'var(--gold)' }}>Den</span></div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={toggleTheme} style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--card2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {theme === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
          </button>

          {/* NOTIFICATION BELL */}
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button className="bell-btn" onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications && unreadCount > 0) markAllRead() }}
              style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--card2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', transition: 'background 0.2s' }}>
              <BellIcon size={16} />
              {unreadCount > 0 && (
                <div style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: '#f43f5e', border: '1.5px solid var(--navy)' }} />
              )}
            </button>

            {/* NOTIFICATIONS PANEL */}
            {showNotifications && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 300, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,0.35)', zIndex: 300, overflow: 'hidden', animation: 'notifSlideDown 0.25s ease' }}>
                <div style={{ padding: '0.9rem 1.1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>Notifications</div>
                    {unreadCount > 0 && <span style={{ fontSize: '0.62rem', fontWeight: 700, background: '#f43f5e', color: '#fff', borderRadius: 50, padding: '0.1rem 0.4rem' }}>{unreadCount}</span>}
                  </div>
                  {notifications.length > 0 && (
                    <button onClick={markAllRead} style={{ background: 'none', border: 'none', fontSize: '0.7rem', color: 'var(--purple2)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
                      Mark all read
                    </button>
                  )}
                </div>
                <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔔</div>
                      <div style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>No notifications yet</div>
                    </div>
                  ) : (
                    notifications.map((n, i) => (
                      <Link key={n.id} href={n.link || '/dashboard'}
                        onClick={() => { markOneRead(n.id); setShowNotifications(false) }}
                        className="notif-item"
                        style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.85rem 1.1rem', borderBottom: i < notifications.length - 1 ? '1px solid var(--border)' : 'none', textDecoration: 'none', background: n.is_read ? 'transparent' : 'rgba(108,78,242,0.04)', transition: 'background 0.15s' }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: notifIconBg(n.type) }}>
                          {notifIcon(n.type)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.15rem' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{n.title}</div>
                            {!n.is_read && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--purple)', flexShrink: 0 }} />}
                          </div>
                          <div style={{ fontSize: '0.71rem', color: 'var(--muted)', lineHeight: 1.45 }}>{n.message}</div>
                          <div style={{ fontSize: '0.63rem', color: 'var(--muted)', marginTop: '0.25rem', opacity: 0.7 }}>
                            {new Date(n.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <Link href="/dashboard/profile" style={{ textDecoration: 'none', flexShrink: 0 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(108,78,242,0.4)' }}>
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, var(--purple), var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.8rem', color: '#fff' }}>{firstName[0].toUpperCase()}</div>
              }
            </div>
          </Link>
        </div>
      </div>

      <div style={{ padding: '1.1rem 1.15rem', display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>

        {/* WALLET CARD */}
        <div style={{ borderRadius: 24, padding: '1.5rem', position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg,#130b3e 0%,#3a1fa8 45%,#6c4ef2 75%,#a86020 100%)' }}>
          <div style={{ position: 'absolute', top: -60, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ position: 'absolute', bottom: -50, left: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.3rem', position: 'relative' }}>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>Main Balance</div>
            <div style={{ width: 28, height: 20, borderRadius: 4, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '1.3rem', position: 'relative' }}>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2.1rem', fontWeight: 800, color: '#fff', letterSpacing: -1, lineHeight: 1 }}>
              {balanceHidden ? '₦ ••••••' : `₦${(profile?.wallet_balance || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`}
            </div>
            <button onClick={() => setBalanceHidden(!balanceHidden)} style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.8)' }}>
              {balanceHidden ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.55rem', position: 'relative' }}>
            {[
              { label: 'Add Funds', icon: <WalletIcon size={18} />, href: '/dashboard/wallet' },
              { label: 'History', icon: <HistoryIcon size={18} />, href: '/dashboard/orders' },
              { label: 'Buy Number', icon: <PhoneIcon size={18} />, href: '/dashboard/numbers' },
              { label: 'Refer', icon: <ReferIcon size={18} />, href: '/dashboard/referral' },
            ].map(a => (
              <Link key={a.label} href={a.href} className="w-act" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', background: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: '0.6rem 0.15rem', textDecoration: 'none', transition: 'background 0.2s' }}>
                <div style={{ color: '#fff' }}>{a.icon}</div>
                <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>{a.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* STATS ROW */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '1rem 1.1rem' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Total Spent</div>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.35rem', color: 'var(--text)', letterSpacing: -0.5, marginBottom: '0.2rem' }}>
              ₦{((profile?.total_spent || 0) / 1000).toFixed(1)}K
            </div>
            <div style={{ fontSize: '0.67rem', fontWeight: 600, color: '#10b981' }}>↑ this month</div>
          </div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '1rem 1.1rem' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Orders</div>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.35rem', color: 'var(--text)', letterSpacing: -0.5, marginBottom: '0.2rem' }}>
              {orders.length}
            </div>
            <div style={{ fontSize: '0.67rem', fontWeight: 600, color: '#10b981' }}>↑ this week</div>
          </div>
        </div>

        {/* PREMIUM SLIDER */}
        <div>
          <div style={{ borderRadius: 24, overflow: 'hidden' }}>
            <div style={{ display: 'flex', width: '400%', transform: `translateX(-${sliderIndex * 25}%)`, transition: 'transform 0.6s cubic-bezier(0.4,0,0.2,1)' }}>
              {slides.map((slide, i) => (
                <div key={i} style={{ width: '25%', flexShrink: 0, minHeight: 148, position: 'relative', overflow: 'hidden', padding: '1.3rem 1.3rem 1.1rem', background: slide.bg, cursor: 'pointer' }} onClick={() => router.push(slide.href)}>
                  <div style={{ position: 'absolute', top: -20, right: -15, width: 70, height: 70, borderRadius: 16, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', transform: 'rotate(20deg)' }} />
                  <div style={{ position: 'absolute', bottom: -12, right: 30, width: 44, height: 44, borderRadius: 16, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', transform: 'rotate(-12deg)' }} />
                  <div style={{ position: 'absolute', top: 10, right: 60, width: 30, height: 30, borderRadius: 16, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', transform: 'rotate(8deg)' }} />
                  <div style={{ position: 'absolute', top: '1.1rem', right: '1.1rem', zIndex: 3, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 12, padding: '0.3rem 0.65rem', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: '#fff', lineHeight: 1 }}>{slide.badge.amt}</div>
                    <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600, letterSpacing: '0.3px' }}>{slide.badge.lbl}</div>
                  </div>
                  <div style={{ position: 'relative', zIndex: 2 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 50, padding: '0.2rem 0.6rem', fontSize: '0.62rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.5px', marginBottom: '0.6rem' }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
                      {slide.tag}
                    </div>
                    <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: '1.05rem', color: '#fff', lineHeight: 1.15, marginBottom: '0.3rem', letterSpacing: '-0.3px', whiteSpace: 'pre-line' }}>{slide.title}</div>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.5, marginBottom: '0.75rem', maxWidth: 200 }}>{slide.desc}</div>
                    <Link href={slide.href} onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.9rem', background: '#fff', borderRadius: 50, fontSize: '0.72rem', fontWeight: 700, color: '#111', textDecoration: 'none' }}>
                      {slide.btn} <span style={{ fontSize: '0.8rem' }}>→</span>
                    </Link>
                  </div>
                  <div key={`prog-${sliderIndex}`} className={`prog-bar${sliderIndex === i ? ' go' : ''}`} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginTop: '0.9rem' }}>
            {slides.map((slide, d) => (
              <button key={d} onClick={() => goToSlide(d)} style={{ height: 4, width: d === sliderIndex ? 22 : 4, borderRadius: 50, background: d === sliderIndex ? slide.dotColor : 'var(--muted)', border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.35s ease' }} />
            ))}
          </div>
        </div>

        {/* QUICK SERVICES */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
            <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>Quick Services</span>
            <span onClick={() => setShowAllActions(!showAllActions)} style={{ fontSize: '0.72rem', color: 'var(--purple2)', fontWeight: 600, cursor: 'pointer' }}>
              {showAllActions ? 'See Less ↑' : 'See All →'}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.55rem' }}>
            {row1Actions.map(a => (
              <Link key={a.label} href={a.href} className="qa" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '0.8rem 0.15rem', textDecoration: 'none', transition: 'border-color 0.2s, background 0.2s' }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{a.icon}</div>
                <span style={{ fontSize: '0.57rem', color: 'var(--text)', fontWeight: 600, textAlign: 'center', lineHeight: 1.25 }}>{a.label}</span>
              </Link>
            ))}
            {showAllActions && row2Actions.map(a => (
              <Link key={a.label} href={a.href} className="qa" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '0.8rem 0.15rem', textDecoration: 'none', transition: 'border-color 0.2s, background 0.2s' }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{a.icon}</div>
                <span style={{ fontSize: '0.57rem', color: 'var(--text)', fontWeight: 600, textAlign: 'center', lineHeight: 1.25 }}>{a.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* OUR SERVICES */}
        <div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', marginBottom: '0.8rem' }}>Our Services</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {services.map(s => (
              <Link key={s.title} href={s.href} className="svc-item" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '0.9rem 1rem', textDecoration: 'none', transition: 'border-color 0.2s' }}>
                <div style={{ width: 46, height: 46, borderRadius: 14, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.87rem', color: 'var(--text)', marginBottom: '0.12rem' }}>{s.title}</div>
                  <div style={{ fontSize: '0.71rem', color: 'var(--muted)' }}>{s.desc}</div>
                </div>
                {s.badge && <span style={{ fontSize: '0.58rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: 50, background: s.badgeBg, color: s.badgeColor, marginRight: '0.4rem' }}>{s.badge}</span>}
                <div style={{ color: 'var(--muted)', flexShrink: 0 }}><ChevronRight size={14} /></div>
              </Link>
            ))}
          </div>
        </div>

        {/* RECENT ORDERS */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
            <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>Recent Orders</span>
            <Link href="/dashboard/orders" style={{ fontSize: '0.72rem', color: 'var(--purple2)', textDecoration: 'none', fontWeight: 600 }}>View All →</Link>
          </div>
          {orders.length === 0 ? (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '2rem', textAlign: 'center' }}>
              <div style={{ color: 'var(--muted)', marginBottom: '0.3rem' }}><PackageIcon size={32} /></div>
              <div style={{ color: 'var(--muted)', fontSize: '0.82rem', marginBottom: '0.8rem' }}>No orders yet. Start shopping!</div>
              <Link href="/dashboard/numbers" style={{ display: 'inline-block', padding: '0.48rem 1.1rem', background: 'var(--purple)', color: '#fff', borderRadius: 8, fontSize: '0.8rem', textDecoration: 'none', fontWeight: 500 }}>Browse Services</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {orders.map(order => (
                <div key={order.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '0.8rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(108,78,242,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--purple2)', flexShrink: 0 }}>
                      <PackageIcon size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--text)' }}>{order.product_name}</div>
                      <div style={{ fontSize: '0.67rem', color: 'var(--muted)', marginTop: '0.08rem' }}>{new Date(order.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--gold)' }}>₦{order.amount?.toLocaleString()}</div>
                    <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '0.18rem 0.55rem', borderRadius: 50, display: 'inline-block', marginTop: '0.22rem', background: order.status === 'completed' ? 'rgba(16,185,129,0.12)' : 'rgba(240,180,41,0.12)', color: order.status === 'completed' ? '#10b981' : 'var(--gold)' }}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* BOTTOM NAV */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(11,14,26,0.94)', backdropFilter: 'blur(24px)', borderTop: '1px solid var(--border)', padding: '0.6rem 2rem 0.85rem', display: 'flex', justifyContent: 'space-around', zIndex: 100 }}>
        {[
          { icon: <HomeIcon size={20} />, label: 'Home', tab: 'home', href: '/dashboard' },
          { icon: <PackageIcon size={20} />, label: 'Orders', tab: 'orders', href: '/dashboard/orders' },
          { icon: <WalletIcon size={20} />, label: 'Wallet', tab: 'wallet', href: '/dashboard/wallet' },
          { icon: <UserIcon size={20} />, label: 'Profile', tab: 'profile', href: '/dashboard/profile' },
        ].map(n => (
          <Link key={n.tab} href={n.href} onClick={() => setActiveTab(n.tab)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.18rem', textDecoration: 'none' }}>
            <div style={{ color: activeTab === n.tab ? 'var(--purple2)' : 'var(--muted)' }}>{n.icon}</div>
            <span style={{ fontSize: '0.58rem', color: activeTab === n.tab ? 'var(--purple2)' : 'var(--muted)', fontWeight: activeTab === n.tab ? 600 : 400 }}>{n.label}</span>
            {activeTab === n.tab && <div style={{ width: 6, height: 3, borderRadius: 2, background: 'var(--purple2)' }} />}
          </Link>
        ))}
      </div>
    </main>
  )
}

// ── ICONS ──
function WalletIcon({ size = 20, color = 'currentColor' }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 12h2"/><path d="M2 10h20"/></svg> }
function PhoneIcon({ size = 20, color = 'currentColor' }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1"/></svg> }
function LogsIcon({ size = 20, color = 'currentColor' }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> }
function BoostIcon({ size = 20, color = 'currentColor' }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> }
function VpnIcon({ size = 20, color = 'currentColor' }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> }
function ReferIcon({ size = 20, color = 'currentColor' }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> }
function HistoryIcon({ size = 20, color = 'currentColor' }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> }
function TrackIcon({ size = 20, color = 'currentColor' }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> }
function HomeIcon({ size = 20, color = 'currentColor' }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> }
function PackageIcon({ size = 20, color = 'currentColor' }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> }
function UserIcon({ size = 20, color = 'currentColor' }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> }
function BellIcon({ size = 20, color = 'currentColor' }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> }
function EyeIcon({ size = 16, color = 'currentColor' }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> }
function EyeOffIcon({ size = 16, color = 'currentColor' }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> }
function ChevronRight({ size = 16, color = 'currentColor' }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg> }
function SunIcon({ size = 16, color = 'currentColor' }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> }
function MoonIcon({ size = 16, color = 'currentColor' }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> }
function LogoMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: size * 0.25, flexShrink: 0 }}>
      <rect width="80" height="80" rx="20" fill="#0f0c24"/>
      <line x1="18" y1="58" x2="18" y2="22" stroke="#fff" strokeWidth="5" strokeLinecap="round"/>
      <line x1="18" y1="22" x2="40" y2="44" stroke="#fff" strokeWidth="5" strokeLinecap="round"/>
      <line x1="40" y1="44" x2="62" y2="22" stroke="#fff" strokeWidth="5" strokeLinecap="round"/>
      <line x1="62" y1="22" x2="62" y2="58" stroke="#fff" strokeWidth="5" strokeLinecap="round"/>
      <path d="M0 66 L80 66 L80 80 Q80 80 60 80 L20 80 Q0 80 0 80 Z" fill="#f0b429"/>
      <path d="M0 0 L5 0 L5 55 Q0 66 0 66 Z" fill="#6c4ef2"/>
    </svg>
  )
}