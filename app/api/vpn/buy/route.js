// app/api/vpn/buy/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { log } from '@/lib/logger'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const VPN_API_URL = 'https://api.vpnresellers.com/v3'
const VPN_API_TOKEN = process.env.VPNRESELLERS_API_TOKEN

const PERIOD_DAYS = { '1m': 30, '3m': 90, '6m': 180, '12m': 365 }
const PRICE_KEYS  = { '1m': 'vpn_price_1m', '3m': 'vpn_price_3m', '6m': 'vpn_price_6m', '12m': 'vpn_price_12m' }

export async function POST(request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { get(name) { return cookieStore.get(name)?.value } } }
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (!user || authError) {
      await log('warning', 'auth', 'Unauthorized attempt to purchase VPN', null, null, {})
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabaseAdmin.from('profiles').select('email, full_name, wallet_balance').eq('id', user.id).single()
    const userEmail = profile?.email || user.email || null

    const { plan, server_id } = await request.json()

    if (!plan || !PERIOD_DAYS[plan]) {
      await log('warning', 'vpn', 'Invalid VPN plan selected', user.id, userEmail, { plan })
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 })
    }

    // Get price from app_settings
    const { data: priceRow } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', PRICE_KEYS[plan])
      .single()

    const priceNgn = parseFloat(priceRow?.value)
    if (!priceNgn || priceNgn < 100) {
      await log('error', 'vpn', 'VPN plan pricing not configured in app_settings', user.id, userEmail, { plan, price_key: PRICE_KEYS[plan] })
      return NextResponse.json({ error: 'VPN plan pricing not configured. Contact support.' }, { status: 500 })
    }

    const balance = profile?.wallet_balance || 0
    if (balance < priceNgn) {
      await log('warning', 'wallet', 'Insufficient balance for VPN purchase', user.id, userEmail, {
        balance, attempted_amount: priceNgn, plan,
      })
      return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 })
    }

    // Deduct wallet
    await supabaseAdmin.from('profiles').update({ wallet_balance: balance - priceNgn }).eq('id', user.id)

    const vpnUsername = `mgd${user.id.slice(0, 8)}${Date.now().toString().slice(-5)}`
    const vpnPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-4).toUpperCase()

    // Create VPN account
    const createRes = await fetch(`${VPN_API_URL}/accounts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VPN_API_TOKEN}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: vpnUsername, password: vpnPassword }),
    })

    if (!createRes.ok) {
      // Refund wallet
      await supabaseAdmin.from('profiles').update({ wallet_balance: balance }).eq('id', user.id)
      const errData = await createRes.json().catch(() => ({}))

      await log('error', 'vpn', `VPNresellers account creation failed — wallet refunded`, user.id, userEmail, {
        plan, amount_ngn: priceNgn, http_status: createRes.status, vpn_error: errData,
      })

      if (createRes.status === 402) {
        return NextResponse.json({ error: 'VPN service temporarily unavailable. Please try again later.' }, { status: 503 })
      }
      return NextResponse.json({ error: 'Failed to create VPN account. Please try again.' }, { status: 500 })
    }

    const createData = await createRes.json()
    const vpnAccountId = createData.data.id

    // Fetch server config
    let chosenServerId = server_id
    if (!chosenServerId) {
      const serversRes = await fetch(`${VPN_API_URL}/servers`, {
        headers: { 'Authorization': `Bearer ${VPN_API_TOKEN}`, 'Accept': 'application/json' },
      })
      if (serversRes.ok) {
        const serversData = await serversRes.json()
        chosenServerId = serversData.data?.[0]?.id
      }
    }

    let ovpnConfig = null
    let ovpnFileName = null
    if (chosenServerId) {
      const configRes = await fetch(`${VPN_API_URL}/configuration?server_id=${chosenServerId}`, {
        headers: { 'Authorization': `Bearer ${VPN_API_TOKEN}`, 'Accept': 'application/json' },
      })
      if (configRes.ok) {
        const configData = await configRes.json()
        ovpnConfig = configData.data?.file_body || null
        ovpnFileName = configData.data?.file_name || 'megaden-vpn.ovpn'
      } else {
        await log('warning', 'vpn', 'Failed to fetch .ovpn config file — account created but no config', user.id, userEmail, {
          vpn_account_id: vpnAccountId, server_id: chosenServerId,
        })
      }
    }

    const periodDays = PERIOD_DAYS[plan]
    const expiresAt = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000).toISOString()

    // Save order
    const { data: order } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: user.id,
        product_type: 'vpn',
        product_name: `VPN — ${plan.toUpperCase()} Plan`,
        amount: priceNgn,
        status: 'active',
        details: {
          vpn_account_id: vpnAccountId,
          vpn_username: vpnUsername,
          vpn_password: vpnPassword,
          server_id: chosenServerId,
          ovpn_config: ovpnConfig,
          ovpn_filename: ovpnFileName,
          plan, period_days: periodDays, expires_at: expiresAt,
        }
      })
      .select()
      .single()

    // Save transaction
    await supabaseAdmin.from('transactions').insert({
      user_id: user.id,
      type: 'debit',
      amount: priceNgn,
      description: `VPN ${plan.toUpperCase()} Plan`,
      reference: `VPN-${vpnAccountId}-${Date.now()}`,
      status: 'success',
    })

    // ✅ Success log
    await log('info', 'vpn', `VPN purchased successfully — ${plan.toUpperCase()} plan`, user.id, userEmail, {
      vpn_account_id: vpnAccountId,
      vpn_username: vpnUsername,
      plan, period_days: periodDays,
      expires_at: expiresAt,
      amount_ngn: priceNgn,
      order_id: order.id,
    })

    return NextResponse.json({
      success: true,
      order_id: order.id,
      vpn_username: vpnUsername,
      vpn_password: vpnPassword,
      ovpn_config: ovpnConfig,
      ovpn_filename: ovpnFileName,
      expires_at: expiresAt,
    })

  } catch (error) {
    console.error('VPN buy error:', error)
    await log('error', 'vpn', `Unhandled exception in VPN buy route: ${error.message}`, null, null, {
      stack: error.stack,
    })
    return NextResponse.json({ error: 'Failed to purchase VPN' }, { status: 500 })
  }
}