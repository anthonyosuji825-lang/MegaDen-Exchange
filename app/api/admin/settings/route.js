// app/api/admin/settings/route.js
//
// Created 2026-09-20 to fix a real bug: the admin settings page was
// upserting directly to app_settings from the BROWSER using the anon
// key, which is subject to Row Level Security. That table's RLS
// evidently allows UPDATE on existing keys but not INSERT of new ones
// — so saving a brand-new setting (fleexa_markup_percent,
// fleexa_rent_margin_percent) silently failed. The admin page never
// checked the upsert's error, so it showed "Saved!" regardless.
//
// This route does the write server-side with the service role key
// (bypasses RLS, same pattern as every other admin/write route in this
// app) and actually returns success/failure so the frontend can show
// the truth instead of an optimistic guess.
//
// IMPORTANT: verify this matches your existing admin-auth pattern.
// This checks for an authenticated session and a profiles.is_admin
// (or equivalent) flag — adjust the exact column/table name below to
// match however your app actually identifies admins elsewhere (e.g.
// however /api/admin/balances protects itself). As written, if no such
// column exists yet, EVERY authenticated user could change site-wide
// pricing — do not ship this without confirming that check is real.
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { get(name) { return cookieStore.get(name)?.value } } }
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ADJUST to match your real admin check — see file header comment.
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const settings = await request.json()
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return NextResponse.json({ error: 'Invalid settings payload' }, { status: 400 })
    }

    const upserts = Object.entries(settings).map(([key, value]) => ({ key, value: String(value) }))
    const { error } = await supabaseAdmin.from('app_settings').upsert(upserts, { onConflict: 'key' })

    if (error) {
      console.error('[admin/settings] upsert failed:', error)
      return NextResponse.json({ error: error.message || 'Failed to save settings' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[admin/settings]', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}