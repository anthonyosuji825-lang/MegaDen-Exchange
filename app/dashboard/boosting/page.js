'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

// Default packages — service_id and quantity never change, only price can be overridden from Supabase
const DEFAULT_SERVICES = [
  {
    id: 'instagram', name: 'Instagram', color: '#e1306c',
    packages: [
      { id: 'ig_f1k',   name: '1,000 Followers',   price: 1500,  delivery: '24hrs',  desc: 'Real-looking profiles',  service_id: 10129, quantity: 1000   },
      { id: 'ig_f5k',   name: '5,000 Followers',   price: 6000,  delivery: '48hrs',  desc: 'Gradual delivery',       service_id: 10129, quantity: 5000   },
      { id: 'ig_f10k',  name: '10,000 Followers',  price: 11000, delivery: '72hrs',  desc: 'Best value',             service_id: 10129, quantity: 10000  },
      { id: 'ig_f50k',  name: '50,000 Followers',  price: 48000, delivery: '5days',  desc: 'Mega growth',            service_id: 10129, quantity: 50000  },
      { id: 'ig_l500',  name: '500 Likes',          price: 500,   delivery: '6hrs',   desc: 'Per post',              service_id: 9438,  quantity: 500    },
      { id: 'ig_l1k',   name: '1,000 Likes',        price: 800,   delivery: '12hrs',  desc: 'Per post',              service_id: 9438,  quantity: 1000   },
      { id: 'ig_l5k',   name: '5,000 Likes',        price: 3500,  delivery: '24hrs',  desc: 'Per post',              service_id: 9438,  quantity: 5000   },
      { id: 'ig_v10k',  name: '10,000 Views',       price: 600,   delivery: '6hrs',   desc: 'Reel / Video',          service_id: 7786,  quantity: 10000  },
      { id: 'ig_v50k',  name: '50,000 Views',       price: 2500,  delivery: '12hrs',  desc: 'Reel / Video',          service_id: 7786,  quantity: 50000  },
      { id: 'ig_v100k', name: '100,000 Views',      price: 4500,  delivery: '24hrs',  desc: 'Reel / Video',          service_id: 7786,  quantity: 100000 },
    ]
  },
  {
    id: 'tiktok', name: 'TikTok', color: '#ff0050',
    packages: [
      { id: 'tt_f1k',  name: '1,000 Followers',  price: 1200,  delivery: '24hrs', desc: 'Real-looking',       service_id: 10127, quantity: 1000  },
      { id: 'tt_f5k',  name: '5,000 Followers',  price: 5000,  delivery: '48hrs', desc: 'Gradual delivery',   service_id: 10127, quantity: 5000  },
      { id: 'tt_f10k', name: '10,000 Followers', price: 9500,  delivery: '72hrs', desc: 'Best value',         service_id: 10127, quantity: 10000 },
      { id: 'tt_l1k',  name: '1,000 Likes',      price: 600,   delivery: '6hrs',  desc: 'Per video',          service_id: 10022, quantity: 1000  },
      { id: 'tt_l5k',  name: '5,000 Likes',      price: 2500,  delivery: '12hrs', desc: 'Per video',          service_id: 10022, quantity: 5000  },
      { id: 'tt_v50k', name: '50,000 Views',     price: 1000,  delivery: '6hrs',  desc: 'Video views',        service_id: 10238, quantity: 50000 },
      { id: 'tt_v500k',name: '500,000 Views',    price: 8000,  delivery: '48hrs', desc: 'Viral boost',        service_id: 10238, quantity: 500000},
    ]
  },
  {
    id: 'twitter', name: 'Twitter / X', color: '#e7e7e7',
    packages: [
      { id: 'tw_f500',  name: '500 Followers',    price: 1000,  delivery: '12hrs', desc: 'Quality accounts',   service_id: 10176, quantity: 500   },
      { id: 'tw_f1k',   name: '1,000 Followers',  price: 1800,  delivery: '24hrs', desc: 'Quality accounts',   service_id: 9276,  quantity: 1000  },
      { id: 'tw_f5k',   name: '5,000 Followers',  price: 7500,  delivery: '72hrs', desc: 'Gradual delivery',   service_id: 9276,  quantity: 5000  },
      { id: 'tw_l500',  name: '500 Likes',         price: 700,   delivery: '6hrs',  desc: 'Per tweet',         service_id: 10176, quantity: 500   },
      { id: 'tw_l1k',   name: '1,000 Likes',       price: 1200,  delivery: '12hrs', desc: 'Per tweet',         service_id: 10176, quantity: 1000  },
      { id: 'tw_rt500', name: '500 Retweets',      price: 1000,  delivery: '12hrs', desc: 'Per tweet',         service_id: 10177, quantity: 500   },
    ]
  },
  {
    id: 'facebook', name: 'Facebook', color: '#1877f2',
    packages: [
      { id: 'fb_pl1k',  name: '1,000 Page Likes',  price: 2000, delivery: '48hrs', desc: 'Real-looking',       service_id: 1882, quantity: 1000  },
      { id: 'fb_pl5k',  name: '5,000 Page Likes',  price: 8000, delivery: '5days', desc: 'Gradual delivery',   service_id: 1882, quantity: 5000  },
      { id: 'fb_f1k',   name: '1,000 Followers',   price: 1800, delivery: '24hrs', desc: 'Profile followers',  service_id: 1889, quantity: 1000  },
      { id: 'fb_f5k',   name: '5,000 Followers',   price: 7000, delivery: '72hrs', desc: 'Gradual delivery',   service_id: 1889, quantity: 5000  },
      { id: 'fb_ptl500',name: '500 Post Likes',     price: 800,  delivery: '12hrs', desc: 'Per post',           service_id: 8999, quantity: 500   },
      { id: 'fb_ptl1k', name: '1,000 Post Likes',  price: 1400, delivery: '24hrs', desc: 'Per post',           service_id: 8999, quantity: 1000  },
    ]
  },
  {
    id: 'youtube', name: 'YouTube', color: '#ff0000',
    packages: [
      { id: 'yt_s500',  name: '500 Subscribers',   price: 3000,  delivery: '48hrs', desc: 'Retention safe',    service_id: 3366, quantity: 500   },
      { id: 'yt_s1k',   name: '1,000 Subscribers', price: 5000,  delivery: '72hrs', desc: 'Retention safe',    service_id: 3366, quantity: 1000  },
      { id: 'yt_s5k',   name: '5,000 Subscribers', price: 22000, delivery: '7days', desc: 'Gradual delivery',  service_id: 3366, quantity: 5000  },
      { id: 'yt_v10k',  name: '10,000 Views',       price: 2000,  delivery: '48hrs', desc: 'Watch time counted',service_id: 10236,quantity: 10000 },
      { id: 'yt_v50k',  name: '50,000 Views',       price: 8000,  delivery: '5days', desc: 'Watch time counted',service_id: 10236,quantity: 50000 },
      { id: 'yt_l500',  name: '500 Likes',           price: 1000,  delivery: '24hrs', desc: 'Per video',        service_id: 6767, quantity: 500   },
      { id: 'yt_l1k',   name: '1,000 Likes',         price: 1800,  delivery: '48hrs', desc: 'Per video',        service_id: 6767, quantity: 1000  },
    ]
  },
  {
    id: 'telegram', name: 'Telegram', color: '#0088cc',
    packages: [
      { id: 'tg_m500',  name: '500 Members',         price: 1800,  delivery: '24hrs', desc: 'Channel / Group',  service_id: 7330, quantity: 500   },
      { id: 'tg_m1k',   name: '1,000 Members',       price: 3000,  delivery: '48hrs', desc: 'Channel / Group',  service_id: 7330, quantity: 1000  },
      { id: 'tg_m5k',   name: '5,000 Members',       price: 12000, delivery: '72hrs', desc: 'Gradual delivery', service_id: 7330, quantity: 5000  },
      { id: 'tg_m10k',  name: '10,000 Members',      price: 22000, delivery: '5days', desc: 'Mega growth',      service_id: 7330, quantity: 10000 },
      { id: 'tg_v10k',  name: '10,000 Post Views',   price: 800,   delivery: '6hrs',  desc: 'Per post',         service_id: 7102, quantity: 10000 },
      { id: 'tg_v50k',  name: '50,000 Post Views',   price: 3000,  delivery: '12hrs', desc: 'Per post',         service_id: 7102, quantity: 50000 },
    ]
  },
  {
    id: 'spotify', name: 'Spotify', color: '#1db954',
    packages: [
      { id: 'sp_pl1k',   name: '1,000 Plays',     price: 1800,  delivery: '24hrs',  desc: 'iOS/iPhone targeted',   service_id: 8430, quantity: 1000  },
      { id: 'sp_pl5k',   name: '5,000 Plays',     price: 8000,  delivery: '48hrs',  desc: 'iOS/iPhone targeted',   service_id: 8430, quantity: 5000  },
      { id: 'sp_pl10k',  name: '10,000 Plays',    price: 14000, delivery: '72hrs',  desc: 'iOS/iPhone targeted',   service_id: 8430, quantity: 10000 },
      { id: 'sp_pla1k',  name: '1,000 Plays',     price: 1900,  delivery: '24hrs',  desc: 'Android targeted',      service_id: 8431, quantity: 1000  },
      { id: 'sp_pla5k',  name: '5,000 Plays',     price: 8500,  delivery: '48hrs',  desc: 'Android targeted',      service_id: 8431, quantity: 5000  },
    ]
  },
  {
    id: 'snapchat', name: 'Snapchat', color: '#fffc00',
    packages: [
      { id: 'sc_f100',  name: '100 Followers',    price: 2500,  delivery: '48hrs',  desc: 'Arab Gulf accounts',    service_id: 4165, quantity: 100   },
      { id: 'sc_f500',  name: '500 Followers',    price: 10000, delivery: '5days',  desc: 'Arab Gulf accounts',    service_id: 4165, quantity: 500   },
      { id: 'sc_fa100', name: '100 Followers',    price: 2000,  delivery: '24hrs',  desc: 'Arab accounts',         service_id: 6859, quantity: 100   },
      { id: 'sc_fa1k',  name: '1,000 Followers',  price: 18000, delivery: '72hrs',  desc: 'Arab accounts',         service_id: 6859, quantity: 1000  },
    ]
  },
]

