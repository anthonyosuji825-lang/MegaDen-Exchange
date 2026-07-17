import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Use this ONLY inside Route Handlers / Server Components — never in
// 'use client' files. It reads the user's session from cookies so that
// Supabase RLS policies apply exactly as they would in the browser client
// (i.e. a user can only read/update their own profile row, etc.).
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll was called from a context that can't set cookies
            // (e.g. a Server Component render) — safe to ignore as long
            // as middleware is refreshing the session, which is the
            // standard Supabase + Next.js App Router setup.
          }
        },
      },
    }
  )
}