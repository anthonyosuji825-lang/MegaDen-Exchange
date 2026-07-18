'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Persistent "Install the app" reminder. Lives in the root layout so it's
// present on every route. Reappears on every page navigation even if
// closed (per spec) — it only disappears for good once the app is
// actually installed (detected via display-mode: standalone).
export default function InstallAppBanner() {
  const pathname = usePathname()
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(true) // assume installed until checked — avoids a flash on load
  const [dismissed, setDismissed] = useState(false)
  const [showIOSSteps, setShowIOSSteps] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
    setIsStandalone(standalone)
    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent))

    const handler = e => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)

    const installedHandler = () => setIsStandalone(true)
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  // Reappear on every page the user navigates to, even if dismissed before.
  useEffect(() => {
    setDismissed(false)
    setShowIOSSteps(false)
  }, [pathname])

  if (isStandalone || dismissed) return null
  if (!deferredPrompt && !isIOS) return null // nothing to offer yet (desktop browsers without support, etc.)

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      setDeferredPrompt(null)
      if (outcome === 'accepted') setIsStandalone(true)
      return
    }
    if (isIOS) setShowIOSSteps(true)
  }

  return (
    <div
      style={{
        position: 'fixed', left: '0.75rem', right: '0.75rem', bottom: '0.75rem', zIndex: 900,
        maxWidth: 420, margin: '0 auto',
        background: 'linear-gradient(160deg, #12142a 0%, #0d0f22 100%)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16,
        padding: '0.9rem 1rem', boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
        animation: 'installBannerUp 0.35s cubic-bezier(.2,.9,.25,1.1) both',
      }}
    >
      <style>{`@keyframes installBannerUp { from { opacity:0; transform: translateY(16px); } to { opacity:1; transform: translateY(0); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <img
          src="/icons/apple-touch-icon.png"
          alt=""
          style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.85rem', color: '#f4f5fb' }}>
            Install MegaDen
          </div>
          <div style={{ fontSize: '0.72rem', color: '#8b8fae', marginTop: '0.1rem' }}>
            Faster access, right from your home screen
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          style={{
            background: 'none', border: 'none', color: '#8b8fae', fontSize: '1rem',
            cursor: 'pointer', flexShrink: 0, padding: '0.2rem',
          }}
        >
          ✕
        </button>
      </div>

      {!showIOSSteps ? (
        <button
          onClick={handleInstall}
          style={{
            width: '100%', marginTop: '0.75rem', border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #6c4ef2, #8a6ef7)', color: '#fff',
            fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem',
            padding: '0.7rem', borderRadius: 12,
          }}
        >
          Install app
        </button>
      ) : (
        <div style={{
          marginTop: '0.75rem', fontSize: '0.74rem', color: '#c7cae0', lineHeight: 1.6,
          background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '0.6rem 0.75rem',
        }}>
          Tap the <strong>Share</strong> icon in Safari, then choose <strong>Add to Home Screen</strong>.
        </div>
      )}
    </div>
  )
}