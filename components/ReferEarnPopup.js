'use client'
import { useState, useEffect } from 'react'

// Refer & Earn ₦500 popup — matches the app's dark navy/purple/gold theme.
// Drop this in and control visibility with the `open` prop, e.g. show it
// once per session after the user lands on /dashboard.
//
// <ReferEarnPopup
//   open={showReferPopup}
//   referralLink="https://yourapp.com/r/USER123"
//   onClose={() => setShowReferPopup(false)}
// />
export default function ReferEarnPopup({ open, referralLink, onClose }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) setCopied(false)
  }, [open])

  if (!open) return null

  const handleShare = async () => {
    const shareText = `Join me on this app and we both get rewarded! Sign up with my link: ${referralLink}`
    if (navigator.share) {
      try { await navigator.share({ text: shareText, url: referralLink }) } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(4,5,12,0.72)', backdropFilter: 'blur(2px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '0 1.4rem',
      }}
    >
      <style>{`
        @keyframes referPopIn { from { opacity:0; transform: scale(0.92) translateY(10px); } to { opacity:1; transform: scale(1) translateY(0); } }
        @keyframes referTravel { from { offset-distance: 0%; } to { offset-distance: 100%; } }
        @keyframes referPulse { 0%,100% { opacity:0.35; transform: scale(1); } 50% { opacity:0; transform: scale(1.5); } }
        @keyframes referTwinkle { 0%,100% { opacity:0.15; } 50% { opacity:0.9; } }
        .refer-popup-card { animation: referPopIn 0.4s cubic-bezier(.2,.9,.25,1.2) both; }
        @media (prefers-reduced-motion: no-preference) {
          .refer-coin { animation: referTravel 2.6s ease-in-out infinite alternate; }
          .refer-pulse-a { animation: referPulse 2.2s ease-in-out infinite; }
          .refer-pulse-b { animation: referPulse 2.2s ease-in-out infinite 1.1s; }
          .refer-spark { animation: referTwinkle 1.8s ease-in-out infinite; }
        }
      `}</style>

      <div
        onClick={e => e.stopPropagation()}
        className="refer-popup-card"
        style={{
          position: 'relative', width: '100%', maxWidth: 340,
          background: 'linear-gradient(160deg, var(--navy2, #12142a) 0%, #0d0f22 70%)',
          border: '1px solid var(--border)', borderRadius: 26,
          padding: '1.8rem 1.5rem 1.6rem', textAlign: 'center', overflow: 'hidden',
        }}
      >
        <div style={{
          content: "''", position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
          width: 260, height: 200,
          background: 'radial-gradient(circle, rgba(108,78,242,0.35), transparent 70%)',
          pointerEvents: 'none',
        }} />

        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
          fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.66rem', letterSpacing: '0.08em',
          color: 'var(--gold)', background: 'rgba(240,180,41,0.12)',
          border: '1px solid rgba(240,180,41,0.3)', padding: '0.3rem 0.7rem', borderRadius: 999,
          position: 'relative', zIndex: 1,
        }}>
          REFER &amp; EARN
        </span>

        <div style={{ position: 'relative', zIndex: 1, margin: '1.1rem 0 0.3rem' }}>
          <svg width="260" height="120" viewBox="0 0 260 120" fill="none" style={{ maxWidth: '100%' }}>
            <circle className="refer-pulse-a" cx="55" cy="72" r="30" fill="none" stroke="#6c4ef2" strokeWidth="2" />
            <circle cx="55" cy="72" r="26" fill="#1b1d3b" stroke="#6c4ef2" strokeWidth="1.5" />
            <path d="M45 80 Q55 60 65 80" stroke="#c9c2ff" strokeWidth="2" strokeLinecap="round" fill="none" />
            <circle cx="55" cy="62" r="7" fill="#c9c2ff" />
            <text x="55" y="108" textAnchor="middle" fontFamily="Inter" fontSize="9" fill="#8b8fae">You</text>

            <circle className="refer-pulse-b" cx="205" cy="72" r="30" fill="none" stroke="#f0b429" strokeWidth="2" />
            <circle cx="205" cy="72" r="26" fill="#1b1d3b" stroke="#f0b429" strokeWidth="1.5" />
            <path d="M195 80 Q205 60 215 80" stroke="#ffdf9b" strokeWidth="2" strokeLinecap="round" fill="none" />
            <circle cx="205" cy="62" r="7" fill="#ffdf9b" />
            <text x="205" y="108" textAnchor="middle" fontFamily="Inter" fontSize="9" fill="#8b8fae">Friend</text>

            <path d="M85 65 Q130 15 175 65" stroke="#f0b429" strokeWidth="2" strokeDasharray="3 5" fill="none" opacity="0.6" />

            <g className="refer-spark" style={{ transformOrigin: '130px 30px' }}><circle cx="130" cy="28" r="1.6" fill="#f0b429" /></g>
            <g className="refer-spark" style={{ transformOrigin: '105px 45px', animationDelay: '0.6s' }}><circle cx="105" cy="45" r="1.3" fill="#c9c2ff" /></g>
            <g className="refer-spark" style={{ transformOrigin: '158px 42px', animationDelay: '1.2s' }}><circle cx="158" cy="42" r="1.3" fill="#ffdf9b" /></g>

            <g className="refer-coin" style={{ offsetPath: "path('M85,65 Q130,15 175,65')" }}>
              <circle cx="0" cy="0" r="12" fill="#f0b429" stroke="#7a5406" strokeWidth="1.2" />
              <text x="0" y="4" textAnchor="middle" fontFamily="Outfit" fontWeight="700" fontSize="11" fill="#4a3703">₦</text>
            </g>
          </svg>
        </div>

        <h1 style={{
          position: 'relative', zIndex: 1, fontFamily: 'Outfit, sans-serif', fontWeight: 800,
          fontSize: '1.5rem', lineHeight: 1.22, color: 'var(--text)', marginTop: '0.9rem',
        }}>
          Invite a friend<br />earn <span style={{ color: 'var(--gold)' }}>₦500</span>
        </h1>

        <p style={{
          position: 'relative', zIndex: 1, fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.5,
          margin: '0.7rem auto 1.4rem', maxWidth: 245,
        }}>
          Share your link. The moment your friend funds their wallet, ₦500 drops straight into yours — no limit on how many friends you invite.
        </p>

        <button
          onClick={handleShare}
          style={{
            position: 'relative', zIndex: 1, width: '100%', border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, var(--purple), #8a6ef7)', color: '#fff',
            fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.92rem',
            padding: '0.95rem', borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            boxShadow: '0 8px 22px rgba(108,78,242,0.4)',
          }}
        >
          {copied ? 'Link copied' : 'Share my link'}
          {!copied && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" /><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            </svg>
          )}
        </button>

        <button
          onClick={onClose}
          style={{
            position: 'relative', zIndex: 1, display: 'block', width: '100%', background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--muted)', fontSize: '0.72rem', marginTop: '0.85rem', fontFamily: 'Inter, sans-serif',
          }}
        >
          Maybe later
        </button>
      </div>

      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          marginTop: 16, width: 34, height: 34, borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border)',
          color: 'var(--text)', fontSize: '1rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ✕
      </button>
    </div>
  )
}