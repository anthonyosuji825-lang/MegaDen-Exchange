'use client'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { SPEND_TIERS, getTierInfo, formatNaira, formatNairaShort } from '@/lib/spend-tiers'

const ICONS = {
  spark: <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8 5.8 21.3l2.4-7.4L2 9.4h7.6z" />,
  medal: <><path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15" /><path d="M11 12 5.12 2.2" /><path d="m13 12 5.88-9.8" /><path d="M8 7h8" /><circle cx="12" cy="17" r="5" /></>,
  trophy: <><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></>,
  gem: <><path d="M6 3h12l4 6-10 13L2 9Z" /><path d="M11 3 8 9l4 13 4-13-3-6" /><path d="M2 9h20" /></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></>,
  flame: <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />,
  crown: <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />,
}

function TierIcon({ name, size = 18, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  )
}

// Deterministic "random" so server/client output always matches
const rnd = (i, salt) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

function Particles({ count, fx, accent }) {
  return (
    <div className="stc-particles" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={`stc-p stc-${fx}`}
          style={{
            left: `${6 + rnd(i, 1) * 88}%`,
            animationDelay: `${(rnd(i, 2) * 4).toFixed(2)}s`,
            animationDuration: `${(fx === 'embers' ? 2.6 : 3.6) + rnd(i, 3) * 2}s`,
            '--s': `${(fx === 'twinkle' ? 5 : 3) + rnd(i, 4) * 4}px`,
            background: fx === 'twinkle' ? 'transparent' : accent,
            color: accent,
          }}
        />
      ))}
    </div>
  )
}

