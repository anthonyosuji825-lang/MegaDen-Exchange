// app/api/boost/cron/sweep/route.js
//
// Called by the Supabase Edge Function (supabase/functions/boost-status-sync)
// on a schedule, the same pattern as app/api/numbers/cron/sweep: not
// user-facing, protected by a shared secret rather than a user session,
// and the edge function is deliberately a thin trigger — all the actual
// sync/settle logic lives here, in one place.
//
// Closes the loop on every boost order. Two passes:
//
// PASS 1 — jobs still 'submitted' with a known provider order id: check
// real status and settle terminal outcomes.
//   completed  -> boost_settle('completed', refund 0)
//   canceled   -> boost_settle('canceled', refund in FULL)
//   partial    -> boost_settle('partial', refund proportional to what's
//                 still missing — pricing here is strictly linear
//                 (rate x quantity), so this refund is exact, unlike the
//                 old tiered-pricing system where only a full refund was
//                 ever safe to compute)
//   still open -> just record the provider's raw status, no state change
//   unrecognized / unreachable -> left as 'submitted' so the NEXT sweep
//                 tries again; never guessed into a refund on the spot
//
// PASS 2 — the safety net every other product already has (numbers:
// 20-min expiry, VPN: instant delivery). A job that has been stuck for
// STUCK_JOB_TIMEOUT_HOURS with no resolution — either 'needs_review'
// (an add-order timeout with no provider id to check at all) or
// 'submitted' but unresolvable sweep after sweep — is auto-refunded in
// full rather than left to check forever.

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { getAdminClient } from '@/lib/boost/supabase-admin'
import { getStatuses } from '@/lib/boost/providers'

// Same safety net convention as numbers (20-min) and VPN (instant) —
// boost was the one product with no ceiling at all until now.
const STUCK_JOB_TIMEOUT_HOURS = 168

// Plain !== comparison on a secret leaks timing information. Low-stakes
// for a cron trigger, but timing-safe is free — same check as the
// numbers sweep route, for the same reason.
function isValidCronSecret(provided) {
  const expected = process.env.CRON_SECRET
  if (!provided || !expected) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function hoursSince(dateStr) {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60)
}

async function refundStuckJob(admin, job, reason) {
  return admin.rpc('boost_settle', {
    p_job_id: job.id,
    p_status: 'failed',
    p_refund: job.price_ngn,
    p_error: reason,
  })
}

