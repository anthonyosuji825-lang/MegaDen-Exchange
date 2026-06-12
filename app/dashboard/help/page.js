'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

const FAQ_CATEGORIES = [
  {
    id: 'wallet',
    title: 'Wallet & Payments',
    icon: 'wallet',
    color: '#f0b429',
    items: [
      {
        q: 'How do I fund my wallet?',
        a: 'Go to Wallet → Add Funds, enter an amount, and pay via Paystack (card, bank transfer, or USSD). Your wallet balance updates automatically once payment is confirmed — usually within seconds.'
      },
      {
        q: 'I paid but my wallet wasn\'t credited. What do I do?',
        a: 'This is rare, but can happen if the payment confirmation was delayed. Wait a few minutes and refresh your wallet page. If it still hasn\'t reflected after 15 minutes, contact support with your payment reference/receipt and we\'ll resolve it promptly.'
      },
      {
        q: 'Are there fees for funding my wallet?',
        a: 'Paystack may apply a small processing fee depending on your payment method (card, bank transfer, etc.). This fee is set by Paystack, not MegaDen.'
      },
      {
        q: 'Can I withdraw money from my wallet?',
        a: 'Wallet balance is for purchasing services on MegaDen (numbers, boosts, VPNs, subscriptions) and isn\'t withdrawable as cash, except for referral earnings — check the Refer & Earn page for details.'
      },
    ]
  },
  {
    id: 'numbers',
    title: 'Foreign Numbers',
    icon: 'phone',
    color: '#8b6ff7',
    items: [
      {
        q: 'How long do I have to receive an SMS code?',
        a: 'Once you purchase a number, you have 20 minutes to receive your verification code. If no code arrives within that window and you close the page, the order is automatically cancelled and refunded — no action needed from you.'
      },
      {
        q: 'I closed the page before getting my code — will I be refunded?',
        a: 'Yes. Our system automatically checks for unused, expired number orders every few minutes. If no code was received, the order is cancelled and your wallet is refunded automatically.'
      },
      {
        q: 'Can I cancel a number order manually?',
        a: 'Yes — if you haven\'t received a code yet, you can tap "Cancel" on the order to get an instant refund, as long as no SMS code has been delivered.'
      },
      {
        q: 'What if I receive a code but it doesn\'t work?',
        a: 'Some services occasionally send a second code shortly after the first. Wait a moment and check again. If the issue persists, contact support with your order ID.'
      },
      {
        q: 'Why are some countries out of stock?',
        a: 'Number availability depends on real-time supply from our provider. If a country shows no stock, try again later or pick another country.'
      },
    ]
  },
  {
    id: 'boosting',
    title: 'Account Boosting',
    icon: 'boost',
    color: '#f43f5e',
    items: [
      {
        q: 'How long does a boost order take?',
        a: 'Delivery time varies by package — most TikTok likes/views orders complete within 6–48 hours depending on the package selected. Estimated delivery times are shown on each package.'
      },
      {
        q: 'My order says "Processing" — is that normal?',
        a: 'Yes. Boost orders are fulfilled gradually (drip-fed) for safety and authenticity. Your order status automatically updates to "Completed" once delivery finishes — this is checked every few minutes.'
      },
      {
        q: 'Will my likes/followers/views drop over time?',
        a: 'Some packages include refill protection and some don\'t — this is noted in the package description. If drops happen on a refill-protected package, contact support.'
      },
      {
        q: 'Do I need to make my account/post public?',
        a: 'Yes — your profile, post, or video must be set to public, otherwise the boost service cannot deliver to it and your order may fail or be delayed.'
      },
      {
        q: 'Can I cancel a boost order after placing it?',
        a: 'Boost orders begin processing almost immediately and generally cannot be cancelled or refunded once started. Double-check your link and package before confirming.'
      },
    ]
  },
  {
    id: 'vpn',
    title: 'VPN Subscriptions',
    icon: 'vpn',
    color: '#4687ff',
    items: [
      {
        q: 'How fast will I receive my VPN key?',
        a: 'VPN access keys are delivered instantly after purchase — you\'ll see it directly on the order confirmation screen. Make sure to copy and save it immediately.'
      },
      {
        q: 'How do I activate my VPN subscription?',
        a: 'Download the official app for your chosen provider (NordVPN, ExpressVPN, Surfshark, or CyberGhost), go to the account/login section, and enter the key or credentials provided.'
      },
      {
        q: 'What if my VPN key doesn\'t work?',
        a: 'Contact support immediately with your order ID and a screenshot of the error. We\'ll issue a replacement key or refund if the key is confirmed invalid.'
      },
      {
        q: 'Can I use the VPN on multiple devices?',
        a: 'Device limits depend on the provider and plan — this is listed under each provider\'s features (e.g. "5 devices", "Unlimited devices").'
      },
    ]
  },
  {
    id: 'subscriptions',
    title: 'Digital Subscriptions',
    icon: 'subs',
    color: '#10a37f',
    items: [
      {
        q: 'How do I activate my subscription (Netflix, Spotify, etc.)?',
        a: 'After purchase, you\'ll receive an access key or redeem code instantly. Open the relevant app, go to Settings/Account, and enter the code as instructed on your order confirmation screen.'
      },
      {
        q: 'How long does the subscription last?',
        a: 'Duration depends on the plan you purchased (1 month, 3 months, 6 months, or 1 year) — this is shown clearly before checkout.'
      },
      {
        q: 'What happens when my subscription expires?',
        a: 'Access ends at the end of your plan duration. You can purchase a renewal at any time from the Subscriptions page.'
      },
      {
        q: 'My code says it\'s already used / invalid.',
        a: 'Contact support right away with your order ID — we\'ll verify and issue a replacement code if there was an error on our end.'
      },
    ]
  },
  {
    id: 'account',
    title: 'Account & Security',
    icon: 'lock',
    color: '#34d399',
    items: [
      {
        q: 'How do I change my password?',
        a: 'Go to Profile → Change Password. You\'ll need your current password and a verification code sent to your email before the change is confirmed.'
      },
      {
        q: 'How do I update my phone number?',
        a: 'Go to Profile → Update Phone Number, enter your new number, and confirm with the verification code sent to your email.'
      },
      {
        q: 'I forgot my password — how do I reset it?',
        a: 'On the login page, tap "Forgot Password?", enter your email, and follow the reset link sent to your inbox. Check your spam folder if it doesn\'t arrive within a few minutes.'
      },
      {
        q: 'Is my payment information safe?',
        a: 'Yes — all payments are processed securely through Paystack. MegaDen never stores your card details.'
      },
    ]
  },
]

