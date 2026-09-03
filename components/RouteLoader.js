// components/RouteLoader.js
// Usage: for loading states INSIDE the app (navigating into a service page),
// not the initial app boot. Replace your loading return with:
//   if (loading) return <RouteLoader />
//
// For the initial cold-boot splash screen, keep using LoadingScreen instead —
// this component intentionally has no logo text, no progress bar, no
// background orbs/dot-grid, since the user already knows what app they're in.

export default function RouteLoader() {
  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <style>{`
        @keyframes routeLoaderRingRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes routeLoaderRingRotateReverse {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes routeLoaderFadeIn {
          from { opacity: 0; transform: scale(0.94); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div style={{
        position: 'relative',
        width: 56,
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'routeLoaderFadeIn 0.25s ease both',
      }}>
        {/* Outer ring */}
        <svg width="56" height="56" viewBox="0 0 56 56" style={{ position: 'absolute', animation: 'routeLoaderRingRotate 1.1s linear infinite' }}>
          <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(108,78,242,0.15)" strokeWidth="2" />
          <circle cx="28" cy="28" r="24" fill="none" stroke="url(#rlGrad1)" strokeWidth="2" strokeLinecap="round" strokeDasharray="36 114" />
          <defs>
            <linearGradient id="rlGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6c4ef2" stopOpacity="0" />
              <stop offset="100%" stopColor="#8b6ff7" stopOpacity="1" />
            </linearGradient>
          </defs>
        </svg>

        {/* Logo mark in center — no rings around it needed at this size, just the mark */}
        <LogoMark size={28} />
      </div>
    </div>
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