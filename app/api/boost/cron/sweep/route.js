// app/api/boost/cron/sweep/route.js
//
// Called by the Supabase Edge Function (supabase/functions/boost-status-sync)
// on a schedule, the same pattern as app/api/numbers/cron/sweep: not
// user-facing, protected by a shared secret rather than a user session,
// and the edge function is deliberately a thin trigger — all the actual
// sync/settle logic lives here, in one place.
//
// Closes the loop on every boost order. Passes:
//
// PASS 1 — jobs still 'submitted' with a known provider order id: check
// real status and settle terminal outcomes.
//   completed  -> boost_settle('completed', refund 0)
//   canceled   -> boost_settle('canceled', refund in FULL)
//   partial    -> boost_settle('partial', refund proportional to what's
//                 still missing — pricing here is strictly linear
//                 (rate x quantity), so this refund is exact)
//   still open -> just record the provider's raw status, no state change
//   unrecognized / unreachable -> left as 'submitted' so the NEXT sweep
//                 tries again; never guessed into a refund on the spot
//
// PASS 2 — the safety net: a job stuck for STUCK_JOB_TIMEOUT_HOURS with no
// resolution is auto-refunded in full rather than left to check forever.
//
// PASS 3 — jobs stranded in 'debited' (the wallet was charged but the
// provider call never recorded an outcome, e.g. the serverless function
// died mid-request). We cannot know whether the provider received the
// order, so they are moved to 'needs_review' and logged loudly — never
// refunded or retried automatically.
//
// PASS 4 — provider wallet balance check, logged as a warning when low (at
// most once per LOW_BALANCE_LOG_COOLDOWN_HOURS per provider), so an empty
// provider account is noticed before customers hit "Not enough funds".
//
// Everything noteworthy is written to the admin Logs page (category 'boost').

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { getAdminClient } from '@/lib/boost/supabase-admin'
import { getStatuses, getBalance, PROVIDER_KEYS } from '@/lib/boost/providers'
import { log } from '@/lib/logger'

const STUCK_JOB_TIMEOUT_HOURS = 168

// A job should leave 'debited' within seconds. Anything older than this is
// stranded.
const DEBITED_STRANDED_MINUTES = 15

// Provider balances are in the provider's own currency (USD for both JAP
// and Exobooster). Override with BOOST_LOW_BALANCE_THRESHOLD in Vercel.
const LOW_BALANCE_THRESHOLD = Number(process.env.BOOST_LOW_BALANCE_THRESHOLD) || 2
const LOW_BALANCE_LOG_COOLDOWN_HOURS = 6

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

async function checkProviderBalances(admin) {
  for (const providerKey of PROVIDER_KEYS) {
    const r = await getBalance(providerKey)

    if (!r.ok) {
      // A missing key is a setup problem worth knowing about; a transient
      // network failure is not worth a log line every 5 minutes.
      if (r.kind === 'config') {
        await logOncePerCooldown(admin, `Boost provider ${providerKey} is not configured`, 'error', {
          provider: providerKey, message: r.message,
        })
      }
      continue
    }

    if (r.balance < LOW_BALANCE_THRESHOLD) {
      await logOncePerCooldown(
        admin,
        `Low ${providerKey} balance: ${r.balance}${r.currency ? ' ' + r.currency : ''} — fund the provider account or boosts will fail`,
        'warning',
        { provider: providerKey, balance: r.balance, currency: r.currency, threshold: LOW_BALANCE_THRESHOLD },
        `Low ${providerKey} balance%`
      )
    }
  }
}

// Writes a log line unless an equivalent one was already written recently.
async function logOncePerCooldown(admin, message, level, context, likePattern) {
  const since = new Date(Date.now() - LOW_BALANCE_LOG_COOLDOWN_HOURS * 3600 * 1000).toISOString()
  const { data: recent } = await admin
    .from('logs')
    .select('id')
    .eq('category', 'boost')
    .eq('level', level)
    .like('message', likePattern || message)
    .gte('created_at', since)
    .limit(1)

  if (recent && recent.length > 0) return
  await log(level, 'boost', message, null, null, context)
}

