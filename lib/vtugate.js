// lib/vtugate.js
// Server-side VTUGATE client. NEVER import this from a 'use client' file —
// it reads VTUGATE_API_KEY from process.env and must only run on the server.

const BASE_URL = 'https://api.vtugate.com/api/v1'

async function vtugateRequest(endpoint, params = {}) {
  const apiKey = process.env.VTUGATE_API_KEY
  if (!apiKey) {
    throw new Error('VTUGATE_API_KEY is not configured on the server')
  }

  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) body.append(key, String(value))
  }

  let res
  try {
    res = await fetch(`${BASE_URL}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${apiKey}`,
      },
      body,
    })
  } catch (e) {
    const err = new Error('Could not reach VTUGATE. Please try again.')
    err.cause = e
    throw err
  }

  let json
  try {
    json = await res.json()
  } catch {
    throw new Error('VTUGATE returned an invalid response')
  }

  if (!res.ok || json.status !== true) {
    const msg = json?.message || json?.data?.provider_message || 'VTUGATE request failed'
    const err = new Error(msg)
    err.vtugate = json
    err.httpStatus = res.status
    throw err
  }

  return json.data
}

export const vtugate = {
  // Catalog — returns your activated service_ids for a category
  // serviceType: 'airtime' | 'data' | 'tv' | 'electricity' | 'education'
  fetchServices: (serviceType) =>
    vtugateRequest('fetchservices', { service_type: serviceType }),

  // ── Airtime ──────────────────────────────────────────────────────────
  buyAirtime: ({ serviceId, phone, amount }) =>
    vtugateRequest('buyairtime', {
      service_id: serviceId, phone_number: phone, amount,
    }),

  // ── Data ─────────────────────────────────────────────────────────────
  fetchDataPlans: (serviceId) =>
    vtugateRequest('fetchdataplans', { service_id: serviceId }),

  buyData: ({ serviceId, phone, planCode, amount }) =>
    vtugateRequest('buydata', {
      service_id: serviceId, phone_number: phone, plan_code: planCode, amount,
    }),

  // ── Cable TV ─────────────────────────────────────────────────────────
  verifyCableTv: ({ serviceId, phone, smartcardNumber }) =>
    vtugateRequest('verifycabletv', {
      service_id: serviceId, phone, smartcard_number: smartcardNumber,
    }),

  buyCableTv: ({ serviceId, phone, smartcardNumber, amount, planCode, planName }) =>
    vtugateRequest('buycabletv', {
      service_id: serviceId, phone, smartcard_number: smartcardNumber,
      amount, plan_code: planCode, plan_name: planName,
    }),

  // ── Electricity ──────────────────────────────────────────────────────
  verifyElectricity: ({ serviceId, meterNo, disco }) =>
    vtugateRequest('verifyelectricity', {
      service_id: serviceId, meter_no: meterNo, disco,
    }),

  buyElectricity: ({ serviceId, meterNo, disco, amount, phone }) =>
    vtugateRequest('buyelectricity', {
      service_id: serviceId, meter_no: meterNo, disco, amount, phone_number: phone,
    }),

  // ── Education ────────────────────────────────────────────────────────
  getEducationPrice: (serviceId) =>
    vtugateRequest('geteducationtypeprice', { service_id: serviceId }),

  buyEducation: ({ serviceId, phone, quantity, productCode }) =>
    vtugateRequest('buyeducation', {
      service_id: serviceId, phone, quantity, product_code: productCode,
    }),
}