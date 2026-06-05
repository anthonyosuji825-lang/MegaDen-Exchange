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
      await supabase
        .from('orders')
        .update({
          status: 'completed',
          details: supabase.rpc('jsonb_merge', {
            original: 'details',
            patch: { sms_code: data.sms[0].code, sms_text: data.sms[0].text }
          })
        })
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

// Cancel a number (refund if no SMS received)
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const fivesimId = searchParams.get('id')
    const orderId = searchParams.get('order_id')
    const userId = searchParams.get('user_id')
    const amount = Number(searchParams.get('amount'))

    if (!fivesimId) {
      return NextResponse.json({ error: 'Missing ID' }, { status: 400 })
    }

    // Cancel on 5SIM
    await fetch(`https://5sim.net/v1/user/cancel/${fivesimId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.FIVESIM_API_KEY}`,
        'Accept': 'application/json',
      }
    })

    // Refund user wallet
    if (userId && amount) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('wallet_balance')
        .eq('id', userId)
        .single()

      if (profile) {
        await supabase
          .from('profiles')
          .update({ wallet_balance: profile.wallet_balance + amount })
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
    }

    // Update order
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