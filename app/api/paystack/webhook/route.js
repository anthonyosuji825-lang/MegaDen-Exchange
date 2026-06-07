// app/api/paystack/webhook/route.js
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-paystack-signature')

    // Verify webhook signature
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(body)
      .digest('hex')

    if (hash !== signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event = JSON.parse(body)

    if (event.event === 'charge.success') {
      const { data } = event
      const email = data.customer.email
      const amount = data.amount / 100
      const reference = data.reference

      // Check for duplicate transaction
      const { data: existing } = await supabase
        .from('transactions')
        .select('id')
        .eq('reference', reference)
        .single()

      if (existing) {
        return NextResponse.json({ message: 'Already processed' }, { status: 200 })
      }

      // Get user by email
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, wallet_balance')
        .eq('email', email)
        .single()

      // ✅ FIX #10: Return 200 on soft errors so Paystack doesn't keep retrying
      if (!profile) {
        console.error('Webhook: user not found for email:', email)
        return NextResponse.json({ message: 'User not found' }, { status: 200 })
      }

      // ✅ Use atomic RPC for credit — consistent with the rest of the codebase
      const { error: creditError } = await supabase
        .rpc('credit_wallet_balance', {
          p_user_id: profile.id,
          p_amount: amount,
        })

      if (creditError) {
        console.error('Webhook: failed to credit wallet:', creditError)
        // Return 500 here so Paystack WILL retry — this is a real failure
        return NextResponse.json({ error: 'Failed to credit wallet' }, { status: 500 })
      }

      // Record transaction
      await supabase.from('transactions').insert({
        user_id: profile.id,
        type: 'credit',
        amount,
        description: 'Wallet funding via Paystack',
        reference,
        status: 'success',
        metadata: { paystack_data: data }
      })

      return NextResponse.json({ message: 'Wallet credited successfully' }, { status: 200 })
    }

    return NextResponse.json({ message: 'Event received' }, { status: 200 })

  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}