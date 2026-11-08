// lib/boost/supabase-admin.js
//
// Server-only Supabase client using the SERVICE ROLE key. It bypasses RLS,
// which is exactly why it must never be imported from browser code and the
// key must never carry a NEXT_PUBLIC_ prefix. Only route handlers and the
// sync job should use it.

import { createClient } from '@supabase/supabase-js'

let cached = null

export function getAdminClient() {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase admin client is not configured')
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}