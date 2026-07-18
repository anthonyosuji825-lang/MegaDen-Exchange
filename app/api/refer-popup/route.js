// app/api/refer-popup/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const MAX_VIEWS = 3

// POST /api/refer-popup — call this once per fresh login session (guarded
// client-side by sessionStorage so it's not hit on every page navigation).
// Returns { show, referralLink }. Bumps refer_popup_views by 1 every time
// it decides to show, so it only ever shows for the first 3 sessions.
export async function POST() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { get(name) { return cookieStore.get(name)?.value } } }
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (!user || authError) {
      return NextResponse.json({ show: false }, { status: 401 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('refer_popup_views, referral_code')
      .eq('id', user.id)
      .single()

    const views = profile?.refer_popup_views || 0

    if (views >= MAX_VIEWS) {
      return NextResponse.json({ show: false })
    }

    await supabaseAdmin
      .from('profiles')
      .update({ refer_popup_views: views + 1 })
      .eq('id', user.id)

    // Adjust this to however your app builds a referral link/code today.
    const referralLink = `${process.env.NEXT_PUBLIC_SITE_URL || ''}/r/${profile?.referral_code || user.id}`

    return NextResponse.json({ show: true, referralLink })

  } catch (error) {
    console.error('Refer popup check error:', error)
    return NextResponse.json({ show: false }, { status: 500 })
  }
}