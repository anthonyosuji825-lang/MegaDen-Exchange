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

async function getAuthedUser(cookieStore) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { get(name) { return cookieStore.get(name)?.value } } }
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  return { user, error }
}

// ── GET: check for SMS ─────────────────────────────────────────────────────
// FIXED: this endpoint previously had NO auth check at all, and trusted the
// `id` (fivesim_id) query param directly — meaning anyone who could guess or
// observe a fivesim_id could pull another user's OTP code with a plain GET
// request. Now: auth is required, order_id is required, ownership of the
// order is verified, and the fivesim_id actually used for the 5sim API call
// always comes from the order record in the DB — never from the query
// string. A client-supplied `id` that doesn't match is logged, not trusted.

export async function GET(request) {
  try {
    const cookieStore = await cookies()
    const { user, error: authError } = await getAuthedUser(cookieStore)
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('order_id')
    const clientFivesimId = searchParams.get('id') // never trusted for the actual API call — see below

    if (!orderId) {
      return NextResponse.json({ error: 'Missing order_id' }, { status: 400 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single()
    const userEmail = profile?.email || user.email || null

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('details, user_id, amount, status')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
    }

    if (order.user_id !== user.id) {
      await log('warning', 'number', 'Attempted to check SMS for another user\'s order', user.id, userEmail, {
        order_id: orderId, actual_owner: order.user_id,
      })
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
    }

    // ── Source of truth for which number we actually check ──
    const fivesimId = order.details?.fivesim_id
    if (!fivesimId) {
      return NextResponse.json({ error: 'Order has no associated number.' }, { status: 400 })
    }
    if (clientFivesimId && clientFivesimId !== fivesimId) {
      await log('warning', 'number', 'SMS check id param did not match order record — ignored client value', user.id, userEmail, {
        order_id: orderId, client_id: clientFivesimId, order_fivesim_id: fivesimId,
      })
    }

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
      await log('error', 'number', '5sim SMS check failed', user.id, userEmail, {
        fivesim_id: fivesimId, order_id: orderId, http_status: res.status,
      })
      return NextResponse.json({ error: 'Failed to check SMS' }, { status: 502 })
    }

    const data = await res.json()

    if (data.sms && data.sms.length > 0) {
      if (order.status === 'pending') {
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

        await log('info', 'number', 'SMS received — order completed', user.id, userEmail, {
          fivesim_id: fivesimId,
          order_id: orderId,
          sms_code: data.sms[0].code,
          sms_text: data.sms[0].text,
          phone: data.phone,
        })
      }

      return NextResponse.json({
        status: data.status,
        sms: data.sms,
        phone: data.phone,
      })
    }

    if (order.status === 'pending') {
      const expiresAt = order.details?.expires ? new Date(order.details.expires) : null
      const isExpired = expiresAt && Date.now() > expiresAt.getTime()

      if (isExpired) {
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
          await log('warning', 'number', '5sim cancel call threw — proceeding with refund', user.id, userEmail, {
            fivesim_id: fivesimId, order_id: orderId, error: cancelErr?.message,
          })
        }

        const { data: refundResult, error: refundError } = await supabaseAdmin
          .rpc('credit_wallet_balance', { p_user_id: order.user_id, p_amount: order.amount })

        if (refundError || !refundResult) {
          await log('error', 'wallet', 'Auto-refund RPC failed after expiry', order.user_id, userEmail, {
            fivesim_id: fivesimId, order_id: orderId, amount: order.amount, rpc_error: refundError?.message,
          })
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
// FIXED: previously trusted `fivesimId` from the request body directly — a
// user could submit their own valid orderId paired with a DIFFERENT user's
// fivesimId, and this would cancel a stranger's active number on 5sim (their
// own refund would still be correct, since that was always tied to their own
// order.amount, but the victim's number would be silently killed). Now the
// fivesim_id used for the actual 5sim calls always comes from the order
// record — the body's fivesimId (if sent) is only used for mismatch logging.

export async function DELETE(request) {
  try {
    const cookieStore = await cookies()
    const { user, error: authError } = await getAuthedUser(cookieStore)
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fivesimId: clientFivesimId, orderId } = await request.json()

    if (!orderId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single()

    const userEmail = profile?.email || null

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, amount, status, details')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      await log('warning', 'number', 'Cancel attempted on unknown order', user.id, userEmail, { order_id: orderId })
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
    }

    if (order.user_id !== user.id) {
      await log('warning', 'number', 'Attempted to cancel another user\'s order', user.id, userEmail, { order_id: orderId, actual_owner: order.user_id })
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
    }

    if (order.status !== 'pending') {
      await log('warning', 'number', 'Cancel attempted on non-pending order', user.id, userEmail, { order_id: orderId, current_status: order.status })
      return NextResponse.json({ error: 'This order can no longer be cancelled.' }, { status: 400 })
    }

    const fivesimId = order.details?.fivesim_id
    if (!fivesimId) {
      return NextResponse.json({ error: 'Order has no associated number.' }, { status: 400 })
    }
    if (clientFivesimId && clientFivesimId !== fivesimId) {
      await log('warning', 'number', 'Cancel id param did not match order record — ignored client value', user.id, userEmail, {
        order_id: orderId, client_id: clientFivesimId, order_fivesim_id: fivesimId,
      })
    }

    const amount = order.amount

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

    const { data: refundResult, error: refundError } = await supabaseAdmin
      .rpc('credit_wallet_balance', { p_user_id: user.id, p_amount: amount })

    if (refundError || !refundResult) {
      await log('error', 'wallet', 'Refund RPC failed after cancel', user.id, userEmail, {
        fivesim_id: fivesimId, order_id: orderId, amount, rpc_error: refundError?.message,
      })
      return NextResponse.json({ error: 'Refund failed. Please contact support.' }, { status: 500 })
    }

    await supabaseAdmin.from('transactions').insert({
      user_id: user.id,
      type: 'credit',
      amount,
      description: 'Refund — Number cancelled',
      reference: `REFUND-${fivesimId}-${Date.now()}`,
      status: 'success',
    })

    await supabaseAdmin
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', orderId)

    await log('info', 'number', `Number cancelled — refunded ₦${amount?.toLocaleString()}`, user.id, userEmail, {
      fivesim_id: fivesimId, order_id: orderId, refunded_amount: amount,
    })

    return NextResponse.json({ success: true, refunded_amount: amount })

  } catch (error) {
    console.error('[5sim/sms DELETE]', error)
    await log('error', 'number', `Unhandled exception in cancel route: ${error.message}`, null, null, { stack: error.stack })
    return NextResponse.json({ error: 'Failed to cancel' }, { status: 500 })
  }
}