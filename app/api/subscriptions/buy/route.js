// app/api/subscriptions/buy/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    // Auth
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

    const { service, service_id, plan, plan_id, price } = await request.json()

    if (!service || !plan || !price || !plan_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check wallet balance
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('wallet_balance')
      .eq('id', user.id)
      .single()

    const balance = profile?.wallet_balance || 0
    if (balance < price) {
      return NextResponse.json({ error: 'Insufficient wallet balance. Please fund your wallet.' }, { status: 400 })
    }

    // Find an available key for this service + plan
    const { data: subKey } = await supabaseAdmin
      .from('subscription_keys')
      .select('*')
      .eq('service_id', service_id)
      .eq('plan', plan)
      .eq('is_used', false)
      .limit(1)
      .single()

    if (!subKey) {
      return NextResponse.json({ error: 'Out of stock. Please check back soon or contact support.' }, { status: 400 })
    }

    // Mark key as used
    await supabaseAdmin
      .from('subscription_keys')
      .update({ is_used: true, used_by: user.id, used_at: new Date().toISOString() })
      .eq('id', subKey.id)

    // Deduct wallet
    await supabaseAdmin
      .from('profiles')
      .update({ wallet_balance: balance - price })
      .eq('id', user.id)

    // Save order
    const { data: order } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: user.id,
        product_type: 'subscription',
        product_name: `${service} - ${plan}`,
        amount: price,
        status: 'completed',
        details: {
          service,
          service_id,
          plan,
          plan_id,
          key: subKey.key,
          key_id: subKey.id,
        }
      })
      .select()
      .single()

    // Save transaction
    await supabaseAdmin.from('transactions').insert({
      user_id: user.id,
      type: 'debit',
      amount: price,
      description: `${service} - ${plan}`,
      reference: `SUB-${order.id}-${Date.now()}`,
      status: 'success',
    })

    return NextResponse.json({ success: true, key: subKey.key, service, plan, order_id: order.id })

  } catch (error) {
    console.error('Subscription buy error:', error)
    return NextResponse.json({ error: 'Failed to process order. Please try again.' }, { status: 500 })
  }
}