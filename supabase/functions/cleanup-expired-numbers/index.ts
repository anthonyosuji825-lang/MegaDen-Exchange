// supabase/functions/number-expiry/index.ts
//
// Deliberately thin. All the actual refund/expiry logic lives in
// app/api/numbers/cron/sweep/route.js (which reuses lib/numberOrders.js —
// the exact same code path the interactive polling route uses). This
// function's only job is to be the scheduled trigger, since Supabase
// Edge Functions (Deno) can't import Next.js server code directly.
//
// Set these as Supabase secrets:
//   APP_URL      — e.g. https://mega-den-exchange-seven.vercel.app
//   CRON_SECRET  — must match the CRON_SECRET env var on your Next.js deployment

Deno.serve(async () => {
  const appUrl = Deno.env.get('APP_URL')
  const cronSecret = Deno.env.get('CRON_SECRET')

  if (!appUrl || !cronSecret) {
    return new Response(JSON.stringify({ error: 'Missing APP_URL or CRON_SECRET' }), { status: 500 })
  }

  const res = await fetch(`${appUrl}/api/numbers/cron/sweep`, {
    method: 'POST',
    headers: { 'x-cron-secret': cronSecret },
  })

  const body = await res.json()
  return new Response(JSON.stringify(body), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  })
})