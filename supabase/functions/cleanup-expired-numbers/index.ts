import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
)

Deno.serve(async () => {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, user_id, amount, details')
    .eq('product_type', 'number')
    .eq('status', 'pending')

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const now = Date.now()
  let processed = 0

  for (const order of orders || []) {
    const expires = order.details?.expires
    if (!expires || new Date(expires).getTime() > now) continue

    const fivesimId = order.details?.fivesim_id
    if (!fivesimId) continue

    const checkRes = await fetch(`https://5sim.net/v1/user/check/${fivesimId}`, {
      headers: {
        Authorization: `Bearer ${Deno.env.get('FIVESIM_API_KEY')}`,
        Accept: 'application/json',
      },
    })
    const checkData = checkRes.ok ? await checkRes.json() : {}

    if (checkData.sms && checkData.sms.length > 0) {
      await supabase.from('orders').update({
        status: 'completed',
        details: { ...order.details, sms_code: checkData.sms[0].code, sms_text: checkData.sms[0].text },
      }).eq('id', order.id)
      processed++
      continue
    }

    await fetch(`https://5sim.net/v1/user/cancel/${fivesimId}`, {
      headers: {
        Authorization: `Bearer ${Deno.env.get('FIVESIM_API_KEY')}`,
        Accept: 'application/json',
      },
    })

    const { data: refundOk } = await supabase.rpc('credit_wallet_balance', {
      p_user_id: order.user_id,
      p_amount: order.amount,
    })

    if (refundOk) {
      await supabase.from('transactions').insert({
        user_id: order.user_id,
        type: 'credit',
        amount: order.amount,
        description: 'Refund — Number expired/cancelled',
        reference: `REFUND-${fivesimId}-${now}`,
        status: 'success',
      })
      await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
    }

    processed++
  }

  return new Response(JSON.stringify({ processed }), {
    headers: { 'Content-Type': 'application/json' },
  })
})