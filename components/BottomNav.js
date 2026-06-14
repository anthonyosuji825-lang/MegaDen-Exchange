// components/BottomNav.js
'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

export default function BottomNav() {
  const pathname = usePathname()

  const getTab = () => {
    if (pathname === '/dashboard' || pathname === '/dashboard/') return 'home'
    if (pathname.startsWith('/dashboard/orders')) return 'orders'
    if (pathname.startsWith('/dashboard/wallet')) return 'wallet'
    if (pathname.startsWith('/dashboard/profile')) return 'profile'
    return ''
  }

  const activeTab = getTab()

  const navItems = [
    { icon: <HomeIcon size={20} />, label: 'Home', tab: 'home', href: '/dashboard' },
    { icon: <PackageIcon size={20} />, label: 'Orders', tab: 'orders', href: '/dashboard/orders' },
    { icon: <WalletIcon size={20} />, label: 'Wallet', tab: 'wallet', href: '/dashboard/wallet' },
    { icon: <UserIcon size={20} />, label: 'Profile', tab: 'profile', href: '/dashboard/profile' },
  ]

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(11,14,26,0.94)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderTop: '1px solid var(--border)', padding: '0.6rem 2rem 0.85rem', display: 'flex', justifyContent: 'space-around', zIndex: 100 }}>
      {navItems.map(n => (
        <Link key={n.tab} href={n.href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', textDecoration: 'none', minWidth: 48 }}>
          <div style={{ color: activeTab === n.tab ? 'var(--purple2)' : 'var(--muted)' }}>{n.icon}</div>
          <span style={{ fontSize: '0.58rem', color: activeTab === n.tab ? 'var(--purple2)' : 'var(--muted)', fontWeight: activeTab === n.tab ? 600 : 400 }}>{n.label}</span>
          {activeTab === n.tab && <div style={{ width: 6, height: 3, borderRadius: 2, background: 'var(--purple2)' }} />}
        </Link>
      ))}
    </div>
  )
}

function HomeIcon({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
}
function PackageIcon({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
}
function WalletIcon({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 12h2"/><path d="M2 10h20"/></svg>
}
function UserIcon({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
}