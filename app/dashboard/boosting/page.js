'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import DesktopSidebar from '@/components/DesktopSidebar'

// ─── PLATFORM ICONS (unchanged from the original design) ─────────────────
const PlatformIcon = ({ id, size = 26 }) => {
  const icons = {
    instagram: <svg width={size} height={size} viewBox="0 0 24 24"><defs><linearGradient id="ig3" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#f09433"/><stop offset="25%" stopColor="#e6683c"/><stop offset="50%" stopColor="#dc2743"/><stop offset="75%" stopColor="#cc2366"/><stop offset="100%" stopColor="#bc1888"/></linearGradient></defs><path fill="url(#ig3)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>,
    tiktok: <svg width={size} height={size} viewBox="0 0 24 24"><path fill="#ff0050" d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.52V6.75a4.85 4.85 0 01-1.02-.06z"/></svg>,
    twitter: <svg width={size} height={size} viewBox="0 0 24 24" fill="#e7e7e7"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
    facebook: <svg width={size} height={size} viewBox="0 0 24 24" fill="#1877f2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
    youtube: <svg width={size} height={size} viewBox="0 0 24 24" fill="#ff0000"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>,
    telegram: <svg width={size} height={size} viewBox="0 0 24 24" fill="#0088cc"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>,
    spotify: <svg width={size} height={size} viewBox="0 0 24 24" fill="#1db954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>,
    snapchat: <svg width={size} height={size} viewBox="0 0 24 24" fill="#fffc00"><path d="M12.166.006C9.834-.072 7.2.637 5.51 2.341 4.073 3.786 3.42 5.836 3.34 7.835c-.05 1.215-.01 2.43-.01 3.644-.31.156-.636.23-.968.252-.347.024-.706-.027-1.02-.177-.186-.09-.4-.232-.604-.166-.21.068-.332.292-.334.506-.003.29.212.527.46.645.82.387 1.693.4 2.566.553.1.463.275.902.572 1.28.07.09.004.226-.073.295-.28.247-.595.44-.904.637-.424.269-.87.568-1.117 1.017-.145.264-.146.6.044.843.208.266.553.326.863.3.468-.04.91-.225 1.355-.375.333-.113.688-.228 1.04-.188.32.036.598.205.856.39.567.406 1.103.876 1.793 1.117.747.26 1.54.295 2.326.3h.194c.786-.005 1.58-.04 2.327-.3.69-.241 1.226-.711 1.793-1.117.258-.185.535-.354.855-.39.353-.04.708.075 1.041.188.445.15.887.334 1.355.375.31.026.655-.034.863-.3.19-.243.189-.579.044-.843-.247-.449-.693-.748-1.117-1.017-.31-.197-.624-.39-.904-.637-.077-.069-.144-.206-.073-.295.297-.378.471-.817.572-1.28.873-.153 1.746-.166 2.566-.553.248-.118.463-.355.46-.645-.002-.214-.123-.438-.334-.506-.204-.066-.418.076-.604.166-.314.15-.673.2-1.02.177-.332-.022-.658-.096-.968-.252 0-1.215.04-2.43-.01-3.644-.08-1.999-.733-4.05-2.17-5.494C16.8.637 14.165-.072 12.166.006"/></svg>,
    whatsapp: <svg width={size} height={size} viewBox="0 0 24 24" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>,
  }
  return icons[id] || null
}

function AlertIcon({ size = 16, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
}

function SpinnerIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
}

// Platform display name + brand accent color. The API only tells us which
// platform codes are active per tier — names/colors are a display concern,
// not pricing data, so they live here rather than in the database.
const PLATFORM_META = {
  instagram: { name: 'Instagram', color: '#dc2743' },
  tiktok:    { name: 'TikTok',    color: '#ff0050' },
  twitter:   { name: 'Twitter / X', color: '#1d9bf0' },
  facebook:  { name: 'Facebook',  color: '#1877f2' },
  youtube:   { name: 'YouTube',   color: '#ff0000' },
  telegram:  { name: 'Telegram',  color: '#0088cc' },
  spotify:   { name: 'Spotify',   color: '#1db954' },
  snapchat:  { name: 'Snapchat',  color: '#fffc00' },
  whatsapp:  { name: 'WhatsApp',  color: '#25d366' },
}

// What the customer should paste for each platform. Most platforms take a
// profile or post URL; WhatsApp services only work on public Channels, so
// the prompt says so up front instead of letting people paste a phone
// number or a profile link that the server would reject.
const LINK_HINTS = {
  whatsapp: {
    placeholder: 'Paste your WhatsApp Channel link (for reactions, the link to the specific post)...',
    note: 'Your WhatsApp Channel must be public. Group and personal chat links are not supported.',
  },
}

// A selectable service type (e.g. "Followers (AVG)"). Shows its real
// min/max range but never a price up front — price depends on quantity
// and today's exchange rate, so it's only computed once both are known.
function ServiceOption({ service, accentColor, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(service)}
      className="pkg-card"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem',
        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', width: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: accentColor, opacity: 0.7, flexShrink: 0 }} />
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text)' }}>{service.label}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.1rem' }}>
            {service.min.toLocaleString()} – {service.max.toLocaleString()}
          </div>
        </div>
      </div>
      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: accentColor, flexShrink: 0, marginLeft: '0.5rem' }}>Select →</span>
    </button>
  )
}

