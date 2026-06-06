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

    // Check order status from 5SIM
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
      // Get current order details
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

// Cancel a number — accepts JSON body for reliability
export async function DELETE(request) {
  try {
    const body = await request.json()
    const { fivesimId, orderId, userId, amount } = body

    if (!fivesimId) {
      return NextResponse.json({ error: 'Missing fivesimId' }, { status: 400 })
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
        // SMS already received — no refund
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
      const err = await cancelRes.text()
      console.error('5SIM cancel failed:', err)
      // Still try to refund even if 5SIM cancel fails
    }

    // Refund user wallet
    if (userId && amount && amount > 0) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('wallet_balance')
        .eq('id', userId)
        .single()

      if (profileError || !profile) {
        console.error('Profile not found for refund:', profileError)
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      const newBalance = (profile.wallet_balance || 0) + amount

      await supabase
        .from('profiles')
        .update({ wallet_balance: newBalance })
        .eq('id', userId)

      await supabase.from('transactions').insert({
        user_id: userId,
        type: 'credit',
        amount,
        description: 'Refund — Number cancelled',
        reference: `REFUND-${fivesimId}-${Date.now()}`,
        status: 'success',
      })
    }

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