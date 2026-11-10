// app/api/email/status/route.js
//
//   GET    /api/email/status?order_id=...   poll one email order for its code
//   DELETE /api/email/status  { orderId }   cancel it and refund (after 2 min)
//
// Mirrors app/api/numbers/sms. The actual state handling lives in
// lib/emailOrders.js so this route and the background sweep cannot drift.
import { NextResponse } from 'next/server'
import { supabaseAdmin, getAuthedUser } from '@/lib/fleexaShared'
import { resolveEmailOrder, cancelEmailOrderForUser, emailCancelUnlockAt } from '@/lib/emailOrders'

const COLUMNS = 'id, user_id, amount, status, details, created_at'

async function loadOwned(orderId, userId) {
  const { data } = await supabaseAdmin
    .from('orders')
    .select(COLUMNS)
    .eq('id', orderId)
    .eq('product_type', 'email_otp')
    .maybeSingle()
  if (!data || data.user_id !== userId) return null // same answer for "missing" and "not yours"
  return data
}

function shape(order) {
  return {
    status: order.status,
    email: order.details?.email || null,
    site: order.details?.site || null,
    code: order.details?.sms_code || null,
    text: order.details?.sms_text || null,
    amount: order.amount,
    cancel_unlock_at: emailCancelUnlockAt(order),
    // 'cancelled' and 'expired' are only ever set after the refund went through.
    refunded: order.status === 'cancelled' || order.status === 'expired',
  }
}

export async function GET(request) {
  try {
    const user = await getAuthedUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const orderId = new URL(request.url).searchParams.get('order_id')
    if (!orderId || orderId.length > 64) return NextResponse.json({ error: 'Missing order_id' }, { status: 400 })

    let order = await loadOwned(orderId, user.id)
    if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 })

    if (order.status === 'pending') {
      const result = await resolveEmailOrder(supabaseAdmin, order)
      if (result.action !== 'none') order = (await loadOwned(orderId, user.id)) || order
    }

    return NextResponse.json(shape(order))
  } catch (error) {
    console.error('[email/status GET]', error)
    return NextResponse.json({ error: 'Failed to check email' }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const user = await getAuthedUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let body
    try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
    const orderId = body?.orderId
    if (!orderId || String(orderId).length > 64) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    const { httpStatus, body: resBody } = await cancelEmailOrderForUser(supabaseAdmin, String(orderId), user.id)
    return NextResponse.json(resBody, { status: httpStatus })
  } catch (error) {
    console.error('[email/status DELETE]', error)
    return NextResponse.json({ error: 'Failed to cancel' }, { status: 500 })
  }
}