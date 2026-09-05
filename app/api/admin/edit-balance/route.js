// app/api/admin/edit-balance/route.js
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

    // ── The one check this whole route exists for: admin status is verified
    // server-side, against the database, every time. Never trust an
    // is_admin flag the client claims about itself — the admin page's own
    // client-side redirect is a UX nicety, not a security boundary.
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin, email')
      .eq('id', user.id)
      .single()

    if (!callerProfile?.is_admin) {
      await log('warning', 'admin', 'Non-admin attempted to edit a user balance', user.id, callerProfile?.email || user.email, {})
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { userId, newBalance } = await request.json()

    if (!userId || newBalance === undefined || newBalance === null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const newBalanceNum = Number(newBalance)
    if (!Number.isFinite(newBalanceNum) || newBalanceNum < 0) {
      return NextResponse.json({ error: 'Invalid balance amount' }, { status: 400 })
    }

    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select('wallet_balance, email')
      .eq('id', userId)
      .single()

    if (targetError || !targetProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const oldBalance = targetProfile.wallet_balance || 0
    const delta = newBalanceNum - oldBalance

    // Service role bypasses RLS entirely — this is the actual privileged
    // write, only reachable after the admin check above.
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ wallet_balance: newBalanceNum })
      .eq('id', userId)

    if (updateError) {
      await log('error', 'admin', 'Admin balance edit failed to save', user.id, callerProfile.email, {
        target_user_id: userId, old_balance: oldBalance, attempted_balance: newBalanceNum, db_error: updateError.message,
      })
      return NextResponse.json({ error: 'Failed to update balance' }, { status: 500 })
    }

    // Audit trail — every other balance change in this app produces a
    // transaction record; a manual admin adjustment should too, so it shows
    // up in the user's own history and isn't a silent, unexplained jump.
    if (delta !== 0) {
      await supabaseAdmin.from('transactions').insert({
        user_id: userId,
        type: delta > 0 ? 'credit' : 'debit',
        amount: Math.abs(delta),
        description: `Manual balance adjustment by admin`,
        reference: `ADMINADJ-${userId}-${Date.now()}`,
        status: 'success',
      })
    }

    await log('info', 'admin', `Admin balance edit — ${targetProfile.email}`, user.id, callerProfile.email, {
      target_user_id: userId, target_email: targetProfile.email,
      old_balance: oldBalance, new_balance: newBalanceNum, delta,
    })

    return NextResponse.json({ success: true, new_balance: newBalanceNum })

  } catch (error) {
    console.error('Admin edit-balance error:', error)
    await log('error', 'admin', `Unhandled exception in edit-balance route: ${error.message}`, null, null, { stack: error.stack })
    return NextResponse.json({ error: 'Failed to update balance' }, { status: 500 })
  }
}