import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
)

const VPN_API_URL = 'https://api.vpnresellers.com/v3'
const VPN_API_TOKEN = Deno.env.get('VPNRESELLERS_API_TOKEN')

Deno.serve(async () => {
  const now = new Date().toISOString()

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, details')
    .eq('product_type', 'vpn')
    .eq('status', 'active')

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  let expired = 0

  for (const order of orders || []) {
    const expiresAt = order.details?.expires_at
    if (!expiresAt || expiresAt > now) continue // not expired yet

    const vpnAccountId = order.details?.vpn_account_id
    if (!vpnAccountId) continue

    // Disable the VPN account on VPNresellers (stops daily billing)
    const res = await fetch(`${VPN_API_URL}/accounts/${vpnAccountId}/disable`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${VPN_API_TOKEN}`,
        'Accept': 'application/json',
      },
    })

    if (res.ok) {
      await supabase
        .from('orders')
        .update({ status: 'expired' })
        .eq('id', order.id)
      expired++
    } else {
      console.error(`Failed to disable VPN account ${vpnAccountId}:`, await res.text())
    }
  }

  return new Response(JSON.stringify({ expired, checked: (orders || []).length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})