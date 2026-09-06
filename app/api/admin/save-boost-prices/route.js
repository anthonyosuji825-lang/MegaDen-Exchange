// app/api/admin/save-boost-prices/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { log } from '@/lib/logger'

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

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin, email')
      .eq('id', user.id)
      .single()

    if (!callerProfile?.is_admin) {
      await log('warning', 'admin', 'Non-admin attempted to edit boost prices', user.id, callerProfile?.email || user.email, {})
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { prices } = await request.json()

    if (!prices || typeof prices !== 'object' || Array.isArray(prices)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    // Validate every price before writing any of them — an admin typo
    // (empty field, negative number, non-numeric text) shouldn't silently
    // corrupt the price table. Reject the whole batch on the first bad
    // value rather than partially saving.
    const upserts = []
    for (const [package_id, rawPrice] of Object.entries(prices)) {
      const price = Number(rawPrice)
      if (!Number.isFinite(price) || price <= 0) {
        return NextResponse.json({ error: `Invalid price for ${package_id}: must be a positive number` }, { status: 400 })
      }
      upserts.push({ package_id, price })
    }

    if (upserts.length === 0) {
      return NextResponse.json({ error: 'No prices to save' }, { status: 400 })
    }

    const { error: upsertError } = await supabaseAdmin
      .from('boost_prices')
      .upsert(upserts, { onConflict: 'package_id' })

    if (upsertError) {
      await log('error', 'admin', 'Admin boost price save failed', user.id, callerProfile.email, {
        db_error: upsertError.message, package_count: upserts.length,
      })
      return NextResponse.json({ error: 'Failed to save prices' }, { status: 500 })
    }

    await log('info', 'admin', `Admin updated ${upserts.length} boost package price(s)`, user.id, callerProfile.email, {
      package_ids: upserts.map(u => u.package_id),
    })

    return NextResponse.json({ success: true, updated: upserts.length })

  } catch (error) {
    console.error('Admin save-boost-prices error:', error)
    await log('error', 'admin', `Unhandled exception in save-boost-prices route: ${error.message}`, null, null, { stack: error.stack })
    return NextResponse.json({ error: 'Failed to save prices' }, { status: 500 })
  }
}