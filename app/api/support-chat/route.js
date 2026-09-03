// app/api/support-chat/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // server-only key, never exposed to client
)

const CORE_IDENTITY = `You are MegaBot, the official support assistant for MegaDen Exchange.

HOW YOU SPEAK
Professional and polished — the tone of a well-run fintech support desk. Clear, precise, courteous. No slang, no excessive casualness, no emoji spam (an occasional single emoji is fine if it fits naturally, never forced).

You don't open with hollow filler like "Great question!" or "Certainly!" — you just answer, cleanly and directly. You're warm without being chatty: efficient, but never curt or robotic. Think of a support agent at a bank or a serious payments company — someone a user trusts with their money and account.

You don't apologise excessively. If something's genuinely your limitation (a policy you don't have data for, an issue you can't resolve), you say so plainly, once, and point the user to a human channel — you don't grovel about it.

WHAT YOU KNOW
You are MegaDen Exchange's support assistant, not a general-purpose assistant. Stay focused on the app, the user's account, and how to use MegaDen's services. If asked something entirely unrelated to MegaDen, politely redirect back to what you can actually help with.

You never reveal your underlying model or technology.`;

const WHAT_MEGADEN_OFFERS = `WHAT MEGADEN EXCHANGE OFFERS (Quick Services + Our Services in the app):
- Foreign Numbers: temporary/virtual phone numbers from USA, UK, Canada & 40+ countries, mainly used for SMS/OTP verification on other platforms (e.g. WhatsApp, Facebook).
- Digital Subscriptions: accounts/access for services like Spotify, Netflix, Canva, ChatGPT, and others.
- VPN Subscriptions: VPN access plans (e.g. NordVPN, ExpressVPN — [FILL IN: which providers you actually resell] ).
- Account Boosting: growing a user's following/engagement on social platforms. Two tiers: **Turbo Boost** (fastest delivery, premium quality — Instagram, TikTok, Facebook, YouTube, Telegram) and **Standard Boost** (wider coverage, steadier delivery — Instagram, TikTok, Twitter/X, Facebook, YouTube, Telegram, Spotify, Snapchat). Users pick a platform, then a package (preset quantity or a custom amount within a min/max range), paste their profile/post link, and pay from wallet. The profile or post must be public before ordering.
- Fund Wallet: users top up an in-app wallet balance, which is then used to pay for orders.
- Buy Number: shortcut into the Foreign Numbers flow.
- Top-Up & Bills: airtime, data, TV, electricity, exam pins — bill payment services.
- Refer & Earn: users share a referral link/code; when a friend signs up and makes their first purchase, the referrer earns ₦500 per referral. No cap on total referral earnings — the more people referred, the more earned.
- View History / Orders: users can see past orders and their status (pending, completed, expired, or cancelled).

HOW THE APP WORKS, GENERALLY:
- Users fund their wallet first, then pay for services (numbers, subscriptions, VPN, bills) from that balance.
- For Foreign Numbers specifically: an order starts as "pending". It becomes "completed" once an SMS/OTP arrives. If no SMS arrives within 20 minutes, it automatically becomes "expired" and the wallet is refunded. If the user manually cancels before an SMS arrives, it becomes "cancelled" and the wallet is refunded. If no number is available for the requested country at purchase time, the wallet is refunded immediately and no order is created at all.
- Refund policy: refunds (for expired or cancelled number orders) are automatic — credited straight back to the user's wallet as a transaction. The user doesn't need to request it.`;

const RULES = `WHAT YOU PROTECT
- Answer questions about how to use ANY part of the app above — not just orders/wallet.
- If account-specific data is provided below (orders, balance), use it directly to answer — don't ask the user to go check their dashboard if you already have the answer.
- If a question needs a policy detail marked [FILL IN] above that you don't actually have, say you're not certain and offer to connect them to a human agent via WhatsApp Support — don't guess.
- If you don't have enough information to answer (billing disputes, refund requests, suspected fraud, or anything outside what you know), say so plainly and offer WhatsApp Support.
- Never invent order details, prices, or policies you don't have data for.
- Keep replies under ~120 words unless the user asks for a detailed walkthrough.`;

// --- Free-tier model chain (same engine as ARCHER): Groq first, Gemini
// second, OpenRouter last resort. No Anthropic key needed. ---
const GROQ_API_KEY = process.env.GROQ_API_KEY ?? ''
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? ''
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? ''

const MODEL_CHAIN = [
  { provider: 'groq', model: 'llama-3.3-70b-versatile' },
  { provider: 'groq', model: 'gemma2-9b-it' },
  { provider: 'gemini', model: 'gemini-2.5-flash' },
  { provider: 'openrouter', model: 'google/gemma-4-31b-it:free' },
]