const PlatformIcon = ({ id, size = 26 }) => {
  const icons = {
    instagram: <svg width={size} height={size} viewBox="0 0 24 24"><defs><linearGradient id="ig3" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#f09433"/><stop offset="50%" stopColor="#dc2743"/><stop offset="100%" stopColor="#bc1888"/></linearGradient></defs><path fill="url(#ig3)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>,
    tiktok: <svg width={size} height={size} viewBox="0 0 24 24"><path fill="#ff0050" d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.52V6.75a4.85 4.85 0 01-1.02-.06z"/></svg>,
    twitter: <svg width={size} height={size} viewBox="0 0 24 24" fill="#e7e7e7"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
    facebook: <svg width={size} height={size} viewBox="0 0 24 24" fill="#1877f2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
    youtube: <svg width={size} height={size} viewBox="0 0 24 24" fill="#ff0000"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>,
    telegram: <svg width={size} height={size} viewBox="0 0 24 24" fill="#0088cc"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>,
    snapchat: <svg width={size} height={size} viewBox="0 0 24 24" fill="#fffc00"><path d="M12.166.006C9.834-.072 7.2.637 5.51 2.341 4.073 3.786 3.42 5.836 3.34 7.835c-.05 1.215-.01 2.43-.01 3.644-.31.156-.636.23-.968.252-.347.024-.706-.027-1.02-.177-.186-.09-.4-.232-.604-.166-.21.068-.332.292-.334.506-.003.29.212.527.46.645.82.387 1.693.4 2.566.553.1.463.275.902.572 1.28.07.09.004.226-.073.295-.28.247-.595.44-.904.637-.424.269-.87.568-1.117 1.017-.145.264-.146.6.044.843.208.266.553.326.863.3.468-.04.91-.225 1.355-.375.333-.113.688-.228 1.04-.188.32.036.598.205.856.39.567.406 1.103.876 1.793 1.117.747.26 1.54.295 2.326.3h.194c.786-.005 1.58-.04 2.327-.3.69-.241 1.226-.711 1.793-1.117.258-.185.535-.354.855-.39.353-.04.708.075 1.041.188.445.15.887.334 1.355.375.31.026.655-.034.863-.3.19-.243.189-.579.044-.843-.247-.449-.693-.748-1.117-1.017-.31-.197-.624-.39-.904-.637-.077-.069-.144-.206-.073-.295.297-.378.471-.817.572-1.28.873-.153 1.746-.166 2.566-.553.248-.118.463-.355.46-.645-.002-.214-.123-.438-.334-.506-.204-.066-.418.076-.604.166-.314.15-.673.2-1.02.177-.332-.022-.658-.096-.968-.252 0-1.215.04-2.43-.01-3.644-.08-1.999-.733-4.05-2.17-5.494C16.8.637 14.165-.072 12.166.006"/></svg>,
    spotify: <svg width={size} height={size} viewBox="0 0 24 24" fill="#1db954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>,
  }
  return icons[id] || null
}

