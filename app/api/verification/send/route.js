// app/api/verification/send/route.js
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

    const { purpose, new_phone } = await request.json()

    if (!['phone_change', 'password_change'].includes(purpose)) {
      return NextResponse.json({ error: 'Invalid purpose' }, { status: 400 })
    }

    if (purpose === 'phone_change' && !new_phone) {
      return NextResponse.json({ error: 'Missing new phone number' }, { status: 400 })
    }

    // Rate limit: max 1 code per 60 seconds per purpose
    const { data: recent } = await supabaseAdmin
      .from('verification_codes')
      .select('created_at')
      .eq('user_id', user.id)
      .eq('purpose', purpose)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (recent && (Date.now() - new Date(recent.created_at).getTime()) < 60000) {
      return NextResponse.json({ error: 'Please wait before requesting another code' }, { status: 429 })
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 min

    // Invalidate previous unused codes for this purpose
    await supabaseAdmin
      .from('verification_codes')
      .update({ used: true })
      .eq('user_id', user.id)
      .eq('purpose', purpose)
      .eq('used', false)

    await supabaseAdmin.from('verification_codes').insert({
      user_id: user.id,
      code,
      purpose,
      metadata: purpose === 'phone_change' ? { new_phone } : {},
      expires_at,
    })

    // Get user email
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .single()

    const subject = purpose === 'phone_change'
      ? 'Confirm your phone number update'
      : 'Confirm your password change'

    const heading = purpose === 'phone_change'
      ? 'Update Phone Number'
      : 'Change Password'

    const description = purpose === 'phone_change'
      ? `We received a request to update your phone number to <strong>${new_phone}</strong>. Enter the code below to confirm this change.`
      : `We received a request to change your account password. Enter the code below to confirm this change.`

    // Send email via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'MegaDen <noreply@megad.name.ng>',
        to: [profile.email],
        subject,
        html: `
          <div style="font-family: 'Inter', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="color:#1a1a2e;">${heading}</h2>
            <p style="color:#555; line-height:1.6;">${description}</p>
            <div style="background:#f4f0ff; border:1px solid #e0d5ff; border-radius:12px; padding:20px; text-align:center; margin:24px 0;">
              <span style="font-size:32px; font-weight:800; letter-spacing:8px; color:#6c4ef2;">${code}</span>
            </div>
            <p style="color:#999; font-size:13px;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      }),
    })

    if (!resendRes.ok) {
      const err = await resendRes.text()
      console.error('Resend error:', err)
      return NextResponse.json({ error: 'Failed to send verification email' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Verification code sent to your email' })

  } catch (error) {
    console.error('Send verification error:', error)
    return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 })
  }
}