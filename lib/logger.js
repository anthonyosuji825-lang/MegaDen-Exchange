// lib/logger.js
// Central logging utility — writes to Supabase `logs` table
// Usage: await log(supabaseAdmin, 'error', 'number', 'message', userId, userEmail, { ...context })

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * @param {'error'|'warning'|'info'|'auth'|'admin'} level
 * @param {'number'|'boost'|'vpn'|'wallet'|'auth'|'admin'|'system'} category
 * @param {string} message
 * @param {string|null} userId
 * @param {string|null} userEmail
 * @param {object} context
 */
export async function log(level, category, message, userId = null, userEmail = null, context = {}) {
  try {
    await supabaseAdmin.from('logs').insert({
      level,
      category,
      message,
      user_id: userId,
      user_email: userEmail,
      context,
    })
  } catch (err) {
    // Never let logging crash the app
    console.error('[Logger] Failed to write log:', err)
  }
}