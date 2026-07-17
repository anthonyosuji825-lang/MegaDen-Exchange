// app/api/bills/services/route.js
import { NextResponse } from 'next/server'
import { vtugate } from '@/lib/vtugate'

// GET /api/bills/services?type=airtime|data|tv|electricity|education
export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const serviceType = searchParams.get('type')

  if (!['airtime', 'data', 'tv', 'electricity', 'education'].includes(serviceType)) {
    return NextResponse.json({ error: 'Invalid or missing type' }, { status: 400 })
  }

  try {
    const data = await vtugate.fetchServices(serviceType)
    return NextResponse.json({ data })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}