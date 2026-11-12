'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import LoadingScreen from '@/components/RouteLoader'
import BottomNav from '@/components/BottomNav'
import DesktopSidebar from '@/components/DesktopSidebar'

const TABS = [
  { id: 'airtime', label: 'Airtime', Icon: PhoneIcon },
  { id: 'data', label: 'Data', Icon: SignalIcon },
  { id: 'cable', label: 'Cable TV', Icon: TvIcon },
]
const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000]

export default function BillsPage() {
  const [pageLoading, setPageLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [activeTab, setActiveTab] = useState('airtime')
  const [broadcast, setBroadcast] = useState(null) // { enabled, message } | null while loading
  const [isDesktop, setIsDesktop] = useState(false)
  const [mounted, setMounted] = useState(false)

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
      if (!user) { window.location.href = '/login'; return }
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(profileData)
      setPageLoading(false)
    }
    load()

    fetch('/api/bills/broadcast')
      .then(r => r.json())
      .then(setBroadcast)
      .catch(() => setBroadcast({ enabled: false, message: '' }))
  }, [])

  const bumpBalance = (delta) => {
    setProfile(p => ({ ...p, wallet_balance: (p.wallet_balance || 0) + delta }))
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (pageLoading) return <LoadingScreen />

  return (
    <main style={{ background: 'var(--navy)', minHeight: '100vh', display: isDesktop ? 'flex' : 'block' }}>
      <style>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes pop { 0% { transform: scale(0.4); opacity: 0; } 60% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); } }
        @keyframes ring { 0% { box-shadow: 0 0 0 0 rgba(52,211,153,0.45); } 100% { box-shadow: 0 0 0 22px rgba(52,211,153,0); } }
        * { box-sizing: border-box; }
        .bl-swipe::-webkit-scrollbar { display: none; }
        .bl-scroll::-webkit-scrollbar { width: 4px; }
        .bl-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }
        .bl-chip { transition: transform 0.15s ease, border-color 0.15s, background 0.15s, box-shadow 0.15s; }
        .bl-chip:hover { transform: translateY(-2px); }
        .bl-chip:active { transform: scale(0.97); }
        .bl-chip:focus-visible, .bl-tab:focus-visible, .bl-buy:focus-visible, .bl-link:focus-visible, .bl-opt:focus-visible, .bl-trigger:focus-visible { outline: 2px solid var(--purple); outline-offset: 2px; }
        .bl-buy { transition: transform 0.18s ease, box-shadow 0.18s, background 0.18s; }
        .bl-buy:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 32px rgba(108,78,242,0.45); }
        .bl-buy:active:not(:disabled) { transform: scale(0.98); }
        .bl-input { transition: border-color 0.2s, box-shadow 0.2s; }
        .bl-input:focus { border-color: var(--purple) !important; box-shadow: 0 0 0 3px rgba(108,78,242,0.12); }
        .bl-back { transition: background 0.15s, transform 0.15s; }
        .bl-back:hover { background: var(--card2) !important; transform: translateX(-2px); }
        .bl-link { transition: background 0.15s, border-color 0.15s; }
        .bl-link:hover { background: var(--card2) !important; }
        .bl-tab { transition: background 0.2s, color 0.2s, border-color 0.2s; }
        .bl-opt:hover { background: var(--card2) !important; }
        .bl-marquee { animation: marquee linear infinite; }
        .bl-marquee:hover { animation-play-state: paused; }
        .bl-skel { background: linear-gradient(90deg, var(--card) 25%, var(--card2) 50%, var(--card) 75%); background-size: 200% 100%; animation: shimmer 1.4s linear infinite; border: 1px solid var(--border); }
        .bl-input::-webkit-outer-spin-button, .bl-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .bl-input[type=number] { -moz-appearance: textfield; }
        @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; } }
      `}</style>

      {isDesktop && <DesktopSidebar profile={profile} onLogout={handleLogout} />}

      <div style={{ flex: isDesktop ? 1 : 'none', minWidth: 0, paddingBottom: isDesktop ? '2rem' : '6.5rem' }}>
        {/* ── STICKY HEADER ── */}
        <div style={{ padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.85rem', position: 'sticky', top: 0, zIndex: 100, background: 'var(--header-bg, rgba(var(--navy-rgb, 10,10,30), 0.92))', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)' }}>
          <Link href="/dashboard" className="bl-back" aria-label="Back to dashboard" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', textDecoration: 'none', flexShrink: 0 }}>
            <BackIcon />
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--text)', letterSpacing: '-0.02em' }}>Top-Up &amp; Bills</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.05rem' }}>Airtime, data &amp; TV subscriptions</div>
          </div>
          <Link href="/dashboard/wallet" className="bl-link" aria-label="Fund wallet" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.4rem 0.35rem 0.75rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, flexShrink: 0, textDecoration: 'none' }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>BAL</span>
            <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem', color: 'var(--gold)' }}>₦{(profile?.wallet_balance || 0).toLocaleString()}</span>
            <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--purple)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PlusIcon size={11} /></span>
          </Link>
        </div>

        <div style={{ padding: '1.2rem', maxWidth: 480, margin: '0 auto' }}>
          {/* ── BROADCAST ── */}
          {broadcast?.enabled && broadcast.message && (
            <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center', background: 'rgba(240,180,41,0.08)', border: '1px solid rgba(240,180,41,0.28)', borderRadius: 14, padding: '0.7rem 0.9rem', marginBottom: '1.1rem', overflow: 'hidden', animation: mounted ? 'fadeSlideIn 0.35s ease both' : 'none' }}>
              <div style={{ width: 28, height: 28, borderRadius: 9, background: 'rgba(240,180,41,0.15)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MegaphoneIcon size={15} color="#f0b429" />
              </div>
              <div style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                <div className="bl-marquee" style={{ display: 'inline-flex', width: 'max-content', animationDuration: `${Math.max(12, broadcast.message.length * 0.18)}s` }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text)', paddingRight: '3rem' }}>{broadcast.message}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text)', paddingRight: '3rem' }}>{broadcast.message}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── TABS ── */}
          <div role="tablist" style={{ display: 'flex', gap: '0.3rem', padding: '0.3rem', marginBottom: '1.4rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14 }}>
            {TABS.map(({ id, label, Icon }) => {
              const on = activeTab === id
              return (
                <button key={id} role="tab" aria-selected={on} className="bl-tab" onClick={() => setActiveTab(id)}
                  style={{ flex: 1, padding: '0.6rem 0.4rem', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem', border: `1px solid ${on ? 'rgba(108,78,242,0.4)' : 'transparent'}`, background: on ? 'rgba(108,78,242,0.14)' : 'transparent', color: on ? 'var(--purple2)' : 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                  <Icon size={14} />
                  {label}
                </button>
              )
            })}
          </div>

          <div key={activeTab} style={{ animation: mounted ? 'fadeSlideIn 0.35s ease both' : 'none' }}>
            {activeTab === 'airtime' && <AirtimeForm profile={profile} bumpBalance={bumpBalance} />}
            {activeTab === 'data' && <DataForm profile={profile} bumpBalance={bumpBalance} />}
            {activeTab === 'cable' && <CableForm profile={profile} bumpBalance={bumpBalance} />}
          </div>
        </div>
      </div>

      {!isDesktop && <BottomNav />}
    </main>
  )
}

// ── Shared bits ──────────────────────────────────────────────────────────

function StepHeader({ n, done, title, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.8rem' }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', background: done ? '#34d399' : 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.3s' }}>
        {done ? <CheckIcon size={11} color="#fff" /> : <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#fff' }}>{n}</span>}
      </div>
      <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>{title}</span>
      {right && (
        <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '55%' }}>
          <CheckIcon size={11} color="#34d399" />
          {right}
        </span>
      )}
    </div>
  )
}

function Section({ children, last }) {
  return <div style={{ marginBottom: last ? 0 : '1.5rem' }}>{children}</div>
}

// Input with a leading icon/prefix. `prefix` is any node (icon or text).
function Field({ prefix, ...props }) {
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none', display: 'flex', alignItems: 'center', fontSize: '0.9rem', fontWeight: 700 }}>{prefix}</div>
      <input className="bl-input" {...props}
        style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.5rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif', outline: 'none', ...props.style }} />
    </div>
  )
}

// Brand marks recreated as wordmarks/monograms using each provider's real
// colors, shape and lettering (not copies of their official artwork files —
// those are trademarked assets we can't embed directly). This reads as a
// "real" logo at a glance while staying original, in-code SVG/CSS.
// shape: 'circle' | 'square' (rounded) — matches the real logo's container.
const LOGOS = {
  mtn:       { shape: 'square', bg: '#ffcc00', color: '#111111', text: 'MTN',     fontSize: '0.72rem', weight: 900, tracking: '0.02em' },
  airtel:    { shape: 'circle', bg: '#e30613', color: '#ffffff', text: 'airtel',  fontSize: '0.5rem',  weight: 700, tracking: '0' },
  glo:       { shape: 'circle', bg: '#00a651', color: '#ffffff', text: 'glo',     fontSize: '0.68rem', weight: 800, tracking: '0.01em' },
  '9mobile': { shape: 'circle', bg: '#00563f', color: '#a4d65e', text: '9',       fontSize: '1.15rem', weight: 900, tracking: '0' },
  dstv:      { shape: 'circle', bg: '#0072bc', color: '#ffffff', text: 'DStv',    fontSize: '0.56rem', weight: 800, tracking: '0' },
  gotv:      { shape: 'circle', bg: '#0f9d58', color: '#ffffff', text: 'GOtv',    fontSize: '0.52rem', weight: 800, tracking: '0' },
  startimes: { shape: 'square', bg: '#f7941d', color: '#ffffff', text: 'ST',      fontSize: '0.85rem', weight: 900, tracking: '0.02em' },
  showmax:   { shape: 'square', bg: '#000000', color: '#ffffff', text: 'SM',      fontSize: '0.78rem', weight: 900, tracking: '0.04em' },
}
const FALLBACK_PALETTE = ['#6c4ef2', '#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6']

// Falls back to a deterministic-color monogram (initials) for anything not
// in LOGOS, so unlisted DISCOs/providers still look intentional.
function brandFor(label) {
  const key = (label || '').toLowerCase().trim()
  if (LOGOS[key]) return LOGOS[key]
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash)
  return {
    shape: 'circle',
    bg: FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length],
    color: '#ffffff',
    text: (label || '?').slice(0, 2).toUpperCase(),
    fontSize: '0.85rem',
    weight: 800,
    tracking: '0',
  }
}

// VTUGATE names its "display name" field differently per service category
// (network_name for airtime/data, tv_name for cable) — confirmed
// inconsistent across their own API.
function serviceLabel(item) {
  return item.network_name || item.tv_name || item.provider_name || item.name || `#${item.service_id}`
}

