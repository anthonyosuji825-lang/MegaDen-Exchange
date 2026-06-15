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

      // Fetch user email for the log
      const { data: profile } = await supabase.from('profiles').select('email').eq('id', order?.user_id).single()

      await log('info', 'number', `SMS received — order completed`, order?.user_id || null, profile?.email || null, {
        fivesim_id: fivesimId,
        order_id: orderId,
        sms_code: data.sms[0].code,
        sms_text: data.sms[0].text,
        phone: data.phone,
      })
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

    // Fetch user email for richer logs
    const { data: profile } = await supabase.from('profiles').select('email').eq('id', userId).single()
    const userEmail = profile?.email || null

    // Check if SMS already received — prevent refund abuse
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

    // Cancel on 5SIM
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

    // Atomic refund
    const { data: refundResult, error: refundError } = await supabase
      .rpc('credit_wallet_balance', { p_user_id: userId, p_amount: amount })

    if (refundError || !refundResult) {
      await log('error', 'wallet', 'Refund RPC failed after number cancellation', userId, userEmail, {
        fivesim_id: fivesimId, order_id: orderId, amount, rpc_error: refundError?.message,
      })
      return NextResponse.json({ error: 'Refund failed. Contact support.' }, { status: 500 })
    }

    // Log refund transaction
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