// app/api/admin/ban-user/route.js
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
      await log('warning', 'admin', 'Non-admin attempted to ban/unban a user', user.id, callerProfile?.email || user.email, {})
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { userId, banned } = await request.json()

    if (!userId || typeof banned !== 'boolean') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // An admin can never ban themselves through this route — a client bug
    // or a compromised admin session shouldn't be able to lock the only
    // admin account out of the panel that fixes it.
    if (userId === user.id) {
      return NextResponse.json({ error: 'You cannot ban your own account.' }, { status: 400 })
    }

    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select('email, is_admin')
      .eq('id', userId)
      .single()

    if (targetError || !targetProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ is_banned: banned })
      .eq('id', userId)

    if (updateError) {
      await log('error', 'admin', 'Admin ban/unban failed to save', user.id, callerProfile.email, {
        target_user_id: userId, attempted_banned: banned, db_error: updateError.message,
      })
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
    }

    await log('info', 'admin', `Admin ${banned ? 'banned' : 'unbanned'} user — ${targetProfile.email}`, user.id, callerProfile.email, {
      target_user_id: userId, target_email: targetProfile.email, banned,
    })

    return NextResponse.json({ success: true, banned })

  } catch (error) {
    console.error('Admin ban-user error:', error)
    await log('error', 'admin', `Unhandled exception in ban-user route: ${error.message}`, null, null, { stack: error.stack })
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}