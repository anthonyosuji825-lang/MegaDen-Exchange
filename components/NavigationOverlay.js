// components/NavigationOverlay.js
// Mount this ONCE in your root app/layout.js (not per-page), e.g.:
//
//   import NavigationOverlay from '@/components/NavigationOverlay'
//   export default function RootLayout({ children }) {
//     return (
//       <html>
//         <body>
//           <NavigationOverlay />
//           {children}
//         </body>
//       </html>
//     )
//   }
//
// How it works: since your dashboard layout has no persistent header/nav,
// there's nothing that naturally "stays visible" during a route change —
// Next.js just swaps the whole page. This component fixes that by watching
// for clicks on internal links, showing RouteLoader immediately as a
// transparent overlay on TOP of whatever page is currently showing, and
// hiding itself the moment the URL actually changes (i.e. the new route
// has taken over). The current page stays visible underneath the whole
// time, since RouteLoader has no background of its own.

'use client'
import { useEffect, useState, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import RouteLoader from './RouteLoader'

export default function NavigationOverlay() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [navigating, setNavigating] = useState(false)
  const currentPath = useRef(pathname)

  // Pathname (or query) changed — the new route has taken over, hide overlay
  useEffect(() => {
    setNavigating(false)
    currentPath.current = pathname
  }, [pathname, searchParams])

  // Listen for clicks on internal links anywhere in the app
  useEffect(() => {
    const handleClick = (e) => {
      const anchor = e.target.closest('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href) return

      // Ignore external links, new-tab links, hash links, and same-page links
      if (href.startsWith('http') || href.startsWith('#')) return
      if (anchor.target === '_blank') return
      if (href === currentPath.current) return

      setNavigating(true)
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  if (!navigating) return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'transparent', // intentionally no backdrop — current page stays visible
      pointerEvents: 'auto', // blocks interaction with the outgoing page during transition
    }}>
      <RouteLoader />
    </div>
  )
}