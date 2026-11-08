'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoMark from './LogoMark'
import {
  HomeIcon, PackageIcon, WalletIcon, UserIcon,
  PhoneIcon, SubsIcon, BoostIcon, VpnIcon, BillsIcon, LogoutIcon,
} from './NavIcons'

const NAV_ITEMS = [
  { label: 'Home', href: '/dashboard', icon: HomeIcon },
  { label: 'Orders', href: '/dashboard/orders', icon: PackageIcon },
  { label: 'Wallet', href: '/dashboard/wallet', icon: WalletIcon },
  { label: 'Profile', href: '/dashboard/profile', icon: UserIcon },
]

const SERVICE_ITEMS = [
  { label: 'Foreign Numbers', href: '/dashboard/numbers', icon: PhoneIcon },
  { label: 'Digital Subscriptions', href: '/dashboard/subscriptions', icon: SubsIcon },
  { label: 'Account Boosting', href: '/dashboard/boosting', icon: BoostIcon },
  { label: 'VPN Subscriptions', href: '/dashboard/vpn', icon: VpnIcon },
  { label: 'Top-Up & Bills', href: '/dashboard/bills', icon: BillsIcon },
]

export default function DesktopSidebar({ profile, onLogout }) {
  const pathname = usePathname()
  const firstName = profile?.full_name?.split(' ')[0] || 'User'

  const renderLink = (item) => {
    const active = pathname === item.href
    const Icon = item.icon
    return (
      <Link key={item.href} href={item.href} className="d-navitem"
        style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.55rem 0.6rem', borderRadius: 10, textDecoration: 'none', transition: 'background 0.15s',
          background: active ? 'rgba(108,78,242,0.12)' : 'transparent',
          color: active ? 'var(--purple2)' : 'var(--muted)' }}>
        <Icon size={18} />
        <span style={{ fontSize: '0.83rem', fontWeight: 600 }}>{item.label}</span>
      </Link>
    )
  }

  return (
    <div style={{ width: 232, flexShrink: 0, background: 'var(--navy2)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '1.3rem 1rem', position: 'sticky', top: 0, height: '100vh' }}>
      <style>{`
        .d-navitem:hover { background: var(--card2) !important; color: var(--text) !important; }
        .d-logout:hover { background: var(--card2) !important; color: var(--text) !important; }
      `}</style>

      <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none', padding: '0 0.4rem', marginBottom: '1.8rem' }}>
        <LogoMark size={30} />
        <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>Mega<span style={{ color: 'var(--gold)' }}>Den</span></span>
      </Link>

      <div style={{ fontSize: '0.63rem', fontWeight: 700, letterSpacing: '0.5px', color: 'var(--muted)', padding: '0 0.6rem', marginBottom: '0.5rem' }}>MENU</div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginBottom: '1.3rem' }}>
        {NAV_ITEMS.map(renderLink)}
      </nav>

      <div style={{ fontSize: '0.63rem', fontWeight: 700, letterSpacing: '0.5px', color: 'var(--muted)', padding: '0 0.6rem', marginBottom: '0.5rem' }}>SERVICES</div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
        {SERVICE_ITEMS.map(renderLink)}
      </nav>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <button onClick={onLogout} className="d-logout"
          style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.55rem 0.6rem', borderRadius: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', transition: 'background 0.15s', fontFamily: 'Inter, sans-serif' }}>
          <LogoutIcon size={18} />
          <span style={{ fontSize: '0.83rem', fontWeight: 600 }}>Log out</span>
        </button>
        <Link href="/dashboard/profile" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none', padding: '0.6rem', borderRadius: 10, borderTop: '1px solid var(--border)', marginTop: '0.3rem' }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(108,78,242,0.4)', flexShrink: 0 }}>
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, var(--purple), var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.75rem', color: '#fff' }}>{firstName[0].toUpperCase()}</div>
            }
          </div>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>{firstName}</span>
        </Link>
      </div>
    </div>
  )
}