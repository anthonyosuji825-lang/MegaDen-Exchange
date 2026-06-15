// components/OnboardingTour.js
'use client'
import { useState, useEffect, useCallback } from 'react'

const TOUR_KEY = 'megaden_tour_completed'

const STEPS = [
  {
    id: 'tour-balance',
    title: 'Your Wallet Balance 💰',
    desc: 'This is your MegaDen wallet. Fund it once and use it to buy any service — numbers, boosts, VPN and more.',
    position: 'bottom',
  },
  {
    id: 'tour-add-funds',
    title: 'Add Funds ➕',
    desc: 'Tap here to top up your wallet via Paystack — card, bank transfer, or USSD. Instant credit.',
    position: 'bottom',
  },
  {
    id: 'tour-quick-services',
    title: 'Quick Services ⚡',
    desc: 'Your shortcut to everything on MegaDen — buy numbers, boost accounts, activate VPN, refer friends and more.',
    position: 'bottom',
  },
  {
    id: 'tour-buy-number',
    title: 'Buy Foreign Numbers 📱',
    desc: 'Get a virtual number from 40+ countries instantly. Use it to verify WhatsApp, TikTok, Google and more.',
    position: 'bottom',
  },
  {
    id: 'tour-boosting',
    title: 'Account Boosting 🚀',
    desc: 'Grow your social media presence with real likes, followers, and views — delivered fast.',
    position: 'bottom',
  },
  {
    id: 'tour-vpn',
    title: 'VPN Subscriptions 🔒',
    desc: 'Browse privately and securely with our VPN plans. Instant activation, 79+ server locations.',
    position: 'bottom',
  },
  {
    id: 'tour-refer',
    title: 'Refer & Earn 🎁',
    desc: 'Share your referral link and earn ₦200 for every friend who signs up and makes their first purchase.',
    position: 'bottom',
  },
]

export default function OnboardingTour() {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const [rect, setRect] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    try {
      const done = localStorage.getItem(TOUR_KEY)
      if (!done) {
        setTimeout(() => setVisible(true), 800)
      }
    } catch (e) {}
  }, [])

  const updateRect = useCallback(() => {
    if (!visible) return
    const currentStep = STEPS[step]
    const el = document.getElementById(currentStep.id)
    if (!el) return
    const r = el.getBoundingClientRect()
    setRect(r)

    const padding = 8
    const tooltipWidth = Math.min(280, window.innerWidth - 32)
    let left = r.left + r.width / 2 - tooltipWidth / 2
    left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16))
    const top = r.bottom + padding + window.scrollY

    setTooltipPos({ top, left, width: tooltipWidth })

    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [visible, step])

  useEffect(() => {
    updateRect()
    window.addEventListener('resize', updateRect)
    return () => window.removeEventListener('resize', updateRect)
  }, [updateRect])

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      finish()
    }
  }

  const finish = () => {
    setVisible(false)
    try { localStorage.setItem(TOUR_KEY, 'true') } catch (e) {}
  }

  if (!visible || !rect) return null

  const scrollTop = window.scrollY || document.documentElement.scrollTop

  return (
    <>
      <style>{`
        @keyframes tourFadeIn {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pulseRing {
          0% { box-shadow: 0 0 0 0 rgba(108,78,242,0.5); }
          70% { box-shadow: 0 0 0 10px rgba(108,78,242,0); }
          100% { box-shadow: 0 0 0 0 rgba(108,78,242,0); }
        }
        .tour-tooltip {
          animation: tourFadeIn 0.3s cubic-bezier(0.2,0.8,0.2,1) both;
        }
      `}</style>

      {/* Overlay with spotlight cutout */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998, pointerEvents: 'none' }}>
        {/* Top overlay */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: Math.max(0, rect.top + scrollTop - 8) - scrollTop, background: 'rgba(8,10,22,0.75)' }} />
        {/* Bottom overlay */}
        <div style={{ position: 'absolute', top: rect.bottom + 8, left: 0, right: 0, bottom: 0, background: 'rgba(8,10,22,0.75)' }} />
        {/* Left overlay */}
        <div style={{ position: 'absolute', top: rect.top - 8, left: 0, width: Math.max(0, rect.left - 8), height: rect.height + 16, background: 'rgba(8,10,22,0.75)' }} />
        {/* Right overlay */}
        <div style={{ position: 'absolute', top: rect.top - 8, left: rect.right + 8, right: 0, height: rect.height + 16, background: 'rgba(8,10,22,0.75)' }} />
      </div>

      {/* Spotlight border */}
      <div style={{
        position: 'fixed',
        top: rect.top - 8,
        left: rect.left - 8,
        width: rect.width + 16,
        height: rect.height + 16,
        borderRadius: 16,
        border: '2px solid var(--purple)',
        zIndex: 9999,
        pointerEvents: 'none',
        animation: 'pulseRing 1.5s ease-in-out infinite',
      }} />

      {/* Tooltip */}
      <div className="tour-tooltip" style={{
        position: 'absolute',
        top: tooltipPos.top + 12,
        left: tooltipPos.left,
        width: tooltipPos.width,
        background: 'var(--card)',
        border: '1px solid rgba(108,78,242,0.35)',
        borderRadius: 18,
        padding: '1.1rem 1.2rem',
        zIndex: 10000,
        boxShadow: '0 16px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(108,78,242,0.15)',
      }}>
        {/* Arrow pointing up */}
        <div style={{ position: 'absolute', top: -8, left: tooltipPos.width / 2 - 8, width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderBottom: '8px solid var(--purple)', opacity: 0.6 }} />

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '0.8rem' }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ height: 3, flex: 1, borderRadius: 2, background: i <= step ? 'var(--purple)' : 'var(--border)', transition: 'background 0.3s' }} />
          ))}
        </div>

        <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)', marginBottom: '0.4rem' }}>
          {STEPS[step].title}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.6, fontFamily: 'Inter, sans-serif', marginBottom: '1rem' }}>
          {STEPS[step].desc}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem' }}>
          <button onClick={finish} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', padding: '0.3rem 0' }}>
            Skip tour
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{step + 1}/{STEPS.length}</span>
            <button onClick={next} style={{ padding: '0.55rem 1.2rem', background: 'var(--purple)', color: '#fff', border: 'none', borderRadius: '10px', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
              {step === STEPS.length - 1 ? "Let's go! 🎉" : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}