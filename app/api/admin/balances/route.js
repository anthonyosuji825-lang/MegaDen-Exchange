// app/api/admin/balances/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  try {
    // Auth — admin only
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

    // Check admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch all 3 balances in parallel
    const [fivesimRes, japRes, vpnRes] = await Promise.allSettled([

      // 5sim — GET /v1/user/profile
      fetch('https://5sim.net/v1/user/profile', {
        headers: {
          'Authorization': `Bearer ${process.env.FIVESIM_API_KEY}`,
          'Accept': 'application/json',
        },
      }),

      // JAP — POST with action=balance
      fetch('https://justanotherpanel.com/api/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          key: process.env.JAP_API_KEY,
          action: 'balance',
        }).toString(),
      }),

      // VPNresellers — GET /v3/reseller
      fetch('https://api.vpnresellers.com/v3/reseller', {
        headers: {
          'Authorization': `Bearer ${process.env.VPNRESELLERS_API_TOKEN}`,
          'Accept': 'application/json',
        },
      }),
    ])

    // Parse 5sim
    let fivesim = { balance: null, error: null }
    if (fivesimRes.status === 'fulfilled' && fivesimRes.value.ok) {
      const d = await fivesimRes.value.json()
      fivesim.balance = d.balance ?? null
    } else {
      fivesim.error = 'Failed to fetch'
    }

    // Parse JAP
    let jap = { balance: null, error: null }
    if (japRes.status === 'fulfilled' && japRes.value.ok) {
      const d = await japRes.value.json()
      jap.balance = d.balance ?? null
    } else {
      jap.error = 'Failed to fetch'
    }

    // Parse VPNresellers
    let vpn = { balance: null, error: null }
    if (vpnRes.status === 'fulfilled' && vpnRes.value.ok) {
      const d = await vpnRes.value.json()
      // API returns data.balance or top-level balance
      vpn.balance = d.data?.balance ?? d.balance ?? null
    } else {
      vpn.error = 'Failed to fetch'
    }

    return NextResponse.json({ fivesim, jap, vpn })

  } catch (error) {
    console.error('Admin balances error:', error)
    return NextResponse.json({ error: 'Failed to fetch balances' }, { status: 500 })
  }
}