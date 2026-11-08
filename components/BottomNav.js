'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HomeIcon, PackageIcon, WalletIcon, UserIcon } from './NavIcons'

// The four primary destinations. Sub-pages (e.g. /dashboard/bills) simply
// render with no tab highlighted — same convention most apps use for a
// "more" or standalone flow that lives a level below the main tabs.
const TABS = [
  { label: 'Home', href: '/dashboard', icon: HomeIcon },
  { label: 'Orders', href: '/dashboard/orders', icon: PackageIcon },
  { label: 'Wallet', href: '/dashboard/wallet', icon: WalletIcon },
  { label: 'Profile', href: '/dashboard/profile', icon: UserIcon },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <div style={{
      position: 'fixed', left: '0.9rem', right: '0.9rem', bottom: 'calc(0.85rem + env(safe-area-inset-bottom))',
      background: 'rgba(22,27,48,0.92)', backdropFilter: 'blur(24px)', border: '1px solid var(--border)',
      borderRadius: 26, boxShadow: '0 12px 32px rgba(0,0,0,0.35)', padding: '0.55rem 0.6rem',
      display: 'flex', justifyContent: 'space-between', zIndex: 100,
    }}>
      <style>{`
        .bottom-nav-item { -webkit-tap-highlight-color: transparent; }
        .bottom-nav-item:active { transform: scale(0.93); }
      `}</style>
      {TABS.map(t => {
        const active = pathname === t.href
        const Icon = t.icon
        return (
          <Link key={t.href} href={t.href} className="bottom-nav-item"
            style={{ display: 'flex', justifyContent: 'center', flex: 1, textDecoration: 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 34, height: 34, borderRadius: 12,
                background: active ? 'var(--purple2)' : 'transparent',
                color: active ? '#fff' : 'var(--muted)',
                transition: 'background 0.25s cubic-bezier(0.34,1.56,0.64,1), color 0.2s ease',
              }}>
                <Icon size={18} />
              </div>
              <span style={{ fontSize: '0.58rem', color: active ? 'var(--purple2)' : 'var(--muted)', fontWeight: active ? 700 : 500, transition: 'color 0.2s ease' }}>{t.label}</span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}