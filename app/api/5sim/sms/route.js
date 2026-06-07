// app/api/5sim/sms/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
      {
        headers: {
          'Authorization': `Bearer ${process.env.FIVESIM_API_KEY}`,
          'Accept': 'application/json',
        }
      }
    )

    if (!res.ok) throw new Error('Failed to check SMS')
    const data = await res.json()

    // If SMS received, update order status
    if (data.sms && data.sms.length > 0 && orderId) {
      const { data: order } = await supabase
        .from('orders')
        .select('details')
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
    }

    return NextResponse.json({
      status: data.status,
      sms: data.sms || [],
      phone: data.phone,
    })

  } catch (error) {
    console.error('SMS check error:', error)
    return NextResponse.json({ error: 'Failed to check SMS' }, { status: 500 })
  }
}

// ✅ FIX #3: DELETE now correctly reads JSON body (not query params)
export async function DELETE(request) {
  try {
    // ✅ Read JSON body — matches what page.js now sends
    const { fivesimId, orderId, userId, amount } = await request.json()

    if (!fivesimId || !userId || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if SMS already received — prevent refund abuse
    const checkRes = await fetch(
      `https://5sim.net/v1/user/check/${fivesimId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.FIVESIM_API_KEY}`,
          'Accept': 'application/json',
        }
      }
    )

    if (checkRes.ok) {
      const checkData = await checkRes.json()
      if (checkData.sms && checkData.sms.length > 0) {
        return NextResponse.json({ error: 'SMS already received. No refund.' }, { status: 400 })
      }
    }

    // Cancel on 5SIM
    const cancelRes = await fetch(
      `https://5sim.net/v1/user/cancel/${fivesimId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.FIVESIM_API_KEY}`,
          'Accept': 'application/json',
        }
      }
    )

    if (!cancelRes.ok) {
      console.error('5SIM cancel failed:', await cancelRes.text())
      // Still proceed with refund even if 5SIM cancel fails
    }

    // ✅ FIX: Use atomic RPC for refund — consistent with buy flow
    const { data: refundResult, error: refundError } = await supabase
      .rpc('credit_wallet_balance', {
        p_user_id: userId,
        p_amount: amount,
      })

    if (refundError || !refundResult) {
      console.error('Refund RPC error:', refundError)
      return NextResponse.json({ error: 'Refund failed. Contact support.' }, { status: 500 })
    }

    // Log the refund transaction
    await supabase.from('transactions').insert({
      user_id: userId,
      type: 'credit',
      amount,
      description: 'Refund — Number cancelled',
      reference: `REFUND-${fivesimId}-${Date.now()}`,
      status: 'success',
    })

    // Update order status
    if (orderId) {
      await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId)
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Cancel error:', error)
    return NextResponse.json({ error: 'Failed to cancel' }, { status: 500 })
  }
}