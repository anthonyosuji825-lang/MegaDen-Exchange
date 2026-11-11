// app/api/esim/orders/route.js
//
//   GET /api/esim/orders -> the signed-in user's eSIM orders (new + top-ups),
//                           newest first.
//
// Installation material (activation code, LPA string, install links) is NOT in
// this list - it only comes from /api/esim/order when the owner opens an eSIM.
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
      .eq('product_type', 'esim')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) return NextResponse.json({ error: 'Failed to load eSIMs' }, { status: 500 })

    const now = Date.now()
    const orders = (data || []).map((o) => {
      const d = o.details || {}
      const expiresMs = d.expires_at ? Date.parse(d.expires_at) : NaN
      return {
        id: o.id,
        status: o.status === 'completed' && Number.isFinite(expiresMs) && now > expiresMs ? 'expired' : o.status,
        amount: o.amount,
        created_at: o.created_at,
        kind: d.kind || 'new',
        plan_name: d.plan_name || d.package_name || null,
        country_name: d.country_name || null,
        data_mb: d.data_mb ?? null,
        is_unlimited: Boolean(d.is_unlimited),
        validity_days: d.validity_days ?? null,
        supports_topup: Boolean(d.supports_topup),
        parent_order_id: d.parent_order_id || null,
        expires_at: d.expires_at || null,
      }
    })

    return NextResponse.json({ orders })
  } catch (error) {
    console.error('[esim/orders]', error)
    return NextResponse.json({ error: 'Failed to load eSIMs' }, { status: 500 })
  }
}