// lib/boost-catalog.js
// Single source of truth for boost package pricing tiers, shared by the
// front-end (app/boosting/page.js) and the order API routes. Keeping this
// in one place means server-side price validation always matches what the
// client displayed — no drift, no way for a client-computed price to
// disagree with what the server is willing to charge.

export const STANDARD_SERVICES = [
  {
    id: 'instagram', name: 'Instagram', color: '#e1306c',
    packages: [
      { id: 'ig_f1k',   name: '1,000 Followers',   price: 1500,  delivery: '24hrs',  desc: 'Real-looking profiles',  service_id: 10129, quantity: 1000   },
      { id: 'ig_f5k',   name: '5,000 Followers',   price: 6000,  delivery: '48hrs',  desc: 'Gradual delivery',       service_id: 10129, quantity: 5000   },
      { id: 'ig_f10k',  name: '10,000 Followers',  price: 11000, delivery: '72hrs',  desc: 'Best value',             service_id: 10129, quantity: 10000  },
      { id: 'ig_f50k',  name: '50,000 Followers',  price: 48000, delivery: '5days',  desc: 'Mega growth',            service_id: 10129, quantity: 50000  },
      { id: 'ig_l500',  name: '500 Likes',          price: 500,   delivery: '6hrs',   desc: 'Per post',               service_id: 9438,  quantity: 500    },
      { id: 'ig_l1k',   name: '1,000 Likes',        price: 800,   delivery: '12hrs',  desc: 'Per post',               service_id: 9438,  quantity: 1000   },
      { id: 'ig_l5k',   name: '5,000 Likes',        price: 3500,  delivery: '24hrs',  desc: 'Per post',               service_id: 9438,  quantity: 5000   },
      { id: 'ig_v10k',  name: '10,000 Views',       price: 600,   delivery: '6hrs',   desc: 'Reel / Video',           service_id: 7786,  quantity: 10000  },
      { id: 'ig_v50k',  name: '50,000 Views',       price: 2500,  delivery: '12hrs',  desc: 'Reel / Video',           service_id: 7786,  quantity: 50000  },
      { id: 'ig_v100k', name: '100,000 Views',      price: 4500,  delivery: '24hrs',  desc: 'Reel / Video',           service_id: 7786,  quantity: 100000 },
    ]
  },
  {
    id: 'tiktok', name: 'TikTok', color: '#ff0050',
    packages: [
      { id: 'tt_f1k',   name: '1,000 Followers',  price: 1200,  delivery: '24hrs', desc: 'Real-looking',     service_id: 10127, quantity: 1000   },
      { id: 'tt_f5k',   name: '5,000 Followers',  price: 5000,  delivery: '48hrs', desc: 'Gradual delivery', service_id: 10127, quantity: 5000   },
      { id: 'tt_f10k',  name: '10,000 Followers', price: 9500,  delivery: '72hrs', desc: 'Best value',       service_id: 10127, quantity: 10000  },
      { id: 'tt_l1k',   name: '1,000 Likes',      price: 600,   delivery: '6hrs',  desc: 'Per video',        service_id: 10022, quantity: 1000   },
      { id: 'tt_l5k',   name: '5,000 Likes',      price: 2500,  delivery: '12hrs', desc: 'Per video',        service_id: 10022, quantity: 5000   },
      { id: 'tt_v50k',  name: '50,000 Views',     price: 1000,  delivery: '6hrs',  desc: 'Video views',      service_id: 10238, quantity: 50000  },
      { id: 'tt_v500k', name: '500,000 Views',    price: 8000,  delivery: '48hrs', desc: 'Viral boost',      service_id: 10238, quantity: 500000 },
    ]
  },
  {
    id: 'twitter', name: 'Twitter / X', color: '#e7e7e7',
    packages: [
      { id: 'tw_f500',  name: '500 Followers',   price: 1000, delivery: '12hrs', desc: 'Quality accounts', service_id: 10176, quantity: 500  },
      { id: 'tw_f1k',   name: '1,000 Followers', price: 1800, delivery: '24hrs', desc: 'Quality accounts', service_id: 9276,  quantity: 1000 },
      { id: 'tw_f5k',   name: '5,000 Followers', price: 7500, delivery: '72hrs', desc: 'Gradual delivery', service_id: 9276,  quantity: 5000 },
      { id: 'tw_l500',  name: '500 Likes',        price: 700,  delivery: '6hrs',  desc: 'Per tweet',        service_id: 10176, quantity: 500  },
      { id: 'tw_l1k',   name: '1,000 Likes',      price: 1200, delivery: '12hrs', desc: 'Per tweet',        service_id: 10176, quantity: 1000 },
      { id: 'tw_rt500', name: '500 Retweets',     price: 1000, delivery: '12hrs', desc: 'Per tweet',        service_id: 10177, quantity: 500  },
    ]
  },
  {
    id: 'facebook', name: 'Facebook', color: '#1877f2',
    packages: [
      { id: 'fb_pl1k',   name: '1,000 Page Likes', price: 2000, delivery: '48hrs', desc: 'Real-looking',      service_id: 1882, quantity: 1000 },
      { id: 'fb_pl5k',   name: '5,000 Page Likes', price: 8000, delivery: '5days', desc: 'Gradual delivery',  service_id: 1882, quantity: 5000 },
      { id: 'fb_f1k',    name: '1,000 Followers',  price: 1800, delivery: '24hrs', desc: 'Profile followers', service_id: 1889, quantity: 1000 },
      { id: 'fb_f5k',    name: '5,000 Followers',  price: 7000, delivery: '72hrs', desc: 'Gradual delivery',  service_id: 1889, quantity: 5000 },
      { id: 'fb_ptl500', name: '500 Post Likes',    price: 800,  delivery: '12hrs', desc: 'Per post',          service_id: 8999, quantity: 500  },
      { id: 'fb_ptl1k',  name: '1,000 Post Likes', price: 1400, delivery: '24hrs', desc: 'Per post',          service_id: 8999, quantity: 1000 },
    ]
  },
  {
    id: 'youtube', name: 'YouTube', color: '#ff0000',
    packages: [
      { id: 'yt_s500',  name: '500 Subscribers',   price: 3000,  delivery: '48hrs', desc: 'Retention safe',     service_id: 3366,  quantity: 500   },
      { id: 'yt_s1k',   name: '1,000 Subscribers', price: 5000,  delivery: '72hrs', desc: 'Retention safe',     service_id: 3366,  quantity: 1000  },
      { id: 'yt_s5k',   name: '5,000 Subscribers', price: 22000, delivery: '7days', desc: 'Gradual delivery',   service_id: 3366,  quantity: 5000  },
      { id: 'yt_v10k',  name: '10,000 Views',       price: 2000,  delivery: '48hrs', desc: 'Watch time counted', service_id: 10236, quantity: 10000 },
      { id: 'yt_v50k',  name: '50,000 Views',       price: 8000,  delivery: '5days', desc: 'Watch time counted', service_id: 10236, quantity: 50000 },
      { id: 'yt_l500',  name: '500 Likes',           price: 1000,  delivery: '24hrs', desc: 'Per video',          service_id: 6767,  quantity: 500   },
      { id: 'yt_l1k',   name: '1,000 Likes',         price: 1800,  delivery: '48hrs', desc: 'Per video',          service_id: 6767,  quantity: 1000  },
    ]
  },
  {
    id: 'telegram', name: 'Telegram', color: '#0088cc',
    packages: [
      { id: 'tg_m500',  name: '500 Members',       price: 1800,  delivery: '24hrs', desc: 'Channel / Group',  service_id: 7330, quantity: 500   },
      { id: 'tg_m1k',   name: '1,000 Members',     price: 3000,  delivery: '48hrs', desc: 'Channel / Group',  service_id: 7330, quantity: 1000  },
      { id: 'tg_m5k',   name: '5,000 Members',     price: 12000, delivery: '72hrs', desc: 'Gradual delivery', service_id: 7330, quantity: 5000  },
      { id: 'tg_m10k',  name: '10,000 Members',    price: 22000, delivery: '5days', desc: 'Mega growth',      service_id: 7330, quantity: 10000 },
      { id: 'tg_v10k',  name: '10,000 Post Views', price: 800,   delivery: '6hrs',  desc: 'Per post',         service_id: 7102, quantity: 10000 },
      { id: 'tg_v50k',  name: '50,000 Post Views', price: 3000,  delivery: '12hrs', desc: 'Per post',         service_id: 7102, quantity: 50000 },
    ]
  },
  {
    id: 'spotify', name: 'Spotify', color: '#1db954',
    packages: [
      { id: 'sp_pl1k',  name: '1,000 Plays',  price: 1800,  delivery: '24hrs', desc: 'iOS/iPhone targeted', service_id: 8430, quantity: 1000  },
      { id: 'sp_pl5k',  name: '5,000 Plays',  price: 8000,  delivery: '48hrs', desc: 'iOS/iPhone targeted', service_id: 8430, quantity: 5000  },
      { id: 'sp_pl10k', name: '10,000 Plays', price: 14000, delivery: '72hrs', desc: 'iOS/iPhone targeted', service_id: 8430, quantity: 10000 },
      { id: 'sp_pla1k', name: '1,000 Plays',  price: 1900,  delivery: '24hrs', desc: 'Android targeted',    service_id: 8431, quantity: 1000  },
      { id: 'sp_pla5k', name: '5,000 Plays',  price: 8500,  delivery: '48hrs', desc: 'Android targeted',    service_id: 8431, quantity: 5000  },
    ]
  },
  {
    id: 'snapchat', name: 'Snapchat', color: '#fffc00',
    packages: [
      { id: 'sc_f100',  name: '100 Followers',   price: 2500,  delivery: '48hrs', desc: 'Arab Gulf accounts', service_id: 4165, quantity: 100  },
      { id: 'sc_f500',  name: '500 Followers',   price: 10000, delivery: '5days', desc: 'Arab Gulf accounts', service_id: 4165, quantity: 500  },
      { id: 'sc_fa100', name: '100 Followers',   price: 2000,  delivery: '24hrs', desc: 'Arab accounts',      service_id: 6859, quantity: 100  },
      { id: 'sc_fa1k',  name: '1,000 Followers', price: 18000, delivery: '72hrs', desc: 'Arab accounts',      service_id: 6859, quantity: 1000 },
    ]
  },
]