// Official logo files. Drop the image files into /public/logos/ (names below) and they are used
// automatically; until a file exists (or if it fails to load) the wordmark tile above is shown.
const LOGO_FILES = {
  dstv: '/logos/dstv.png',
  gotv: '/logos/gotv.png',
  startimes: '/logos/startimes.png',
  showmax: '/logos/showmax.png',
}

function BrandTile({ brand, size = 44, label }) {
  const [failed, setFailed] = useState(false)
  const file = LOGO_FILES[(label || '').toLowerCase().trim()]
  if (file && !failed) {
    return (
      <div aria-hidden style={{ width: size, height: size, borderRadius: Math.round(size * 0.28), background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', padding: 4, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.12)' }}>
        <img src={file} alt="" width={size - 8} height={size - 8} onError={() => setFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
      </div>
    )
  }
  return (
    <div aria-hidden style={{
      width: size, height: size, borderRadius: brand.shape === 'square' ? Math.round(size * 0.28) : '50%',
      background: brand.bg, color: brand.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Outfit, sans-serif', fontWeight: brand.weight, fontSize: brand.fontSize,
      letterSpacing: brand.tracking, flexShrink: 0, lineHeight: 1,
      boxShadow: `inset 0 0 0 1px rgba(0,0,0,0.08), 0 4px 12px ${brand.bg}30`, overflow: 'hidden', padding: '0 2px',
    }}>
      {brand.text}
    </div>
  )
}

// Logo picker: a swipeable grid (2 rows x 4 columns per page, or a single row when there
// are 4 or fewer), same pattern as the Numbers page service picker, with page dots and a hint.
// Selected state is tinted with the option's own brand colour.
function LogoPicker({ options, value, onChange, subLabel, loading = false, noun = 'networks' }) {
  const [page, setPage] = useState(0)
  const [pct, setPct] = useState(0)
  const rows = options.length <= 4 ? 1 : 2
  const cols = Math.ceil(options.length / rows)
  const pages = Math.max(1, Math.ceil(cols / 4))

  const handleScroll = (e) => {
    const el = e.currentTarget
    const max = el.scrollWidth - el.clientWidth
    setPct(max > 0 ? el.scrollLeft / max : 0)
    setPage(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))
  }

  if (loading && options.length === 0) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
        {[0, 1, 2, 3].map(i => <div key={i} className="bl-skel" style={{ height: 96, borderRadius: 14 }} />)}
      </div>
    )
  }

  return (
    <div>
      <div className="bl-swipe" onScroll={handleScroll}
        style={{ display: 'grid', gridTemplateRows: `repeat(${rows}, 1fr)`, gridAutoFlow: 'column', gridAutoColumns: 'calc(25% - 0.38rem)', justifyContent: cols <= 4 ? 'center' : 'start', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.3rem', scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
        {options.map(opt => {
          const selected = String(value) === String(opt.idKey)
          const brand = brandFor(opt.label)
          return (
            <button key={opt.idKey} type="button" className="bl-chip" aria-pressed={selected} onClick={() => onChange(String(opt.idKey))}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                padding: '0.9rem 0.3rem', minWidth: 0, borderRadius: 14, cursor: 'pointer',
                border: `1.5px solid ${selected ? brand.bg : 'var(--border)'}`,
                background: selected ? `${brand.bg}15` : 'var(--card)',
                boxShadow: selected ? `0 4px 16px ${brand.bg}33` : 'none',
              }}>
              <div style={{ filter: selected ? 'none' : 'grayscale(15%) opacity(0.92)', transition: 'filter 0.2s', display: 'flex' }}>
                <BrandTile brand={brand} size={44} label={opt.label} />
              </div>
              <span style={{ fontSize: '0.68rem', fontWeight: 600, color: selected ? brand.bg : 'var(--text)', textAlign: 'center', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                {opt.label}
              </span>
              {subLabel && <span style={{ fontSize: '0.58rem', color: 'var(--muted)', textAlign: 'center', marginTop: '-0.3rem' }}>{subLabel(opt)}</span>}
            </button>
          )
        })}
      </div>

      {pages > 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', marginTop: '0.5rem' }}>
          {pages <= 7 ? (
            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
              {Array.from({ length: pages }).map((_, i) => (
                <div key={i} style={{ width: page === i ? 16 : 6, height: 6, borderRadius: 99, background: page === i ? 'var(--purple)' : 'var(--border)', transition: 'all 0.3s ease' }} />
              ))}
            </div>
          ) : (
            <div style={{ position: 'relative', width: 96, height: 5, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, height: '100%', width: '26%', left: `${pct * 74}%`, borderRadius: 99, background: 'var(--purple)', transition: 'left 0.1s linear' }} />
            </div>
          )}
          <span style={{ fontSize: '0.6rem', color: 'var(--muted)', letterSpacing: '0.04em' }}>
            {pct > 0.98 ? 'That’s everything ←' : `Swipe to see more ${noun} →`}
          </span>
        </div>
      )}
    </div>
  )
}

