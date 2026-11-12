'use client'
// Save as: components/AnnouncementPopup.js
// Shows the announcements you switch on from the admin "Popups" tab.
// Add <AnnouncementPopup /> once inside your dashboard layout.
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const HIDE_KEY = 'md_ann_hidden' // { [id]: version } people who ticked "Don't show again"
const sessionKey = (a) => `md_ann_seen:${a.id}:${a.version}` // dismissed for this visit

const readHidden = () => {
  try { return JSON.parse(localStorage.getItem(HIDE_KEY) || '{}') || {} } catch { return {} }
}
const writeHidden = (id, version) => {
  try { localStorage.setItem(HIDE_KEY, JSON.stringify({ ...readHidden(), [id]: version })) } catch { /* ignore */ }
}
const seenThisSession = (a) => {
  try { return sessionStorage.getItem(sessionKey(a)) === '1' } catch { return false }
}
const markSeen = (a) => {
  try { sessionStorage.setItem(sessionKey(a), '1') } catch { /* ignore */ }
}

// Resolves when the image is in the browser cache (or after `ms`, or on error) so the
// popup opens with its picture already painted instead of popping in later.
const preloadImage = (url, ms = 2500) => new Promise((resolve) => {
  if (!url) return resolve()
  const img = new Image()
  const done = () => resolve()
  img.onload = done
  img.onerror = done
  img.src = url
  setTimeout(done, ms)
})

const svg = (children) => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
)
export const ANN_ICONS = {
  bell: svg(<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>),
  gift: svg(<><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></>),
  rocket: svg(<><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></>),
  alert: svg(<><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>),
  info: svg(<><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>),
}

const CSS = `
  @keyframes annOverlay { from { opacity: 0; } to { opacity: 1; } }
  @keyframes annPop { from { opacity: 0; transform: translateY(18px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
  @keyframes annRing { 0% { transform: scale(0.9); opacity: 0.6; } 100% { transform: scale(1.5); opacity: 0; } }
  @keyframes annShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
  .ann-btn { transition: transform 0.15s, box-shadow 0.18s, background 0.15s, border-color 0.15s; cursor: pointer; font-family: Outfit, sans-serif; }
  .ann-btn:hover { transform: translateY(-1px); }
  .ann-primary:hover { box-shadow: 0 10px 28px rgba(108,78,242,0.45); }
  .ann-ghost:hover { background: var(--card2) !important; }
  .ann-x:hover { transform: scale(1.06); }
  .ann-btn:focus-visible, .ann-x:focus-visible { outline: 2px solid var(--purple); outline-offset: 2px; }
  .ann-skel { background: linear-gradient(90deg, var(--card2) 25%, var(--border) 50%, var(--card2) 75%); background-size: 200% 100%; animation: annShimmer 1.3s linear infinite; }
  /* Phones: slightly smaller card and text. Desktop and tablets are unchanged. */
  @media (max-width: 480px) {
    .ann-card { max-width: 316px !important; border-radius: 22px !important; }
    .ann-body { padding-left: 1.1rem !important; padding-right: 1.1rem !important; padding-bottom: 1.05rem !important; }
    .ann-title { font-size: 1.1rem !important; margin-bottom: 0.4rem !important; }
    .ann-msg { font-size: 0.8rem !important; line-height: 1.5 !important; margin-bottom: 0.55rem !important; }
    .ann-primary { padding: 0.72rem !important; font-size: 0.86rem !important; border-radius: 12px !important; }
    .ann-ghost { padding: 0.62rem !important; font-size: 0.8rem !important; border-radius: 12px !important; }
  }
  @media (prefers-reduced-motion: reduce) { .ann-card, .ann-overlay, .ann-ring, .ann-skel { animation: none !important; } }
`

