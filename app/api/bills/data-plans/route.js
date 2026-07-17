// app/api/bills/data-plans/route.js
import { NextResponse } from 'next/server'
import { vtugate } from '@/lib/vtugate'

// GET /api/bills/data-plans?service_id=136
export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const serviceId = searchParams.get('service_id')

  if (!serviceId) {
    return NextResponse.json({ error: 'service_id is required' }, { status: 400 })
  }

  try {
    const data = await vtugate.fetchDataPlans(serviceId)
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}