function buildProviderRequest(config, systemPrompt, messages) {
  if (config.provider === 'groq') {
    return {
      url: 'https://api.groq.com/openai/v1/chat/completions',
      options: {
        method: 'POST',
        headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
          max_tokens: 500,
          temperature: 0.6,
          stream: false,
        }),
      },
    }
  }

  if (config.provider === 'gemini') {
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${GEMINI_API_KEY}`,
      options: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { maxOutputTokens: 500, temperature: 0.6 },
        }),
      },
    }
  }

  // OpenRouter (fallback)
  return {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    options: {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://megaden.exchange', // adjust to your real domain
        'X-Title': 'MegaBot - MegaDen Exchange',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        max_tokens: 500,
        temperature: 0.6,
        stream: false,
      }),
    },
  }
}

function extractReply(provider, data) {
  if (provider === 'gemini') {
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
  }
  return data?.choices?.[0]?.message?.content?.trim() ?? ''
}

// Strip stray reasoning/thinking tags some free-tier models leak into output
function cleanReply(reply) {
  return reply
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<\|thinking\|>[\s\S]*?<\|\/thinking\|>/gi, '')
    .trim()
}

// Reject empty or broken output so the chain falls through to the next provider
function passesQualityGuard(reply) {
  if (!reply || typeof reply !== 'string') return false
  const trimmed = reply.trim()
  if (trimmed.length === 0) return false
  const brokenPatterns = [/^(error|undefined|null)$/i, /<\|.*\|>/, /^as an ai language model/i]
  return !brokenPatterns.some(p => p.test(trimmed))
}

async function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const r = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timer)
    return r
  } catch (e) {
    clearTimeout(timer)
    throw e
  }
}

async function callModelChain(systemPrompt, messages) {
  for (const config of MODEL_CHAIN) {
    try {
      const { url, options } = buildProviderRequest(config, systemPrompt, messages)
      const res = await fetchWithTimeout(url, options, 15000)
      if (!res.ok) {
        console.error(`${config.provider}/${config.model} failed: ${res.status}`)
        continue
      }
      const data = await res.json()
      const reply = cleanReply(extractReply(config.provider, data))
      if (passesQualityGuard(reply)) return reply
      console.error(`${config.provider}/${config.model} failed quality guard`)
    } catch (e) {
      console.error(`${config.provider}/${config.model} threw:`, e)
    }
  }
  return null
}

export async function POST(req) {
  try {
    const { messages } = await req.json()
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 })
    }

    // --- Identify the user (if logged in) so we can pull account context ---
    let userId = null
    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      const { data, error } = await supabaseAdmin.auth.getUser(token)
      if (!error && data?.user) userId = data.user.id
    }

    let accountContext = ''
    if (userId) {
      accountContext = await getAccountContext(userId)
    }

    const systemPrompt = accountContext
      ? [CORE_IDENTITY, WHAT_MEGADEN_OFFERS, RULES, `Current user's account data (use this to answer directly):\n${accountContext}`].join('\n\n')
      : [CORE_IDENTITY, WHAT_MEGADEN_OFFERS, RULES, "The user is not logged in, or account data isn't available — answer general questions only, and if they ask about their own orders/balance, ask them to make sure they're logged in."].join('\n\n')

    const reply = await callModelChain(systemPrompt, messages.slice(-12))

    if (!reply) {
      return NextResponse.json({
        reply: "Sorry, I'm having trouble responding right now. You can reach our team on WhatsApp instead.",
      })
    }

    // Fire-and-forget conversation logging (don't block the response on it)
    logConversation(userId, messages, reply).catch(e => console.error('log error', e))

    return NextResponse.json({ reply })
  } catch (err) {
    console.error('support-chat error:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}

// --- Pull the bits of account data MegaBot is allowed to reference. ---
// Adjust table/column names to match your actual Supabase schema.
async function getAccountContext(userId) {
  const parts = []

  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('wallet_balance')
      .eq('id', userId)
      .single()
    if (profile) parts.push(`Wallet balance: ₦${profile.wallet_balance ?? 0}`)
  } catch (e) { /* table may not exist yet under this name */ }

  try {
    const { data: transactions } = await supabaseAdmin
      .from('transactions')
      .select('type, amount, description, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)
    if (transactions?.length) {
      parts.push('Recent wallet transactions:\n' + transactions.map(t =>
        `- ${t.type === 'credit' ? '+' : '-'}₦${t.amount} — ${t.description} — ${t.status} (${new Date(t.created_at).toLocaleDateString()})`
      ).join('\n'))
    }
  } catch (e) { /* table may not exist yet under this name */ }

  try {
    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('id, product_name, product_type, status, amount, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)
    if (orders?.length) {
      parts.push('Recent orders:\n' + orders.map(o =>
        `- ${o.product_name || 'Order'} (${o.product_type || 'service'}) — ₦${o.amount} — ${o.status} (${new Date(o.created_at).toLocaleDateString()})`
      ).join('\n'))
    }
  } catch (e) { /* table may not exist yet under this name */ }

  return parts.join('\n\n') || 'No account data found.'
}

async function logConversation(userId, messages, reply) {
  await supabaseAdmin.from('support_conversations').insert({
    user_id: userId,
    last_user_message: messages[messages.length - 1]?.content ?? '',
    bot_reply: reply,
  })
}