export async function POST(request) {
  const secret = request.headers.get('x-cron-secret')
  if (!isValidCronSecret(secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    return await runSweep()
  } catch (err) {
    console.error('[boost/sweep]', err)
    await log('error', 'boost', `Boost sweep crashed: ${err.message}`, null, null, { stack: err.stack })
    return NextResponse.json({ error: 'Sweep failed' }, { status: 500 })
  }
}

async function runSweep() {
  const admin = getAdminClient()
  const now = new Date().toISOString()

  const counts = {
    checked: 0, completed: 0, partial: 0, canceled: 0, stillOpen: 0,
    unresolved: 0, autoRefunded: 0, refundErrors: 0, stranded: 0,
  }
  const failures = []

  // ── PASS 1: active jobs with a provider order id to actually check ──
  const { data: jobs, error } = await admin
    .from('boost_jobs')
    .select('id, provider, provider_order_id, price_ngn, quantity, created_at')
    .eq('status', 'submitted')
    .not('provider_order_id', 'is', null)

  if (error) {
    await log('error', 'boost', `Boost sweep could not load open jobs: ${error.message}`, null, null, {})
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
        if (stuck) {
          const { error: settleError } = await refundStuckJob(
            admin, job,
            `Could not confirm status after ${STUCK_JOB_TIMEOUT_HOURS}h (last error: ${result?.message || 'unknown'}) — auto-refunded.`
          )
          if (settleError) {
            failures.push({ jobId: job.id, message: settleError.message }); counts.refundErrors++
            await log('error', 'boost', `CRITICAL: auto-refund of stuck boost job failed: ${settleError.message}`, null, null, { job_id: job.id, provider: providerKey })
          } else {
            counts.autoRefunded++
            await log('warning', 'boost', `Boost job auto-refunded after ${STUCK_JOB_TIMEOUT_HOURS}h — status could not be confirmed`, null, null, { job_id: job.id, provider: providerKey, provider_order_id: job.provider_order_id, last_error: result?.message })
          }
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
          if (settleError) {
            failures.push({ jobId: job.id, message: settleError.message }); counts.refundErrors++
            await log('error', 'boost', `CRITICAL: auto-refund of stuck boost job failed: ${settleError.message}`, null, null, { job_id: job.id, provider: providerKey })
          } else {
            counts.autoRefunded++
            await log('warning', 'boost', `Boost job auto-refunded after ${STUCK_JOB_TIMEOUT_HOURS}h — provider status "${result.rawStatus}" never resolved`, null, null, { job_id: job.id, provider: providerKey, provider_order_id: job.provider_order_id })
          }
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
          await log('error', 'boost', `Boost job has an unrecognized provider status "${result.rawStatus}" — needs review (add it to STATE_BY_RAW in lib/boost/providers.js)`, null, null, { job_id: job.id, provider: providerKey, provider_order_id: job.provider_order_id, raw_status: result.rawStatus })
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
        await log('error', 'boost', `CRITICAL: could not settle boost job as ${result.state}: ${settleError.message}`, null, null, { job_id: job.id, provider: providerKey, provider_order_id: job.provider_order_id, refund_ngn: refund })
        continue
      }

      if (result.state === 'completed') counts.completed++
      else if (result.state === 'partial') counts.partial++
      else if (result.state === 'canceled') counts.canceled++

      await log(
        result.state === 'completed' ? 'info' : 'warning',
        'boost',
        `Boost job ${result.state} on ${providerKey}${refund > 0 ? ` — refunded ₦${refund.toLocaleString('en-US')}` : ''}`,
        null, null,
        { job_id: job.id, provider: providerKey, provider_order_id: job.provider_order_id, state: result.state, refund_ngn: refund, remains: result.remains }
      )
    }
  }

  // ── PASS 2: needs_review jobs that never got a provider order id ──
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
      if (settleError) {
        failures.push({ jobId: job.id, message: settleError.message }); counts.refundErrors++
        await log('error', 'boost', `CRITICAL: auto-refund of stale boost job failed: ${settleError.message}`, null, null, { job_id: job.id })
      } else {
        counts.autoRefunded++
        await log('warning', 'boost', `Boost job auto-refunded after ${STUCK_JOB_TIMEOUT_HOURS}h — no provider order id was ever recorded`, null, null, { job_id: job.id })
      }
    }
  }

  // ── PASS 3: jobs stranded in 'debited' ──
  const strandedBefore = new Date(Date.now() - DEBITED_STRANDED_MINUTES * 60 * 1000).toISOString()
  const { data: strandedJobs, error: strandedError } = await admin
    .from('boost_jobs')
    .select('id, provider, user_id, price_ngn, created_at')
    .eq('status', 'debited')
    .is('provider_order_id', null)
    .lt('created_at', strandedBefore)

  if (!strandedError) {
    for (const job of strandedJobs || []) {
      const { error: moveError } = await admin
        .from('boost_jobs')
        .update({
          status: 'needs_review',
          error: 'Stranded in debited state — the provider call has no recorded outcome. Check the provider order history before refunding.',
          updated_at: now,
        })
        .eq('id', job.id)
        .eq('status', 'debited')

      if (moveError) {
        failures.push({ jobId: job.id, message: moveError.message })
        continue
      }
      counts.stranded++
      await log('error', 'boost', `CRITICAL: customer was charged but the boost order has no recorded outcome — check ${job.provider} order history, then refund or resubmit`, job.user_id, null, {
        job_id: job.id, provider: job.provider, amount_ngn: job.price_ngn, created_at: job.created_at,
      })
    }
  }

  // ── PASS 4: provider wallet balances ──
  try {
    await checkProviderBalances(admin)
  } catch (err) {
    console.error('[boost/sweep] balance check failed', err)
  }

  // One summary line per sweep that actually did something — not one every
  // five minutes of nothing.
  const didSomething = counts.completed + counts.partial + counts.canceled + counts.autoRefunded + counts.refundErrors + counts.stranded > 0
  if (didSomething) {
    await log(counts.refundErrors > 0 ? 'error' : 'info', 'boost', 'Boost sweep finished', null, null, { ...counts, failures: failures.length ? failures : undefined })
  }

  return NextResponse.json({ ...counts, failures: failures.length ? failures : undefined })
}