// app/api/boost/quote/route.js
//
// POST /api/boost/quote  { serviceCode, quantity }
//
// Public, read-only price preview — no sign-in required, since a customer
// should be able to see what something costs before creating an account
// or logging in. This does NOT touch the wallet or create anything; it's
// the exact same quoteBoost() the real order route uses, just without the
// debit step, so the price shown here is guaranteed to match what
// /api/boost/order will actually charge for the same input a moment later.

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/boost/supabase-admin'
import { quoteBoost } from '@/lib/boost/pricing'

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { serviceCode, quantity } = body || {}
  if (!serviceCode || typeof serviceCode !== 'string') {
    return NextResponse.json({ error: 'serviceCode is required' }, { status: 400 })
  }

  const admin = getAdminClient()
  const quote = await quoteBoost(admin, { serviceCode, quantity })

  if (!quote.ok) {
    return NextResponse.json(
      { error: quote.message, code: quote.code, min: quote.min, max: quote.max },
      { status: 400 }
    )
  }

  return NextResponse.json({
    price: quote.price,
    quantity: quote.quantity,
    label: quote.label,
    platform: quote.platform,
    min: quote.min,
    max: quote.max,
  })
}