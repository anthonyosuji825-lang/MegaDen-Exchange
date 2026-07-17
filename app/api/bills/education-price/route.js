// app/api/bills/education-price/route.js
import { NextResponse } from 'next/server'
import { vtugate } from '@/lib/vtugate'

// GET /api/bills/education-price?service_id=1
export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const serviceId = searchParams.get('service_id')

  if (!serviceId) {
    return NextResponse.json({ error: 'service_id is required' }, { status: 400 })
  }

  try {
    const data = await vtugate.getEducationPrice(serviceId)
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}