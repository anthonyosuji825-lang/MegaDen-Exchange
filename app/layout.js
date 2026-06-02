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
  metadataBase: new URL('https://megaden.megad.name.ng'),
  openGraph: {
    title: 'MegaDen Exchange',
    description: 'Buy foreign numbers, social media logs & boost your online presence.',
    url: 'https://megaden.megad.name.ng',
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
    apple: '/favicon.svg',
  }
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${outfit.variable} ${inter.variable}`}>
      <head>
        <script src="https://js.paystack.co/v1/inline.js" async defer></script>
      </head>
      <body>{children}</body>
    </html>
  )
}