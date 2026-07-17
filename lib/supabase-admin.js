import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Service-role client — bypasses RLS entirely. Only ever use this AFTER
// you've already verified the request via the cookie-based client's
// auth.getUser() (see lib/supabase-server.js). This mirrors the pattern
// already used across your other /api/*/buy routes (5sim, vpn,
// subscriptions, boost, etc.), which read SUPABASE_SERVICE_ROLE_KEY
// directly for their privileged writes.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}