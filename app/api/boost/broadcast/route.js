// app/api/boost/broadcast/route.js
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

// GET /api/boost/broadcast — public, no auth required.
// Returns { enabled, message } read from the same `app_settings` table
// your admin Settings tab already writes to.
export async function GET() {
  const admin = createAdminClient()

  const { data } = await admin
    .from('app_settings')
    .select('key, value')
    .in('key', ['boost_broadcast_enabled', 'boost_broadcast_message'])

  const map = {}
  ;(data || []).forEach(row => { map[row.key] = row.value })

  return NextResponse.json({
    enabled: map.boost_broadcast_enabled === 'true',
    message: map.boost_broadcast_message || '',
  })
}