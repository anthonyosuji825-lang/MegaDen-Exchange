// app/api/proxy/action/route.js
//
//   POST /api/proxy/action  { orderId, action }
//   action = extract | reveal | verify | rotate | stop
//
// Order statuses used for proxies (all already used elsewhere in the app):
//   pending    bought, not started yet - the customer taps "Get proxy"
//   active     started; running until details.expires_at (max 6 hours)
//   expired    time is up
//   completed  stopped by the customer (or by the provider after a failed rotate)
//
// Credentials are never stored in our database: they are fetched from Fleexa
// each time the signed-in owner asks (extract / reveal / rotate), so a
// rotated or stopped proxy can never show stale or withheld credentials.
// There is no money movement here - a proxy cannot be refunded once bought.
import { NextResponse } from 'next/server'
import { log } from '@/lib/logger'
import { supabaseAdmin, getAuthedUser, makeInFlightGuard } from '@/lib/fleexaShared'
import { extractProxy, revealProxy, verifyProxy, rotateProxy, stopProxy, getProxySlot } from '@/lib/providers/fleexaProxy'

const ACTIONS = ['extract', 'reveal', 'verify', 'rotate', 'stop']
// A rotation costs us nothing in the docs, but an unlimited one invites
// scraping with a single purchase. Generous enough for real use.
const MAX_ROTATIONS = 10
const DEFAULT_LIFETIME_MS = 6 * 60 * 60 * 1000

const guard = makeInFlightGuard()

const fail = (error, status = 400, extra = {}) => NextResponse.json({ error, ...extra }, { status })

// Moves an order from one status to another, only if it is still in the
// expected status (so two taps / a late response can never undo each other).
async function transition(order, fromStatus, toStatus, detailsPatch = {}) {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .update({ status: toStatus, details: { ...order.details, ...detailsPatch } })
    .eq('id', order.id)
    .eq('status', fromStatus)
    .select('id, details')
    .maybeSingle()
  if (error) throw new Error(`order update failed: ${error.message}`)
  return data
}

// Patch details only (status unchanged).
async function patchDetails(order, detailsPatch) {
  const { error } = await supabaseAdmin
    .from('orders')
    .update({ details: { ...order.details, ...detailsPatch } })
    .eq('id', order.id)
  if (error) throw new Error(`order update failed: ${error.message}`)
}

// Our order disagrees with what Fleexa says (e.g. a 409 "already extracted",
// or a rotate that stopped the slot). Ask Fleexa for the truth and line the
// order up with it. Returns the remote slot (or null if Fleexa is unreachable).
async function syncWithProvider(order, externalId) {
  const slot = await getProxySlot(externalId)
  if (!slot.ok) return null
  const remote = slot.status
  if (remote === 'active' && order.status === 'pending') {
    const expiresAt = slot.expiresAt || new Date(Date.now() + DEFAULT_LIFETIME_MS).toISOString()
    await transition(order, 'pending', 'active', { expires_at: expiresAt, extracted_at: new Date().toISOString() })
  } else if (remote === 'expired' && order.status === 'active') {
    await transition(order, 'active', 'expired', { expired_at: new Date().toISOString() })
  } else if (remote === 'stopped' && order.status === 'active') {
    await transition(order, 'active', 'completed', { stopped_at: new Date().toISOString(), stopped_reason: 'provider' })
  }
  return slot
}

function credentialsResponse(status, r, fallbackExpiry) {
  return NextResponse.json({
    success: true,
    status,
    credentials: r.credentials,
    expires_at: r.expiresAt || fallbackExpiry || null,
  })
}

