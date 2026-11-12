// Save as: app/api/admin/announcements/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const ICONS = ['bell', 'gift', 'rocket', 'alert', 'info']
const IMAGE_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/announcements/`

const db = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

// Only signed-in admins (profiles.is_admin) may use this route.
async function requireAdmin(req, supabase) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin ? user : null
}

// Validates and cleans the fields an admin can set.
function clean(body) {
  const title = String(body.title ?? '').trim()
  const message = String(body.message ?? '').trim()
  if (!title || title.length > 80) return { error: 'Title is required (max 80 characters).' }
  if (message.length > 500) return { error: 'Message can be at most 500 characters.' }
  const icon = ICONS.includes(body.icon) ? body.icon : 'bell'

  const label = String(body.primary_label ?? '').trim()
  const url = String(body.primary_url ?? '').trim()
  if (label.length > 30) return { error: 'Button text can be at most 30 characters.' }
  if ((label && !url) || (!label && url)) return { error: 'Fill in both the button text and the button link, or leave both empty.' }
  if (url && !(/^\/(?!\/)/.test(url) || /^https:\/\//i.test(url))) {
    return { error: 'Button link must start with / (a page in your app) or https://' }
  }

  // Only pictures uploaded through our own upload route are accepted.
  const image_url = String(body.image_url ?? '').trim()
  if (image_url && (!image_url.startsWith(IMAGE_PREFIX) || image_url.length > 300)) return { error: 'Invalid image. Please upload it again.' }

  const toDate = (v) => {
    if (!v) return null
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
  }
  const starts_at = toDate(body.starts_at)
  const ends_at = toDate(body.ends_at)
  if (starts_at === undefined || ends_at === undefined) return { error: 'Invalid start or end date.' }
  if (starts_at && ends_at && new Date(ends_at) <= new Date(starts_at)) return { error: 'End time must be after the start time.' }

  return {
    row: {
      title, message, icon,
      primary_label: label || null,
      primary_url: url || null,
      image_url: image_url || null,
      allow_hide: body.allow_hide !== false,
      is_active: !!body.is_active,
      starts_at, ends_at,
    },
  }
}

export async function GET(req) {
  const supabase = db()
  if (!(await requireAdmin(req, supabase))) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ announcements: data || [] })
}

export async function POST(req) {
  const supabase = db()
  if (!(await requireAdmin(req, supabase))) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const { row, error: bad } = clean(body)
  if (bad) return NextResponse.json({ error: bad }, { status: 400 })
  const { data, error } = await supabase.from('announcements').insert(row).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ announcement: data })
}

// Body: { id, ...fields }  -> edit
//       { id, is_active }  -> quick on/off switch
//       { id, reshow: true } -> show again to everyone who hid it
export async function PATCH(req) {
  const supabase = db()
  if (!(await requireAdmin(req, supabase))) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  let update
  if (body.reshow) {
    const { data: cur } = await supabase.from('announcements').select('version').eq('id', body.id).single()
    if (!cur) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    update = { version: (cur.version || 1) + 1, is_active: true }
  } else if (Object.keys(body).length === 2 && typeof body.is_active === 'boolean') {
    update = { is_active: body.is_active }
  } else {
    const { row, error: bad } = clean(body)
    if (bad) return NextResponse.json({ error: bad }, { status: 400 })
    update = row
  }

  const { data, error } = await supabase
    .from('announcements').update({ ...update, updated_at: new Date().toISOString() }).eq('id', body.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ announcement: data })
}

export async function DELETE(req) {
  const supabase = db()
  if (!(await requireAdmin(req, supabase))) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  // Remove the picture from storage too (best effort).
  const { data: row } = await supabase.from('announcements').select('image_url').eq('id', id).single()
  const { error } = await supabase.from('announcements').delete().eq('id', id)
  if (!error && row?.image_url?.startsWith(IMAGE_PREFIX)) {
    await supabase.storage.from('announcements').remove([row.image_url.slice(IMAGE_PREFIX.length)]).catch(() => {})
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}