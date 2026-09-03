'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import LoadingScreen from '@/components/RouteLoader'

const TABS = [
  { id: 'airtime', label: 'Airtime' },
  { id: 'data', label: 'Data' },
  { id: 'cable', label: 'Cable TV' },
]

export default function BillsPage() {
  const [pageLoading, setPageLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [activeTab, setActiveTab] = useState('airtime')
  const [broadcast, setBroadcast] = useState(null) // { enabled, message } | null while loading

  useEffect(() => {
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

  if (pageLoading) return <LoadingScreen />

  return (
    <main className="bills-main" style={{ background: 'var(--navy)', minHeight: '100vh', paddingBottom: '3rem', position: 'relative' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .bills-main::before {
          content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background: radial-gradient(640px circle at 50% -8%, rgba(108,78,242,0.12), transparent 62%);
        }
        .bills-shell { position: relative; z-index: 1; padding: 1.25rem; max-width: 520px; margin: 0 auto; }
        @media (min-width: 860px) {
          .bills-shell {
            max-width: 600px; margin: 1.75rem auto 0;
            background: var(--card); border: 1px solid var(--border);
            border-radius: 28px; padding: 2.1rem 2.3rem 2.5rem;
            box-shadow: 0 32px 80px rgba(0,0,0,0.32);
          }
        }
        .bills-tabs { display: flex; gap: 0.3rem; padding: 0.3rem; background: var(--navy2); border: 1px solid var(--border); border-radius: 14px; margin-bottom: 1.5rem; }
        .bills-tab { flex: 1; }
        .bills-tab:hover:not(.active) { background: rgba(255,255,255,0.04) !important; }
        .buy-btn:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
        .buy-btn:active:not(:disabled) { transform: translateY(0); }
        .marquee-track { animation: marquee linear infinite; }
        .marquee-track:hover { animation-play-state: paused; }
        .bills-shell input:focus, .bills-shell select:focus {
          border-color: var(--purple) !important;
          box-shadow: 0 0 0 3px rgba(108,78,242,0.16);
        }
        .logo-picker { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 0.6rem; }
        .logo-picker button:hover { border-color: rgba(108,78,242,0.4) !important; }
        .plan-option:hover { background: var(--card2) !important; }
        .logo-picker.scroll-mobile::-webkit-scrollbar { display: none; }
        .logo-picker.grid-scroll {
          grid-template-columns: none; grid-template-rows: repeat(2, 1fr);
          grid-auto-flow: column; grid-auto-columns: calc(25% - 0.45rem);
          overflow-x: auto; padding-bottom: 0.3rem;
          scrollbar-width: none; -ms-overflow-style: none;
        }
        .logo-picker.grid-scroll::-webkit-scrollbar { display: none; }
        @media (max-width: 640px) {
          .logo-picker.scroll-mobile {
            grid-template-columns: none;
            grid-auto-flow: column;
            grid-auto-columns: calc(25% - 0.45rem);
            overflow-x: auto;
            padding-bottom: 0.3rem;
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
        }
        @media (min-width: 860px) {
          .logo-picker:not(.grid-scroll) { grid-template-columns: repeat(5, 1fr); }
        }
      `}</style>

      {/* TOP BAR */}
      <div style={{ padding: '1.1rem 1.25rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.8rem', position: 'sticky', top: 0, zIndex: 100, background: 'var(--header-bg)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/dashboard" style={{ color: 'var(--header-text)', display: 'flex', width: 32, height: 32, borderRadius: 9, background: 'var(--card2)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <BackIcon />
        </Link>
        <div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--header-text)' }}>Top-Up & Bills</div>
          <div style={{ fontSize: '0.68rem', color: 'var(--header-muted)' }}>Airtime, data & TV subscriptions</div>
        </div>
      </div>

      <div className="bills-shell">
        {broadcast?.enabled && broadcast.message && (
          <div style={{
            display: 'flex', gap: '0.7rem', alignItems: 'center',
            background: 'rgba(240,180,41,0.08)', border: '1px solid rgba(240,180,41,0.25)',
            borderRadius: 14, padding: '0.85rem 1rem', marginBottom: '1.2rem',
            overflow: 'hidden',
          }}>
            <div style={{ flexShrink: 0, display: 'flex' }}><AlertIcon size={16} color="#f0b429" /></div>
            <div style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap' }}>
              <div
                className="marquee-track"
                style={{
                  display: 'inline-flex', width: 'max-content',
                  animationDuration: `${Math.max(12, broadcast.message.length * 0.18)}s`,
                }}
              >
                <span style={{ fontSize: '0.8rem', color: 'var(--text)', paddingRight: '3rem' }}>{broadcast.message}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text)', paddingRight: '3rem' }}>{broadcast.message}</span>
              </div>
            </div>
          </div>
        )}

        {/* WALLET BALANCE */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(108,78,242,0.16), rgba(108,78,242,0.03))',
          border: '1px solid rgba(108,78,242,0.25)', borderRadius: 18,
          padding: '1.1rem 1.3rem', marginBottom: '1.4rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(108,78,242,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <WalletIcon size={19} color="#8b6ff7" />
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Wallet Balance</div>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.4rem', color: 'var(--text)', letterSpacing: '-0.3px' }}>
                ₦{(profile?.wallet_balance || 0).toLocaleString()}
              </div>
            </div>
          </div>
          <Link href="/dashboard/wallet" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--purple2)', textDecoration: 'none', flexShrink: 0 }}>
            Fund →
          </Link>
        </div>

        {/* TABS */}
        <div className="bills-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`bills-tab${activeTab === t.id ? ' active' : ''}`}
              style={{
                padding: '0.6rem 0.5rem', borderRadius: 10, border: 'none',
                background: activeTab === t.id ? 'var(--purple)' : 'transparent',
                color: activeTab === t.id ? '#fff' : 'var(--muted)',
                fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                fontFamily: 'Outfit, sans-serif', transition: 'background 0.2s, color 0.2s',
                boxShadow: activeTab === t.id ? '0 4px 14px rgba(108,78,242,0.35)' : 'none',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'airtime' && <AirtimeForm profile={profile} bumpBalance={bumpBalance} />}
        {activeTab === 'data' && <DataForm profile={profile} bumpBalance={bumpBalance} />}
        {activeTab === 'cable' && <CableForm profile={profile} bumpBalance={bumpBalance} />}
      </div>
    </main>
  )
}

// ── Shared bits ──────────────────────────────────────────────────────────

function Card({ children }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: '1.4rem', boxShadow: '0 12px 32px rgba(0,0,0,0.18)' }}>
      {children}
    </div>
  )
}

function Label({ children }) {
  return <div style={{ fontSize: '0.68rem', color: 'var(--muted)', letterSpacing: '0.06em', fontWeight: 600, marginBottom: '0.45rem' }}>{children}</div>
}

function inputStyle() {
  return {
    width: '100%', padding: '0.85rem 1rem', borderRadius: 12,
    border: '1px solid var(--border)', background: 'var(--navy2)',
    color: 'var(--text)', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif',
    outline: 'none', boxSizing: 'border-box',
  }
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

// A logo-style picker replacing native <select> for network/provider choice.
// options: array of objects with a unique `idKey` and a display `label`.
// scrollMobile: on narrow screens, lay out as a single horizontally
// scrollable row (like the Turbo Boost platform picker) instead of
// wrapping into a grid. Desktop layout is unaffected either way.
// gridScroll: always lay out as a fixed 2-row x 4-column grid, with any
// extra options reachable by horizontal swipe — same pattern as the
// Numbers page service picker, including the swipe hint + page dots.
// Selected (and would-be-hovered) state is tinted with that option's own
// brand color, same as the Numbers page's per-service color highlight.
function LogoPicker({ options, value, onChange, subLabel, scrollMobile = false, gridScroll = false }) {
  const [page, setPage] = useState(0)
  const perPage = 8
  const pageCount = Math.ceil(options.length / perPage)

  return (
    <div>
      <div
        className={`logo-picker${scrollMobile ? ' scroll-mobile' : ''}${gridScroll ? ' grid-scroll' : ''}`}
        ref={gridScroll ? el => {
          if (el) el.onscroll = () => setPage(Math.round(el.scrollLeft / el.clientWidth))
        } : undefined}
      >
        {options.map(opt => {
          const selected = String(value) === String(opt.idKey)
          const brand = brandFor(opt.label)
          return (
            <button
              key={opt.idKey}
              onClick={() => onChange(String(opt.idKey))}
              type="button"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.45rem',
                padding: '0.75rem 0.4rem', borderRadius: 14,
                border: `1.5px solid ${selected ? brand.bg : 'var(--border)'}`,
                background: selected ? `${brand.bg}15` : 'var(--navy2)',
                boxShadow: selected ? `0 4px 16px ${brand.bg}33` : 'none',
                cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: brand.shape === 'square' ? 11 : '50%',
                background: brand.bg, color: brand.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Outfit, sans-serif', fontWeight: brand.weight, fontSize: brand.fontSize,
                letterSpacing: brand.tracking, flexShrink: 0, lineHeight: 1,
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)', overflow: 'hidden', padding: '0 2px',
              }}>
                {brand.text}
              </div>
              <span style={{
                fontSize: '0.68rem', fontWeight: 600, color: selected ? brand.bg : 'var(--text)',
                textAlign: 'center', lineHeight: 1.2,
              }}>
                {opt.label}
              </span>
              {subLabel && (
                <span style={{ fontSize: '0.58rem', color: 'var(--muted)', textAlign: 'center' }}>{subLabel(opt)}</span>
              )}
            </button>
          )
        })}
      </div>

      {gridScroll && pageCount > 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', marginTop: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
            {Array.from({ length: pageCount }).map((_, i) => (
              <div key={i} style={{
                width: page === i ? 16 : 6, height: 6, borderRadius: 99,
                background: page === i ? 'var(--purple)' : 'var(--border)',
                transition: 'all 0.3s ease',
              }} />
            ))}
          </div>
          <span style={{ fontSize: '0.6rem', color: 'var(--muted)', letterSpacing: '0.04em' }}>
            Swipe to see more networks →
          </span>
        </div>
      )}
    </div>
  )
}

// A custom dropdown for plan/package selection, replacing the native
// <select> — native selects render as an unstyleable OS popup (the plain
// blue list), so this renders its own themed panel instead. Options are
// objects with { code, name, price }.
function PlanPicker({ value, onChange, options, placeholder = 'Select plan', disabled = false, loading = false }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selected = options.find(o => String(o.code) === String(value))

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        style={{
          ...inputStyle(),
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.55 : 1,
          borderColor: open ? 'var(--purple)' : 'var(--border)',
          boxShadow: open ? '0 0 0 3px rgba(108,78,242,0.16)' : 'none',
        }}
      >
        <span style={{
          color: selected ? 'var(--text)' : 'var(--muted)', fontWeight: selected ? 600 : 400,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left',
        }}>
          {loading ? 'Loading plans…' : selected ? selected.name : placeholder}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
          {selected && (
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--purple2)' }}>
              ₦{Number(selected.price).toLocaleString()}
            </span>
          )}
          <ChevronDownIcon size={16} color="var(--muted)" rotated={open} />
        </div>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 200,
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14,
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)', maxHeight: 280, overflowY: 'auto', padding: '0.4rem',
        }}>
          {options.length === 0 ? (
            <div style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--muted)', textAlign: 'center' }}>No plans available</div>
          ) : options.map(opt => {
            const isSelected = String(opt.code) === String(value)
            return (
              <button
                key={opt.code}
                type="button"
                onClick={() => { onChange(opt.code); setOpen(false) }}
                className="plan-option"
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: '0.8rem', padding: '0.65rem 0.75rem', borderRadius: 10, border: 'none',
                  background: isSelected ? 'rgba(108,78,242,0.14)' : 'transparent',
                  cursor: 'pointer', textAlign: 'left', boxSizing: 'border-box',
                }}
              >
                <span style={{ fontSize: '0.82rem', color: 'var(--text)', fontWeight: isSelected ? 700 : 500 }}>{opt.name}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: isSelected ? 'var(--purple2)' : 'var(--muted)', flexShrink: 0 }}>
                  ₦{Number(opt.price).toLocaleString()}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ErrorBanner({ error }) {
  if (!error) return null
  return (
    <div style={{
      background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)',
      borderRadius: 12, padding: '0.75rem 1rem', fontSize: '0.8rem',
      color: '#f43f5e', marginTop: '0.9rem',
    }}>
      {error}
    </div>
  )
}

function InsufficientBanner({ show }) {
  if (!show) return null
  return (
    <div style={{
      background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)',
      borderRadius: 12, padding: '0.75rem 1rem', fontSize: '0.8rem',
      color: '#f43f5e', marginTop: '0.9rem',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <span>Insufficient balance</span>
      <Link href="/dashboard/wallet" style={{ color: '#f43f5e', fontWeight: 700, textDecoration: 'none', fontSize: '0.75rem' }}>
        Fund Wallet →
      </Link>
    </div>
  )
}

function SuccessCard({ title, lines, onReset }) {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(52,211,153,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CheckIcon size={16} color="#34d399" />
        </div>
        <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>{title}</div>
      </div>
      {lines.map((l, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '0.4rem 0', borderBottom: i < lines.length - 1 ? '1px solid var(--border)' : 'none' }}>
          <span style={{ color: 'var(--muted)' }}>{l.label}</span>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{l.value}</span>
        </div>
      ))}
      <button onClick={onReset} className="buy-btn" style={{
        width: '100%', marginTop: '1rem', padding: '0.85rem',
        background: 'var(--card2)', color: 'var(--text)', border: '1px solid var(--border)',
        borderRadius: 12, fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
      }}>
        Make Another Purchase
      </button>
    </Card>
  )
}

function BuyButton({ onClick, disabled, loading, label, loadingLabel = 'Processing…' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="buy-btn"
      style={{
        width: '100%', padding: '1rem', marginTop: '1rem',
        background: disabled ? 'var(--card2)' : loading ? 'var(--purple2)' : 'var(--purple)',
        color: disabled ? 'var(--muted)' : '#fff',
        border: 'none', borderRadius: 14,
        fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem', fontWeight: 700,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {loading ? (
        <>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          {loadingLabel}
        </>
      ) : label}
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
  const hasBalance = (profile?.wallet_balance || 0) >= price

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
        lines={[
          { label: 'Network', value: result.network || '—' },
          { label: 'Phone', value: result.phone },
          { label: 'Amount', value: `₦${result.amount.toLocaleString()}` },
        ]}
        onReset={() => { setResult(null); setPhone(''); setAmount(''); setServiceId('') }}
      />
    )
  }

  return (
    <Card>
      <Label>Network</Label>
      <div style={{ marginBottom: '1rem' }}>
        <LogoPicker
          options={networks.map(n => ({ idKey: n.service_id, label: serviceLabel(n) }))}
          value={serviceId}
          onChange={setServiceId}
          scrollMobile
        />
      </div>

      <Label>Phone Number</Label>
      <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="08012345678" style={{ ...inputStyle(), marginBottom: '1rem' }} />

      <Label>Amount (₦)</Label>
      <input value={amount} onChange={e => setAmount(e.target.value)} type="number" placeholder="500" style={inputStyle()} />

      <InsufficientBanner show={price > 0 && !hasBalance} />
      <ErrorBanner error={error} />

      <BuyButton
        onClick={handleBuy}
        loading={loading}
        disabled={!serviceId || !phone || price <= 0 || !hasBalance}
        label={`Buy Airtime${price > 0 ? ` — ₦${price.toLocaleString()}` : ''}`}
      />
    </Card>
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
  const hasBalance = (profile?.wallet_balance || 0) >= price

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
        lines={[
          { label: 'Plan', value: result.plan || '—' },
          { label: 'Phone', value: result.phone },
          { label: 'Amount', value: `₦${result.amount.toLocaleString()}` },
        ]}
        onReset={() => { setResult(null); setPhone(''); setPlanCode(''); setServiceId('') }}
      />
    )
  }

  return (
    <Card>
      <Label>Network</Label>
      <div style={{ marginBottom: '1rem' }}>
        <LogoPicker
          options={networks.map(n => ({
            idKey: n.service_id, label: serviceLabel(n),
            provider: n.provider ? n.provider.charAt(0).toUpperCase() + n.provider.slice(1) : `#${n.service_id}`,
          }))}
          value={serviceId}
          onChange={setServiceId}
          subLabel={opt => opt.provider}
          gridScroll
        />
      </div>

      <Label>Data Plan</Label>
      <div style={{ marginBottom: '1rem' }}>
        <PlanPicker
          value={planCode}
          onChange={setPlanCode}
          options={plans}
          disabled={!serviceId || loadingPlans}
          loading={loadingPlans}
          placeholder="Select plan"
        />
      </div>

      <Label>Phone Number</Label>
      <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="08012345678" style={inputStyle()} />

      <InsufficientBanner show={price > 0 && !hasBalance} />
      <ErrorBanner error={error} />

      <BuyButton
        onClick={handleBuy}
        loading={loading}
        disabled={!serviceId || !planCode || !phone || !hasBalance}
        label={`Buy Data${price > 0 ? ` — ₦${price.toLocaleString()}` : ''}`}
      />
    </Card>
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
  const hasBalance = (profile?.wallet_balance || 0) >= price

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
        lines={[
          { label: 'Account Name', value: result.name || '—' },
          { label: 'Smartcard', value: result.smartcardNumber },
          { label: 'Package', value: result.plan || '—' },
          { label: 'Amount', value: `₦${result.amount.toLocaleString()}` },
        ]}
        onReset={() => { setResult(null); setSmartcardNumber(''); setPhone(''); setPlanCode(''); setServiceId(''); setVerified(null) }}
      />
    )
  }

  return (
    <Card>
      <Label>Provider</Label>
      <div style={{ marginBottom: '1rem' }}>
        <LogoPicker
          options={providers.map(p => ({ idKey: p.service_id, label: serviceLabel(p) }))}
          value={serviceId}
          onChange={id => { setServiceId(id); setVerified(null); setPlanCode('') }}
        />
      </div>

      <Label>Smartcard Number</Label>
      <input value={smartcardNumber} onChange={e => { setSmartcardNumber(e.target.value); setVerified(null) }} placeholder="1234567890" style={{ ...inputStyle(), marginBottom: '1rem' }} />

      <Label>Phone Number</Label>
      <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="08012345678" style={{ ...inputStyle(), marginBottom: '1rem' }} />

      {!verified ? (
        <BuyButton
          onClick={handleVerify}
          loading={verifying}
          disabled={!serviceId || !smartcardNumber || !phone}
          label="Verify Smartcard"
          loadingLabel="Verifying…"
        />
      ) : (
        <>
          <div style={{
            background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.2)',
            borderRadius: 12, padding: '0.75rem 1rem', fontSize: '0.82rem', color: '#34d399',
            marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}>
            <CheckIcon size={14} color="#34d399" /> {verified.smartcard_name}
          </div>

          <Label>Package</Label>
          <PlanPicker
            value={planCode}
            onChange={setPlanCode}
            options={verified.cable_plans || []}
            placeholder="Select package"
          />

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

      {!verified && <ErrorBanner error={error} />}
    </Card>
  )
}

// ── Icons ────────────────────────────────────────────────────────────────

function BackIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
}
function CheckIcon({ size = 14, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
}
function AlertIcon({ size = 16, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
}
function WalletIcon({ size = 20, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 12h2"/><path d="M2 10h20"/></svg>
}
function ChevronDownIcon({ size = 16, color = 'currentColor', rotated = false }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: rotated ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', flexShrink: 0 }}><polyline points="6 9 12 15 18 9" /></svg>
}