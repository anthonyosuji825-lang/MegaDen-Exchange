import { Outfit, Inter } from 'next/font/google'
import './globals.css'

const outfit = Outfit({ 
  subsets: ['latin'], 
  variable: '--font-heading',
  display: 'swap'
})

const inter = Inter({ 
  subsets: ['latin'], 
  variable: '--font-body',
  display: 'swap'
})

export const metadata = {
  title: 'MegaDen Exchange — Foreign Numbers & Social Media Logs',
  description: 'Buy verified foreign virtual numbers, social media logs, and boost your online presence. Fast, secure and affordable.',
  keywords: 'foreign numbers, social media accounts, virtual numbers, account boosting, buy logs',
  metadataBase: new URL('https://megad.name.ng'),
  openGraph: {
    title: 'MegaDen Exchange',
    description: 'Buy foreign numbers, social media logs & boost your online presence.',
    url: 'https://megad.name.ng',
    siteName: 'MegaDen Exchange',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MegaDen Exchange',
    description: 'Buy foreign numbers, social media logs & boost your online presence.',
  },
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/icons/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
}

export const viewport = {
  themeColor: '#0b0e1a',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${outfit.variable} ${inter.variable}`}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="MegaDen" />
        <script src="https://js.paystack.co/v1/inline.js" async defer></script>
        {/* Theme persistence — runs before paint to prevent flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var theme = localStorage.getItem('megaden-theme') || 'dark';
              document.documentElement.setAttribute('data-theme', theme);
            } catch(e) {}
          })();
        `}} />
        {/* Register service worker for PWA */}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').catch(function(err) {
                console.warn('SW registration failed:', err);
              });
            });
          }
        `}} />
      </head>
      <body>{children}</body>
    </html>
  )
}