'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import LoadingScreen from '@/components/LoadingScreen'

const TABS = [
  { id: 'airtime', label: 'Airtime' },
  { id: 'data', label: 'Data' },
  { id: 'cable', label: 'Cable TV' },
  { id: 'electricity', label: 'Electricity' },
  { id: 'education', label: 'Education' },
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
    <main style={{ background: 'var(--navy)', minHeight: '100vh', paddingBottom: '3rem' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .bills-tab:hover { border-color: rgba(108,78,242,0.4) !important; }
        .buy-btn:hover:not(:disabled) { filter: brightness(1.08); }
        .marquee-track { animation: marquee linear infinite; }
        .marquee-track:hover { animation-play-state: paused; }
        .logo-picker { display: grid; grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap: 0.6rem; }
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
      `}</style>

      {/* TOP BAR */}
      <div style={{ padding: '1.1rem 1.25rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.8rem', position: 'sticky', top: 0, zIndex: 100, background: 'var(--header-bg)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/dashboard" style={{ color: 'var(--header-text)', display: 'flex' }}>
          <BackIcon />
        </Link>
        <div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--header-text)' }}>Top-Up & Bills</div>
          <div style={{ fontSize: '0.68rem', color: 'var(--header-muted)' }}>Airtime, data, TV, electricity & exam pins</div>
        </div>
      </div>

      <div style={{ padding: '1.25rem', maxWidth: 520, margin: '0 auto' }}>
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
          background: 'linear-gradient(135deg, rgba(108,78,242,0.14), rgba(108,78,242,0.04))',
          border: '1px solid rgba(108,78,242,0.25)', borderRadius: 16,
          padding: '1rem 1.2rem', marginBottom: '1.2rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Wallet Balance</div>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.3rem', color: 'var(--text)' }}>
              ₦{(profile?.wallet_balance || 0).toLocaleString()}
            </div>
          </div>
          <Link href="/dashboard/wallet" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--purple2)', textDecoration: 'none' }}>
            Fund Wallet →
          </Link>
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', marginBottom: '1.3rem', paddingBottom: '0.2rem' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className="bills-tab"
              style={{
                flexShrink: 0, padding: '0.55rem 1rem', borderRadius: 12,
                border: `1px solid ${activeTab === t.id ? 'var(--purple)' : 'var(--border)'}`,
                background: activeTab === t.id ? 'var(--purple)' : 'var(--card)',
                color: activeTab === t.id ? '#fff' : 'var(--text)',
                fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                fontFamily: 'Outfit, sans-serif', transition: 'border-color 0.2s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'airtime' && <AirtimeForm profile={profile} bumpBalance={bumpBalance} />}
        {activeTab === 'data' && <DataForm profile={profile} bumpBalance={bumpBalance} />}
        {activeTab === 'cable' && <CableForm profile={profile} bumpBalance={bumpBalance} />}
        {activeTab === 'electricity' && <ElectricityForm profile={profile} bumpBalance={bumpBalance} />}
        {activeTab === 'education' && <EducationForm profile={profile} bumpBalance={bumpBalance} />}
      </div>
    </main>
  )
}

// ── Shared bits ──────────────────────────────────────────────────────────

function Card({ children }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '1.2rem' }}>
      {children}
    </div>
  )
}

function Label({ children }) {
  return <div style={{ fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>{children}</div>
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
  waec:      { shape: 'circle', bg: '#1d4ed8', color: '#ffffff', text: 'WAEC',    fontSize: '0.44rem', weight: 800, tracking: '0.02em' },
  neco:      { shape: 'circle', bg: '#059669', color: '#ffffff', text: 'NECO',    fontSize: '0.44rem', weight: 800, tracking: '0.02em' },
  jamb:      { shape: 'circle', bg: '#7c3aed', color: '#ffffff', text: 'JAMB',    fontSize: '0.44rem', weight: 800, tracking: '0.02em' },
  nabteb:    { shape: 'circle', bg: '#dc2626', color: '#ffffff', text: 'NABTEB',  fontSize: '0.34rem', weight: 800, tracking: '0.01em' },
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

// Standard Nigerian DISCO code → friendly name, matching what VTUGATE's own
// admin dashboard shows (Ikeja, Eko, Port Harcourt, etc.) — the catalog API
// itself only returns the short code (e.g. 'IKEDC'), not the friendly name.
const DISCO_NAMES = {
  AEDC: 'Abuja Electric', APLE: 'Aba Electric', BEDC: 'Benin Electric',
  EEDC: 'Enugu Electric', EKEDC: 'Eko Electric', IBEDC: 'Ibadan Electric',
  IKEDC: 'Ikeja Electric', JEDC: 'Jos Electric', KAEDC: 'Kaduna Electric',
  KEDC: 'Kano Electric', PHEDC: 'Port Harcourt Electric', YEDC: 'Yola Electric',
}

// VTUGATE names its "display name" field differently per service category
// (network_name for airtime/data, tv_name for cable, disco for electricity,
// edu_type for education — confirmed inconsistent across their own API).
// This tries every variant seen so far instead of assuming one, so a new
// category doesn't silently render blank/fallback labels again.
function serviceLabel(item) {
  if (item.disco) return DISCO_NAMES[item.disco] || item.disco
  if (item.edu_type) return item.edu_type.replace(/\b\w/g, c => c.toUpperCase())
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
      <select value={planCode} onChange={e => setPlanCode(e.target.value)} disabled={!serviceId || loadingPlans} style={{ ...inputStyle(), marginBottom: '1rem' }}>
        <option value="">{loadingPlans ? 'Loading plans…' : 'Select plan'}</option>
        {plans.map(p => (
          <option key={p.code} value={p.code}>{p.name} — ₦{Number(p.price).toLocaleString()}</option>
        ))}
      </select>

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
          <select value={planCode} onChange={e => setPlanCode(e.target.value)} style={inputStyle()}>
            <option value="">Select package</option>
            {(verified.cable_plans || []).map(p => (
              <option key={p.code} value={p.code}>{p.name} — ₦{Number(p.price).toLocaleString()}</option>
            ))}
          </select>

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

// ── Electricity ──────────────────────────────────────────────────────────

function ElectricityForm({ profile, bumpBalance }) {
  const [discos, setDiscos] = useState([])
  const [serviceId, setServiceId] = useState('')
  const [meterNo, setMeterNo] = useState('')
  const [phone, setPhone] = useState('')
  const [amount, setAmount] = useState('')
  const [verified, setVerified] = useState(null) // { meter_name, disco }
  const [verifying, setVerifying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    getJson('/api/bills/services?type=electricity')
      .then(d => setDiscos(d.data || []))
      .catch(e => setError(e.message))
  }, [])

  const selectedDisco = discos.find(d => String(d.service_id) === String(serviceId))

  const handleVerify = async () => {
    setVerifying(true); setError(''); setVerified(null)
    try {
      const res = await fetch('/api/bills/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'electricity', serviceId, meterNo, disco: selectedDisco?.disco }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Verification failed')
      setVerified(data)
    } catch (e) {
      setError(e.message)
    }
    setVerifying(false)
  }

  const price = Number(amount) || 0
  const hasBalance = (profile?.wallet_balance || 0) >= price

  const handleBuy = async () => {
    setLoading(true); setError('')
    try {
      const data = await postBuy({ type: 'electricity', serviceId, meterNo, disco: selectedDisco?.disco, amount: price, phone })
      bumpBalance(-data.price_ngn)
      setResult({ meterNo, amount: data.price_ngn, token: data.result?.token, name: verified?.meter_name })
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  if (result) {
    return (
      <SuccessCard
        title="Electricity Purchased"
        lines={[
          { label: 'Account Name', value: result.name || '—' },
          { label: 'Meter No.', value: result.meterNo },
          ...(result.token ? [{ label: 'Token', value: result.token }] : []),
          { label: 'Amount', value: `₦${result.amount.toLocaleString()}` },
        ]}
        onReset={() => { setResult(null); setMeterNo(''); setPhone(''); setAmount(''); setServiceId(''); setVerified(null) }}
      />
    )
  }

  return (
    <Card>
      <Label>Distribution Company (DISCO)</Label>
      <div style={{ marginBottom: '1rem' }}>
        <LogoPicker
          options={discos.map(d => ({ idKey: d.service_id, label: serviceLabel(d) }))}
          value={serviceId}
          onChange={id => { setServiceId(id); setVerified(null) }}
          gridScroll
        />
      </div>

      <Label>Meter Number</Label>
      <input value={meterNo} onChange={e => { setMeterNo(e.target.value); setVerified(null) }} placeholder="234567890567" style={{ ...inputStyle(), marginBottom: '1rem' }} />

      {!verified ? (
        <BuyButton
          onClick={handleVerify}
          loading={verifying}
          disabled={!serviceId || !meterNo}
          label="Verify Meter"
          loadingLabel="Verifying…"
        />
      ) : (
        <>
          <div style={{
            background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.2)',
            borderRadius: 12, padding: '0.75rem 1rem', fontSize: '0.82rem', color: '#34d399',
            marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}>
            <CheckIcon size={14} color="#34d399" /> {verified.meter_name}
          </div>

          <Label>Phone Number</Label>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="08012345678" style={{ ...inputStyle(), marginBottom: '1rem' }} />

          <Label>Amount (₦)</Label>
          <input value={amount} onChange={e => setAmount(e.target.value)} type="number" placeholder="1000" style={inputStyle()} />

          <InsufficientBanner show={price > 0 && !hasBalance} />
          <ErrorBanner error={error} />

          <BuyButton
            onClick={handleBuy}
            loading={loading}
            disabled={!phone || price <= 0 || !hasBalance}
            label={`Buy Electricity${price > 0 ? ` — ₦${price.toLocaleString()}` : ''}`}
          />
        </>
      )}

      {!verified && <ErrorBanner error={error} />}
    </Card>
  )
}

// ── Education ────────────────────────────────────────────────────────────

function EducationForm({ profile, bumpBalance }) {
  const [types, setTypes] = useState([])
  const [serviceId, setServiceId] = useState('')
  const [unitPrice, setUnitPrice] = useState(0)
  const [loadingPrice, setLoadingPrice] = useState(false)
  const [phone, setPhone] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    getJson('/api/bills/services?type=education')
      .then(d => setTypes(d.data || []))
      .catch(e => setError(e.message))
  }, [])

  useEffect(() => {
    if (!serviceId) { setUnitPrice(0); return }
    setLoadingPrice(true); setError('')
    getJson(`/api/bills/education-price?service_id=${serviceId}`)
      .then(d => setUnitPrice(Number(d.price) || 0))
      .catch(e => setError(e.message))
      .finally(() => setLoadingPrice(false))
  }, [serviceId])

  const price = unitPrice * (Number(quantity) || 0)
  const hasBalance = (profile?.wallet_balance || 0) >= price
  const selectedType = types.find(t => String(t.service_id) === String(serviceId))

  const handleBuy = async () => {
    setLoading(true); setError('')
    try {
      const data = await postBuy({ type: 'education', serviceId, phone, quantity: Number(quantity), productCode: selectedType?.product_code })
      bumpBalance(-data.price_ngn)
      setResult({ amount: data.price_ngn, pins: data.result?.pins || [], type: serviceLabel(selectedType || {}) })
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  if (result) {
    return (
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(52,211,153,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckIcon size={16} color="#34d399" />
          </div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>{result.type} Pin(s) Purchased</div>
        </div>
        {result.pins.map((pin, i) => (
          <div key={i} style={{
            fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.08em',
            color: 'var(--text)', background: 'var(--navy2)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '0.7rem 1rem', marginBottom: '0.5rem', textAlign: 'center',
          }}>
            {pin}
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '0.6rem 0', borderTop: '1px solid var(--border)', marginTop: '0.5rem' }}>
          <span style={{ color: 'var(--muted)' }}>Total Paid</span>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>₦{result.amount.toLocaleString()}</span>
        </div>
        <button onClick={() => { setResult(null); setServiceId(''); setPhone(''); setQuantity(1) }} className="buy-btn" style={{
          width: '100%', marginTop: '0.5rem', padding: '0.85rem',
          background: 'var(--card2)', color: 'var(--text)', border: '1px solid var(--border)',
          borderRadius: 12, fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
        }}>
          Make Another Purchase
        </button>
      </Card>
    )
  }

  return (
    <Card>
      <Label>Exam Type</Label>
      <div style={{ marginBottom: '1rem' }}>
        <LogoPicker
          options={types.map(t => ({ idKey: t.service_id, label: serviceLabel(t) }))}
          value={serviceId}
          onChange={setServiceId}
        />
      </div>

      <Label>Phone Number</Label>
      <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="08012345678" style={{ ...inputStyle(), marginBottom: '1rem' }} />

      <Label>Quantity</Label>
      <input value={quantity} onChange={e => setQuantity(e.target.value)} type="number" min="1" style={inputStyle()} />

      {serviceId && (
        <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.6rem' }}>
          {loadingPrice ? 'Loading price…' : `₦${unitPrice.toLocaleString()} per pin`}
        </div>
      )}

      <InsufficientBanner show={price > 0 && !hasBalance} />
      <ErrorBanner error={error} />

      <BuyButton
        onClick={handleBuy}
        loading={loading}
        disabled={!serviceId || !phone || price <= 0 || !hasBalance}
        label={`Buy Pin${quantity > 1 ? 's' : ''}${price > 0 ? ` — ₦${price.toLocaleString()}` : ''}`}
      />
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