export default function Boosting() {
  const [profile, setProfile] = useState(null)
  const [boostingServices, setBoostingServices] = useState(DEFAULT_SERVICES)
  const [selectedPlatform, setSelectedPlatform] = useState(null)
  const [selectedPackage, setSelectedPackage] = useState(null)
  const [link, setLink] = useState('')
  const [ordering, setOrdering] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [orderId, setOrderId] = useState(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const supabase = createClient()

    // Load profile + live prices in parallel
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const [profileRes, pricesRes] = await Promise.all([
        user ? supabase.from('profiles').select('wallet_balance').eq('id', user.id).single() : Promise.resolve({ data: null }),
        supabase.from('boost_prices').select('package_id, price'),
      ])

      if (profileRes.data) setProfile(profileRes.data)

      // Merge live prices over defaults
      if (pricesRes.data?.length) {
        const priceMap = {}
        pricesRes.data.forEach(p => { priceMap[p.package_id] = p.price })
        setBoostingServices(DEFAULT_SERVICES.map(platform => ({
          ...platform,
          packages: platform.packages.map(pkg => ({
            ...pkg,
            price: priceMap[pkg.id] ?? pkg.price,
          }))
        })))
      }
    }
    load()
  }, [])

  const handleOrder = async () => {
    if (!selectedPlatform || !selectedPackage || !link.trim()) return
    setOrdering(true)
    setError('')

    const res = await fetch('/api/boost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: selectedPackage.service_id,
        link: link.trim(),
        quantity: selectedPackage.quantity,
        price_ngn: selectedPackage.price,
        package_id: selectedPackage.id,
        package_name: selectedPackage.name,
        platform: selectedPlatform.name,
      })
    })

    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Order failed. Please try again.'); setOrdering(false); return }

    setOrderId(data.jap_order_id)
    setProfile(p => ({ ...p, wallet_balance: (p?.wallet_balance || 0) - selectedPackage.price }))
    setOrdering(false)
    setSuccess(true)
  }

  return (
    <main style={{ background: 'var(--navy)', minHeight: '100vh', paddingBottom: '2rem' }}>
      <style>{`
        @keyframes fadeSlideIn { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes scaleIn { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:scale(1); } }
        @keyframes successPop { 0%{transform:scale(0);opacity:0;} 70%{transform:scale(1.15);} 100%{transform:scale(1);opacity:1;} }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
        * { box-sizing:border-box; }
        .platform-grid::-webkit-scrollbar { display:none; }
        .platform-chip { transition:transform 0.15s ease,border-color 0.15s,background 0.15s,box-shadow 0.15s; cursor:pointer; }
        .platform-chip:hover { transform:translateY(-2px); }
        .platform-chip:active { transform:scale(0.97); }
        .pkg-card { transition:transform 0.15s ease,border-color 0.18s,background 0.18s; cursor:pointer; }
        .pkg-card:hover { transform:translateY(-1px); }
        .pkg-card:active { transform:scale(0.98); }
        .buy-btn { transition:transform 0.18s ease,box-shadow 0.18s,background 0.18s; cursor:pointer; }
        .buy-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 10px 32px rgba(108,78,242,0.45); }
        .buy-btn:active:not(:disabled) { transform:scale(0.98); }
        .back-btn { transition:background 0.15s,transform 0.15s; }
        .back-btn:hover { background:var(--card2) !important; transform:translateX(-2px); }
        .link-input:focus { border-color:var(--purple) !important; box-shadow:0 0 0 3px rgba(108,78,242,0.12); outline:none; }
      `}</style>

      {/* STICKY HEADER */}
      <div style={{ padding:'1rem 1.2rem', display:'flex', alignItems:'center', gap:'0.85rem', position:'sticky', top:0, zIndex:100, background:'rgba(var(--navy-rgb,10,10,30),0.92)', backdropFilter:'blur(20px)', borderBottom:'1px solid var(--border)' }}>
        <Link href="/dashboard" className="back-btn" style={{ display:'flex', alignItems:'center', justifyContent:'center', width:36, height:36, borderRadius:'10px', background:'var(--card)', border:'1px solid var(--border)', color:'var(--text)', textDecoration:'none', flexShrink:0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </Link>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:800, fontSize:'1rem', color:'var(--text)', letterSpacing:'-0.02em' }}>Social Boosting</div>
          <div style={{ fontSize:'0.7rem', color:'var(--muted)', marginTop:'0.05rem' }}>Real growth · Instant delivery</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.35rem 0.75rem', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'20px', flexShrink:0 }}>
          <span style={{ fontSize:'0.65rem', color:'var(--muted)' }}>BAL</span>
          <span style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.82rem', color:'var(--gold)' }}>₦{(profile?.wallet_balance || 0).toLocaleString()}</span>
        </div>
      </div>

      <div style={{ padding:'1.2rem', maxWidth:480, margin:'0 auto' }}>

        {/* SUCCESS STATE */}
        {success ? (
          <div style={{ textAlign:'center', padding:'3rem 1rem', animation:'fadeSlideIn 0.4s ease' }}>
            <div style={{ width:80, height:80, borderRadius:'50%', background:'rgba(29,158,117,0.15)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1.2rem', color:'#34d399', animation:'successPop 0.5s cubic-bezier(0.175,0.885,0.32,1.275)' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div style={{ fontFamily:'Outfit, sans-serif', fontSize:'1.3rem', fontWeight:800, color:'var(--text)', marginBottom:'0.4rem' }}>Order Placed!</div>
            <div style={{ color:'var(--muted)', fontSize:'0.85rem', marginBottom:'1.2rem' }}>Your {selectedPlatform?.name} boost is processing and will be delivered within {selectedPackage?.delivery}.</div>
            <div style={{ display:'inline-flex', alignItems:'center', gap:'0.6rem', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', padding:'0.8rem 1.4rem', marginBottom:'0.5rem' }}>
              <PlatformIcon id={selectedPlatform?.id} size={16} />
              <span style={{ fontSize:'0.82rem', color:'var(--text)' }}>{selectedPackage?.name}</span>
              <span style={{ color:'var(--gold)', fontWeight:700, fontFamily:'Outfit, sans-serif' }}>₦{selectedPackage?.price.toLocaleString()}</span>
            </div>
            {orderId && <div style={{ fontSize:'0.72rem', color:'var(--muted)', marginBottom:'1.5rem' }}>Order ID: #{orderId}</div>}
            <br/>
            <button onClick={() => { setSuccess(false); setSelectedPlatform(null); setSelectedPackage(null); setLink(''); setOrderId(null) }}
              className="buy-btn" style={{ padding:'0.75rem 1.8rem', background:'var(--purple)', color:'#fff', border:'none', borderRadius:'12px', fontFamily:'Outfit, sans-serif', fontSize:'0.9rem', fontWeight:700 }}>
              New Order
            </button>
          </div>
        ) : (
          <>
            {error && (
              <div style={{ background:'rgba(220,50,50,0.1)', border:'1px solid rgba(220,50,50,0.3)', color:'#ff6b6b', borderRadius:'12px', padding:'0.8rem 1rem', fontSize:'0.84rem', marginBottom:'1rem', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span>{error}</span>
                <button onClick={() => setError('')} style={{ background:'none', border:'none', color:'#ff6b6b', cursor:'pointer', fontSize:'1.1rem', lineHeight:1 }}>×</button>
              </div>
            )}

            {/* STEP 1 — PLATFORM */}
            <div style={{ marginBottom:'1.4rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.05s both' : 'none' }}>
              <div style={{ fontSize:'0.75rem', fontWeight:700, color:'var(--muted)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:'0.7rem' }}>Select Platform</div>
              {/* 2-row horizontal scroll — same as number page service chips */}
              <div className="platform-grid" style={{ display:'grid', gridTemplateRows:'repeat(2, 1fr)', gridAutoFlow:'column', gridAutoColumns:'calc(25% - 0.38rem)', gap:'0.5rem', overflowX:'auto', paddingBottom:'0.3rem', scrollbarWidth:'none', msOverflowStyle:'none' }}>
                {boostingServices.map((p, i) => {
                  const isSelected = selectedPlatform?.id === p.id
                  return (
                    <button key={p.id} className="platform-chip"
                      onClick={() => { setSelectedPlatform(p); setSelectedPackage(null) }}
                      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0.5rem', padding:'1rem 0.4rem', background: isSelected ? `${p.color}15` : 'var(--card)', border:`1.5px solid ${isSelected ? p.color : 'var(--border)'}`, borderRadius:'14px', boxShadow: isSelected ? `0 4px 16px ${p.color}33` : 'none', animation: mounted ? `fadeSlideIn 0.3s ease ${0.04*i}s both` : 'none' }}>
                      <div style={{ filter: isSelected ? 'none' : 'grayscale(20%) opacity(0.85)', transition:'filter 0.2s' }}>
                        <PlatformIcon id={p.id} size={26} />
                      </div>
                      <span style={{ fontSize:'0.6rem', fontWeight:600, color: isSelected ? p.color : 'var(--muted)', textAlign:'center', lineHeight:1.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', width:'100%', transition:'color 0.2s' }}>
                        {p.name.replace(' / X', '')}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* STEP 2 — PACKAGES */}
            {selectedPlatform && (
              <div style={{ marginBottom:'1.4rem', animation:'fadeSlideIn 0.35s ease both' }}>
                <div style={{ fontSize:'0.75rem', fontWeight:700, color:'var(--muted)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:'0.7rem', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span>Select Package</span>
                  <span style={{ display:'flex', alignItems:'center', gap:'0.35rem' }}>
                    <PlatformIcon id={selectedPlatform.id} size={13} />
                    <span style={{ color: selectedPlatform.color, fontSize:'0.72rem', fontWeight:700 }}>{selectedPlatform.name}</span>
                  </span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', maxHeight:320, overflowY:'auto', paddingRight:2 }}>
                  {selectedPlatform.packages.map((pkg, i) => {
                    const isSelected = selectedPackage?.id === pkg.id
                    return (
                      <button key={pkg.id} className="pkg-card"
                        onClick={() => setSelectedPackage(pkg)}
                        style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.85rem 1rem', background: isSelected ? `${selectedPlatform.color}12` : 'var(--card)', border:`1px solid ${isSelected ? selectedPlatform.color : 'var(--border)'}`, borderRadius:'12px', animation:`fadeSlideIn 0.25s ease ${0.04*i}s both` }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'0.85rem' }}>
                          <div style={{ width:8, height:8, borderRadius:'50%', background: isSelected ? selectedPlatform.color : 'var(--border)', transition:'all 0.2s', boxShadow: isSelected ? `0 0 8px ${selectedPlatform.color}` : 'none', flexShrink:0 }}/>
                          <div style={{ textAlign:'left' }}>
                            <div style={{ fontSize:'0.84rem', fontWeight:600, color:'var(--text)' }}>{pkg.name}</div>
                            <div style={{ fontSize:'0.7rem', color:'var(--muted)', marginTop:'0.1rem' }}>{pkg.desc} · {pkg.delivery}</div>
                          </div>
                        </div>
                        <span style={{ fontSize:'0.88rem', fontWeight:700, color:'var(--gold)', fontFamily:'Outfit, sans-serif', flexShrink:0, marginLeft:'0.5rem' }}>₦{pkg.price.toLocaleString()}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* STEP 3 — LINK */}
            {selectedPackage && (
              <div style={{ marginBottom:'1.4rem', animation:'fadeSlideIn 0.3s ease both' }}>
                <div style={{ fontSize:'0.75rem', fontWeight:700, color:'var(--muted)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:'0.7rem' }}>Your Link</div>
                <input className="link-input"
                  placeholder={`Paste your ${selectedPlatform.name} profile or post URL...`}
                  value={link} onChange={e => setLink(e.target.value)}
                  style={{ width:'100%', padding:'0.85rem 1rem', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', color:'var(--text)', fontSize:'0.88rem', fontFamily:'Inter, sans-serif', transition:'border-color 0.2s, box-shadow 0.2s' }}
                />
                <div style={{ fontSize:'0.7rem', color:'var(--muted)', marginTop:'0.4rem' }}>Make sure your account or post is public before ordering.</div>
              </div>
            )}

            {/* ORDER SUMMARY + BUY */}
            {selectedPlatform && selectedPackage && link.trim() && (
              <div style={{ animation:'scaleIn 0.3s ease both' }}>
                <div style={{ background:'var(--card2)', border:'1px solid var(--border)', borderRadius:'16px', padding:'1.1rem', marginBottom:'1rem' }}>
                  <div style={{ fontFamily:'Outfit, sans-serif', fontWeight:700, fontSize:'0.82rem', color:'var(--text)', marginBottom:'0.8rem' }}>Order Summary</div>
                  {[
                    { label:'Platform', value:<span style={{ display:'flex', alignItems:'center', gap:'0.4rem', justifyContent:'flex-end' }}><PlatformIcon id={selectedPlatform.id} size={13}/>{selectedPlatform.name}</span> },
                    { label:'Package',  value: selectedPackage.name },
                    { label:'Delivery', value: selectedPackage.delivery },
                    { label:'Balance',  value: <span style={{ color:'var(--gold)' }}>₦{(profile?.wallet_balance || 0).toLocaleString()}</span> },
                  ].map(row => (
                    <div key={row.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'0.8rem', marginBottom:'0.45rem' }}>
                      <span style={{ color:'var(--muted)' }}>{row.label}</span>
                      <span style={{ color:'var(--text)', fontWeight:500 }}>{row.value}</span>
                    </div>
                  ))}
                  <div style={{ height:1, background:'var(--border)', margin:'0.6rem 0' }}/>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'0.92rem' }}>
                    <span style={{ color:'var(--muted)', fontWeight:600 }}>Total</span>
                    <span style={{ color:'var(--gold)', fontWeight:800, fontFamily:'Outfit, sans-serif' }}>₦{selectedPackage.price.toLocaleString()}</span>
                  </div>
                </div>

                <button onClick={handleOrder} disabled={ordering} className="buy-btn"
                  style={{ width:'100%', padding:'0.95rem', background: ordering ? 'var(--purple2)' : 'var(--purple)', color:'#fff', border:'none', borderRadius:'12px', fontFamily:'Outfit, sans-serif', fontSize:'0.95rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.6rem' }}>
                  {ordering ? (
                    <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation:'spin 0.8s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>Processing...</>
                  ) : `Boost Now — ₦${selectedPackage.price.toLocaleString()}`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}