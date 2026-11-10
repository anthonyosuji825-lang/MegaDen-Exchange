// app/api/proxy/orders/route.js
//
//   GET /api/proxy/orders -> the signed-in user's proxy orders, newest first
//
// Credentials are deliberately NOT included (same as Fleexa's own list): they
// are only returned by /api/proxy/action when the customer asks for them.
//
// Also the place where a running proxy is marked 'expired' once its time is
// up. A Fleexa proxy lasts at most 6 hours from "Get proxy", and the stored
// details.expires_at is the end of that window.
import { NextResponse } from 'next/server'
import { supabaseAdmin, getAuthedUser } from '@/lib/fleexaShared'

export async function GET() {
  try {
    const user = await getAuthedUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('id, amount, status, details, created_at')
      .eq('user_id', user.id)
      .eq('product_type', 'proxy')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) return NextResponse.json({ error: 'Failed to load proxies' }, { status: 500 })

    const now = Date.now()
    const orders = []
    for (const o of data || []) {
      let status = o.status
      const expiresAt = o.details?.expires_at ? Date.parse(o.details.expires_at) : NaN
      if (status === 'active' && Number.isFinite(expiresAt) && now > expiresAt) {
        // Only ever moves active -> expired; guarded on the current status so
        // it cannot undo a stop that happened a moment ago.
        const { error: upErr } = await supabaseAdmin
          .from('orders')
          .update({ status: 'expired', details: { ...o.details, expired_at: new Date().toISOString() } })
          .eq('id', o.id)
          .eq('status', 'active')
        if (!upErr) status = 'expired'
      }
      orders.push({
        id: o.id,
        status,
        amount: o.amount,
        created_at: o.created_at,
        country: o.details?.country || null,
        state: o.details?.state || null,
        proxy_type: o.details?.proxy_type ?? null,
        plan_label: o.details?.plan_label || null,
        expires_at: o.details?.expires_at || null,
        rotations: o.details?.rotations || 0,
      })
    }

    return NextResponse.json({ orders })
  } catch (error) {
    console.error('[proxy/orders]', error)
    return NextResponse.json({ error: 'Failed to load proxies' }, { status: 500 })
  }
}