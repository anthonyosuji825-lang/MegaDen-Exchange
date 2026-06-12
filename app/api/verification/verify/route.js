// app/api/verification/verify/route.js
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

    const { purpose, code, current_password, new_password } = await request.json()

    if (!['phone_change', 'password_change'].includes(purpose)) {
      return NextResponse.json({ error: 'Invalid purpose' }, { status: 400 })
    }
    if (!code) {
      return NextResponse.json({ error: 'Missing code' }, { status: 400 })
    }

    // Fetch latest unused code for this purpose
    const { data: record } = await supabaseAdmin
      .from('verification_codes')
      .select('*')
      .eq('user_id', user.id)
      .eq('purpose', purpose)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!record) {
      return NextResponse.json({ error: 'No active code found. Please request a new one.' }, { status: 400 })
    }

    if (new Date(record.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Code has expired. Please request a new one.' }, { status: 400 })
    }

    if (record.code !== code) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
    }

    // ── PHONE CHANGE ──
    if (purpose === 'phone_change') {
      const newPhone = record.metadata?.new_phone
      if (!newPhone) {
        return NextResponse.json({ error: 'No phone number found for this request' }, { status: 400 })
      }

      await supabaseAdmin
        .from('profiles')
        .update({ phone: newPhone })
        .eq('id', user.id)

      await supabaseAdmin
        .from('verification_codes')
        .update({ used: true })
        .eq('id', record.id)

      return NextResponse.json({ success: true, phone: newPhone })
    }

    // ── PASSWORD CHANGE ──
    if (purpose === 'password_change') {
      if (!current_password || !new_password) {
        return NextResponse.json({ error: 'Missing password fields' }, { status: 400 })
      }
      if (new_password.length < 6) {
        return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 })
      }

      // Verify current password by attempting sign-in
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single()

      const checkClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )
      const { error: signInError } = await checkClient.auth.signInWithPassword({
        email: profile.email,
        password: current_password,
      })

      if (signInError) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
      }

      // Update password via admin API
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: new_password,
      })

      if (updateError) {
        console.error('Password update error:', updateError)
        return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
      }

      await supabaseAdmin
        .from('verification_codes')
        .update({ used: true })
        .eq('id', record.id)

      return NextResponse.json({ success: true, message: 'Password updated successfully' })
    }

  } catch (error) {
    console.error('Verify code error:', error)
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
  }
}