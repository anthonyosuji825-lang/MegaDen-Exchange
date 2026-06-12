import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
)

const JAP_API_URL = 'https://justanotherpanel.com/api/v2'
const JAP_API_KEY = Deno.env.get('JAP_API_KEY')

Deno.serve(async () => {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, details')
    .eq('product_type', 'boost')
    .eq('status', 'processing')

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  let updated = 0

  for (const order of orders || []) {
    const japOrderId = order.details?.jap_order_id
    if (!japOrderId) continue

    const formData = new URLSearchParams()
    formData.append('key', JAP_API_KEY)
    formData.append('action', 'status')
    formData.append('order', japOrderId)

    const res = await fetch(JAP_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    })

    if (!res.ok) continue
    const japData = await res.json()
    if (japData.error) continue

    const japStatus = (japData.status || '').toLowerCase()
    let newStatus = null

    if (japStatus === 'completed') newStatus = 'completed'
    else if (japStatus === 'canceled' || japStatus === 'cancelled') newStatus = 'cancelled'
    else if (japStatus === 'partial') newStatus = 'completed'

    if (newStatus) {
      await supabase
        .from('orders')
        .update({
          status: newStatus,
          details: { ...order.details, jap_status: japData.status, remains: japData.remains, start_count: japData.start_count },
        })
        .eq('id', order.id)
      updated++
    }
  }

  return new Response(JSON.stringify({ updated, checked: (orders || []).length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})