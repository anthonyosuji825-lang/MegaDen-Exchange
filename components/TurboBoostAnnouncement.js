'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const STORAGE_KEY = 'turbo_boost_announcement_v1'
const MAX_SHOWS = 3

export default function TurboBoostAnnouncement() {
  const [visible, setVisible] = useState(false)
  const [animateOut, setAnimateOut] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const count = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10)
    if (count < MAX_SHOWS) {
      localStorage.setItem(STORAGE_KEY, String(count + 1))
      const t = setTimeout(() => setVisible(true), 700)
      return () => clearTimeout(t)
    }
  }, [])

  const dismiss = () => {
    setAnimateOut(true)
    setTimeout(() => setVisible(false), 420)
  }

  const handleCTA = () => {
    dismiss()
    setTimeout(() => router.push('/dashboard/boosting'), 450)
  }

  if (!visible) return null

  return (
    <>
      <style>{`
        @keyframes tbBackdrop { from{opacity:0} to{opacity:1} }
        @keyframes tbBackdropOut { from{opacity:1} to{opacity:0} }
        @keyframes tbSheet { from{opacity:0;transform:translateY(100%)} to{opacity:1;transform:translateY(0)} }
        @keyframes tbSheetOut { from{opacity:1;transform:translateY(0)} to{opacity:0;transform:translateY(60px)} }
        @keyframes tbBolt { 0%,100%{transform:scale(1) rotate(-5deg);filter:drop-shadow(0 0 12px rgba(167,139,250,0.8));} 50%{transform:scale(1.12) rotate(-5deg);filter:drop-shadow(0 0 28px rgba(167,139,250,1));} }
        @keyframes tbRing1 { 0%{transform:scale(0.8);opacity:0.8} 100%{transform:scale(2.2);opacity:0} }
        @keyframes tbRing2 { 0%{transform:scale(0.8);opacity:0.6} 100%{transform:scale(2.8);opacity:0} }
        @keyframes tbRing3 { 0%{transform:scale(0.8);opacity:0.4} 100%{transform:scale(3.4);opacity:0} }
        @keyframes tbStreakL { 0%{opacity:0;transform:translateX(0)} 30%{opacity:1} 100%{opacity:0;transform:translateX(-60px)} }
        @keyframes tbStreakR { 0%{opacity:0;transform:translateX(0)} 30%{opacity:1} 100%{opacity:0;transform:translateX(60px)} }
        @keyframes tbTitle { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes tbSub { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes tbPills { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes tbBtn { from{opacity:0;transform:translateY(10px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes tbGlow { 0%,100%{box-shadow:0 0 30px rgba(139,92,246,0.5),0 0 60px rgba(139,92,246,0.2),inset 0 1px 0 rgba(255,255,255,0.15);} 50%{box-shadow:0 0 50px rgba(139,92,246,0.8),0 0 100px rgba(139,92,246,0.3),inset 0 1px 0 rgba(255,255,255,0.15);} }
        @keyframes tbParticle { 0%{opacity:1;transform:translate(0,0) scale(1)} 100%{opacity:0;transform:translate(var(--px),var(--py)) scale(0)} }
        @keyframes tbScan { 0%{transform:translateY(-100%)} 100%{transform:translateY(400%)} }
        .tb-cta { transition:transform 0.18s ease,box-shadow 0.18s ease !important; }
        .tb-cta:hover { transform:translateY(-3px) scale(1.01) !important; box-shadow:0 20px 50px rgba(139,92,246,0.7) !important; }
        .tb-cta:active { transform:scale(0.98) !important; }
        .tb-dismiss:hover { color:rgba(255,255,255,0.6) !important; }
      `}</style>

      {/* BACKDROP */}
      <div onClick={dismiss} style={{
        position:'fixed', inset:0, zIndex:9998,
        background:'rgba(0,0,0,0.85)',
        backdropFilter:'blur(8px)',
        animation: animateOut ? 'tbBackdropOut 0.42s ease forwards' : 'tbBackdrop 0.3s ease both',
      }}/>

      {/* SHEET */}
      <div style={{
        position:'fixed', left:0, right:0, bottom:0, zIndex:9999,
        animation: animateOut ? 'tbSheetOut 0.42s cubic-bezier(0.4,0,1,1) forwards' : 'tbSheet 0.5s cubic-bezier(0.175,0.885,0.32,1.1) both',
        animationDelay: animateOut ? '0s' : '0.08s',
      }}>
        <div style={{
          background:'#08051a',
          borderRadius:'28px 28px 0 0',
          overflow:'hidden',
          maxWidth:520,
          margin:'0 auto',
          border:'1px solid rgba(139,92,246,0.3)',
          borderBottom:'none',
        }}>

          {/* ── HERO AREA ── */}
          <div style={{
            position:'relative', height:220,
            background:'linear-gradient(160deg, #1a0533 0%, #0d0825 40%, #060414 100%)',
            overflow:'hidden',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            {/* Scan line effect */}
            <div style={{
              position:'absolute', left:0, right:0, height:2,
              background:'linear-gradient(90deg, transparent, rgba(139,92,246,0.6), transparent)',
              animation:'tbScan 2.5s ease-in-out infinite',
              zIndex:2,
            }}/>

            {/* Deep glow background */}
            <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 70% 60% at 50% 60%, rgba(109,40,217,0.35) 0%, transparent 70%)' }}/>

            {/* Grid */}
            <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:0.06 }} viewBox="0 0 520 220" preserveAspectRatio="none">
              {[0,1,2,3,4,5,6,7,8,9,10].map(i => <line key={`v${i}`} x1={i*52} y1="0" x2={i*52} y2="220" stroke="#a78bfa" strokeWidth="1"/>)}
              {[0,1,2,3,4,5].map(i => <line key={`h${i}`} x1="0" y1={i*44} x2="520" y2={i*44} stroke="#a78bfa" strokeWidth="1"/>)}
            </svg>

            {/* Speed streaks left */}
            {[0,1,2,3,4].map(i => (
              <div key={`sl${i}`} style={{
                position:'absolute',
                left: `${18 + i*4}%`,
                top: `${30 + i*10}%`,
                width: `${20 + i*8}px`, height:'1.5px',
                background:`linear-gradient(90deg, transparent, rgba(167,139,250,${0.3 + i*0.1}))`,
                borderRadius:99,
                animation:`tbStreakL ${0.8 + i*0.15}s ease-in-out infinite`,
                animationDelay:`${i*0.2}s`,
              }}/>
            ))}

            {/* Speed streaks right */}
            {[0,1,2,3,4].map(i => (
              <div key={`sr${i}`} style={{
                position:'absolute',
                right: `${18 + i*4}%`,
                top: `${35 + i*9}%`,
                width: `${20 + i*8}px`, height:'1.5px',
                background:`linear-gradient(90deg, rgba(167,139,250,${0.3 + i*0.1}), transparent)`,
                borderRadius:99,
                animation:`tbStreakR ${0.8 + i*0.15}s ease-in-out infinite`,
                animationDelay:`${i*0.2}s`,
              }}/>
            ))}

            {/* Pulse rings */}
            <div style={{ position:'absolute', width:80, height:80, borderRadius:'50%', border:'1.5px solid rgba(139,92,246,0.6)', animation:'tbRing1 2s ease-out infinite' }}/>
            <div style={{ position:'absolute', width:80, height:80, borderRadius:'50%', border:'1px solid rgba(139,92,246,0.4)', animation:'tbRing2 2s ease-out infinite', animationDelay:'0.4s' }}/>
            <div style={{ position:'absolute', width:80, height:80, borderRadius:'50%', border:'1px solid rgba(139,92,246,0.2)', animation:'tbRing3 2s ease-out infinite', animationDelay:'0.8s' }}/>

            {/* Particles */}
            {[
              {x:'calc(50% - 55px)', y:'calc(50% - 45px)', px:'-30px', py:'-40px', d:'0s'},
              {x:'calc(50% + 45px)', y:'calc(50% - 50px)', px:'35px', py:'-35px', d:'0.3s'},
              {x:'calc(50% - 65px)', y:'calc(50% + 30px)', px:'-40px', py:'30px', d:'0.6s'},
              {x:'calc(50% + 55px)', y:'calc(50% + 25px)', px:'40px', py:'28px', d:'0.9s'},
              {x:'calc(50% - 20px)', y:'calc(50% - 60px)', px:'-10px', py:'-50px', d:'0.15s'},
              {x:'calc(50% + 25px)', y:'calc(50% + 50px)', px:'20px', py:'45px', d:'0.7s'},
            ].map((p, i) => (
              <div key={i} style={{
                position:'absolute',
                left:p.x, top:p.y,
                width:4, height:4, borderRadius:'50%',
                background:'#a78bfa',
                boxShadow:'0 0 6px #a78bfa',
                '--px':p.px, '--py':p.py,
                animation:`tbParticle 1.8s ease-out infinite`,
                animationDelay:p.d,
              }}/>
            ))}

            {/* Main bolt icon */}
            <div style={{
              position:'relative', zIndex:3,
              width:88, height:88, borderRadius:26,
              background:'linear-gradient(145deg, #7c3aed, #6d28d9, #4c1d95)',
              display:'flex', alignItems:'center', justifyContent:'center',
              animation:'tbGlow 2s ease-in-out infinite',
              border:'1px solid rgba(167,139,250,0.4)',
            }}>
              {/* Inner shimmer */}
              <div style={{
                position:'absolute', inset:0, borderRadius:26,
                background:'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 50%)',
              }}/>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" strokeWidth="0" style={{ animation:'tbBolt 1.8s ease-in-out infinite', filter:'drop-shadow(0 0 8px rgba(167,139,250,0.9))' }}>
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="white"/>
              </svg>
            </div>

            {/* NEW badge */}
            <div style={{
              position:'absolute', top:14, right:14, zIndex:4,
              background:'linear-gradient(135deg, #f59e0b, #ef4444)',
              borderRadius:99, padding:'0.28rem 0.8rem',
              fontSize:'0.6rem', fontWeight:900, color:'white',
              letterSpacing:'0.1em', textTransform:'uppercase',
              boxShadow:'0 4px 16px rgba(245,158,11,0.5)',
            }}>✦ NEW</div>

            {/* Drag pill */}
            <div style={{ position:'absolute', top:10, left:'50%', transform:'translateX(-50%)', width:40, height:4, borderRadius:99, background:'rgba(255,255,255,0.15)' }}/>
          </div>

          {/* ── CONTENT ── */}
          <div style={{ padding:'1.4rem 1.4rem 1.6rem' }}>

            {/* Eyebrow */}
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.55rem', animation:'tbTitle 0.4s ease 0.2s both' }}>
              <div style={{ flex:1, height:'1px', background:'linear-gradient(90deg, transparent, rgba(139,92,246,0.5))' }}/>
              <span style={{ fontSize:'0.6rem', fontWeight:700, color:'#a78bfa', letterSpacing:'0.14em', textTransform:'uppercase' }}>Introducing</span>
              <div style={{ flex:1, height:'1px', background:'linear-gradient(90deg, rgba(139,92,246,0.5), transparent)' }}/>
            </div>

            {/* Title */}
            <div style={{ animation:'tbTitle 0.4s ease 0.25s both' }}>
              <div style={{
                fontFamily:'Outfit, sans-serif', fontWeight:900, fontSize:'2rem',
                lineHeight:1.05, marginBottom:'0.1rem',
                background:'linear-gradient(90deg, #fff 0%, #c4b5fd 40%, #7c3aed 70%, #fff 100%)',
                backgroundSize:'250% auto',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
              }}>
                Turbo Boost
              </div>
              <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.75rem', color:'#7c3aed', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'0.8rem' }}>
                ⚡ Fastest growth · Now live
              </div>
            </div>

            {/* Description */}
            <div style={{ fontSize:'0.85rem', color:'rgba(255,255,255,0.55)', lineHeight:1.6, marginBottom:'1.2rem', animation:'tbSub 0.4s ease 0.35s both' }}>
              Grow faster than ever. Lightning delivery in minutes, not hours — with Average and High Quality tiers across 5 major platforms.
            </div>

            {/* Pills */}
            <div style={{ display:'flex', gap:'0.45rem', flexWrap:'wrap', marginBottom:'1.4rem', animation:'tbPills 0.4s ease 0.45s both' }}>
              {[
                { icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="white"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>, label:'Minutes delivery', color:'rgba(124,58,237,0.25)', border:'rgba(124,58,237,0.5)' },
                { icon: '🎯', label:'Avg & HQ tiers', color:'rgba(16,185,129,0.12)', border:'rgba(16,185,129,0.3)' },
                { icon: '📱', label:'5 platforms', color:'rgba(245,158,11,0.12)', border:'rgba(245,158,11,0.3)' },
              ].map(f => (
                <div key={f.label} style={{
                  display:'flex', alignItems:'center', gap:'0.4rem',
                  background:f.color, border:`1px solid ${f.border}`,
                  borderRadius:99, padding:'0.3rem 0.7rem',
                  fontSize:'0.7rem', fontWeight:600, color:'rgba(255,255,255,0.8)',
                }}>
                  {f.icon}{f.label}
                </div>
              ))}
            </div>

            {/* CTA button */}
            <button onClick={handleCTA} className="tb-cta" style={{
              width:'100%', padding:'1rem 1.2rem',
              background:'linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #5b21b6 100%)',
              border:'1px solid rgba(167,139,250,0.3)',
              borderRadius:16, cursor:'pointer',
              fontFamily:'Outfit, sans-serif', fontWeight:800, fontSize:'1rem', color:'white',
              boxShadow:'0 8px 30px rgba(124,58,237,0.5), inset 0 1px 0 rgba(255,255,255,0.15)',
              display:'flex', alignItems:'center', justifyContent:'center', gap:'0.6rem',
              marginBottom:'0.65rem',
              animation:'tbBtn 0.4s ease 0.55s both',
              position:'relative', overflow:'hidden',
            }}>
              {/* Button shimmer */}
              <div style={{
                position:'absolute', inset:0,
                background:'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%)',
              }}/>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
              Try Turbo Boost Now
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>

            {/* Dismiss */}
            <button onClick={dismiss} className="tb-dismiss" style={{
              width:'100%', padding:'0.6rem',
              background:'transparent', border:'none', cursor:'pointer',
              fontFamily:'Outfit, sans-serif', fontSize:'0.8rem', fontWeight:500,
              color:'rgba(255,255,255,0.25)',
              transition:'color 0.15s',
              animation:'tbBtn 0.4s ease 0.6s both',
            }}>
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </>
  )
}