export default function SpendTierCard({ totalSpent = 0, variant = 'full' }) {
  const info = getTierInfo(totalSpent)
  const { tier, next, progress, remaining, index } = info
  const compact = variant === 'compact'
  const stacked = variant === 'stacked'

  const [shown, setShown] = useState(0)
  const [barPct, setBarPct] = useState(0)
  const [open, setOpen] = useState(false)
  const [levelUp, setLevelUp] = useState(false)
  const prevTotal = useRef(0)

  // Count-up animation for the amount + progress bar fill
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const from = prevTotal.current
    const to = info.total
    prevTotal.current = to
    if (reduce || from === to) { setShown(to); setBarPct(progress * 100); return }
    let raf, start
    const dur = 1000
    const step = (t) => {
      if (!start) start = t
      const p = Math.min(1, (t - start) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(from + (to - from) * eased)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    const bar = setTimeout(() => setBarPct(progress * 100), 150)
    return () => { cancelAnimationFrame(raf); clearTimeout(bar) }
  }, [info.total, progress])

  // Celebrate when the user reaches a new tier since their last visit
  useEffect(() => {
    try {
      const saved = localStorage.getItem('megaden-spend-tier')
      if (saved !== null && Number(saved) < index) {
        setLevelUp(true)
        setTimeout(() => setLevelUp(false), 4500)
      }
      localStorage.setItem('megaden-spend-tier', String(index))
    } catch (e) {}
  }, [index])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const cardClass = `stc-card stc-${tier.key}${levelUp ? ' stc-levelup' : ''}`
  const pad = compact ? '0.65rem 1rem' : stacked ? '0.7rem 0.85rem' : '1rem 1.1rem'

  return (
    <>
      <style>{`
        .stc-card{position:relative;overflow:hidden;border-radius:18px;color:#fff;cursor:pointer;
          border:1px solid rgba(255,255,255,0.18);box-shadow:0 0 0 0 var(--stc-glow),0 6px 22px -10px var(--stc-glow);
          animation:stcGlow 3.2s ease-in-out infinite;transition:filter .2s;outline:none}
        .stc-card:hover{filter:brightness(1.08)}
        .stc-card:focus-visible{box-shadow:0 0 0 2px #fff}
        .stc-shine{position:absolute;inset:0;pointer-events:none;
          background:linear-gradient(115deg,transparent 35%,rgba(255,255,255,0.22) 50%,transparent 65%);
          transform:translateX(-120%);animation:stcShine 4.5s ease-in-out infinite}
        .stc-orb{position:absolute;top:-40px;right:-30px;width:120px;height:120px;border-radius:50%;
          background:radial-gradient(circle,var(--stc-glow) 0%,transparent 70%);animation:stcOrb 5s ease-in-out infinite;pointer-events:none}
        .stc-icon{animation:stcFloat 2.8s ease-in-out infinite}
        .stc-particles{position:absolute;inset:0;pointer-events:none;overflow:hidden}
        .stc-p{position:absolute;bottom:-8px;width:var(--s);height:var(--s);opacity:0;border-radius:50%;
          animation-name:stcRise;animation-iteration-count:infinite;animation-timing-function:ease-in}
        .stc-p.stc-twinkle{border-radius:0;background:none;animation-name:stcTwinkle;bottom:auto;top:calc(10% + var(--s) * 8)}
        .stc-p.stc-twinkle::before,.stc-p.stc-twinkle::after{content:"";position:absolute;left:50%;top:50%;background:currentColor;border-radius:2px;transform:translate(-50%,-50%)}
        .stc-p.stc-twinkle::before{width:var(--s);height:1.5px}
        .stc-p.stc-twinkle::after{width:1.5px;height:var(--s)}
        .stc-p.stc-embers{animation-name:stcEmber;filter:blur(.3px)}
        .stc-bar{height:6px;border-radius:99px;background:rgba(0,0,0,0.32);overflow:hidden;position:relative}
        .stc-fill{height:100%;border-radius:99px;transition:width 1.1s cubic-bezier(.22,1,.36,1);position:relative;overflow:hidden}
        .stc-fill::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.7),transparent);
          transform:translateX(-100%);animation:stcFillShine 2.4s ease-in-out infinite}
        .stc-levelup{animation:stcGlow 3.2s ease-in-out infinite,stcPop .9s cubic-bezier(.2,1.4,.4,1)}
        .stc-toast{position:absolute;left:50%;top:6px;transform:translateX(-50%);z-index:5;white-space:nowrap;
          background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,0.3);
          border-radius:99px;padding:.18rem .6rem;font-size:.6rem;font-weight:800;letter-spacing:.4px;animation:stcToast 4.5s ease forwards}
        @keyframes stcGlow{0%,100%{box-shadow:0 0 0 0 transparent,0 6px 22px -10px var(--stc-glow)}50%{box-shadow:0 0 18px 1px var(--stc-glow),0 6px 22px -8px var(--stc-glow)}}
        @keyframes stcShine{0%,55%{transform:translateX(-120%)}100%{transform:translateX(120%)}}
        @keyframes stcOrb{0%,100%{transform:scale(1);opacity:.7}50%{transform:scale(1.35);opacity:1}}
        @keyframes stcFloat{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-3px) rotate(3deg)}}
        @keyframes stcRise{0%{transform:translateY(0);opacity:0}20%{opacity:.85}100%{transform:translateY(-110px);opacity:0}}
        @keyframes stcEmber{0%{transform:translate(0,0) scale(1);opacity:0}15%{opacity:1}100%{transform:translate(12px,-120px) scale(.2);opacity:0}}
        @keyframes stcTwinkle{0%,100%{transform:scale(0) rotate(0);opacity:0}50%{transform:scale(1) rotate(45deg);opacity:1}}
        @keyframes stcFillShine{0%{transform:translateX(-100%)}60%,100%{transform:translateX(100%)}}
        @keyframes stcPop{0%{transform:scale(.94)}60%{transform:scale(1.04)}100%{transform:scale(1)}}
        @keyframes stcToast{0%{opacity:0;transform:translate(-50%,-8px)}10%,85%{opacity:1;transform:translate(-50%,0)}100%{opacity:0}}
        .stc-sheet{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.22) transparent}
        .stc-sheet::-webkit-scrollbar{width:6px}
        .stc-sheet::-webkit-scrollbar-track{background:transparent;margin:14px 0}
        .stc-sheet::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.22);border-radius:99px}
        .stc-sheet::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.4)}
        @keyframes stcSheet{from{transform:translateY(24px);opacity:0}to{transform:translateY(0);opacity:1}}
        @media (prefers-reduced-motion:reduce){.stc-card,.stc-shine,.stc-orb,.stc-icon,.stc-p,.stc-fill::after,.stc-toast{animation:none!important}}
      `}</style>

      <div
        role="button"
        tabIndex={0}
        aria-label={`Total spent ${formatNaira(info.total)}. ${tier.name} spender. Tap to view all tiers.`}
        className={cardClass}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true) } }}
        style={{ background: tier.bg, padding: pad, '--stc-glow': tier.glow, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: compact ? '0.22rem' : stacked ? '0.2rem' : '0.45rem', gridColumn: variant === 'full' ? '1 / -1' : undefined }}
      >
        <div className="stc-orb" />
        <Particles count={stacked ? Math.min(tier.particles, 4) : compact ? Math.min(tier.particles, 6) : tier.particles} fx={tier.fx} accent={tier.accent} />
        <div className="stc-shine" />
        {levelUp && <div className="stc-toast" style={{ color: tier.accent }}>🎉 {tier.name} TIER UNLOCKED</div>}

        {stacked ? (
          <>
            <div style={{ position: 'relative', zIndex: 2, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.72)', lineHeight: 1.2 }}>Total Spent</div>
            <div style={{ position: 'relative', zIndex: 2, fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.3rem', letterSpacing: -0.5, lineHeight: 1.1, textShadow: '0 1px 8px rgba(0,0,0,0.35)' }}>
              {formatNaira(shown)}
            </div>
            <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.3rem', marginTop: '0.1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', minWidth: 0 }}>
                <span className="stc-icon" style={{ display: 'flex' }}><TierIcon name={tier.icon} size={12} color={tier.accent} /></span>
                <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.66rem', color: tier.accent, letterSpacing: 0.2 }}>{tier.name}</span>
              </div>
              <span style={{ fontSize: '0.54rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)', whiteSpace: 'nowrap' }}>
                {next ? `${formatNairaShort(remaining)} to ${next.name}` : 'Max 👑'}
              </span>
            </div>
            <div className="stc-bar" style={{ position: 'relative', zIndex: 2, height: 5, marginTop: '0.1rem' }}>
              <div className="stc-fill" style={{ width: `${barPct}%`, background: `linear-gradient(90deg,${tier.accent}aa,${tier.accent})` }} />
            </div>
          </>
        ) : (
          <>
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.72)' }}>Total Spent</div>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: compact ? '1.3rem' : '1.55rem', letterSpacing: -0.5, lineHeight: 1.15, textShadow: '0 1px 8px rgba(0,0,0,0.35)' }}>
              {formatNaira(shown)}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(0,0,0,0.28)', border: `1px solid ${tier.accent}66`, borderRadius: 99, padding: compact ? '0.22rem 0.6rem 0.22rem 0.35rem' : '0.3rem 0.75rem 0.3rem 0.4rem', flexShrink: 0 }}>
            <span className="stc-icon" style={{ display: 'flex' }}><TierIcon name={tier.icon} size={compact ? 16 : 19} color={tier.accent} /></span>
            <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: compact ? '0.7rem' : '0.78rem', color: tier.accent, letterSpacing: 0.3 }}>{tier.name}</span>
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
          <div className="stc-bar" style={{ flex: 1 }}>
            <div className="stc-fill" style={{ width: `${barPct}%`, background: `linear-gradient(90deg,${tier.accent}aa,${tier.accent})` }} />
          </div>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap' }}>
            {next ? `${formatNaira(remaining)} to ${next.name}` : 'Max tier 👑'}
          </div>
        </div>
          </>
        )}
      </div>

      {open && typeof document !== 'undefined' && createPortal(
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="stc-sheet" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, maxHeight: '85vh', overflowY: 'auto', background: 'var(--card, #14142b)', color: 'var(--text, #fff)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: 22, padding: '1.2rem', animation: 'stcSheet .3s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.1rem' }}>Spender Tiers</div>
              <button onClick={() => setOpen(false)} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--muted, #999)', fontSize: '1.3rem', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted, #999)', marginBottom: '1rem' }}>
              You've spent {formatNaira(info.total)}{next ? ` — ${formatNaira(remaining)} more to reach ${next.name}.` : ' — you are at the top tier!'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {SPEND_TIERS.map((t, i) => {
                const unlocked = i <= index
                const current = i === index
                const upper = SPEND_TIERS[i + 1]
                return (
                  <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.65rem 0.8rem', borderRadius: 14, background: unlocked ? t.bg : 'var(--card2, rgba(255,255,255,0.04))', border: current ? `1.5px solid ${t.accent}` : '1px solid var(--border, rgba(255,255,255,0.08))', opacity: unlocked ? 1 : 0.6, color: unlocked ? '#fff' : 'inherit' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(0,0,0,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <TierIcon name={t.icon} size={18} color={unlocked ? t.accent : 'currentColor'} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.88rem' }}>{t.name}</div>
                      <div style={{ fontSize: '0.66rem', opacity: 0.8 }}>
                        {upper ? `${formatNaira(t.min)} – ${formatNaira(upper.min)}` : `${formatNaira(t.min)}+`}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.64rem', fontWeight: 800, color: unlocked ? t.accent : 'inherit' }}>
                      {current ? 'YOU ARE HERE' : unlocked ? '✓ Unlocked' : '🔒'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}