// Save as: app/api/admin/announcements/upload/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 500 * 1024 // hard server limit (the admin page compresses to ~250 KB first)
const BUCKET = 'announcements'

const db = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

async function requireAdmin(req, supabase) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin ? user : null
}

// Check the real file signature, not just the name/type the browser claims.
function sniff(buf) {
  if (buf.length > 12 && buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return { type: 'image/webp', ext: 'webp' }
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { type: 'image/jpeg', ext: 'jpg' }
  if (buf.length > 8 && buf[0] === 0x89 && buf.slice(1, 4).toString('ascii') === 'PNG') return { type: 'image/png', ext: 'png' }
  return null
}

export async function POST(req) {
  const supabase = db()
  if (!(await requireAdmin(req, supabase))) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })

  let form
  try { form = await req.formData() } catch { return NextResponse.json({ error: 'Invalid upload.' }, { status: 400 }) }
  const file = form.get('file')
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'No image received.' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Image must be 500 KB or smaller.' }, { status: 413 })

  const buf = Buffer.from(await file.arrayBuffer())
  const kind = sniff(buf)
  if (!kind) return NextResponse.json({ error: 'Only PNG, JPG or WebP images are allowed.' }, { status: 400 })

  const path = `${randomUUID()}.${kind.ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, buf, {
    contentType: kind.type,
    cacheControl: '31536000', // unique file name, so it can be cached for a year
    upsert: false,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl, size: buf.length })
}