// ─── TURBO BOOST SERVICES (EXO) ──────────────────────────────────────────────
export const TURBO_SERVICES = [
  {
    id: 'instagram', name: 'Instagram', color: '#e1306c',
    packages: [
      { id: 'tb_ig_f1k_avg',   name: '1,000 Followers (Avg)',  price: 4000,  delivery: '1hr',   desc: 'Average quality', service_id: 3106, quantity: 1000   },
      { id: 'tb_ig_f1k_hq',    name: '1,000 Followers (HQ)',   price: 6000,  delivery: '11min', desc: 'High quality',    service_id: 3107, quantity: 1000   },
      { id: 'tb_ig_f5k_avg',   name: '5,000 Followers (Avg)',  price: 18000, delivery: '1hr',   desc: 'Average quality', service_id: 3106, quantity: 5000   },
      { id: 'tb_ig_f5k_hq',    name: '5,000 Followers (HQ)',   price: 28000, delivery: '11min', desc: 'High quality',    service_id: 3107, quantity: 5000   },
      { id: 'tb_ig_l1k_avg',   name: '1,000 Likes (Avg)',      price: 500,   delivery: '5min',  desc: 'Average quality', service_id: 2997, quantity: 1000   },
      { id: 'tb_ig_l1k_hq',    name: '1,000 Likes (HQ)',       price: 900,   delivery: '5min',  desc: 'High quality',    service_id: 2998, quantity: 1000   },
      { id: 'tb_ig_l5k_avg',   name: '5,000 Likes (Avg)',      price: 2000,  delivery: '5min',  desc: 'Average quality', service_id: 2997, quantity: 5000   },
      { id: 'tb_ig_l5k_hq',    name: '5,000 Likes (HQ)',       price: 4000,  delivery: '5min',  desc: 'High quality',    service_id: 2998, quantity: 5000   },
      { id: 'tb_ig_v10k_avg',  name: '10,000 Views (Avg)',     price: 100,   delivery: '28min', desc: 'Reel / Video',    service_id: 3108, quantity: 10000  },
      { id: 'tb_ig_v10k_hq',   name: '10,000 Views (HQ)',      price: 300,   delivery: '31min', desc: 'Reel / Video',    service_id: 3109, quantity: 10000  },
      { id: 'tb_ig_v100k_avg', name: '100,000 Views (Avg)',    price: 900,   delivery: '28min', desc: 'Reel / Video',    service_id: 3108, quantity: 100000 },
      { id: 'tb_ig_v100k_hq',  name: '100,000 Views (HQ)',     price: 2500,  delivery: '31min', desc: 'Reel / Video',    service_id: 3109, quantity: 100000 },
    ]
  },
  {
    id: 'tiktok', name: 'TikTok', color: '#ff0050',
    packages: [
      { id: 'tb_tt_f1k_avg',   name: '1,000 Followers (Avg)',  price: 8000,  delivery: '1hr',   desc: 'Average quality', service_id: 3036, quantity: 1000   },
      { id: 'tb_tt_f1k_hq',    name: '1,000 Followers (HQ)',   price: 11000, delivery: '7hrs',  desc: 'High quality',    service_id: 3037, quantity: 1000   },
      { id: 'tb_tt_f5k_avg',   name: '5,000 Followers (Avg)',  price: 38000, delivery: '1hr',   desc: 'Average quality', service_id: 3036, quantity: 5000   },
      { id: 'tb_tt_f5k_hq',    name: '5,000 Followers (HQ)',   price: 56000, delivery: '7hrs',  desc: 'High quality',    service_id: 3037, quantity: 5000   },
      { id: 'tb_tt_l1k_avg',   name: '1,000 Likes (Avg)',      price: 500,   delivery: '29min', desc: 'Average quality', service_id: 3048, quantity: 1000   },
      { id: 'tb_tt_l1k_hq',    name: '1,000 Likes (HQ)',       price: 700,   delivery: '32min', desc: 'High quality',    service_id: 3049, quantity: 1000   },
      { id: 'tb_tt_l5k_avg',   name: '5,000 Likes (Avg)',      price: 2000,  delivery: '29min', desc: 'Average quality', service_id: 3048, quantity: 5000   },
      { id: 'tb_tt_l5k_hq',    name: '5,000 Likes (HQ)',       price: 3500,  delivery: '32min', desc: 'High quality',    service_id: 3049, quantity: 5000   },
      { id: 'tb_tt_v50k_avg',  name: '50,000 Views (Avg)',     price: 400,   delivery: '12min', desc: 'Video views',     service_id: 3047, quantity: 50000  },
      { id: 'tb_tt_v50k_hq',   name: '50,000 Views (HQ)',      price: 600,   delivery: '5min',  desc: 'Video views',     service_id: 3043, quantity: 50000  },
      { id: 'tb_tt_v500k_avg', name: '500,000 Views (Avg)',    price: 4000,  delivery: '12min', desc: 'Viral boost',     service_id: 3047, quantity: 500000 },
      { id: 'tb_tt_v500k_hq',  name: '500,000 Views (HQ)',     price: 6000,  delivery: '5min',  desc: 'Viral boost',     service_id: 3043, quantity: 500000 },
    ]
  },
  {
    id: 'facebook', name: 'Facebook', color: '#1877f2',
    packages: [
      { id: 'tb_fb_pgf1k_avg',   name: '1,000 Page Followers (Avg)',    price: 4500, delivery: '3hrs',  desc: 'Average quality', service_id: 3123, quantity: 1000  },
      { id: 'tb_fb_pgf1k_hq',    name: '1,000 Page Followers (HQ)',     price: 4500, delivery: '4hrs',  desc: 'High quality',    service_id: 3124, quantity: 1000  },
      { id: 'tb_fb_prf1k_avg',   name: '1,000 Profile Followers (Avg)', price: 7000, delivery: '6hrs',  desc: 'Average quality', service_id: 3125, quantity: 1000  },
      { id: 'tb_fb_prf1k_hq',    name: '1,000 Profile Followers (HQ)',  price: 7000, delivery: '1hr',   desc: 'High quality',    service_id: 3126, quantity: 1000  },
      { id: 'tb_fb_pl1k_avg',    name: '1,000 Post Likes (Avg)',        price: 700,  delivery: '26min', desc: 'Average quality', service_id: 3129, quantity: 1000  },
      { id: 'tb_fb_pl1k_hq',     name: '1,000 Post Likes (HQ)',         price: 900,  delivery: '1hr',   desc: 'High quality',    service_id: 3130, quantity: 1000  },
      { id: 'tb_fb_react_love',  name: '1,000 Reactions ❤️',            price: 900,  delivery: '2hrs',  desc: 'Love reaction',   service_id: 3131, quantity: 1000  },
      { id: 'tb_fb_react_haha',  name: '1,000 Reactions 😂',            price: 900,  delivery: '55min', desc: 'Haha reaction',   service_id: 3133, quantity: 1000  },
      { id: 'tb_fb_react_wow',   name: '1,000 Reactions 😮',            price: 900,  delivery: '3hrs',  desc: 'Wow reaction',    service_id: 3132, quantity: 1000  },
      { id: 'tb_fb_react_sad',   name: '1,000 Reactions 😢',            price: 900,  delivery: '29min', desc: 'Sad reaction',    service_id: 3134, quantity: 1000  },
      { id: 'tb_fb_react_angry', name: '1,000 Reactions 😡',            price: 900,  delivery: '8min',  desc: 'Angry reaction',  service_id: 3135, quantity: 1000  },
      { id: 'tb_fb_shares',      name: '1,000 Post Shares',             price: 2200, delivery: '4min',  desc: 'High quality',    service_id: 2975, quantity: 1000  },
      { id: 'tb_fb_grp1k_avg',   name: '1,000 Group Members (Avg)',     price: 2700, delivery: '1hr',   desc: 'Average quality', service_id: 2932, quantity: 1000  },
      { id: 'tb_fb_grp1k_hq',    name: '1,000 Group Members (HQ)',      price: 4000, delivery: '3hrs',  desc: 'High quality',    service_id: 3136, quantity: 1000  },
      { id: 'tb_fb_v10k_avg',    name: '10,000 Video Views (Avg)',      price: 1200, delivery: '2hrs',  desc: 'Average quality', service_id: 3137, quantity: 10000 },
      { id: 'tb_fb_v10k_hq',     name: '10,000 Video Views (HQ)',       price: 2000, delivery: '3hrs',  desc: 'High quality',    service_id: 3138, quantity: 10000 },
    ]
  },
  {
    id: 'youtube', name: 'YouTube', color: '#ff0000',
    packages: [
      { id: 'tb_yt_s500_avg',  name: '500 Subscribers (Avg)',  price: 25000, delivery: '65hrs', desc: 'Average quality', service_id: 3056, quantity: 500   },
      { id: 'tb_yt_s500_hq',   name: '500 Subscribers (HQ)',   price: 32000, delivery: 'varies',desc: 'High quality',    service_id: 3058, quantity: 500   },
      { id: 'tb_yt_v10k_avg',  name: '10,000 Views (Avg)',     price: 1800,  delivery: '6hrs',  desc: 'Average quality', service_id: 3061, quantity: 10000 },
      { id: 'tb_yt_v10k_hq',   name: '10,000 Views (HQ)',      price: 2500,  delivery: '4hrs',  desc: 'High quality',    service_id: 3062, quantity: 10000 },
      { id: 'tb_yt_v50k_avg',  name: '50,000 Views (Avg)',     price: 8000,  delivery: '6hrs',  desc: 'Average quality', service_id: 3061, quantity: 50000 },
      { id: 'tb_yt_v50k_hq',   name: '50,000 Views (HQ)',      price: 11000, delivery: '4hrs',  desc: 'High quality',    service_id: 3062, quantity: 50000 },
      { id: 'tb_yt_l500_avg',  name: '500 Likes (Avg)',         price: 2200,  delivery: '36min', desc: 'Average quality', service_id: 3080, quantity: 500   },
      { id: 'tb_yt_l500_hq',   name: '500 Likes (HQ)',          price: 4000,  delivery: '3min',  desc: 'High quality',    service_id: 3149, quantity: 500   },
      { id: 'tb_yt_l1k_avg',   name: '1,000 Likes (Avg)',       price: 4500,  delivery: '36min', desc: 'Average quality', service_id: 3080, quantity: 1000  },
      { id: 'tb_yt_l1k_hq',    name: '1,000 Likes (HQ)',        price: 7000,  delivery: '3min',  desc: 'High quality',    service_id: 3149, quantity: 1000  },
    ]
  },
  {
    id: 'telegram', name: 'Telegram', color: '#0088cc',
    packages: [
      { id: 'tb_tg_m500_avg',     name: '500 Members (Avg)',        price: 1800, delivery: '4hrs',  desc: 'Channel / Group',    service_id: 3143, quantity: 500   },
      { id: 'tb_tg_m500_hq',      name: '500 Members (HQ)',         price: 2200, delivery: '28min', desc: 'Channel / Group',    service_id: 3144, quantity: 500   },
      { id: 'tb_tg_m1k_avg',      name: '1,000 Members (Avg)',      price: 3500, delivery: '4hrs',  desc: 'Channel / Group',    service_id: 3143, quantity: 1000  },
      { id: 'tb_tg_m1k_hq',       name: '1,000 Members (HQ)',       price: 4500, delivery: '28min', desc: 'Channel / Group',    service_id: 3144, quantity: 1000  },
      { id: 'tb_tg_v10k',         name: '10,000 Post Views',        price: 300,  delivery: '16min', desc: 'High quality',       service_id: 2801, quantity: 10000 },
      { id: 'tb_tg_v50k',         name: '50,000 Post Views',        price: 1500, delivery: '16min', desc: 'High quality',       service_id: 2801, quantity: 50000 },
      { id: 'tb_tg_autoviews',    name: 'Auto Views (New & Old)',   price: 100,  delivery: '1hr',   desc: 'Per 10k views',      service_id: 2804, quantity: 10000 },
      { id: 'tb_tg_react_pos',    name: '1,000 Positive Reactions', price: 500,  delivery: '7min',  desc: '👍❤️🔥🎉',           service_id: 2733, quantity: 1000  },
      { id: 'tb_tg_react_neg',    name: '1,000 Negative Reactions', price: 500,  delivery: '4min',  desc: '👎😢😱😡',           service_id: 2734, quantity: 1000  },
      { id: 'tb_tg_react_heart',  name: '1,000 Reactions ❤️',       price: 500,  delivery: '22min', desc: 'Heart reaction',     service_id: 2735, quantity: 1000  },
      { id: 'tb_tg_react_fire',   name: '1,000 Reactions 🔥',       price: 500,  delivery: '3min',  desc: 'Fire reaction',      service_id: 2736, quantity: 1000  },
      { id: 'tb_tg_react_party',  name: '1,000 Reactions 🎉',       price: 500,  delivery: '5min',  desc: 'Party reaction',     service_id: 2737, quantity: 1000  },
      { id: 'tb_tg_react_thumbs', name: '1,000 Reactions 👍',       price: 500,  delivery: '2min',  desc: 'Thumbs up reaction', service_id: 2738, quantity: 1000  },
    ]
  },
]