export async function POST(request) {
  const secret = request.headers.get('x-cron-secret')
  if (!isValidCronSecret(secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getAdminClient()
  const now = new Date().toISOString()

  const counts = {
    checked: 0, completed: 0, partial: 0, canceled: 0, stillOpen: 0,
    unresolved: 0, autoRefunded: 0, refundErrors: 0,
  }
  const failures = []

  // ── PASS 1: active jobs with a provider order id to actually check ──
  const { data: jobs, error } = await admin
    .from('boost_jobs')
    .select('id, provider, provider_order_id, price_ngn, quantity, created_at')
    .eq('status', 'submitted')
    .not('provider_order_id', 'is', null)

  if (error) {
    return NextResponse.json({ error: 'Could not load open jobs' }, { status: 500 })
  }
  counts.checked = jobs?.length || 0

  const byProvider = { jap: [], exobooster: [] }
  for (const job of jobs || []) byProvider[job.provider]?.push(job)

  for (const providerKey of Object.keys(byProvider)) {
    const providerJobs = byProvider[providerKey]
    if (!providerJobs.length) continue

    const statusMap = await getStatuses(providerKey, providerJobs.map(j => j.provider_order_id))

    for (const job of providerJobs) {
      const result = statusMap.get(String(job.provider_order_id))
      const stuck = hoursSince(job.created_at) >= STUCK_JOB_TIMEOUT_HOURS

      if (!result || !result.ok) {
        // Couldn't confirm this job's status this round. Leave as
        // 'submitted' for the next sweep to retry — UNLESS it's been
        // stuck past the timeout, in which case waiting longer isn't
        // actually the safe choice anymore.
        if (stuck) {
          const { error: settleError } = await refundStuckJob(
            admin, job,
            `Could not confirm status after ${STUCK_JOB_TIMEOUT_HOURS}h (last error: ${result?.message || 'unknown'}) — auto-refunded.`
          )
          if (settleError) { failures.push({ jobId: job.id, message: settleError.message }); counts.refundErrors++ }
          else counts.autoRefunded++
        } else {
          counts.unresolved++
          if (result?.message) failures.push({ jobId: job.id, message: result.message })
        }
        continue
      }

      if (result.state === 'open') {
        await admin
          .from('boost_jobs')
          .update({ provider_status: result.rawStatus, last_synced_at: now, updated_at: now })
          .eq('id', job.id)
        counts.stillOpen++
        continue
      }

      if (result.state === 'unknown') {
        if (stuck) {
          const { error: settleError } = await refundStuckJob(
            admin, job,
            `Provider status "${result.rawStatus}" never resolved after ${STUCK_JOB_TIMEOUT_HOURS}h — auto-refunded.`
          )
          if (settleError) { failures.push({ jobId: job.id, message: settleError.message }); counts.refundErrors++ }
          else counts.autoRefunded++
        } else {
          await admin
            .from('boost_jobs')
            .update({
              status: 'needs_review',
              provider_status: result.rawStatus,
              error: `Unrecognized provider status: "${result.rawStatus}"`,
              last_synced_at: now,
              updated_at: now,
            })
            .eq('id', job.id)
          counts.unresolved++
        }
        continue
      }

      // Terminal states: completed, partial, canceled.
      let refund = 0
      if (result.state === 'canceled') {
        refund = job.price_ngn
      } else if (result.state === 'partial') {
        const remains = Number(result.remains) || 0
        const quantity = Number(job.quantity) || 0
        // Pricing here is strictly linear (rate x quantity), so this
        // proportional refund is exact — not an approximation.
        refund = quantity > 0 ? Math.round(job.price_ngn * (remains / quantity)) : 0
        refund = clamp(refund, 0, job.price_ngn)
      }

      const { error: settleError } = await admin.rpc('boost_settle', {
        p_job_id: job.id,
        p_status: result.state,
        p_refund: refund,
        p_provider_status: result.rawStatus,
        p_charge_usd: result.chargeUsd,
      })

      if (settleError) {
        failures.push({ jobId: job.id, message: settleError.message })
        counts.refundErrors++
        continue
      }

      if (result.state === 'completed') counts.completed++
      else if (result.state === 'partial') counts.partial++
      else if (result.state === 'canceled') counts.canceled++
    }
  }

  // ── PASS 2: jobs with nothing left to check at all ──
  // 'needs_review' jobs that never got a provider order id in the first
  // place (the original add-order call itself timed out) have no status
  // to look up, ever. Age past the timeout is the only signal available —
  // same situation as "uncheckable" orders in the old numbers-era function.
  const { data: stale, error: staleError } = await admin
    .from('boost_jobs')
    .select('id, price_ngn, created_at')
    .eq('status', 'needs_review')
    .is('provider_order_id', null)

  if (!staleError) {
    for (const job of stale || []) {
      if (hoursSince(job.created_at) < STUCK_JOB_TIMEOUT_HOURS) continue
      const { error: settleError } = await refundStuckJob(
        admin, job,
        `No provider order id was ever recorded — auto-refunded after ${STUCK_JOB_TIMEOUT_HOURS}h with no way to check status.`
      )
      if (settleError) { failures.push({ jobId: job.id, message: settleError.message }); counts.refundErrors++ }
      else counts.autoRefunded++
    }
  }

  return NextResponse.json({ ...counts, failures: failures.length ? failures : undefined })
}