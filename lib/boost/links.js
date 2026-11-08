// lib/boost/links.js
//
// Checks that the link a customer pasted is a real web address on the
// platform they chose. Providers usually charge for orders with bad links
// and do not always refund them, so we stop obvious mistakes up front.

const HOSTS = {
  instagram: ['instagram.com', 'instagr.am'],
  tiktok: ['tiktok.com'],
  twitter: ['x.com', 'twitter.com'],
  facebook: ['facebook.com', 'fb.com', 'fb.watch', 'fb.me'],
  youtube: ['youtube.com', 'youtu.be'],
  telegram: ['t.me', 'telegram.me'],
  spotify: ['spotify.com', 'spotify.link'],
  snapchat: ['snapchat.com'],
  whatsapp: ['whatsapp.com', 'wa.me'],
}

export function validateLink(platformId, raw) {
  const link = String(raw ?? '').trim()
  if (!link || link.length > 500 || /\s/.test(link)) {
    return { ok: false, code: 'invalid_link', message: 'Please paste a valid link' }
  }
  let url
  try {
    url = new URL(link)
  } catch {
    return { ok: false, code: 'invalid_link', message: 'Please paste a valid link' }
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, code: 'invalid_link', message: 'Please paste a valid link' }
  }
  const allowed = HOSTS[platformId]
  if (!allowed) return { ok: false, code: 'invalid_platform', message: 'Unknown platform' }

  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  const matches = allowed.some(d => host === d || host.endsWith('.' + d))
  if (!matches) {
    return { ok: false, code: 'link_platform_mismatch', message: 'That link does not match the platform you selected' }
  }
  return { ok: true, link }
}