// ─── SHARED PRICING HELPERS ───────────────────────────────────────────────
// Used by the boost page (client) to show live custom-amount pricing, and
// by the order API routes (server) to independently recompute and verify
// that price before charging the wallet — never trust a client-submitted
// price for a custom quantity.

// Interpolates a price for any quantity between known tiers, respecting
// the real bulk-discount curve instead of a flat per-unit multiply.
// `tiers` must be sorted ascending by quantity.
export function interpolatePrice(tiers, qty) {
  if (!tiers.length) return null
  if (qty <= tiers[0].quantity) return tiers[0].price
  if (qty >= tiers[tiers.length - 1].quantity) return tiers[tiers.length - 1].price
  for (let i = 0; i < tiers.length - 1; i++) {
    const a = tiers[i], b = tiers[i + 1]
    if (qty >= a.quantity && qty <= b.quantity) {
      const t = (qty - a.quantity) / (b.quantity - a.quantity)
      return Math.round(a.price + t * (b.price - a.price))
    }
  }
  return tiers[tiers.length - 1].price
}

// Nearest tier's delivery estimate for a custom quantity.
export function nearestDelivery(tiers, qty) {
  let best = tiers[0]
  let bestDiff = Math.abs(qty - tiers[0].quantity)
  for (const t of tiers) {
    const diff = Math.abs(qty - t.quantity)
    if (diff < bestDiff) { best = t; bestDiff = diff }
  }
  return best.delivery
}

// Flattens every package across every platform in a services array
// (STANDARD_SERVICES or TURBO_SERVICES) into one lookup by service_id —
// each service_id is a distinct family/offering across quantity tiers.
// `priceMap` (package_id -> admin-overridden price) is applied so the
// curve always reflects live pricing, not just the hardcoded defaults.
export function getFamilyTiers(services, serviceId, priceMap = {}) {
  return services
    .flatMap(platform => platform.packages)
    .filter(pkg => pkg.service_id === serviceId)
    .map(pkg => ({ quantity: pkg.quantity, price: priceMap[pkg.id] ?? pkg.price }))
    .sort((a, b) => a.quantity - b.quantity)
}

// Looks up a single package's default/overridden price by package_id,
// across every platform in a services array.
export function getDefaultPackagePrice(services, packageId, priceMap = {}) {
  const pkg = services.flatMap(platform => platform.packages).find(p => p.id === packageId)
  if (!pkg) return null
  return priceMap[packageId] ?? pkg.price
}