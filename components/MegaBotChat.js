'use client'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

const STARTER_PROMPTS = [
  'Why was my order cancelled?',
  'How do I fund my wallet?',
  'How does referral earning work?',
]

export default function MegaBotChat({ onBack, onClose }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hey! I'm MegaBot 👋 Ask me anything about your orders, wallet, subscriptions, or how to use MegaDen." }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef(null)
  const supabase = createClient()

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  async function send(text) {
    const content = (text ?? input).trim()
    if (!content || loading) return

    const nextMessages = [...messages, { role: 'user', content }]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch('/api/support-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok) throw new Error('Support chat request failed')
      const data = await res.json()

      setMessages(m => [...m, { role: 'assistant', content: data.reply }])
    } catch (err) {
      setMessages(m => [...m, {
        role: 'assistant',
        content: "Sorry, I'm having trouble responding right now. You can reach our team on WhatsApp instead.",
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.7rem',
        padding: '1rem 1.1rem', borderBottom: '1px solid var(--border)',
        background: 'linear-gradient(135deg, #7c5cf5, #5a3ce0)', flexShrink: 0,
      }}>
        <button onClick={onBack} aria-label="Back" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
          <ChevronLeft />
        </button>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          🤖
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>MegaBot</div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.8)' }}>{loading ? 'typing…' : 'online'}</div>
        </div>
        <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#fff' }}>✕</button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', background: 'var(--card)' }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '80%',
            background: m.role === 'user' ? 'linear-gradient(135deg, #7c5cf5, #5a3ce0)' : 'var(--navy2)',
            color: m.role === 'user' ? '#fff' : 'var(--text)',
            border: m.role === 'user' ? 'none' : '1px solid var(--border)',
            padding: '0.6rem 0.85rem',
            borderRadius: 14,
            borderBottomRightRadius: m.role === 'user' ? 4 : 14,
            borderBottomLeftRadius: m.role === 'assistant' ? 4 : 14,
            fontSize: '0.85rem',
            lineHeight: 1.45,
            whiteSpace: 'pre-wrap',
          }}>
            {m.content}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', color: 'var(--muted)', fontSize: '0.8rem', padding: '0.4rem 0.2rem' }}>
            MegaBot is typing…
          </div>
        )}

        {messages.length === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.4rem' }}>
            {STARTER_PROMPTS.map(p => (
              <button key={p} onClick={() => send(p)} style={{
                textAlign: 'left', background: 'var(--navy2)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '0.55rem 0.75rem', fontSize: '0.78rem', color: 'var(--text)', cursor: 'pointer',
              }}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: '0.5rem', padding: '0.8rem', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send() }}
          placeholder="Type your question…"
          style={{
            flex: 1, background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: 10,
            padding: '0.6rem 0.8rem', color: 'var(--text)', fontSize: '0.85rem', outline: 'none',
          }}
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          style={{
            background: 'linear-gradient(135deg, #7c5cf5, #5a3ce0)', border: 'none', borderRadius: 10,
            width: 40, color: '#fff', cursor: loading ? 'default' : 'pointer', opacity: loading || !input.trim() ? 0.6 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <SendIcon />
        </button>
      </div>
    </div>
  )
}

function ChevronLeft() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
}
function SendIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
}