export async function POST(request) {
  let guardKey = null
  try {
    const user = await getAuthedUser()
    if (!user) return fail('Unauthorized', 401)

    let body
    try { body = await request.json() } catch { return fail('Invalid request body') }
    const orderId = String(body?.orderId || '')
    const action = String(body?.action || '')
    if (!orderId || orderId.length > 64 || !ACTIONS.includes(action)) return fail('Missing required fields')

    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, amount, status, details, created_at')
      .eq('id', orderId)
      .eq('product_type', 'proxy')
      .maybeSingle()
    // Same answer for "missing" and "someone else's" so existence never leaks.
    if (!order || order.user_id !== user.id) return fail('Proxy not found.', 404)

    const externalId = order.details?.external_id
    if (!externalId) return fail('This proxy has no provider reference. Please contact support.', 400)

    guardKey = `proxy-order:${order.id}`
    if (!guard.tryEnter(guardKey)) {
      guardKey = null
      return fail('Still working on your last request. Please wait a moment.', 429)
    }

    const logFailure = (what, r) => log('warning', 'number', `Proxy ${what} failed at the provider`, user.id, null, {
      feature: 'proxy', order_id: order.id, external_id: externalId, kind: r.kind, http: r.http, message: r.message, raw: r.raw,
    }).catch(() => {})

    // Our own clock says the 6-hour window is over.
    const expiredNow = () => order.status === 'active' && order.details?.expires_at && Date.now() > Date.parse(order.details.expires_at)

    // ── extract: start the proxy (the 6-hour clock starts here) ──
    if (action === 'extract') {
      if (order.status === 'active') return fail('This proxy is already running. Use "Show details" to see it.')
      if (order.status !== 'pending') return fail('This proxy can no longer be started.')

      let r = await extractProxy(externalId)
      if (!r.ok && r.http === 409) {
        // Already extracted on Fleexa's side (e.g. the first reply got lost).
        const slot = await syncWithProvider(order, externalId)
        if (slot?.status === 'active') {
          r = await revealProxy(externalId)
          if (r.ok) return credentialsResponse('active', r, slot.expiresAt)
        }
      }
      if (!r.ok) {
        await logFailure('extract', r)
        return fail(r.kind === 'AMBIGUOUS'
          ? 'The proxy service did not respond. Please try again in a moment.'
          : 'No proxy is available for this location right now. Please try again in a minute.', 502)
      }
      const expiresAt = r.expiresAt || new Date(Date.now() + DEFAULT_LIFETIME_MS).toISOString()
      await transition(order, 'pending', 'active', { expires_at: expiresAt, extracted_at: new Date().toISOString() })
      if (!r.credentials) {
        await log('warning', 'number', 'Fleexa proxy extract succeeded but returned no usable credentials - field names need checking', user.id, null, {
          feature: 'proxy', order_id: order.id, raw: r.raw,
        }).catch(() => {})
        const again = await revealProxy(externalId)
        if (again.ok && again.credentials) return credentialsResponse('active', again, expiresAt)
        return fail('Your proxy started but its details could not be loaded. Tap "Show details" in a moment.', 502)
      }
      return credentialsResponse('active', r, expiresAt)
    }

    // Everything below needs a running proxy.
    if (order.status !== 'active') {
      return fail(order.status === 'pending'
        ? 'Start this proxy first with "Get proxy".'
        : 'This proxy is no longer active.')
    }
    if (expiredNow()) {
      await transition(order, 'active', 'expired', { expired_at: new Date().toISOString() })
      return fail('This proxy has expired.', 410, { status: 'expired' })
    }

    // ── reveal: show the details again ──
    if (action === 'reveal') {
      const r = await revealProxy(externalId)
      if (!r.ok) {
        if (r.http === 409 || r.http === 404 || r.http === 410) await syncWithProvider(order, externalId)
        await logFailure('reveal', r)
        return fail(r.kind === 'AMBIGUOUS'
          ? 'The proxy service did not respond. Please try again in a moment.'
          : 'Could not load the details for this proxy. It may have expired.', 502)
      }
      if (!r.credentials) return fail('Could not load the details for this proxy right now. Please try again.', 502)
      return credentialsResponse('active', r, order.details?.expires_at)
    }

    // ── verify: is it still alive? ──
    if (action === 'verify') {
      const r = await verifyProxy(externalId)
      if (!r.ok) {
        await logFailure('verify', r)
        return fail('Could not check this proxy right now. Please try again.', 502)
      }
      // Only act on a confirmed answer (checked:true) - never on a check that
      // could not run.
      if (r.checked !== false && (r.alive === false || r.status === 'expired')) {
        await transition(order, 'active', 'expired', { expired_at: new Date().toISOString() })
        return NextResponse.json({ success: true, alive: false, checked: true, status: 'expired' })
      }
      return NextResponse.json({ success: true, alive: r.alive, checked: r.checked !== false, status: 'active' })
    }

    // ── rotate: a fresh IP in the same location ──
    if (action === 'rotate') {
      const rotations = order.details?.rotations || 0
      if (rotations >= MAX_ROTATIONS) return fail(`You have reached the limit of ${MAX_ROTATIONS} IP changes for this proxy.`)
      const r = await rotateProxy(externalId)
      if (!r.ok) {
        await logFailure('rotate', r)
        // Fleexa stops the slot when it has no replacement (502) - line up.
        const slot = await syncWithProvider(order, externalId)
        if (slot && slot.status && slot.status !== 'active') {
          return fail('No replacement IP was available, so this proxy was stopped.', 502, { status: slot.status === 'expired' ? 'expired' : 'completed' })
        }
        return fail('Could not change the IP right now. Your current proxy is unchanged - please try again.', 502)
      }
      if (!r.credentials) return fail('The IP was changed but its details could not be loaded. Tap "Show details".', 502)
      await patchDetails(order, { rotations: rotations + 1, last_rotated_at: new Date().toISOString(), ...(r.expiresAt ? { expires_at: r.expiresAt } : {}) })
      return credentialsResponse('active', r, order.details?.expires_at)
    }

    // ── stop: release it ──
    if (action === 'stop') {
      const r = await stopProxy(externalId)
      if (!r.ok && r.http !== 409) {
        await logFailure('stop', r)
        return fail('Could not stop this proxy right now. Please try again.', 502)
      }
      // 409 means it was not active on Fleexa's side any more - same end state.
      await transition(order, 'active', 'completed', { stopped_at: new Date().toISOString(), stopped_reason: 'customer' })
      return NextResponse.json({ success: true, status: 'completed' })
    }

    return fail('Unknown action')
  } catch (error) {
    console.error('[proxy/action]', error)
    await log('error', 'number', `Unhandled exception in proxy/action: ${error.message}`, null, null, { feature: 'proxy', stack: error.stack }).catch(() => {})
    return fail('Something went wrong. Please try again.', 500)
  } finally {
    if (guardKey) guard.leave(guardKey)
  }
}