// Quantity entry for the chosen service: a free number input, quick-pick
// buttons computed server-side from that service's real min/max, and a
// live price fetched from /api/boost/quote as the quantity changes
// (debounced so we're not firing a request on every keystroke).
function QuantityPanel({ service, accentColor, onBack, onConfirm }) {
  const [raw, setRaw] = useState('')
  const [quote, setQuote] = useState(null)
  const [quoteError, setQuoteError] = useState('')
  const [quoting, setQuoting] = useState(false)

  const qty = Math.round(Number(raw) || 0)
  const inRange = raw !== '' && qty >= service.min && qty <= service.max
  const pickCount = service.quickPicks?.length || 0
  const pickCols = pickCount <= 4 ? Math.max(1, pickCount) : (pickCount % 3 === 0 ? 3 : pickCount % 4 === 0 ? 4 : 3)

  useEffect(() => {
    if (!inRange) { setQuote(null); setQuoteError(''); return }
    let cancelled = false
    setQuoting(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/boost/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serviceCode: service.code, quantity: qty }),
        })
        const data = await res.json().catch(() => null)
        if (cancelled) return
        if (!res.ok || !data) {
          setQuote(null)
          setQuoteError(data?.error || 'Could not get a price for this quantity')
        } else {
          setQuote(data)
          setQuoteError('')
        }
      } catch {
        if (!cancelled) { setQuote(null); setQuoteError('Could not reach the server') }
      } finally {
        if (!cancelled) setQuoting(false)
      }
    }, 400)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [qty, inRange, service.code])

  return (
    <div style={{ padding: '0.9rem 1rem', background: `${accentColor}0d`, border: `1px solid ${accentColor}`, borderRadius: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
        <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text)' }}>{service.label}</div>
        <button type="button" onClick={onBack} aria-label="Choose a different service" style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '1rem', cursor: 'pointer', lineHeight: 1 }}>×</button>
      </div>

      <input
        type="number"
        inputMode="numeric"
        aria-label={`Quantity for ${service.label}`}
        value={raw}
        onChange={e => setRaw(e.target.value)}
        placeholder={`${service.min.toLocaleString()} – ${service.max.toLocaleString()}`}
        style={{
          width: '100%', padding: '0.7rem 0.85rem', background: 'var(--navy)', border: '1px solid var(--border)',
          borderRadius: '10px', color: 'var(--text)', fontSize: '0.86rem', fontFamily: 'Inter, sans-serif',
          outline: 'none', boxSizing: 'border-box', marginBottom: '0.55rem',
        }}
      />

      {service.quickPicks?.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${pickCols}, 1fr)`, gap: '0.45rem', marginBottom: '0.7rem' }}>
          {service.quickPicks.map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setRaw(String(n))}
              className="quick-pick"
              style={{
                width: '100%', padding: '0.55rem 0.3rem', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif',
                background: qty === n ? accentColor : 'var(--card)',
                color: qty === n ? '#fff' : 'var(--muted)',
                border: `1px solid ${qty === n ? accentColor : 'var(--border)'}`,
              }}
            >
              {n.toLocaleString()}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '1.3rem' }}>
        <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>
          {raw !== '' && !inRange
            ? `Min ${service.min.toLocaleString()}, max ${service.max.toLocaleString()}`
            : `Range: ${service.min.toLocaleString()}–${service.max.toLocaleString()}`}
        </span>
        <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--gold)', fontFamily: 'Outfit, sans-serif' }}>
          {quoting ? <SpinnerIcon size={14} /> : quote ? `₦${quote.price.toLocaleString()}` : '—'}
        </span>
      </div>

      {quoteError && <div style={{ fontSize: '0.68rem', color: '#ff6b6b', marginTop: '0.35rem' }}>{quoteError}</div>}

      <button
        type="button"
        disabled={!quote}
        onClick={() => onConfirm({
          code: service.code,
          name: `${qty.toLocaleString()} ${service.label}`,
          price: quote.price,
          quantity: qty,
        })}
        className="buy-btn"
        style={{
          width: '100%', marginTop: '0.7rem', padding: '0.65rem',
          background: quote ? accentColor : 'var(--card2)', color: quote ? '#fff' : 'var(--muted)',
          border: 'none', borderRadius: '10px', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem',
          cursor: quote ? 'pointer' : 'not-allowed',
        }}
      >
        Use This Amount
      </button>
    </div>
  )
}

async function loadTierPlatforms(tier) {
  const res = await fetch(`/api/boost/services?tier=${tier}`).then(r => r.json()).catch(() => null)
  if (!res || res.error) return null
  return (res.platforms || [])
    .filter(p => PLATFORM_META[p.platform])
    .map(p => ({
      id: p.platform,
      name: PLATFORM_META[p.platform].name,
      color: PLATFORM_META[p.platform].color,
      services: p.services,
    }))
}

export default function Boosting() {
  const [profile, setProfile] = useState(null)
  const [provider, setProvider] = useState(null)   // null | 'turbo' | 'standard'
  const [platformsByTier, setPlatformsByTier] = useState({ turbo: [], standard: [] })
  const [servicesLoaded, setServicesLoaded] = useState(false)
  const [servicesError, setServicesError] = useState('')
  const [selectedPlatform, setSelectedPlatform] = useState(null)
  const [selectedService, setSelectedService] = useState(null)   // chosen type, quantity not yet confirmed
  const [selectedPackage, setSelectedPackage] = useState(null)   // confirmed { code, name, price, quantity }
  const [link, setLink] = useState('')
  const [ordering, setOrdering] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [orderMeta, setOrderMeta] = useState(null)
  const [mounted, setMounted] = useState(false)
  const [platformPage, setPlatformPage] = useState(0)
  const [broadcast, setBroadcast] = useState(null)
  const [isDesktop, setIsDesktop] = useState(false)
  const platformRef = useRef(null)
  const [platformPct, setPlatformPct] = useState(0)
  const step2Ref = useRef(null)
  const step3Ref = useRef(null)
  const summaryRef = useRef(null)

  const isTurbo = provider === 'turbo'
  const activeServices = provider ? platformsByTier[provider] : []

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    setIsDesktop(mq.matches)
    const handleChange = (e) => setIsDesktop(e.matches)
    mq.addEventListener('change', handleChange)
    return () => mq.removeEventListener('change', handleChange)
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  // A fresh key per distinct order attempt. Reused across retries of the
  // same attempt so the server recognizes a retry and doesn't duplicate the
  // order; cleared whenever the package or link actually changes.
  const idempotencyKeyRef = useRef(null)
  useEffect(() => { idempotencyKeyRef.current = null }, [selectedPackage?.code, selectedPackage?.quantity, link])

  // Gently bring the next step into view as the user progresses.
  const hasLink = !!link.trim()
  useEffect(() => {
    if (!selectedPlatform) return
    const t = setTimeout(() => step2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 160)
    return () => clearTimeout(t)
  }, [selectedPlatform?.id])
  useEffect(() => {
    if (!selectedPackage) return
    const t = setTimeout(() => step3Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 160)
    return () => clearTimeout(t)
  }, [selectedPackage?.code, selectedPackage?.quantity])
  useEffect(() => {
    if (!hasLink) return
    const t = setTimeout(() => summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 160)
    return () => clearTimeout(t)
  }, [hasLink])

  useEffect(() => {
    setMounted(true)
    const supabase = createClient()

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const [profileRes, turbo, standard] = await Promise.all([
        user ? supabase.from('profiles').select('wallet_balance').eq('id', user.id).single() : Promise.resolve({ data: null }),
        loadTierPlatforms('turbo'),
        loadTierPlatforms('standard'),
      ])
      if (profileRes.data) setProfile(profileRes.data)

      if (!turbo || !standard) {
        setServicesError('Could not load current services. Please refresh the page.')
      } else {
        setPlatformsByTier({ turbo, standard })
      }
      setServicesLoaded(true)
    }
    load()

    fetch('/api/boost/broadcast')
      .then(r => r.json())
      .then(setBroadcast)
      .catch(() => setBroadcast({ enabled: false, message: '' }))
  }, [])

  const goBack = () => {
    setProvider(null)
    setSelectedPlatform(null)
    setSelectedService(null)
    setSelectedPackage(null)
    setLink('')
    setError('')
    setSuccess(false)
    setOrderMeta(null)
    setPlatformPage(0)
    idempotencyKeyRef.current = null
  }

  const resetOrder = () => {
    setSelectedPlatform(null)
    setSelectedService(null)
    setSelectedPackage(null)
    setLink('')
    setError('')
    setSuccess(false)
    setOrderMeta(null)
    setPlatformPage(0)
    idempotencyKeyRef.current = null
  }

  const handleOrder = async () => {
    if (!selectedPlatform || !selectedPackage || !link.trim()) return
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID()
    }
    setOrdering(true)
    setError('')
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Your session has expired. Please sign in again.')
        return
      }

      // One endpoint for both tiers — the service code itself carries which
      // provider (Exobooster or JAP) the order actually goes to.
      const res = await fetch('/api/boost/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          serviceCode: selectedPackage.code,
          link: link.trim(),
          quantity: selectedPackage.quantity,
          idempotencyKey: idempotencyKeyRef.current,
        }),
      })
      const data = await res.json().catch(() => null)

      if (res.status === 202) {
        setOrderMeta({ orderId: data.orderId, status: 'needs_review' })
        setProfile(p => ({ ...p, wallet_balance: data.balance ?? p?.wallet_balance }))
        setSuccess(true)
        return
      }
      if (!res.ok || !data) {
        setError(data?.error || 'Order failed. Please try again.')
        return
      }
      setOrderMeta({ orderId: data.orderId, status: data.status })
      setProfile(p => ({ ...p, wallet_balance: data.balance ?? p?.wallet_balance }))
      setSuccess(true)
    } catch (err) {
      setError('Something went wrong. Please check your connection and try again.')
    } finally {
      setOrdering(false)
    }
  }

  const pasteLink = async () => {
    try {
      const t = await navigator.clipboard.readText()
      if (t) setLink(t.trim())
    } catch { /* clipboard permission denied - the user can paste manually */ }
  }

  const hasBalance = (profile?.wallet_balance || 0) >= (selectedPackage?.price || 0)

  // Turbo lays platforms out in 1 row, Standard in 2 rows; 4 columns fit per screen.
  const gridColumns = Math.ceil(activeServices.length / (isTurbo ? 1 : 2))
  const totalPages = Math.ceil(gridColumns / 4)

  return (
    <main style={{ background: 'var(--navy)', minHeight: '100vh', display: isDesktop ? 'flex' : 'block' }}>
      <style>{`
        @keyframes fadeSlideIn { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeSlideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes scaleIn { from { opacity:0; transform:scale(0.97); } to { opacity:1; transform:scale(1); } }
        @keyframes successPop { 0%{transform:scale(0);opacity:0;} 70%{transform:scale(1.15);} 100%{transform:scale(1);opacity:1;} }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .marquee-track { animation: marquee linear infinite; }
        .marquee-track:hover { animation-play-state: paused; }
        * { box-sizing:border-box; }
        .service-grid::-webkit-scrollbar { display:none; }
        .service-chip { transition:transform 0.15s ease,border-color 0.15s,background 0.15s,box-shadow 0.15s; cursor:pointer; }
        .service-chip:hover { transform:translateY(-2px); }
        .service-chip:active { transform:scale(0.97); }
        .pkg-card { transition:transform 0.15s ease,border-color 0.18s,background 0.18s; cursor:pointer; }
        .pkg-card:hover { transform:translateY(-1px); }
        .pkg-card:active { transform:scale(0.98); }
        .quick-pick { transition:transform 0.12s ease,background 0.15s,border-color 0.15s; cursor:pointer; }
        .quick-pick:hover { transform:translateY(-1px); }
        .quick-pick:active { transform:scale(0.95); }
        .buy-btn { transition:transform 0.18s ease,box-shadow 0.18s,background 0.18s; cursor:pointer; }
        .buy-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 10px 32px rgba(108,78,242,0.45); }
        .buy-btn:active:not(:disabled) { transform:scale(0.98); }
        .back-btn { transition:background 0.15s; }
        .back-btn:hover { background:var(--card2) !important; }
        .link-input:focus { border-color:var(--purple) !important; box-shadow:0 0 0 3px rgba(108,78,242,0.12); outline:none; }
        .provider-card { transition:transform 0.18s ease,box-shadow 0.2s ease; cursor:pointer; }
        .provider-card:hover { transform:translateY(-3px); }
        .provider-card:active { transform:scale(0.98); }
        @keyframes ring { 0% { box-shadow: 0 0 0 0 rgba(52,211,153,0.45); } 100% { box-shadow: 0 0 0 22px rgba(52,211,153,0); } }
        .bal-pill { transition: background 0.15s, border-color 0.15s; }
        .bal-pill:hover { background: var(--card2) !important; border-color: rgba(108,78,242,0.4) !important; }
        .paste-btn { transition: background 0.15s, transform 0.15s; }
        .paste-btn:hover { background: var(--card2) !important; }
        .paste-btn:active { transform: scale(0.95); }
        input[type=number]::-webkit-outer-spin-button, input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        .service-chip:focus-visible, .pkg-card:focus-visible, .quick-pick:focus-visible, .buy-btn:focus-visible, .provider-card:focus-visible, .back-btn:focus-visible, .paste-btn:focus-visible, .bal-pill:focus-visible { outline: 2px solid var(--purple); outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; } }
      `}</style>

      {isDesktop && <DesktopSidebar profile={profile} onLogout={handleLogout} />}

      <div style={{ flex: isDesktop ? 1 : 'none', minWidth: 0, paddingBottom: isDesktop ? '2rem' : '6.5rem' }}>
      {/* HEADER */}
      <div style={{ padding:'1rem 1.2rem', display:'flex', alignItems:'center', gap:'0.85rem', position:'sticky', top:0, zIndex:100, background:'rgba(var(--navy-rgb,10,10,30),0.92)', backdropFilter:'blur(20px)', borderBottom:'1px solid var(--border)' }}>
        {provider ? (
          <button className="back-btn" onClick={goBack} aria-label="Back" style={{ display:'flex', alignItems:'center', justifyContent:'center', width:36, height:36, borderRadius:'10px', background:'var(--card)', border:'1px solid var(--border)', color:'var(--text)', flexShrink:0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
        ) : (
          <Link href="/dashboard" className="back-btn" aria-label="Back to dashboard" style={{ display:'flex', alignItems:'center', justifyContent:'center', width:36, height:36, borderRadius:'10px', background:'var(--card)', border:'1px solid var(--border)', color:'var(--text)', textDecoration:'none', flexShrink:0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </Link>
        )}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:800, fontSize:'1rem', color:'var(--text)', letterSpacing:'-0.02em', display:'flex', alignItems:'center', gap:'0.4rem' }}>
            {provider === 'turbo' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--purple2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>}
            {provider === 'standard' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f5a623" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>}
            {!provider ? 'Social Boosting' : isTurbo ? 'Turbo Boost' : 'Standard Boost'}
          </div>
          <div style={{ fontSize:'0.7rem', color:'var(--muted)', marginTop:'0.05rem' }}>
            {!provider ? 'Real growth · Choose your service' : isTurbo ? 'Fast delivery · Premium quality' : 'All platforms · Steady growth'}
          </div>
        </div>
        <Link href="/dashboard/wallet" className="bal-pill" aria-label="Fund wallet" style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.35rem 0.4rem 0.35rem 0.75rem', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'20px', flexShrink:0, textDecoration:'none' }}>
          <span style={{ fontSize:'0.65rem', color:'var(--muted)' }}>BAL</span>
          <span style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.82rem', color:'var(--gold)' }}>₦{(profile?.wallet_balance || 0).toLocaleString()}</span>
          <span style={{ width:20, height:20, borderRadius:'50%', background:'var(--purple)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          </span>
        </Link>
      </div>

      <div style={{ padding:'1.2rem', maxWidth:480, margin:'0 auto' }}>

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

        {servicesError && (
          <div style={{ background:'rgba(220,50,50,0.1)', border:'1px solid rgba(220,50,50,0.3)', color:'#ff6b6b', borderRadius:'12px', padding:'0.8rem 1rem', fontSize:'0.84rem', marginBottom:'1rem' }}>
            {servicesError}
          </div>
        )}

        {/* ── LANDING SCREEN — choose Turbo or Standard ── */}
        {!provider && (
          <div style={{ animation: mounted ? 'fadeSlideIn 0.4s ease both' : 'none' }}>
            <div style={{ textAlign:'center', padding:'1.4rem 0 1.6rem' }}>
              <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:800, fontSize:'1.2rem', color:'var(--text)', marginBottom:'0.35rem' }}>Choose Your Boost</div>
              <div style={{ fontSize:'0.8rem', color:'var(--muted)' }}>Pick the service that fits your goals</div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>

              {/* TURBO */}
              <button className="provider-card" onClick={() => setProvider('turbo')}
                style={{ padding:'1.2rem 1rem', background:'linear-gradient(145deg, rgba(108,78,242,0.14) 0%, rgba(108,78,242,0.04) 100%)', border:'1.5px solid rgba(108,78,242,0.4)', borderRadius:'18px', textAlign:'left', boxShadow:'0 4px 20px rgba(108,78,242,0.1)' }}>
                <div style={{ width:40, height:40, borderRadius:'11px', background:'rgba(108,78,242,0.18)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'0.75rem' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--purple2)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                </div>
                <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:800, fontSize:'0.92rem', color:'var(--text)', marginBottom:'0.2rem' }}>Turbo Boost</div>
                <div style={{ fontSize:'0.62rem', color:'var(--purple2)', fontWeight:600, marginBottom:'0.6rem' }}>MegaDen Premium</div>
                <div style={{ fontSize:'0.72rem', color:'var(--muted)', lineHeight:1.55, marginBottom:'0.85rem' }}>
                  Lightning-fast delivery with Average and High Quality tiers.
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'0.3rem', marginBottom:'0.85rem' }}>
                  {['Instagram','TikTok','Facebook','YouTube','Telegram'].map(p => (
                    <span key={p} style={{ fontSize:'0.58rem', fontWeight:600, color:'var(--muted)', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'5px', padding:'0.15rem 0.4rem' }}>{p}</span>
                  ))}
                </div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', borderTop:'1px solid rgba(108,78,242,0.15)', paddingTop:'0.7rem' }}>
                  <span style={{ fontSize:'0.62rem', color:'var(--purple2)', fontWeight:700 }}>FASTEST</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--purple2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              </button>

              {/* STANDARD */}
              <button className="provider-card" onClick={() => setProvider('standard')}
                style={{ padding:'1.2rem 1rem', background:'linear-gradient(145deg, rgba(245,166,35,0.1) 0%, rgba(245,166,35,0.02) 100%)', border:'1.5px solid rgba(245,166,35,0.3)', borderRadius:'18px', textAlign:'left', boxShadow:'0 4px 20px rgba(245,166,35,0.06)' }}>
                <div style={{ width:40, height:40, borderRadius:'11px', background:'rgba(245,166,35,0.14)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'0.75rem' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f5a623" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>
                </div>
                <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:800, fontSize:'0.92rem', color:'var(--text)', marginBottom:'0.2rem' }}>Standard Boost</div>
                <div style={{ fontSize:'0.62rem', color:'#f5a623', fontWeight:600, marginBottom:'0.6rem' }}>MegaDen Standard</div>
                <div style={{ fontSize:'0.72rem', color:'var(--muted)', lineHeight:1.55, marginBottom:'0.85rem' }}>
                  Wider coverage including Spotify, Snapchat and WhatsApp across 9 platforms.
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'0.3rem', marginBottom:'0.85rem' }}>
                  {['Instagram','TikTok','Twitter','Facebook','YouTube','Telegram','Spotify','Snapchat','WhatsApp'].map(p => (
                    <span key={p} style={{ fontSize:'0.58rem', fontWeight:600, color:'var(--muted)', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'5px', padding:'0.15rem 0.4rem' }}>{p}</span>
                  ))}
                </div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', borderTop:'1px solid rgba(245,166,35,0.15)', paddingTop:'0.7rem' }}>
                  <span style={{ fontSize:'0.62rem', color:'#f5a623', fontWeight:700 }}>ALL PLATFORMS</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f5a623" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              </button>

            </div>

            {!servicesLoaded && (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem', padding:'1.2rem', color:'var(--muted)', fontSize:'0.78rem' }}>
                <SpinnerIcon size={14} /> Loading current services…
              </div>
            )}
          </div>
        )}

        {/* ── BOOST SCREEN — after a tier is picked ── */}
        {provider && (
          <>
            {success ? (
              <div style={{ background:'linear-gradient(135deg, rgba(52,211,153,0.08) 0%, rgba(108,78,242,0.06) 100%)', border:'1px solid rgba(52,211,153,0.25)', borderRadius:22, padding:'1.6rem 1.3rem 1.3rem', animation:'scaleIn 0.35s ease both' }}>
                <div style={{ textAlign:'center', marginBottom:'1.3rem' }}>
                  <div style={{ width:64, height:64, borderRadius:'50%', margin:'0 auto 0.9rem', background:'rgba(52,211,153,0.16)', border:'1px solid rgba(52,211,153,0.4)', display:'flex', alignItems:'center', justifyContent:'center', color:'#34d399', animation:'successPop 0.5s cubic-bezier(0.175,0.885,0.32,1.275), ring 1.2s ease-out 0.3s 1' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div style={{ fontFamily:'Outfit, sans-serif', fontSize:'1.1rem', fontWeight:800, color:'var(--text)' }}>
                    {orderMeta?.status === 'needs_review' ? 'Order Received' : 'Order Placed!'}
                  </div>
                  <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:900, fontSize:'1.9rem', color:'var(--gold)', marginTop:'0.25rem', letterSpacing:'-0.02em' }}>₦{selectedPackage?.price.toLocaleString()}</div>
                  <div style={{ color:'var(--muted)', fontSize:'0.78rem', lineHeight:1.55, marginTop:'0.5rem' }}>
                    {orderMeta?.status === 'needs_review'
                      ? `We're confirming your ${selectedPlatform?.name} boost with the provider — this can take a few minutes. Check your order history shortly.`
                      : `Your ${selectedPlatform?.name} boost is processing.`}
                  </div>
                </div>

                <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'0.35rem 0.95rem' }}>
                  {[
                    { label:'Platform', value: <span style={{ display:'inline-flex', alignItems:'center', gap:'0.4rem' }}><PlatformIcon id={selectedPlatform?.id} size={14} />{selectedPlatform?.name}</span> },
                    { label:'Package', value: selectedPackage?.name },
                    { label:'Service', value: isTurbo ? 'Turbo Boost' : 'Standard Boost' },
                    ...(orderMeta?.orderId ? [{ label:'Order ID', value: `#${orderMeta.orderId}` }] : []),
                  ].map((l, i, arr) => (
                    <div key={l.label} style={{ display:'flex', justifyContent:'space-between', gap:'0.8rem', fontSize:'0.8rem', padding:'0.6rem 0', borderBottom: i < arr.length - 1 ? '1px dashed var(--border)' : 'none' }}>
                      <span style={{ color:'var(--muted)', flexShrink:0 }}>{l.label}</span>
                      <span style={{ color:'var(--text)', fontWeight:600, textAlign:'right', wordBreak:'break-word' }}>{l.value}</span>
                    </div>
                  ))}
                </div>

                <button onClick={resetOrder} className="buy-btn" style={{ width:'100%', marginTop:'1rem', padding:'0.95rem', background:'var(--purple)', color:'#fff', border:'none', borderRadius:14, fontFamily:'Outfit, sans-serif', fontSize:'0.92rem', fontWeight:700 }}>
                  New Order
                </button>
                <Link href="/dashboard" style={{ display:'block', textAlign:'center', marginTop:'0.6rem', padding:'0.75rem', borderRadius:12, border:'1px solid var(--border)', color:'var(--muted)', fontSize:'0.82rem', fontWeight:600, textDecoration:'none', fontFamily:'Outfit, sans-serif' }}>
                  Back to dashboard
                </Link>
              </div>
            ) : (
              <div style={{ animation:'fadeSlideUp 0.35s ease both' }}>
                {error && (
                  <div style={{ background:'rgba(220,50,50,0.1)', border:'1px solid rgba(220,50,50,0.3)', color:'#ff6b6b', borderRadius:'12px', padding:'0.8rem 1rem', fontSize:'0.84rem', marginBottom:'1rem', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <span>{error}</span>
                    <button onClick={() => setError('')} style={{ background:'none', border:'none', color:'#ff6b6b', cursor:'pointer', fontSize:'1.1rem', lineHeight:1 }}>×</button>
                  </div>
                )}

                {/* STEP 1 — PLATFORM */}
                <div style={{ marginBottom:'1.5rem', animation: mounted ? 'fadeSlideIn 0.35s ease 0.05s both' : 'none' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.55rem', marginBottom:'0.85rem' }}>
                    <StepBadge n={1} done={!!selectedPlatform} />
                    <span style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.88rem', color:'var(--text)' }}>Select Platform</span>
                    {selectedPlatform && (
                      <span style={{ fontSize:'0.7rem', color:'#34d399', marginLeft:'auto', display:'flex', alignItems:'center', gap:'0.3rem' }}>
                        <span style={{ display:'inline-block', width:7, height:7, borderRadius:'50%', background: selectedPlatform.color }}/>
                        {selectedPlatform.name}
                      </span>
                    )}
                  </div>

                  <div
                    className="service-grid"
                    ref={platformRef}
                    onScroll={e => {
                      const el = e.currentTarget
                      const max = el.scrollWidth - el.clientWidth
                      setPlatformPct(max > 0 ? el.scrollLeft / max : 0)
                      setPlatformPage(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))
                    }}
                    style={isTurbo
                      ? { display:'grid', gridTemplateRows:'1fr', gridAutoFlow:'column', gridAutoColumns:'calc(25% - 0.38rem)', gap:'0.5rem', overflowX:'auto', paddingBottom:'0.3rem', scrollbarWidth:'none', msOverflowStyle:'none' }
                      : { display:'grid', gridTemplateRows:'repeat(2, 1fr)', gridAutoFlow:'column', gridAutoColumns:'calc(25% - 0.38rem)', gap:'0.5rem', overflowX:'auto', paddingBottom:'0.3rem', scrollbarWidth:'none', msOverflowStyle:'none' }
                    }>
                    {activeServices.map((p, i) => {
                      const isSel = selectedPlatform?.id === p.id
                      return (
                        <button key={p.id} className="service-chip"
                          onClick={() => { setSelectedPlatform(p); setSelectedService(null); setSelectedPackage(null) }}
                          style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0.5rem', padding:'1rem 0.4rem', background: isSel ? `${p.color}15` : 'var(--card)', border:`1.5px solid ${isSel ? p.color : 'var(--border)'}`, borderRadius:'14px', boxShadow: isSel ? `0 4px 16px ${p.color}33` : 'none', animation: mounted ? `fadeSlideIn 0.3s ease ${0.04*i}s both` : 'none' }}>
                          <div style={{ filter: isSel ? 'none' : 'grayscale(20%) opacity(0.85)', transition:'filter 0.2s' }}>
                            <PlatformIcon id={p.id} size={26} />
                          </div>
                          <span style={{ fontSize:'0.62rem', fontWeight:600, color: isSel ? p.color : 'var(--muted)', textAlign:'center', lineHeight:1.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', width:'100%', transition:'color 0.2s' }}>
                            {p.name.replace(' / X', '')}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {totalPages > 1 && (
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0.3rem', marginTop:'0.5rem' }}>
                      <div style={{ display:'flex', gap:'0.3rem', alignItems:'center' }}>
                        {Array.from({ length: totalPages }).map((_, i) => (
                          <div key={i} style={{ width: platformPage === i ? 16 : 6, height:6, borderRadius:99, background: platformPage === i ? 'var(--purple)' : 'var(--border)', transition:'all 0.3s ease' }}/>
                        ))}
                      </div>
                      <span style={{ fontSize:'0.6rem', color:'var(--muted)', letterSpacing:'0.04em' }}>{platformPct > 0.98 ? 'That’s everything ←' : 'Swipe to see more platforms →'}</span>
                    </div>
                  )}
                </div>

                {/* STEP 2 — SERVICE TYPE + QUANTITY */}
                {selectedPlatform && (
                  <div ref={step2Ref} style={{ marginBottom:'1.4rem', scrollMarginTop:84, animation:'fadeSlideIn 0.35s ease both' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.55rem', marginBottom:'0.85rem' }}>
                      <StepBadge n={2} done={!!selectedPackage} />
                      <span style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.88rem', color:'var(--text)' }}>Select Package</span>
                      <span style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'0.35rem' }}>
                        <PlatformIcon id={selectedPlatform.id} size={13} />
                        <span style={{ color: selectedPlatform.color, fontSize:'0.72rem', fontWeight:700 }}>{selectedPlatform.name}</span>
                      </span>
                    </div>

                    <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', maxHeight:360, overflowY:'auto', paddingRight:2 }}>
                      {!selectedService && selectedPlatform.services.map(svc => (
                        <ServiceOption
                          key={svc.code}
                          service={svc}
                          accentColor={selectedPlatform.color}
                          onSelect={(s) => { setSelectedService(s); setSelectedPackage(null) }}
                        />
                      ))}
                      {selectedService && (
                        <QuantityPanel
                          service={selectedService}
                          accentColor={selectedPlatform.color}
                          onBack={() => setSelectedService(null)}
                          onConfirm={setSelectedPackage}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* STEP 3 — LINK */}
                {selectedPackage && (
                  <div ref={step3Ref} style={{ marginBottom:'1.4rem', scrollMarginTop:84, animation:'fadeSlideIn 0.3s ease both' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.55rem', marginBottom:'0.85rem' }}>
                      <StepBadge n={3} done={hasLink} />
                      <span style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.88rem', color:'var(--text)' }}>Your Link</span>
                    </div>
                    <div style={{ position:'relative' }}>
                      <input className="link-input" aria-label="Your link" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                        placeholder={LINK_HINTS[selectedPlatform.id]?.placeholder || `Paste your ${selectedPlatform.name} profile or post URL...`}
                        value={link} onChange={e => setLink(e.target.value)}
                        style={{ width:'100%', padding:'0.85rem 5.2rem 0.85rem 1rem', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', color:'var(--text)', fontSize:'0.88rem', fontFamily:'Inter, sans-serif', transition:'border-color 0.2s, box-shadow 0.2s' }}
                      />
                      <div style={{ position:'absolute', right:'0.45rem', top:'50%', transform:'translateY(-50%)', display:'flex', gap:'0.3rem' }}>
                        {link ? (
                          <button type="button" onClick={() => setLink('')} aria-label="Clear link" className="paste-btn" style={{ width:30, height:30, borderRadius:'50%', border:'none', background:'var(--card2)', color:'var(--muted)', cursor:'pointer', fontSize:'1rem', lineHeight:1, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
                        ) : (
                          <button type="button" onClick={pasteLink} className="paste-btn" style={{ padding:'0.4rem 0.75rem', borderRadius:'9px', border:'1px solid var(--border)', background:'var(--card)', color:'var(--text)', cursor:'pointer', fontSize:'0.72rem', fontWeight:600, fontFamily:'Outfit, sans-serif' }}>Paste</button>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize:'0.7rem', color:'var(--muted)', marginTop:'0.4rem', lineHeight:1.5 }}>{LINK_HINTS[selectedPlatform.id]?.note || 'Make sure your account or post is public before ordering.'}</div>
                    {link.trim() && !/^https?:\/\//i.test(link.trim()) && (
                      <div style={{ fontSize:'0.7rem', color:'#f0b429', marginTop:'0.35rem' }}>This doesn’t look like a link — it should start with https://</div>
                    )}
                  </div>
                )}

                {/* SUMMARY + BUY */}
                {selectedPlatform && selectedPackage && link.trim() && (
                  <div ref={summaryRef} style={{ scrollMarginTop:84, animation:'scaleIn 0.3s ease both' }}>
                    <div style={{ background:'var(--card2)', border:'1px solid var(--border)', borderRadius:'16px', padding:'1.1rem', marginBottom:'1rem' }}>
                      <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.82rem', color:'var(--text)', marginBottom:'0.8rem' }}>Order Summary</div>
                      {[
                        { label:'Service',  value: <span style={{ fontWeight:600, color: isTurbo ? 'var(--purple2)' : '#f5a623' }}>{isTurbo ? 'Turbo Boost' : 'Standard Boost'}</span> },
                        { label:'Platform', value: <span style={{ display:'flex', alignItems:'center', gap:'0.4rem', justifyContent:'flex-end' }}><PlatformIcon id={selectedPlatform.id} size={13}/>{selectedPlatform.name}</span> },
                        { label:'Package',  value: selectedPackage.name },
                        { label:'Balance',  value: <span style={{ color: hasBalance ? '#10b981' : '#f43f5e', fontWeight:700 }}>₦{(profile?.wallet_balance || 0).toLocaleString()}</span> },
                      ].map(row => (
                        <div key={row.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'0.8rem', marginBottom:'0.45rem' }}>
                          <span style={{ color:'var(--muted)' }}>{row.label}</span>
                          <span style={{ color:'var(--text)', fontWeight:500 }}>{row.value}</span>
                        </div>
                      ))}
                      <div style={{ height:1, background:'var(--border)', margin:'0.6rem 0' }}/>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'0.92rem' }}>
                        <span style={{ color:'var(--muted)', fontWeight:600 }}>Total</span>
                        <span style={{ color:'var(--gold)', fontWeight:800, fontFamily:'Outfit, sans-serif' }}>₦{selectedPackage.price.toLocaleString()}</span>
                      </div>
                    </div>
                    {!hasBalance && (
                      <div style={{ background:'rgba(244,63,94,0.07)', border:'1px solid rgba(244,63,94,0.2)', borderRadius:'12px', padding:'0.75rem 1rem', fontSize:'0.8rem', color:'#f43f5e', marginBottom:'0.75rem', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <span>Insufficient balance</span>
                        <Link href="/dashboard/wallet" style={{ color:'#f43f5e', fontWeight:700, textDecoration:'none', fontSize:'0.75rem' }}>Fund Wallet →</Link>
                      </div>
                    )}
                    <button onClick={handleOrder} disabled={ordering || !hasBalance} className="buy-btn"
                      style={{ width:'100%', padding:'0.95rem', background: !hasBalance ? 'var(--card2)' : ordering ? 'var(--purple2)' : 'var(--purple)', color: !hasBalance ? 'var(--muted)' : '#fff', border:'none', borderRadius:'12px', fontFamily:'Outfit, sans-serif', fontSize:'0.95rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.6rem', opacity: !hasBalance ? 0.6 : 1, cursor: ordering || !hasBalance ? 'not-allowed' : 'pointer' }}>
                      {ordering
                        ? <><SpinnerIcon size={18} />Processing...</>
                        : `${isTurbo ? 'Turbo' : 'Boost'} Now — ₦${selectedPackage.price.toLocaleString()}`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      </div>

      {!isDesktop && <BottomNav />}
    </main>
  )
}
function StepBadge({ n, done }) {
  return (
    <div style={{ width: 22, height: 22, borderRadius: '50%', background: done ? '#34d399' : 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.3s' }}>
      {done
        ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        : <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#fff' }}>{n}</span>}
    </div>
  )
}