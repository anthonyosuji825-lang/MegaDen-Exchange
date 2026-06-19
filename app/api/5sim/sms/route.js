// app/api/5sim/sms/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { log } from '@/lib/logger'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── GET: check for SMS ─────────────────────────────────────────────────────

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const fivesimId = searchParams.get('id')
    const orderId = searchParams.get('order_id')

    if (!fivesimId) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    // ── Ask 5sim for the current order state ──
    const res = await fetch(
      `https://5sim.net/v1/user/check/${fivesimId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.FIVESIM_API_KEY}`,
          'Accept': 'application/json',
        },
      }
    )

    if (!res.ok) {
      await log('error', 'number', '5sim SMS check failed', null, null, {
        fivesim_id: fivesimId, order_id: orderId, http_status: res.status,
      })
      return NextResponse.json({ error: 'Failed to check SMS' }, { status: 502 })
    }

    const data = await res.json()

    // ── SMS arrived ──
    if (data.sms && data.sms.length > 0) {
      if (orderId) {
        // Fetch order once to get user context for logging
        const { data: order } = await supabaseAdmin
          .from('orders')
          .select('details, user_id, status')
          .eq('id', orderId)
          .single()

        // Only update if still pending — avoid double-writing on repeated polls
        if (order?.status === 'pending') {
          await supabaseAdmin
            .from('orders')
            .update({
              status: 'completed',
              details: {
                ...(order.details || {}),
                sms_code: data.sms[0].code,
                sms_text: data.sms[0].text,
              },
            })
            .eq('id', orderId)

          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('email')
            .eq('id', order.user_id)
            .single()

          await log('info', 'number', 'SMS received — order completed', order.user_id, profile?.email || null, {
            fivesim_id: fivesimId,
            order_id: orderId,
            sms_code: data.sms[0].code,
            sms_text: data.sms[0].text,
            phone: data.phone,
          })
        }
      }

      return NextResponse.json({
        status: data.status,
        sms: data.sms,
        phone: data.phone,
      })
    }

    // ── No SMS yet — check if the order has expired ──
    // We only do this check when orderId is provided (i.e. a tracked order).
    // Expiry is driven by the `expires` timestamp we wrote at buy time.
    if (orderId) {
      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('details, user_id, amount, status')
        .eq('id', orderId)
        .single()

      const isStillPending = order?.status === 'pending'
      const expiresAt = order?.details?.expires ? new Date(order.details.expires) : null
      const isExpired = expiresAt && Date.now() > expiresAt.getTime()

      if (isStillPending && isExpired) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('email')
          .eq('id', order.user_id)
          .single()

        const userEmail = profile?.email || null

        // Cancel on 5sim — best effort, don't block refund if this fails
        try {
          await fetch(
            `https://5sim.net/v1/user/cancel/${fivesimId}`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${process.env.FIVESIM_API_KEY}`,
                'Accept': 'application/json',
              },
            }
          )
        } catch (cancelErr) {
          await log('warning', 'number', '5sim cancel call threw — proceeding with refund', order.user_id, userEmail, {
            fivesim_id: fivesimId, order_id: orderId, error: cancelErr?.message,
          })
        }

        // Refund wallet
        const { data: refundResult, error: refundError } = await supabaseAdmin
          .rpc('credit_wallet_balance', { p_user_id: order.user_id, p_amount: order.amount })

        if (refundError || !refundResult) {
          await log('error', 'wallet', 'Auto-refund RPC failed after expiry', order.user_id, userEmail, {
            fivesim_id: fivesimId, order_id: orderId, amount: order.amount, rpc_error: refundError?.message,
          })
          // Still mark expired even if refund failed — don't leave it stuck as pending
        } else {
          await supabaseAdmin.from('transactions').insert({
            user_id: order.user_id,
            type: 'credit',
            amount: order.amount,
            description: 'Auto-refund — No SMS received before expiry',
            reference: `AUTOREFUND-${fivesimId}-${Date.now()}`,
            status: 'success',
          })

          await log('warning', 'number', `Order auto-expired — refunded ₦${order.amount?.toLocaleString()}`, order.user_id, userEmail, {
            fivesim_id: fivesimId,
            order_id: orderId,
            refunded_amount: order.amount,
            country: order.details?.country,
            service: order.details?.service,
            operator: order.details?.operator,
          })
        }

        await supabaseAdmin
          .from('orders')
          .update({ status: 'expired' })
          .eq('id', orderId)

        return NextResponse.json({
          status: 'expired',
          sms: [],
          phone: data.phone,
          refunded: true,
          refunded_amount: order.amount,
        })
      }
    }

    // ── Still waiting — return current status ──
    return NextResponse.json({
      status: data.status,
      sms: data.sms || [],
      phone: data.phone,
    })

  } catch (error) {
    console.error('[5sim/sms GET]', error)
    return NextResponse.json({ error: 'Failed to check SMS' }, { status: 500 })
  }
}

// ── DELETE: cancel a number and refund ────────────────────────────────────
// Authenticates via session — does NOT trust userId from the request body.

export async function DELETE(request) {
  try {
    // ── Verify session server-side ──
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

    const { fivesimId, orderId, amount } = await request.json()

    if (!fivesimId || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single()

    const userEmail = profile?.email || null

    // ── Confirm no SMS has arrived yet ──
    try {
      const checkRes = await fetch(
        `https://5sim.net/v1/user/check/${fivesimId}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.FIVESIM_API_KEY}`,
            'Accept': 'application/json',
          },
        }
      )
      if (checkRes.ok) {
        const checkData = await checkRes.json()
        if (checkData.sms && checkData.sms.length > 0) {
          await log('warning', 'number', 'Cancel blocked — SMS already received', user.id, userEmail, {
            fivesim_id: fivesimId, order_id: orderId, amount,
          })
          return NextResponse.json({ error: 'SMS already received — no refund possible.' }, { status: 400 })
        }
      }
    } catch {
      // If the check fails we still proceed — better to refund than leave user stuck
    }

    // ── Cancel on 5sim ──
    try {
      await fetch(
        `https://5sim.net/v1/user/cancel/${fivesimId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.FIVESIM_API_KEY}`,
            'Accept': 'application/json',
          },
        }
      )
    } catch (cancelErr) {
      await log('warning', 'number', '5sim cancel threw — proceeding with refund', user.id, userEmail, {
        fivesim_id: fivesimId, order_id: orderId, error: cancelErr?.message,
      })
    }

    // ── Refund wallet ──
    const { data: refundResult, error: refundError } = await supabaseAdmin
      .rpc('credit_wallet_balance', { p_user_id: user.id, p_amount: amount })

    if (refundError || !refundResult) {
      await log('error', 'wallet', 'Refund RPC failed after cancel', user.id, userEmail, {
        fivesim_id: fivesimId, order_id: orderId, amount, rpc_error: refundError?.message,
      })
      return NextResponse.json({ error: 'Refund failed. Please contact support.' }, { status: 500 })
    }

    // ── Record transaction + update order ──
    await supabaseAdmin.from('transactions').insert({
      user_id: user.id,
      type: 'credit',
      amount,
      description: 'Refund — Number cancelled',
      reference: `REFUND-${fivesimId}-${Date.now()}`,
      status: 'success',
    })

    if (orderId) {
      await supabaseAdmin
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId)
    }

    await log('info', 'number', `Number cancelled — refunded ₦${amount?.toLocaleString()}`, user.id, userEmail, {
      fivesim_id: fivesimId, order_id: orderId, refunded_amount: amount,
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[5sim/sms DELETE]', error)
    await log('error', 'number', `Unhandled exception in cancel route: ${error.message}`, null, null, { stack: error.stack })
    return NextResponse.json({ error: 'Failed to cancel' }, { status: 500 })
  }
}