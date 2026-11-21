// lib/boost/links.js
//
// Checks that the link a customer pasted is a real web address on the
// platform they chose. Providers usually charge for orders with bad links
// and do not always refund them, so we stop obvious mistakes up front.
//
// People rarely paste a clean link. Share buttons copy text like
//   "Check out this video https://vm.tiktok.com/ZMabc/ #fyp"
// and some people type "tiktok.com/@name" without https://. So instead of
// rejecting anything that isn't already a perfect URL, we pull the link out
// of what was pasted, add https:// if it's missing, and only then validate.

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

// Shown to customers in error messages.
const PLATFORM_INFO = {
  instagram: { name: 'Instagram', example: 'https://www.instagram.com/username/' },
  tiktok: { name: 'TikTok', example: 'https://www.tiktok.com/@username/video/1234567890' },
  twitter: { name: 'Twitter / X', example: 'https://x.com/username/status/1234567890' },
  facebook: { name: 'Facebook', example: 'https://www.facebook.com/yourpage' },
  youtube: { name: 'YouTube', example: 'https://www.youtube.com/watch?v=xxxxxxxxxxx' },
  telegram: { name: 'Telegram', example: 'https://t.me/yourchannel' },
  spotify: { name: 'Spotify', example: 'https://open.spotify.com/track/xxxxxxxx' },
  snapchat: { name: 'Snapchat', example: 'https://www.snapchat.com/add/username' },
  whatsapp: { name: 'WhatsApp', example: 'https://whatsapp.com/channel/xxxxxxxx' },
}

const URL_WITH_SCHEME = /https?:\/\/[^\s<>"'`]+/gi
// A bare "domain.tld/path" typed or pasted without https://
const BARE_URL = /(?:^|[\s(])((?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"'`]*)?)/gi
const TRAILING_JUNK = /[.,;:!?)\]}'"]+$/

function clean(candidate) {
  return candidate.replace(TRAILING_JUNK, '')
}

// Every link-looking piece of the pasted text, in order, with https://
// added where it was missing.
function extractCandidates(raw) {
  const text = String(raw ?? '').trim()
  const found = []

  for (const m of text.matchAll(URL_WITH_SCHEME)) found.push({ at: m.index, link: clean(m[0]) })
  for (const m of text.matchAll(BARE_URL)) {
    const bare = clean(m[1])
    const at = m.index + m[0].indexOf(m[1])
    // Skip bare matches that are just the tail of a link we already found.
    if (found.some(f => at >= f.at && at < f.at + f.link.length)) continue
    found.push({ at, link: 'https://' + bare })
  }

  return found.sort((a, b) => a.at - b.at).map(f => f.link)
}

function hostMatches(link, allowed) {
  let url
  try {
    url = new URL(link)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  return allowed.some(d => host === d || host.endsWith('.' + d))
}

export function validateLink(platformId, raw) {
  const allowed = HOSTS[platformId]
  const info = PLATFORM_INFO[platformId]
  if (!allowed || !info) return { ok: false, code: 'invalid_platform', message: 'Unknown platform' }

  const candidates = extractCandidates(raw)

  if (candidates.length === 0) {
    return {
      ok: false,
      code: 'invalid_link',
      message: `We couldn't find a link in what you pasted. Paste the full ${info.name} link, starting with https:// (for example ${info.example}).`,
    }
  }

  // Use the first link that actually belongs to the chosen platform, so a
  // share message that mentions another site first still works.
  const link = candidates.find(c => hostMatches(c, allowed))
  if (!link) {
    return {
      ok: false,
      code: 'link_platform_mismatch',
      message: `That link isn't from ${info.name}. Paste a ${info.name} link (for example ${info.example}).`,
    }
  }

  if (link.length > 500) {
    return { ok: false, code: 'invalid_link', message: 'That link is too long. Please paste the shorter share link.' }
  }

  return { ok: true, link }
}