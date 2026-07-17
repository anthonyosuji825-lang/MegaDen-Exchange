// app/api/bills/broadcast/route.js
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

// GET /api/bills/broadcast — public, no auth required.
// Returns { enabled, message } read from the same `app_settings` table
// your admin Settings tab already writes to.
export async function GET() {
  const admin = createAdminClient()

  const { data } = await admin
    .from('app_settings')
    .select('key, value')
    .in('key', ['bills_broadcast_enabled', 'bills_broadcast_message'])

  const map = {}
  ;(data || []).forEach(row => { map[row.key] = row.value })

  return NextResponse.json({
    enabled: map.bills_broadcast_enabled === 'true',
    message: map.bills_broadcast_message || '',
  })
}