// The card itself. Also used for the live preview in the admin Popups tab.
export function AnnouncementCard({ a, onPrimary, onDismiss, onHide, preview = false }) {
  const hasPrimary = !!(a.primary_label && a.primary_url)
  const primaryRef = useRef(null)
  const [loadedUrl, setLoadedUrl] = useState(null)
  const [failedUrl, setFailedUrl] = useState(null)
  const imgRef = useRef(null)
  const img = !a.image_url ? 'none' : failedUrl === a.image_url ? 'error' : loadedUrl === a.image_url ? 'ok' : 'loading'
  // A preloaded/cached picture can finish before React attaches onLoad, so also check once on mount.
  useEffect(() => {
    const el = imgRef.current
    if (el && el.complete && el.naturalWidth > 0) setLoadedUrl(a.image_url)
  }, [a.image_url])
  useEffect(() => { if (!preview) primaryRef.current?.focus() }, [preview, a.id])

  const hasImage = !!a.image_url && img !== 'error'
  const posted = a.created_at ? new Date(a.created_at) : new Date()

  return (
    <div className="ann-card" role={preview ? undefined : 'dialog'} aria-modal={preview ? undefined : 'true'} aria-label={a.title}
      style={{ position: 'relative', width: '100%', maxWidth: 380, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 26, textAlign: 'center', boxShadow: preview ? '0 12px 40px rgba(0,0,0,0.25)' : '0 28px 80px rgba(0,0,0,0.5)', animation: preview ? 'none' : 'annPop 0.35s cubic-bezier(0.2,0.8,0.2,1) both', overflow: 'hidden', maxHeight: preview ? 'none' : '92vh', overflowY: preview ? 'hidden' : 'auto' }}>
      <style>{CSS}</style>

      <button className="ann-x" onClick={onDismiss} aria-label="Close" type="button"
        style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3, transition: 'transform 0.15s',
          background: hasImage ? 'rgba(10,10,30,0.55)' : 'var(--card2)', color: hasImage ? '#fff' : 'var(--muted)', backdropFilter: hasImage ? 'blur(6px)' : 'none' }}>×</button>

      {/* BANNER IMAGE (16:9 box reserved up front so nothing jumps while it loads) */}
      {hasImage && (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: 'var(--card2)', overflow: 'hidden' }}>
          {img === 'loading' && <div className="ann-skel" style={{ position: 'absolute', inset: 0 }} />}
          <img ref={imgRef} src={a.image_url} alt="" decoding="async" fetchPriority="high"
            onLoad={() => setLoadedUrl(a.image_url)} onError={() => setFailedUrl(a.image_url)}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: img === 'ok' ? 1 : 0, transition: 'opacity 0.3s ease' }} />
          <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '40%', background: 'linear-gradient(to top, var(--card), transparent)', pointerEvents: 'none' }} />
        </div>
      )}

      {!hasImage && (
        <>
          <div aria-hidden style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(108,78,242,0.6), rgba(240,180,41,0.4), transparent)' }} />
          <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% -10%, rgba(108,78,242,0.16), transparent 60%)', pointerEvents: 'none' }} />
        </>
      )}

      <div className="ann-body" style={{ position: 'relative', zIndex: 1, padding: hasImage ? '0.4rem 1.5rem 1.4rem' : '1.9rem 1.5rem 1.4rem' }}>
        {!hasImage && (
          <div style={{ position: 'relative', width: 68, height: 68, margin: '0 auto 1.1rem' }}>
            <span className="ann-ring" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(108,78,242,0.22)', animation: preview ? 'none' : 'annRing 1.8s ease-out infinite' }} />
            <div style={{ position: 'relative', width: 68, height: 68, borderRadius: '50%', background: 'rgba(108,78,242,0.14)', border: '1px solid rgba(108,78,242,0.35)', color: 'var(--purple2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {ANN_ICONS[a.icon] || ANN_ICONS.bell}
            </div>
          </div>
        )}

        <h2 className="ann-title" style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.3rem', color: 'var(--text)', margin: '0 0 0.5rem', letterSpacing: '-0.02em', lineHeight: 1.25, wordBreak: 'break-word' }}>
          {a.title || 'Your title appears here'}
        </h2>
        {(a.message || preview) && (
          <p className="ann-msg" style={{ fontSize: '0.88rem', color: 'var(--muted)', margin: '0 0 0.7rem', lineHeight: 1.6, whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
            {a.message || 'Your message appears here.'}
          </p>
        )}
        <div style={{ fontSize: '0.68rem', color: 'var(--muted)', opacity: 0.8, marginBottom: '1.3rem' }}>
          Posted {posted.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          {hasPrimary && (
            <button ref={primaryRef} className="ann-btn ann-primary" type="button" onClick={onPrimary}
              style={{ width: '100%', padding: '0.9rem', background: 'var(--purple)', color: '#fff', border: 'none', borderRadius: 14, fontSize: '0.92rem', fontWeight: 700 }}>
              {a.primary_label}
            </button>
          )}
          <button className="ann-btn ann-ghost" type="button" onClick={onDismiss}
            style={{ width: '100%', padding: '0.8rem', background: 'transparent', color: hasPrimary ? 'var(--muted)' : '#fff', border: hasPrimary ? '1px solid var(--border)' : 'none', borderRadius: 14, fontSize: '0.86rem', fontWeight: 600, ...(hasPrimary ? {} : { background: 'var(--purple)', fontWeight: 700, fontSize: '0.92rem' }) }}>
            {hasPrimary ? 'Dismiss' : 'Got it'}
          </button>
          {a.allow_hide && (
            <button className="ann-btn" type="button" onClick={onHide}
              style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.74rem', fontWeight: 600, padding: '0.35rem', textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Don’t show this again
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AnnouncementPopup() {
  const router = useRouter()
  const [queue, setQueue] = useState([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.from('announcements').select('*').eq('is_active', true).order('created_at', { ascending: false })
        if (error || cancelled) return
        const now = Date.now()
        const hidden = readHidden()
        const list = (data || []).filter((a) =>
          (!a.starts_at || new Date(a.starts_at).getTime() <= now) &&
          (!a.ends_at || new Date(a.ends_at).getTime() > now) &&
          !(a.allow_hide && (hidden[a.id] || 0) >= a.version) &&
          !seenThisSession(a)
        )
        if (list.length === 0) return
        // Warm the first image (and wait briefly) so the popup opens fully painted.
        await Promise.all([preloadImage(list[0].image_url), new Promise((r) => setTimeout(r, 600))])
        if (!cancelled) setQueue(list)
        // Warm the rest in the background.
        list.slice(1).forEach((a) => preloadImage(a.image_url, 8000))
      } catch { /* never block the dashboard */ }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const current = queue[0]

  const next = () => setQueue((q) => q.slice(1))
  const dismiss = () => { if (current) { markSeen(current); next() } }
  const hide = () => { if (current) { writeHidden(current.id, current.version); markSeen(current); next() } }
  const primary = () => {
    if (!current) return
    const url = current.primary_url || ''
    markSeen(current)
    next()
    if (/^https:\/\//i.test(url)) window.open(url, '_blank', 'noopener,noreferrer')
    else if (/^\/(?!\/)/.test(url)) router.push(url)
  }

  useEffect(() => {
    if (!current) return
    const onKey = (e) => { if (e.key === 'Escape') { markSeen(current); setQueue((q) => q.slice(1)) } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [current])

  if (!current) return null

  return (
    <div className="ann-overlay" onClick={dismiss}
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(5,5,20,0.66)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.2rem', animation: 'annOverlay 0.25s ease both' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <AnnouncementCard a={current} onPrimary={primary} onDismiss={dismiss} onHide={hide} />
      </div>
    </div>
  )
}