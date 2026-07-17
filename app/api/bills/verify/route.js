// app/api/bills/verify/route.js
import { NextResponse } from 'next/server'
import { vtugate } from '@/lib/vtugate'

// POST /api/bills/verify
// body: { kind: 'cable', serviceId, phone, smartcardNumber }
// body: { kind: 'electricity', serviceId, meterNo, disco }
export async function POST(req) {
  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { kind } = body

  try {
    if (kind === 'cable') {
      const { serviceId, phone, smartcardNumber } = body
      if (!serviceId || !phone || !smartcardNumber) {
        return NextResponse.json({ error: 'serviceId, phone and smartcardNumber are required' }, { status: 400 })
      }
      const data = await vtugate.verifyCableTv({ serviceId, phone, smartcardNumber })
      return NextResponse.json(data)
    }

    if (kind === 'electricity') {
      const { serviceId, meterNo, disco } = body
      if (!serviceId || !meterNo || !disco) {
        return NextResponse.json({ error: 'serviceId, meterNo and disco are required' }, { status: 400 })
      }
      const data = await vtugate.verifyElectricity({ serviceId, meterNo, disco })
      return NextResponse.json(data)
    }

    return NextResponse.json({ error: 'Invalid kind — expected "cable" or "electricity"' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}