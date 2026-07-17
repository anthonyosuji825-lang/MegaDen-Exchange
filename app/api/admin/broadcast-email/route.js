// app/api/admin/broadcast-email/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const FROM_ADDRESS = 'MegaDen <no-reply@megad.name.ng>'
const BATCH_SIZE = 100 // Resend's batch endpoint accepts up to 100 emails per call

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function buildHtml(subject, message) {
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br/>')
  return `
    <div style="font-family: -apple-system, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #1a1a2e;">
      <div style="font-weight: 800; font-size: 18px; margin-bottom: 16px;">
        Mega<span style="color:#f0b429;">Den</span>
      </div>
      <div style="font-size: 15px; line-height: 1.6;">${safeMessage}</div>
      <div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #eee; font-size: 12px; color: #888;">
        You're receiving this because you have an account on MegaDen Exchange.
      </div>
    </div>
  `
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export async function POST(request) {
  try {
    // Auth — admin only (mirrors /api/admin/balances and /api/admin/logs)
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

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse body
    const { subject, message } = await request.json()
    if (!subject?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 })
    }

    // Get all recipient emails
    const { data: recipients, error: recipientsError } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .not('email', 'is', null)

    if (recipientsError) {
      return NextResponse.json({ error: recipientsError.message }, { status: 500 })
    }

    const emails = [...new Set((recipients || []).map(r => r.email).filter(Boolean))]
    if (emails.length === 0) {
      return NextResponse.json({ error: 'No recipients found' }, { status: 400 })
    }

    const html = buildHtml(subject, message)
    const batches = chunk(emails, BATCH_SIZE)

    let sent = 0
    let failed = 0
    const errors = []

    for (const batch of batches) {
      const payload = batch.map(email => ({
        from: FROM_ADDRESS,
        to: [email],
        subject,
        html,
      }))

      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        sent += batch.length
      } else {
        failed += batch.length
        const errBody = await res.text()
        errors.push(errBody)
      }
    }

    // Best-effort log — matches your actual `logs` table schema
    try {
      await supabaseAdmin.from('logs').insert({
        level: failed > 0 ? 'warning' : 'info',
        category: 'broadcast_email',
        message: `Broadcast "${subject}" sent to ${sent}/${emails.length} recipients`,
        user_id: user.id,
        user_email: user.email,
        context: { subject, sent, failed, total: emails.length },
      })
    } catch (logErr) {
      console.error('Failed to write broadcast log:', logErr)
    }

    return NextResponse.json({
      total: emails.length,
      sent,
      failed,
      errors: errors.length ? errors : undefined,
    })

  } catch (error) {
    console.error('Broadcast email error:', error)
    return NextResponse.json({ error: 'Failed to send broadcast' }, { status: 500 })
  }
}