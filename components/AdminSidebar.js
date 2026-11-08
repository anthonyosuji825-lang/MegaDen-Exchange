import Link from 'next/link'
import LogoMark from './LogoMark'
import { LogoutIcon } from './NavIcons'

// Unlike the customer DesktopSidebar (which links between real routes and
// derives "active" from the URL), the admin panel is one page with tab
// *state* — so this takes the tabs, current tab, and a setter as props
// instead of hardcoding routes or reading usePathname.
export default function AdminSidebar({ tabs, activeTab, onTabChange, onLogout }) {
  return (
    <div style={{ width: 220, flexShrink: 0, background: 'var(--navy2)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '1.3rem 1rem', position: 'sticky', top: 0, height: '100vh' }}>
      <style>{`
        .admin-navitem:hover { background: var(--card2) !important; color: var(--text) !important; }
        .admin-logout:hover { background: var(--card2) !important; color: var(--text) !important; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0 0.4rem', marginBottom: '1.8rem' }}>
        <LogoMark size={30} />
        <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)' }}>
          Mega<span style={{ color: 'var(--gold)' }}>Den</span> <span style={{ color: 'var(--purple2)' }}>Admin</span>
        </span>
      </div>

      <div style={{ fontSize: '0.63rem', fontWeight: 700, letterSpacing: '0.5px', color: 'var(--muted)', padding: '0 0.6rem', marginBottom: '0.5rem' }}>SECTIONS</div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', flex: 1, overflowY: 'auto' }}>
        {tabs.map(tab => {
          const active = activeTab === tab.id
          return (
            <button key={tab.id} onClick={() => onTabChange(tab.id)} className="admin-navitem"
              style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.55rem 0.6rem', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif', transition: 'background 0.15s',
                background: active ? 'rgba(108,78,242,0.12)' : 'transparent',
                color: active ? 'var(--purple2)' : 'var(--muted)' }}>
              {tab.icon}
              <span style={{ fontSize: '0.83rem', fontWeight: 600 }}>{tab.label}</span>
            </button>
          )
        })}
      </nav>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border)' }}>
        <Link href="/dashboard" className="admin-navitem"
          style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.55rem 0.6rem', borderRadius: 10, textDecoration: 'none', color: 'var(--muted)', fontSize: '0.83rem', fontWeight: 600, transition: 'background 0.15s' }}>
          ← Back to Store
        </Link>
        <button onClick={onLogout} className="admin-logout"
          style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.55rem 0.6rem', borderRadius: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', transition: 'background 0.15s', fontFamily: 'Inter, sans-serif' }}>
          <LogoutIcon size={18} />
          <span style={{ fontSize: '0.83rem', fontWeight: 600 }}>Log out</span>
        </button>
      </div>
    </div>
  )
}