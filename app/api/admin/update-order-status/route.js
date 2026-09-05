// app/api/admin/update-order-status/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { log } from '@/lib/logger'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const VALID_STATUSES = ['pending', 'processing', 'completed', 'partial', 'cancelled', 'expired', 'active']

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
      await log('warning', 'admin', 'Non-admin attempted to change an order status', user.id, callerProfile?.email || user.email, {})
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { orderId, status } = await request.json()

    if (!orderId || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 })
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, status, product_name')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ status })
      .eq('id', orderId)

    if (updateError) {
      await log('error', 'admin', 'Admin order status change failed to save', user.id, callerProfile.email, {
        order_id: orderId, attempted_status: status, db_error: updateError.message,
      })
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
    }

    await log('info', 'admin', `Admin changed order status — ${order.product_name}`, user.id, callerProfile.email, {
      order_id: orderId, target_user_id: order.user_id, old_status: order.status, new_status: status,
    })

    return NextResponse.json({ success: true, status })

  } catch (error) {
    console.error('Admin update-order-status error:', error)
    await log('error', 'admin', `Unhandled exception in update-order-status route: ${error.message}`, null, null, { stack: error.stack })
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}