// A custom dropdown for plan/package selection, replacing the native
// <select> — native selects render as an unstyleable OS popup (the plain
// blue list), so this renders its own themed panel instead. Options are
// objects with { code, name, price }. Adds a search box once the list is long.
function PlanPicker({ value, onChange, options, placeholder = 'Select plan', disabled = false, loading = false }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const handleKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('touchstart', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('touchstart', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [])

  useEffect(() => { if (!open) setQ('') }, [open])

  const selected = options.find(o => String(o.code) === String(value))
  const searchable = options.length > 8
  const shown = q.trim() ? options.filter(o => String(o.name).toLowerCase().includes(q.trim().toLowerCase())) : options

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="bl-trigger" onClick={() => !disabled && setOpen(o => !o)} disabled={disabled} aria-haspopup="listbox" aria-expanded={open}
        style={{
          width: '100%', padding: '0.85rem 1rem', borderRadius: 12, background: 'var(--card)',
          color: 'var(--text)', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif', outline: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem',
          cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1,
          border: `1px solid ${open ? 'var(--purple)' : selected ? 'rgba(108,78,242,0.4)' : 'var(--border)'}`,
          boxShadow: open ? '0 0 0 3px rgba(108,78,242,0.12)' : 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
        }}>
        <span style={{ color: selected ? 'var(--text)' : 'var(--muted)', fontWeight: selected ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {loading && <Spinner color="var(--purple)" size={14} />}
          {loading ? 'Loading plans…' : selected ? selected.name : placeholder}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
          {selected && (
            <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem', fontWeight: 800, color: 'var(--gold)' }}>₦{Number(selected.price).toLocaleString()}</span>
          )}
          <ChevronDownIcon size={16} color="var(--muted)" rotated={open} />
        </div>
      </button>

      {open && (
        <div role="listbox" style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 200, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.4)', overflow: 'hidden', animation: 'scaleIn 0.15s ease both', transformOrigin: 'top center' }}>
          {searchable && (
            <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)', position: 'relative' }}>
              <div style={{ position: 'absolute', left: '1.1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none', display: 'flex' }}><SearchIcon size={13} /></div>
              <input className="bl-input" autoFocus placeholder="Search plans…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search plans"
                style={{ width: '100%', padding: '0.55rem 0.8rem 0.55rem 2rem', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: '0.8rem', outline: 'none', fontFamily: 'Inter, sans-serif' }} />
            </div>
          )}
          <div className="bl-scroll" style={{ maxHeight: 264, overflowY: 'auto', padding: '0.4rem' }}>
            {shown.length === 0 ? (
              <div style={{ padding: '1.1rem', fontSize: '0.8rem', color: 'var(--muted)', textAlign: 'center' }}>{options.length === 0 ? 'No plans available' : `No plan found for “${q}”`}</div>
            ) : shown.map(opt => {
              const isSelected = String(opt.code) === String(value)
              return (
                <button key={opt.code} type="button" role="option" aria-selected={isSelected} className="bl-opt" onClick={() => { onChange(opt.code); setOpen(false) }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem', padding: '0.7rem 0.75rem', borderRadius: 10, border: 'none', background: isSelected ? 'rgba(108,78,242,0.14)' : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
                    <span style={{ width: 16, height: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--purple2)' }}>{isSelected && <CheckIcon size={13} color="var(--purple2)" />}</span>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text)', fontWeight: isSelected ? 700 : 500, lineHeight: 1.3 }}>{opt.name}</span>
                  </span>
                  <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem', fontWeight: 800, color: isSelected ? 'var(--gold)' : 'var(--muted)', flexShrink: 0 }}>₦{Number(opt.price).toLocaleString()}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ rows, total, balance }) {
  const ok = balance >= total
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '1rem', animation: 'scaleIn 0.3s ease both' }}>
      <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)', marginBottom: '0.75rem' }}>Order summary</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        {rows.map(r => <Row key={r.label} label={r.label}>{r.value}</Row>)}
        <Row label="Balance"><span style={{ color: ok ? '#10b981' : '#f43f5e', fontWeight: 700 }}>₦{balance.toLocaleString()}</span></Row>
        <div style={{ height: 1, background: 'var(--border)', margin: '0.1rem 0' }} />
        <Row label="Total" bold><span style={{ color: 'var(--gold)', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem' }}>₦{total.toLocaleString()}</span></Row>
      </div>
    </div>
  )
}

function Row({ label, children, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', gap: '0.5rem' }}>
      <span style={{ color: 'var(--muted)', flexShrink: 0, fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ color: 'var(--text)', fontWeight: bold ? 700 : 500, textAlign: 'right', minWidth: 0, wordBreak: 'break-word' }}>{children}</span>
    </div>
  )
}

function ErrorBanner({ error }) {
  if (!error) return null
  return (
    <div role="alert" style={{ background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 12, padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#f43f5e', marginTop: '0.9rem', display: 'flex', alignItems: 'flex-start', gap: '0.55rem', lineHeight: 1.45 }}>
      <span style={{ flexShrink: 0, marginTop: '0.1rem', display: 'flex' }}><InfoIcon size={15} color="#f43f5e" /></span>
      <span>{error}</span>
    </div>
  )
}

function InsufficientBanner({ show }) {
  if (!show) return null
  return (
    <div style={{ background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 12, padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#f43f5e', marginTop: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span>Insufficient balance</span>
      <Link href="/dashboard/wallet" style={{ color: '#f43f5e', fontWeight: 700, textDecoration: 'none', fontSize: '0.75rem' }}>Fund Wallet →</Link>
    </div>
  )
}

function SuccessCard({ title, lines, amount, onReset }) {
  const [ts] = useState(() => new Date())
  const when = ts.toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.08) 0%, rgba(108,78,242,0.06) 100%)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 22, padding: '1.6rem 1.3rem 1.3rem', animation: 'scaleIn 0.35s ease both' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.3rem' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', margin: '0 auto 0.9rem', background: 'rgba(52,211,153,0.16)', border: '1px solid rgba(52,211,153,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pop 0.5s ease both, ring 1.2s ease-out 0.3s 1' }}>
          <CheckIcon size={28} color="#34d399" />
        </div>
        <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.05rem', color: 'var(--text)' }}>{title}</div>
        {amount != null && (
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: '1.9rem', color: 'var(--gold)', marginTop: '0.25rem', letterSpacing: '-0.02em' }}>₦{Number(amount).toLocaleString()}</div>
        )}
        <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '0.2rem' }}>{when}</div>
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '0.35rem 0.95rem' }}>
        {lines.map((l, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', fontSize: '0.8rem', padding: '0.6rem 0', borderBottom: i < lines.length - 1 ? '1px dashed var(--border)' : 'none' }}>
            <span style={{ color: 'var(--muted)', flexShrink: 0 }}>{l.label}</span>
            <span style={{ color: 'var(--text)', fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>{l.value}</span>
          </div>
        ))}
      </div>

      <button onClick={onReset} className="bl-buy" style={{ width: '100%', marginTop: '1rem', padding: '0.95rem', background: 'var(--purple)', color: '#fff', border: 'none', borderRadius: 14, fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.92rem', cursor: 'pointer' }}>
        Make Another Purchase
      </button>
      <Link href="/dashboard" className="bl-link" style={{ display: 'block', textAlign: 'center', marginTop: '0.6rem', padding: '0.75rem', borderRadius: 12, border: '1px solid var(--border)', color: 'var(--muted)', fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none', fontFamily: 'Outfit, sans-serif' }}>
        Back to dashboard
      </Link>
    </div>
  )
}

function BuyButton({ onClick, disabled, loading, label, loadingLabel = 'Processing…' }) {
  return (
    <button onClick={onClick} disabled={disabled || loading} className="bl-buy"
      style={{
        width: '100%', padding: '1rem', marginTop: '1rem',
        background: disabled ? 'var(--card2)' : loading ? 'var(--purple2)' : 'var(--purple)',
        color: disabled ? 'var(--muted)' : '#fff', border: 'none', borderRadius: 14,
        fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem', fontWeight: 700,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
        opacity: disabled ? 0.6 : 1,
      }}>
      {loading ? (<><Spinner size={18} />{loadingLabel}</>) : label}
    </button>
  )
}

async function postBuy(payload) {
  const res = await fetch('/api/bills/buy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Purchase failed. Try again.')
  return data
}

// Every GET call above returns { error } with a non-200 status on failure —
// this makes sure that error surfaces instead of silently being treated as
// an empty list.
async function getJson(url) {
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

// ── Airtime ──────────────────────────────────────────────────────────────

function AirtimeForm({ profile, bumpBalance }) {
  const [networks, setNetworks] = useState([])
  const [serviceId, setServiceId] = useState('')
  const [phone, setPhone] = useState('')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    getJson('/api/bills/services?type=airtime')
      .then(d => setNetworks(d.data || []))
      .catch(e => setError(e.message))
  }, [])

  const price = Number(amount) || 0
  const balance = profile?.wallet_balance || 0
  const hasBalance = balance >= price
  const network = networks.find(n => String(n.service_id) === String(serviceId))

  const handleBuy = async () => {
    setLoading(true); setError('')
    try {
      const data = await postBuy({ type: 'airtime', serviceId, phone, amount: price })
      bumpBalance(-data.price_ngn)
      setResult({ phone, amount: data.price_ngn, network: serviceLabel(networks.find(n => String(n.service_id) === String(serviceId)) || {}) })
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  if (result) {
    return (
      <SuccessCard
        title="Airtime Purchased"
        amount={result.amount}
        lines={[
          { label: 'Network', value: result.network || '—' },
          { label: 'Phone', value: result.phone },
        ]}
        onReset={() => { setResult(null); setPhone(''); setAmount(''); setServiceId('') }}
      />
    )
  }

  return (
    <div>
      <Section>
        <StepHeader n={1} done={!!serviceId} title="Select network" right={network ? serviceLabel(network) : null} />
        <LogoPicker
          options={networks.map(n => ({ idKey: n.service_id, label: serviceLabel(n) }))}
          value={serviceId}
          onChange={setServiceId}
          loading={networks.length === 0 && !error}
        />
      </Section>

      <Section>
        <StepHeader n={2} done={phone.trim().length >= 10} title="Phone number" />
        <Field prefix={<PhoneIcon size={15} />} value={phone} onChange={e => setPhone(e.target.value)} placeholder="08012345678" inputMode="tel" autoComplete="tel" aria-label="Phone number" />
      </Section>

      <Section last>
        <StepHeader n={3} done={price > 0} title="Amount" right={price > 0 ? `₦${price.toLocaleString()}` : null} />
        <Field prefix="₦" value={amount} onChange={e => setAmount(e.target.value)} type="number" inputMode="numeric" placeholder="500" aria-label="Amount in naira" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.7rem' }}>
          {QUICK_AMOUNTS.map(v => {
            const sel = String(amount) === String(v)
            return (
              <button key={v} type="button" className="bl-chip" aria-pressed={sel} onClick={() => setAmount(String(v))}
                style={{ width: '100%', padding: '0.7rem 0.4rem', borderRadius: 12, cursor: 'pointer', fontSize: '0.86rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', textAlign: 'center', background: sel ? 'rgba(108,78,242,0.14)' : 'var(--card)', border: `1.5px solid ${sel ? 'var(--purple)' : 'var(--border)'}`, boxShadow: sel ? '0 4px 16px rgba(108,78,242,0.18)' : 'none', color: sel ? 'var(--purple2)' : 'var(--text)' }}>
                ₦{v.toLocaleString()}
              </button>
            )
          })}
        </div>
      </Section>

      {serviceId && phone && price > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <SummaryCard rows={[{ label: 'Network', value: network ? serviceLabel(network) : '—' }, { label: 'Phone', value: phone }]} total={price} balance={balance} />
        </div>
      )}

      <InsufficientBanner show={price > 0 && !hasBalance} />
      <ErrorBanner error={error} />

      <BuyButton
        onClick={handleBuy}
        loading={loading}
        disabled={!serviceId || !phone || price <= 0 || !hasBalance}
        label={`Buy Airtime${price > 0 ? ` — ₦${price.toLocaleString()}` : ''}`}
      />
    </div>
  )
}

// ── Data ─────────────────────────────────────────────────────────────────

function DataForm({ profile, bumpBalance }) {
  const [networks, setNetworks] = useState([])
  const [serviceId, setServiceId] = useState('')
  const [plans, setPlans] = useState([])
  const [planCode, setPlanCode] = useState('')
  const [phone, setPhone] = useState('')
  const [loadingPlans, setLoadingPlans] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    getJson('/api/bills/services?type=data')
      .then(d => setNetworks(d.data || []))
      .catch(e => setError(e.message))
  }, [])

  useEffect(() => {
    if (!serviceId) { setPlans([]); setPlanCode(''); return }
    setLoadingPlans(true); setPlanCode(''); setError('')
    getJson(`/api/bills/data-plans?service_id=${serviceId}`)
      .then(d => setPlans(d.data_plans || []))
      .catch(e => setError(e.message))
      .finally(() => setLoadingPlans(false))
  }, [serviceId])

  const selectedPlan = plans.find(p => String(p.code) === String(planCode))
  const price = Number(selectedPlan?.price) || 0
  const balance = profile?.wallet_balance || 0
  const hasBalance = balance >= price
  const network = networks.find(n => String(n.service_id) === String(serviceId))

  const handleBuy = async () => {
    setLoading(true); setError('')
    try {
      const data = await postBuy({ type: 'data', serviceId, phone, planCode })
      bumpBalance(-data.price_ngn)
      setResult({ phone, amount: data.price_ngn, plan: selectedPlan?.name })
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  if (result) {
    return (
      <SuccessCard
        title="Data Purchased"
        amount={result.amount}
        lines={[
          { label: 'Plan', value: result.plan || '—' },
          { label: 'Phone', value: result.phone },
        ]}
        onReset={() => { setResult(null); setPhone(''); setPlanCode(''); setServiceId('') }}
      />
    )
  }

  return (
    <div>
      <Section>
        <StepHeader n={1} done={!!serviceId} title="Select network" right={network ? serviceLabel(network) : null} />
        <LogoPicker
          options={networks.map(n => ({
            idKey: n.service_id, label: serviceLabel(n),
            provider: n.provider ? n.provider.charAt(0).toUpperCase() + n.provider.slice(1) : `#${n.service_id}`,
          }))}
          value={serviceId}
          onChange={setServiceId}
          subLabel={opt => opt.provider}
          loading={networks.length === 0 && !error}
        />
      </Section>

      <Section>
        <StepHeader n={2} done={!!planCode} title="Data plan" right={selectedPlan ? selectedPlan.name : null} />
        <PlanPicker
          value={planCode}
          onChange={setPlanCode}
          options={plans}
          disabled={!serviceId || loadingPlans}
          loading={loadingPlans}
          placeholder={serviceId ? 'Select plan' : 'Choose a network first'}
        />
      </Section>

      <Section last>
        <StepHeader n={3} done={phone.trim().length >= 10} title="Phone number" />
        <Field prefix={<PhoneIcon size={15} />} value={phone} onChange={e => setPhone(e.target.value)} placeholder="08012345678" inputMode="tel" autoComplete="tel" aria-label="Phone number" />
      </Section>

      {serviceId && planCode && phone && (
        <div style={{ marginTop: '1.5rem' }}>
          <SummaryCard rows={[{ label: 'Network', value: network ? serviceLabel(network) : '—' }, { label: 'Plan', value: selectedPlan?.name || '—' }, { label: 'Phone', value: phone }]} total={price} balance={balance} />
        </div>
      )}

      <InsufficientBanner show={price > 0 && !hasBalance} />
      <ErrorBanner error={error} />

      <BuyButton
        onClick={handleBuy}
        loading={loading}
        disabled={!serviceId || !planCode || !phone || !hasBalance}
        label={`Buy Data${price > 0 ? ` — ₦${price.toLocaleString()}` : ''}`}
      />
    </div>
  )
}

// ── Cable TV ─────────────────────────────────────────────────────────────

function CableForm({ profile, bumpBalance }) {
  const [providers, setProviders] = useState([])
  const [serviceId, setServiceId] = useState('')
  const [phone, setPhone] = useState('')
  const [smartcardNumber, setSmartcardNumber] = useState('')
  const [verified, setVerified] = useState(null) // { smartcard_name, cable_plans }
  const [planCode, setPlanCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    getJson('/api/bills/services?type=tv')
      .then(d => setProviders(d.data || []))
      .catch(e => setError(e.message))
  }, [])

  const handleVerify = async () => {
    setVerifying(true); setError(''); setVerified(null); setPlanCode('')
    try {
      const res = await fetch('/api/bills/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'cable', serviceId, phone, smartcardNumber }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Verification failed')
      setVerified(data)
    } catch (e) {
      setError(e.message)
    }
    setVerifying(false)
  }

  const selectedPlan = verified?.cable_plans?.find(p => String(p.code) === String(planCode))
  const price = Number(selectedPlan?.price) || 0
  const balance = profile?.wallet_balance || 0
  const hasBalance = balance >= price
  const provider = providers.find(p => String(p.service_id) === String(serviceId))

  const handleBuy = async () => {
    setLoading(true); setError('')
    try {
      const data = await postBuy({ type: 'cable', serviceId, phone, smartcardNumber, planCode })
      bumpBalance(-data.price_ngn)
      setResult({ smartcardNumber, amount: data.price_ngn, plan: selectedPlan?.name, name: verified?.smartcard_name })
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  if (result) {
    return (
      <SuccessCard
        title="Cable TV Subscription Active"
        amount={result.amount}
        lines={[
          { label: 'Account Name', value: result.name || '—' },
          { label: 'Smartcard', value: result.smartcardNumber },
          { label: 'Package', value: result.plan || '—' },
        ]}
        onReset={() => { setResult(null); setSmartcardNumber(''); setPhone(''); setPlanCode(''); setServiceId(''); setVerified(null) }}
      />
    )
  }

  return (
    <div>
      <Section>
        <StepHeader n={1} done={!!serviceId} title="Select provider" right={provider ? serviceLabel(provider) : null} />
        <LogoPicker
          options={providers.map(p => ({ idKey: p.service_id, label: serviceLabel(p) }))}
          value={serviceId}
          onChange={id => { setServiceId(id); setVerified(null); setPlanCode('') }}
          noun="providers"
          loading={providers.length === 0 && !error}
        />
      </Section>

      <Section last={!verified && false}>
        <StepHeader n={2} done={!!verified} title="Verify smartcard" right={verified ? verified.smartcard_name : null} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <Field prefix={<CardIcon size={15} />} value={smartcardNumber} onChange={e => { setSmartcardNumber(e.target.value); setVerified(null) }} placeholder="Smartcard / IUC number" inputMode="numeric" aria-label="Smartcard number" />
          <Field prefix={<PhoneIcon size={15} />} value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number, e.g. 08012345678" inputMode="tel" autoComplete="tel" aria-label="Phone number" />
        </div>

        {verified && (
          <div style={{ marginTop: '0.8rem', background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 14, padding: '0.8rem 0.95rem', display: 'flex', alignItems: 'center', gap: '0.7rem', animation: 'scaleIn 0.25s ease both' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(52,211,153,0.16)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckIcon size={15} color="#34d399" /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Account verified</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#34d399', wordBreak: 'break-word' }}>{verified.smartcard_name}</div>
            </div>
          </div>
        )}

        {!verified && (
          <>
            <ErrorBanner error={error} />
            <BuyButton
              onClick={handleVerify}
              loading={verifying}
              disabled={!serviceId || !smartcardNumber || !phone}
              label="Verify Smartcard"
              loadingLabel="Verifying…"
            />
          </>
        )}
      </Section>

      {verified && (
        <>
          <div style={{ marginTop: '1.5rem' }}>
            <StepHeader n={3} done={!!planCode} title="Choose package" right={selectedPlan ? selectedPlan.name : null} />
            <PlanPicker
              value={planCode}
              onChange={setPlanCode}
              options={verified.cable_plans || []}
              placeholder="Select package"
            />
          </div>

          {planCode && (
            <div style={{ marginTop: '1.5rem' }}>
              <SummaryCard
                rows={[
                  { label: 'Provider', value: provider ? serviceLabel(provider) : '—' },
                  { label: 'Account', value: verified.smartcard_name },
                  { label: 'Smartcard', value: smartcardNumber },
                  { label: 'Package', value: selectedPlan?.name || '—' },
                ]}
                total={price}
                balance={balance}
              />
            </div>
          )}

          <InsufficientBanner show={price > 0 && !hasBalance} />
          <ErrorBanner error={error} />

          <BuyButton
            onClick={handleBuy}
            loading={loading}
            disabled={!planCode || !hasBalance}
            label={`Subscribe${price > 0 ? ` — ₦${price.toLocaleString()}` : ''}`}
          />
        </>
      )}
    </div>
  )
}

// ── Icons ────────────────────────────────────────────────────────────────

function Spinner({ color = 'currentColor', size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.9s linear infinite', flexShrink: 0 }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  )
}
function BackIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
}
function CheckIcon({ size = 14, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
}
function PlusIcon({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
}
function SearchIcon({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
}
function InfoIcon({ size = 16, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
}
function MegaphoneIcon({ size = 16, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></svg>
}
function PhoneIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
}
function SignalIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" /></svg>
}
function TvIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" /><polyline points="17 2 12 7 7 2" /></svg>
}
function CardIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
}
function ChevronDownIcon({ size = 16, color = 'currentColor', rotated = false }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: rotated ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', flexShrink: 0 }}><polyline points="6 9 12 15 18 9" /></svg>
}