// app/api/numbers/rent/sms/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { log } from '@/lib/logger'
import { checkRentSms } from '@/lib/providers/fleexaRent'

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

async function loadOwnedRental(orderId, userId) {
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('id, user_id, status, details')
    .eq('id', orderId)
    .eq('product_type', 'number_rental')
    .single()
  if (error || !order) return { error: 'NOT_FOUND' }
  if (order.user_id !== userId) return { error: 'NOT_FOUND' }
  return { order }
}

// De-dupes by (code, text) pair — the simplest key available given
// checkRentSms() doesn't guarantee a per-message id in its normalized
// shape. If Fleexa's real response includes a stable message id once
// /rent/sms has actually been called, prefer that instead.
function mergeMessages(existing, incoming) {
  const seen = new Set(existing.map((m) => `${m.code}|${m.text}`))
  const merged = [...existing]
  for (const m of incoming) {
    const key = `${m.code}|${m.text}`
    if (!seen.has(key)) {
      merged.push(m)
      seen.add(key)
    }
  }
  return merged
}

export async function GET(request) {
  try {
    const cookieStore = await cookies()
    const { user, error: authError } = await getAuthedUser(cookieStore)
    if (!user || authError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('order_id')
    if (!orderId) return NextResponse.json({ error: 'Missing order_id' }, { status: 400 })

    const { order, error } = await loadOwnedRental(orderId, user.id)
    if (error) return NextResponse.json({ error: 'Rental not found.' }, { status: 404 })

    const expiresAt = order.details?.expires
    const isExpired = expiresAt && new Date(expiresAt).getTime() < Date.now()

    if (order.status !== 'active' || isExpired) {
      if (order.status === 'active' && isExpired) {
        await supabaseAdmin.from('orders').update({ status: 'expired' }).eq('id', orderId)
      }
      return NextResponse.json({
        status: isExpired ? 'expired' : order.status,
        phone: order.details?.phone,
        expires_at: expiresAt,
        messages: order.details?.messages || [],
      })
    }

    const externalId = order.details?.external_id
    if (!externalId) {
      return NextResponse.json({ error: 'Rental has no associated number.' }, { status: 400 })
    }

    const result = await checkRentSms(externalId)
    if (!result.ok) {
      // Provider hiccup — don't fail the poll, just return what's
      // already cached so the UI doesn't flash an error every 20s.
      return NextResponse.json({
        status: 'active',
        phone: order.details?.phone,
        expires_at: expiresAt,
        messages: order.details?.messages || [],
      })
    }

    const mergedMessages = mergeMessages(order.details?.messages || [], result.messages)
    if (mergedMessages.length !== (order.details?.messages || []).length) {
      await supabaseAdmin
        .from('orders')
        .update({ details: { ...order.details, messages: mergedMessages } })
        .eq('id', orderId)

      await log('info', 'number', `New SMS received on rental — ${mergedMessages.length - (order.details?.messages || []).length} new`, user.id, null, {
        feature: 'rent_numbers', order_id: orderId, external_id: externalId,
      }).catch(() => {})
    }

    return NextResponse.json({
      status: 'active',
      phone: order.details?.phone,
      expires_at: expiresAt,
      messages: mergedMessages,
    })

  } catch (error) {
    console.error('[numbers/rent/sms GET]', error)
    return NextResponse.json({ error: 'Failed to check rental messages' }, { status: 500 })
  }
}