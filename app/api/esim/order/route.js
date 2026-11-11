// app/api/esim/order/route.js
//
//   GET /api/esim/order?order_id=...                 the eSIM + its install details
//   GET /api/esim/order?order_id=...&part=qr         QR code + LPA string
//   GET /api/esim/order?order_id=...&part=usage      data remaining
//   GET /api/esim/order?order_id=...&part=topups     top-up packages (our prices)
//
// Only the signed-in owner can read an eSIM. Opening one also refreshes it
// from Fleexa: a still-pending order is resolved (delivered / refunded) and a
// delivered one is marked expired when its validity runs out.
import { NextResponse } from 'next/server'
import { log } from '@/lib/logger'
import { supabaseAdmin, getAuthedUser, getMarkupPercent, sellPriceNgn } from '@/lib/fleexaShared'
import { getEsimQr, getEsimUsage, listTopupPackages } from '@/lib/providers/fleexaEsim'
import { resolveEsimOrder, syncDeliveredEsim } from '@/lib/esimOrders'

const COLUMNS = 'id, user_id, amount, status, details, created_at'
const PARTS = ['qr', 'usage', 'topups']

async function loadOwned(orderId, userId) {
  const { data } = await supabaseAdmin.from('orders').select(COLUMNS).eq('id', orderId).eq('product_type', 'esim').maybeSingle()
  if (!data || data.user_id !== userId) return null // same answer for "missing" and "not yours"
  return data
}

const lpaFrom = (d) => (d.smdp_address && d.activation_code ? `LPA:1$${d.smdp_address}$${d.activation_code}` : null)

export async function GET(request) {
  try {
    const user = await getAuthedUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const params = new URL(request.url).searchParams
    const orderId = params.get('order_id')
    const part = params.get('part')
    if (!orderId || orderId.length > 64 || (part && !PARTS.includes(part))) return NextResponse.json({ error: 'Missing or invalid parameters' }, { status: 400 })

    let order = await loadOwned(orderId, user.id)
    if (!order) return NextResponse.json({ error: 'eSIM not found.' }, { status: 404 })

    // Refresh from Fleexa before answering.
    if (order.status === 'pending') {
      const r = await resolveEsimOrder(supabaseAdmin, order)
      if (r.action !== 'none') order = (await loadOwned(orderId, user.id)) || order
    } else if (order.status === 'completed' && !part) {
      const s = await syncDeliveredEsim(supabaseAdmin, order)
      if (s !== order.status) order = (await loadOwned(orderId, user.id)) || order
    }

    const d = order.details || {}
    const externalId = d.external_id

    // ── Parts: only for a delivered eSIM ──
    if (part) {
      if (order.status !== 'completed' || !externalId) {
        return NextResponse.json({ error: order.status === 'pending' ? 'Your eSIM is still being prepared. Please check again shortly.' : 'This eSIM is no longer available.' }, { status: 409 })
      }

      if (part === 'qr') {
        const r = await getEsimQr(externalId)
        if (!r.ok) {
          await log('warning', 'number', 'eSIM QR code failed at the provider', user.id, null, { feature: 'esim', order_id: order.id, kind: r.kind, http: r.http, message: r.message, code: r.code }).catch(() => {})
          const notInstallable = r.http === 409 && /NOT_INSTALLABLE/i.test(String(r.code || r.message))
          return NextResponse.json({ error: notInstallable ? 'This eSIM can no longer be installed.' : 'Could not load the QR code right now. Please try again.' }, { status: 502 })
        }
        return NextResponse.json({
          lpa_string: r.lpaString || lpaFrom({ smdp_address: r.smdpAddress, activation_code: r.activationCode }),
          qr_data_url: r.qrDataUrl,
          smdp_address: r.smdpAddress,
          activation_code: r.activationCode,
          install_urls: r.installUrls,
        })
      }

      if (part === 'usage') {
        const r = await getEsimUsage(externalId)
        if (!r.ok) return NextResponse.json({ error: 'Could not load usage right now. Please try again.' }, { status: 502 })
        return NextResponse.json({
          tracking_supported: r.trackingSupported,
          reason: r.reason,
          remaining_mb: r.remainingMb,
          total_mb: r.totalMb,
          expires_at: r.expiresAt,
        })
      }

      if (part === 'topups') {
        if ((d.kind || 'new') !== 'new' || !d.supports_topup) return NextResponse.json({ supports_topup: false, packages: [] })
        const [markup, r] = await Promise.all([getMarkupPercent('esim'), listTopupPackages(externalId)])
        if (!r.ok) return NextResponse.json({ error: 'Could not load top-ups right now. Please try again.' }, { status: 502 })
        const packages = r.packages
          .map((p) => {
            const price = sellPriceNgn(p.costNgn, markup)
            return price === null ? null : { id: p.id, name: p.name, data_mb: p.dataMb, is_unlimited: p.isUnlimited, validity_days: p.validityDays, price_ngn: price }
          })
          .filter(Boolean)
          .sort((a, b) => a.price_ngn - b.price_ngn)
        return NextResponse.json({ supports_topup: r.supportsTopup && packages.length > 0, packages })
      }
    }

    // ── The eSIM itself ──
    // Install material is only returned while the eSIM is usable.
    let details = d
    if (order.status === 'completed' && externalId && !(d.smdp_address && d.activation_code)) {
      // Fleexa's order reply did not carry the activation data - fill it in
      // from the QR endpoint once, and keep it.
      const q = await getEsimQr(externalId)
      if (q.ok && q.smdpAddress && q.activationCode) {
        details = { ...d, smdp_address: q.smdpAddress, activation_code: q.activationCode, ...(q.installUrls ? { install_urls: q.installUrls } : {}) }
        await supabaseAdmin.from('orders').update({ details }).eq('id', order.id)
      }
    }
    const usable = order.status === 'completed'

    return NextResponse.json({
      id: order.id,
      status: order.status,
      kind: details.kind || 'new',
      plan_name: details.plan_name || details.package_name || null,
      country_name: details.country_name || null,
      data_mb: details.data_mb ?? null,
      is_unlimited: Boolean(details.is_unlimited),
      validity_days: details.validity_days ?? null,
      supports_topup: Boolean(details.supports_topup),
      amount: order.amount,
      created_at: order.created_at,
      expires_at: details.expires_at || null,
      iccid: usable ? details.iccid || null : null,
      smdp_address: usable ? details.smdp_address || null : null,
      activation_code: usable ? details.activation_code || null : null,
      lpa_string: usable ? lpaFrom(details) : null,
      install_urls: usable ? details.install_urls || null : null,
      refunded: order.status === 'failed',
    })
  } catch (error) {
    console.error('[esim/order]', error)
    return NextResponse.json({ error: 'Failed to load eSIM' }, { status: 500 })
  }
}