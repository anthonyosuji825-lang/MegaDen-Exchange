// app/api/5sim/sms/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { log } from '@/lib/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const fivesimId = searchParams.get('id')
    const orderId = searchParams.get('order_id')

    if (!fivesimId) {
      return NextResponse.json({ error: 'Missing ID' }, { status: 400 })
    }

    const res = await fetch(
      `https://5sim.net/v1/user/check/${fivesimId}`,
      { headers: { 'Authorization': `Bearer ${process.env.FIVESIM_API_KEY}`, 'Accept': 'application/json' } }
    )

    if (!res.ok) {
      await log('error', 'number', '5sim SMS check API failed', null, null, {
        fivesim_id: fivesimId, order_id: orderId, http_status: res.status,
      })
      throw new Error('Failed to check SMS')
    }

    const data = await res.json()

    // If SMS received, update order and log it
    if (data.sms && data.sms.length > 0 && orderId) {
      const { data: order } = await supabase
        .from('orders')
        .select('details, user_id')
        .eq('id', orderId)
        .single()

      const updatedDetails = {
        ...(order?.details || {}),
        sms_code: data.sms[0].code,
        sms_text: data.sms[0].text,
      }

      await supabase
        .from('orders')
        .update({ status: 'completed', details: updatedDetails })
        .eq('id', orderId)

      const { data: profile } = await supabase.from('profiles').select('email').eq('id', order?.user_id).single()

      await log('info', 'number', `SMS received — order completed`, order?.user_id || null, profile?.email || null, {
        fivesim_id: fivesimId,
        order_id: orderId,
        sms_code: data.sms[0].code,
        sms_text: data.sms[0].text,
        phone: data.phone,
      })

      return NextResponse.json({ status: data.status, sms: data.sms, phone: data.phone })
    }

    // ── No SMS yet — check if this order has expired ──
    // If 20 minutes have passed with no code, auto-cancel on 5sim and
    // refund the user automatically instead of leaving them stuck on
    // "waiting" forever. This is the safety net for dead/virtual operators.
    if (orderId) {
      const { data: order } = await supabase
        .from('orders')
        .select('details, user_id, amount, status')
        .eq('id', orderId)
        .single()

      const expiresAt = order?.details?.expires ? new Date(order.details.expires) : null
      const isExpired = expiresAt && expiresAt.getTime() < Date.now()
      const stillPending = order?.status === 'pending'

      if (isExpired && stillPending) {
        const { data: profile } = await supabase.from('profiles').select('email').eq('id', order.user_id).single()
        const userEmail = profile?.email || null

        // Cancel on 5sim (best effort — don't block refund if this fails)
        const cancelRes = await fetch(
          `https://5sim.net/v1/user/cancel/${fivesimId}`,
          { method: 'GET', headers: { 'Authorization': `Bearer ${process.env.FIVESIM_API_KEY}`, 'Accept': 'application/json' } }
        )
        if (!cancelRes.ok) {
          const cancelErr = await cancelRes.text()
          await log('warning', 'number', '5sim auto-cancel failed on expiry — proceeding with refund anyway', order.user_id, userEmail, {
            fivesim_id: fivesimId, order_id: orderId, cancel_error: cancelErr,
          })
        }

        // Atomic refund
        const { data: refundResult, error: refundError } = await supabase
          .rpc('credit_wallet_balance', { p_user_id: order.user_id, p_amount: order.amount })

        if (refundError || !refundResult) {
          await log('error', 'wallet', 'Auto-refund RPC failed after order expiry', order.user_id, userEmail, {
            fivesim_id: fivesimId, order_id: orderId, amount: order.amount, rpc_error: refundError?.message,
          })
        } else {
          await supabase.from('transactions').insert({
            user_id: order.user_id,
            type: 'credit',
            amount: order.amount,
            description: 'Auto-refund — No SMS received before expiry',
            reference: `AUTOREFUND-${fivesimId}-${Date.now()}`,
            status: 'success',
          })

          await supabase.from('orders').update({ status: 'expired' }).eq('id', orderId)

          await log('warning', 'number', `Order auto-expired — no SMS received, wallet refunded ₦${order.amount.toLocaleString()}`, order.user_id, userEmail, {
            fivesim_id: fivesimId, order_id: orderId, refunded_amount: order.amount,
            country: order.details?.country, service: order.details?.service, operator: order.details?.operator,
          })

          return NextResponse.json({ status: 'expired', sms: [], phone: data.phone, refunded: true })
        }
      }
    }

    return NextResponse.json({ status: data.status, sms: data.sms || [], phone: data.phone })

  } catch (error) {
    console.error('SMS check error:', error)
    return NextResponse.json({ error: 'Failed to check SMS' }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const { fivesimId, orderId, userId, amount } = await request.json()

    if (!fivesimId || !userId || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: profile } = await supabase.from('profiles').select('email').eq('id', userId).single()
    const userEmail = profile?.email || null

    const checkRes = await fetch(
      `https://5sim.net/v1/user/check/${fivesimId}`,
      { headers: { 'Authorization': `Bearer ${process.env.FIVESIM_API_KEY}`, 'Accept': 'application/json' } }
    )

    if (checkRes.ok) {
      const checkData = await checkRes.json()
      if (checkData.sms && checkData.sms.length > 0) {
        await log('warning', 'number', 'Refund blocked — SMS already received', userId, userEmail, {
          fivesim_id: fivesimId, order_id: orderId, amount,
        })
        return NextResponse.json({ error: 'SMS already received. No refund.' }, { status: 400 })
      }
    }

    const cancelRes = await fetch(
      `https://5sim.net/v1/user/cancel/${fivesimId}`,
      { method: 'GET', headers: { 'Authorization': `Bearer ${process.env.FIVESIM_API_KEY}`, 'Accept': 'application/json' } }
    )

    if (!cancelRes.ok) {
      const cancelErr = await cancelRes.text()
      await log('warning', 'number', '5sim cancel API failed — proceeding with refund anyway', userId, userEmail, {
        fivesim_id: fivesimId, order_id: orderId, cancel_error: cancelErr,
      })
    }

    const { data: refundResult, error: refundError } = await supabase
      .rpc('credit_wallet_balance', { p_user_id: userId, p_amount: amount })

    if (refundError || !refundResult) {
      await log('error', 'wallet', 'Refund RPC failed after number cancellation', userId, userEmail, {
        fivesim_id: fivesimId, order_id: orderId, amount, rpc_error: refundError?.message,
      })
      return NextResponse.json({ error: 'Refund failed. Contact support.' }, { status: 500 })
    }

    await supabase.from('transactions').insert({
      user_id: userId,
      type: 'credit',
      amount,
      description: 'Refund — Number cancelled',
      reference: `REFUND-${fivesimId}-${Date.now()}`,
      status: 'success',
    })

    if (orderId) {
      await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
    }

    await log('info', 'number', `Number cancelled — wallet refunded ₦${amount.toLocaleString()}`, userId, userEmail, {
      fivesim_id: fivesimId, order_id: orderId, refunded_amount: amount,
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Cancel error:', error)
    await log('error', 'number', `Unhandled exception in number cancel route: ${error.message}`, null, null, {
      stack: error.stack,
    })
    return NextResponse.json({ error: 'Failed to cancel' }, { status: 500 })
  }
}