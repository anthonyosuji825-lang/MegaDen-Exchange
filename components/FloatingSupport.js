'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function FloatingSupport() {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    const read = () => {
      const attr = document.documentElement.getAttribute('data-theme')
      if (attr) { setTheme(attr); return }
      try {
        const stored = localStorage.getItem('megaden-theme')
        if (stored) setTheme(stored)
      } catch (e) {}
    }
    read()
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  const isLight = theme === 'light'

  return (
    <>
      <style>{`
        @keyframes supportPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(108,78,242,0.28); }
          50% { box-shadow: 0 0 0 8px rgba(108,78,242,0); }
        }
        .floating-support-btn {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          animation: supportPulse 3.2s ease-in-out infinite;
        }
        .floating-support-btn:hover { transform: translateY(-3px) scale(1.05); }
        .floating-support-btn:active { transform: scale(0.95); }
      `}</style>
      <button
        onClick={() => setOpen(true)}
        aria-label="Support"
        className="floating-support-btn"
        style={{
          position: 'fixed',
          bottom: '5.6rem',
          right: '1.1rem',
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: isLight
            ? 'linear-gradient(135deg, #ffffff, #f2effe)'
            : 'linear-gradient(135deg, #7c5cf5, #5a3ce0)',
          border: isLight ? '1px solid rgba(108,78,242,0.22)' : '1px solid rgba(255,255,255,0.1)',
          boxShadow: isLight
            ? '0 8px 22px rgba(108,78,242,0.16), 0 2px 6px rgba(20,10,50,0.06)'
            : '0 10px 28px rgba(92,60,224,0.45), 0 2px 10px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 500,
        }}
      >
        <SupportIcon size={23} color={isLight ? '#6c4ef2' : '#ffffff'} />
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(8,10,22,0.7)',
            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '1.2rem',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20,
              padding: '1.4rem', width: '100%', maxWidth: 380, boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
            }}
          >
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.1rem', color: 'var(--text)', marginBottom: '0.3rem' }}>Need Help?</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '1.2rem' }}>Reach us through any of these channels</div>

            <a href="https://wa.me/17656822078" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.9rem', background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: 12, textDecoration: 'none', marginBottom: '0.7rem' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><SupportIcon size={18} color="#10b981" /></div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' }}>WhatsApp Support</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>Chat directly with our team</div>
              </div>
            </a>

            <a href="https://whatsapp.com/channel/0029Vb6NItO3gvWZxYJHZN17" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.9rem', background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: 12, textDecoration: 'none', marginBottom: '0.7rem' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><SupportIcon size={18} color="#10b981" /></div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' }}>WhatsApp Channel</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>Get updates & announcements</div>
              </div>
            </a>

            <a href="https://t.me/+3cblEJBfh1owOTJk" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.9rem', background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: 12, textDecoration: 'none', marginBottom: '0.7rem' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(70,135,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><SupportIcon size={18} color="#4687ff" /></div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' }}>Telegram Channel</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>Join our Telegram community</div>
              </div>
            </a>

            <Link href="/dashboard/help" onClick={() => setOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.9rem', background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: 12, textDecoration: 'none' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(240,180,41,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><HelpIcon size={18} color="#f0b429" /></div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' }}>Help Center</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>FAQs & answers to common questions</div>
              </div>
            </Link>
          </div>
        </div>
      )}
    </>
  )
}

function SupportIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-1.9 5.4 8.5 8.5 0 0 1-9.9 2.3L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 8.5-8.5h.4a8.48 8.48 0 0 1 8 8v.5z"/>
      <circle cx="8.4" cy="11.4" r="0.9" fill={color} stroke="none"/>
      <circle cx="12" cy="11.4" r="0.9" fill={color} stroke="none"/>
      <circle cx="15.6" cy="11.4" r="0.9" fill={color} stroke="none"/>
    </svg>
  )
}
function HelpIcon({ size = 20, color = 'currentColor' }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12" y2="17"/></svg> }