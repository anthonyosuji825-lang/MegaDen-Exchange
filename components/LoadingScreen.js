// components/LoadingScreen.js
// Usage: import LoadingScreen from '@/components/LoadingScreen'
// Replace your loading return with: if (loading) return <LoadingScreen />

export default function LoadingScreen() {
  return (
    <main style={{
      background: 'var(--navy)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes orb1 {
          0%, 100% { transform: translate(0,0) scale(1); opacity: 0.6; }
          50% { transform: translate(30px,-20px) scale(1.1); opacity: 0.9; }
        }
        @keyframes orb2 {
          0%, 100% { transform: translate(0,0) scale(1); opacity: 0.5; }
          50% { transform: translate(-25px,25px) scale(1.08); opacity: 0.8; }
        }
        @keyframes logoFadeUp {
          from { opacity: 0; transform: translateY(16px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes ringRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes ringRotateReverse {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes dotPulse1 {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          33% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes dotPulse2 {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes dotPulse3 {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          66% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes progressBar {
          0% { width: 0%; opacity: 0.6; }
          20% { opacity: 1; }
          85% { width: 90%; opacity: 1; }
          100% { width: 95%; opacity: 0.8; }
        }
        @keyframes textFade {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes shimmerMove {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `}</style>

      {/* Background orbs */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,78,242,0.15) 0%, transparent 70%)', top: '-15%', left: '-10%', animation: 'orb1 10s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(240,180,41,0.08) 0%, transparent 70%)', bottom: '-10%', right: '-8%', animation: 'orb2 14s ease-in-out infinite' }} />
      </div>

      {/* Dot grid */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(108,78,242,0.2) 1px, transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none', opacity: 0.35 }} />

      {/* LOGO + SPINNER */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', position: 'relative', zIndex: 1, animation: 'logoFadeUp 0.6s ease both' }}>

        {/* Spinner rings around logo */}
        <div style={{ position: 'relative', width: 90, height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

          {/* Outer ring */}
          <svg width="90" height="90" viewBox="0 0 90 90" style={{ position: 'absolute', animation: 'ringRotate 2.4s linear infinite' }}>
            <circle cx="45" cy="45" r="40" fill="none" stroke="rgba(108,78,242,0.15)" strokeWidth="1.5" />
            <circle cx="45" cy="45" r="40" fill="none" stroke="url(#grad1)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="60 192" />
            <defs>
              <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6c4ef2" stopOpacity="0" />
                <stop offset="100%" stopColor="#8b6ff7" stopOpacity="1" />
              </linearGradient>
            </defs>
          </svg>

          {/* Inner ring */}
          <svg width="68" height="68" viewBox="0 0 68 68" style={{ position: 'absolute', animation: 'ringRotateReverse 1.8s linear infinite' }}>
            <circle cx="34" cy="34" r="29" fill="none" stroke="rgba(240,180,41,0.12)" strokeWidth="1.5" />
            <circle cx="34" cy="34" r="29" fill="none" stroke="url(#grad2)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="30 152" />
            <defs>
              <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f0b429" stopOpacity="0" />
                <stop offset="100%" stopColor="#f0b429" stopOpacity="0.8" />
              </linearGradient>
            </defs>
          </svg>

          {/* Logo mark in center */}
          <LogoMark size={42} />
        </div>

        {/* Brand name with shimmer */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: 'Outfit, sans-serif',
            fontWeight: 800,
            fontSize: '1.5rem',
            letterSpacing: '-0.5px',
            background: 'linear-gradient(90deg, var(--text) 0%, #fff 40%, var(--purple2) 60%, var(--text) 100%)',
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'shimmerMove 3s linear infinite',
            marginBottom: '0.2rem',
          }}>
            Mega<span>Den</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', letterSpacing: '2px', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', opacity: 0.6 }}>Exchange</div>
        </div>

        {/* Progress bar */}
        <div style={{ width: 140, height: 2, background: 'rgba(108,78,242,0.15)', borderRadius: '50px', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            borderRadius: '50px',
            background: 'linear-gradient(90deg, var(--purple), var(--purple2), var(--gold))',
            animation: 'progressBar 2.5s ease forwards',
          }} />
        </div>

        {/* Animated dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--purple2)', animation: 'dotPulse1 1.2s ease-in-out infinite' }} />
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--purple2)', animation: 'dotPulse2 1.2s ease-in-out infinite' }} />
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--purple2)', animation: 'dotPulse3 1.2s ease-in-out infinite' }} />
        </div>

      </div>
    </main>
  )
}

function LogoMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: size * 0.25, flexShrink: 0 }}>
      <rect x="0" y="0" width="80" height="80" rx="20" fill="#0f0c24"/>
      <line x1="18" y1="58" x2="18" y2="22" stroke="#ffffff" strokeWidth="5" strokeLinecap="round"/>
      <line x1="18" y1="22" x2="40" y2="44" stroke="#ffffff" strokeWidth="5" strokeLinecap="round"/>
      <line x1="40" y1="44" x2="62" y2="22" stroke="#ffffff" strokeWidth="5" strokeLinecap="round"/>
      <line x1="62" y1="22" x2="62" y2="58" stroke="#ffffff" strokeWidth="5" strokeLinecap="round"/>
      <path d="M0 66 L80 66 L80 80 Q80 80 60 80 L20 80 Q0 80 0 80 Z" fill="#f0b429"/>
      <path d="M0 0 L5 0 L5 55 Q0 66 0 66 Z" fill="#6c4ef2"/>
    </svg>
  )
}