export default function HelpCenter() {
  const [openItem, setOpenItem] = useState(null)
  const [search, setSearch] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const toggle = (key) => setOpenItem(prev => prev === key ? null : key)

  const filteredCategories = FAQ_CATEGORIES.map(cat => ({
    ...cat,
    items: cat.items.filter(item =>
      !search ||
      item.q.toLowerCase().includes(search.toLowerCase()) ||
      item.a.toLowerCase().includes(search.toLowerCase())
    )
  })).filter(cat => cat.items.length > 0)

  return (
    <main style={{ background: 'var(--navy)', minHeight: '100vh', paddingBottom: '2.5rem' }}>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes expandIn {
          from { opacity: 0; max-height: 0; }
          to { opacity: 1; max-height: 500px; }
        }
        .back-btn { transition: background 0.18s, transform 0.18s; }
        .back-btn:hover { background: var(--card2) !important; transform: translateX(-2px); }
        .faq-question { transition: background 0.18s; cursor: pointer; }
        .faq-question:hover { background: var(--card2) !important; }
        .search-input:focus { border-color: var(--purple) !important; box-shadow: 0 0 0 3px rgba(108,78,242,0.12); }
        .chevron { transition: transform 0.25s ease; }
        .chevron.open { transform: rotate(180deg); }
        .contact-card { transition: transform 0.18s, box-shadow 0.18s; }
        .contact-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(108,78,242,0.2); }
      `}</style>

      {/* HEADER */}
      <div style={{ padding: '1.1rem 1.4rem', display: 'flex', alignItems: 'center', gap: '0.9rem', position: 'sticky', top: 0, zIndex: 100, background: 'var(--navy)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/dashboard" className="back-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '10px', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', textDecoration: 'none' }}>
          <BackIcon />
        </Link>
        <div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>Help Center</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>FAQs & support</div>
        </div>
      </div>

      <div style={{ padding: '1.2rem 1.4rem', maxWidth: 640, margin: '0 auto' }}>

        {/* SEARCH */}
        <div style={{ position: 'relative', marginBottom: '1.3rem', animation: mounted ? 'fadeSlideIn 0.4s ease' : 'none' }}>
          <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}><SearchIcon /></span>
          <input
            className="search-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search for help..."
            style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.7rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', color: 'var(--text)', fontSize: '0.9rem', outline: 'none', fontFamily: 'Inter, sans-serif', transition: 'border-color 0.2s, box-shadow 0.2s' }}
          />
        </div>

        {/* CONTACT OPTIONS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem', marginBottom: '1.6rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.05s both' : 'none' }}>
          <a href="https://wa.me/17656822078" target="_blank" rel="noopener noreferrer" className="contact-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '1rem 0.5rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', textDecoration: 'none', textAlign: 'center' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChatIcon size={17} color="#10b981" /></div>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text)' }}>WhatsApp</span>
          </a>
          <a href="https://t.me/+3cblEJBfh1owOTJk" target="_blank" rel="noopener noreferrer" className="contact-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '1rem 0.5rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', textDecoration: 'none', textAlign: 'center' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(70,135,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChatIcon size={17} color="#4687ff" /></div>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text)' }}>Telegram</span>
          </a>
          <a href="mailto:support@megad.name.ng" className="contact-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '1rem 0.5rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', textDecoration: 'none', textAlign: 'center' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(240,180,41,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MailIcon size={17} color="#f0b429" /></div>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text)' }}>Email</span>
          </a>
        </div>

        {/* FAQ SECTIONS */}
        {filteredCategories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--muted)' }}>
            <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>No results found</div>
            <div style={{ fontSize: '0.78rem' }}>Try a different search term, or contact support directly.</div>
          </div>
        ) : (
          filteredCategories.map((cat, ci) => (
            <div key={cat.id} style={{ marginBottom: '1.4rem', animation: mounted ? `fadeSlideIn 0.4s ease ${0.05 * (ci + 2)}s both` : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.7rem' }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: `${cat.color}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cat.color }}>
                  <CategoryIcon type={cat.icon} size={16} />
                </div>
                <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.92rem', color: 'var(--text)' }}>{cat.title}</span>
              </div>

              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
                {cat.items.map((item, i) => {
                  const key = `${cat.id}-${i}`
                  const isOpen = openItem === key
                  return (
                    <div key={key} style={{ borderBottom: i < cat.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div className="faq-question" onClick={() => toggle(key)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem', padding: '0.95rem 1.1rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>{item.q}</span>
                        <span className={`chevron ${isOpen ? 'open' : ''}`} style={{ color: 'var(--muted)', flexShrink: 0 }}><ChevronDownIcon /></span>
                      </div>
                      {isOpen && (
                        <div style={{ padding: '0 1.1rem 1rem', animation: 'expandIn 0.25s ease' }}>
                          <p style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>{item.a}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}

        {/* STILL NEED HELP */}
        <div style={{ background: 'linear-gradient(135deg, rgba(108,78,242,0.1), rgba(240,180,41,0.06))', border: '1px solid rgba(108,78,242,0.2)', borderRadius: '16px', padding: '1.3rem', textAlign: 'center', marginTop: '1rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.3s both' : 'none' }}>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', marginBottom: '0.35rem' }}>Still need help?</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '1rem' }}>Our support team is ready to assist you</div>
          <a href="https://wa.me/17656822078" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.4rem', background: 'var(--purple)', color: '#fff', borderRadius: '10px', textDecoration: 'none', fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', fontWeight: 700 }}>
            <ChatIcon size={15} color="#fff" /> Chat with Support
          </a>
        </div>
      </div>
    </main>
  )
}

function BackIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
}
function SearchIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
}
function ChevronDownIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
}
function ChatIcon({ size = 16, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
}
function MailIcon({ size = 16, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
}
function CategoryIcon({ type, size = 16 }) {
  const icons = {
    wallet: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 12h2"/><path d="M2 10h20"/></svg>,
    phone: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1"/></svg>,
    boost: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></svg>,
    vpn: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z"/></svg>,
    subs: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>,
    lock: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  }
  return icons[type] || null
}