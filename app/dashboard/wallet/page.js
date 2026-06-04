'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import LoadingScreen from '@/component/LoadingScreen'

export default function Wallet() {
  const [profile, setProfile] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState('')
  const [payMethod, setPayMethod] = useState(null)
  const [funding, setFunding] = useState(false)
  const [success, setSuccess] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [balanceHidden, setBalanceHidden] = useState(false)

  useEffect(() => {
    setMounted(true)
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(profileData)
      const { data: txData } = await supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10)
      setTransactions(txData || [])
      setLoading(false)
    }
    load()
  }, [])

  const quickAmounts = [500, 1000, 2000, 5000, 10000, 20000]

  const handleFund = async () => {
    if (!amount || !payMethod || Number(amount) < 100) return
    setFunding(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setFunding(false); return }
    const amountInKobo = Number(amount) * 100
    const reference = `WALLET-${Date.now()}-${user.id.slice(0, 8)}`
    try {
      if (!window.PaystackPop) {
        alert('Payment system is loading. Please try again in a moment.')
        setFunding(false)
        return
      }
      const handler = window.PaystackPop.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
        email: profile?.email,
        amount: amountInKobo,
        currency: 'NGN',
        ref: reference,
        onClose: function() { setFunding(false) },
        callback: async function(response) {
          if (response.status === 'success') {
            // Wait a moment for webhook to process
            await new Promise(resolve => setTimeout(resolve, 2000))
            // Re-fetch updated balance from DB (webhook has credited it)
            const supabaseInner = createClient()
            const { data: updatedProfile } = await supabaseInner
              .from('profiles')
              .select('wallet_balance')
              .eq('id', user.id)
              .single()
            setProfile(p => ({ ...p, wallet_balance: updatedProfile?.wallet_balance || p.wallet_balance }))
            // Re-fetch transactions
            const { data: txData } = await supabaseInner
              .from('transactions')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(10)
            setTransactions(txData || [])
            setFunding(false)
            setSuccess(true)
          } else {
            setFunding(false)
          }
        }
      })
      handler.openIframe()
    } catch (err) {
      console.error('Paystack error:', err)
      setFunding(false)
    }
  }

  if (loading) return <LoadingScreen />

  return (
    <main style={{ background: 'var(--navy)', minHeight: '100vh', paddingBottom: '2rem' }}>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes successPop {
          0% { transform: scale(0); opacity: 0; }
          70% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .amount-chip { transition: transform 0.15s, background 0.15s, border-color 0.15s, color 0.15s; cursor: pointer; }
        .amount-chip:hover { transform: translateY(-2px); }
        .pay-card { transition: transform 0.18s, border-color 0.18s, background 0.18s, box-shadow 0.18s; cursor: pointer; }
        .pay-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
        .fund-btn { transition: transform 0.18s, box-shadow 0.18s; cursor: pointer; }
        .fund-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(108,78,242,0.4); }
        .back-btn { transition: background 0.18s, transform 0.18s; }
        .back-btn:hover { background: var(--card2) !important; transform: translateX(-2px); }
        .amount-input:focus { border-color: var(--purple) !important; box-shadow: 0 0 0 3px rgba(108,78,242,0.12); }
      `}</style>

      {/* HEADER */}
      <div style={{ padding: '1.1rem 1.4rem', display: 'flex', alignItems: 'center', gap: '0.9rem', position: 'sticky', top: 0, zIndex: 100, background: 'var(--navy)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/dashboard" className="back-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '10px', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', textDecoration: 'none' }}>
          <BackIcon />
        </Link>
        <div style={{ animation: mounted ? 'fadeSlideIn 0.4s ease' : 'none' }}>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>My Wallet</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Fund your account and view transactions</div>
        </div>
      </div>

      <div style={{ padding: '1.2rem 1.4rem' }}>

        {/* BALANCE CARD */}
        <div style={{ borderRadius: '22px', padding: '1.6rem 1.5rem', background: 'linear-gradient(135deg, #1a0a5e 0%, #6c4ef2 55%, #c0781a 100%)', marginBottom: '1.4rem', position: 'relative', overflow: 'hidden', animation: mounted ? 'fadeSlideIn 0.4s ease' : 'none' }}>
          <div style={{ position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ position: 'absolute', bottom: -40, left: -20, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)', letterSpacing: '0.5px', marginBottom: '0.4rem' }}>Available Balance</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.5rem' }}>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2.2rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
              {balanceHidden ? '₦ ••••••' : `₦${(profile?.wallet_balance || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`}
            </div>
            <button onClick={() => setBalanceHidden(!balanceHidden)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              {balanceHidden ? <EyeIcon /> : <EyeOffIcon />}
            </button>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)' }}>
            {profile?.full_name} · MegaDen Exchange
          </div>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', animation: 'fadeSlideIn 0.4s ease' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(29,158,117,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.2rem', color: '#34d399', animation: 'successPop 0.5s cubic-bezier(0.175,0.885,0.32,1.275)' }}>
              <CheckIcon size={36} />
            </div>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.3rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.4rem' }}>Wallet Funded!</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>Your wallet has been credited successfully.</div>
            <div style={{ display: 'inline-block', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.8rem 1.4rem', margin: '0 0 1.5rem', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.1rem', color: 'var(--gold)' }}>
              +₦{Number(amount).toLocaleString()}
            </div>
            <br />
            <button onClick={() => { setSuccess(false); setAmount(''); setPayMethod(null) }} className="fund-btn"
              style={{ padding: '0.75rem 1.8rem', background: 'var(--purple)', color: '#fff', border: 'none', borderRadius: '12px', fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' }}>
              Fund Again
            </button>
          </div>
        ) : (
          <>
            {/* AMOUNT */}
            <div style={{ marginBottom: '1.5rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.1s both' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.9rem' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#fff' }}>1</div>
                <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>Enter Amount</span>
              </div>
              <div style={{ position: 'relative', marginBottom: '0.8rem' }}>
                <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '1rem' }}>₦</span>
                <input className="amount-input" type="number" placeholder="0.00" value={amount}
                  onChange={e => setAmount(e.target.value)}
                  style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.2rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)', fontSize: '1.1rem', fontFamily: 'Outfit, sans-serif', fontWeight: 700, outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {quickAmounts.map((a, i) => (
                  <button key={a} className="amount-chip" onClick={() => setAmount(String(a))}
                    style={{ padding: '0.55rem', background: Number(amount) === a ? 'rgba(108,78,242,0.15)' : 'var(--card)', border: `1px solid ${Number(amount) === a ? 'var(--purple)' : 'var(--border)'}`, borderRadius: '10px', color: Number(amount) === a ? 'var(--purple2)' : 'var(--muted)', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'Outfit, sans-serif', animation: mounted ? `fadeSlideIn 0.3s ease ${0.05 * i}s both` : 'none' }}>
                    ₦{a.toLocaleString()}
                  </button>
                ))}
              </div>
              {amount && Number(amount) < 100 && (
                <div style={{ fontSize: '0.75rem', color: '#ff6b6b', marginTop: '0.5rem' }}>Minimum amount is ₦100</div>
              )}
            </div>

            {/* PAYMENT METHOD */}
            <div style={{ marginBottom: '1.5rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.15s both' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.9rem' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#fff' }}>2</div>
                <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>Payment Method</span>
                {payMethod && <span style={{ fontSize: '0.75rem', color: '#34d399', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><CheckIcon size={12} /> {payMethod}</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
                {[
                  { id: 'Paystack', color: '#00c3f7', desc: 'Card, Bank, USSD', icon: '💳' },
                  { id: 'Flutterwave', color: '#f5a623', desc: 'Card, Bank Transfer', icon: '🌊' },
                ].map(m => (
                  <button key={m.id} className="pay-card" onClick={() => setPayMethod(m.id)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem', padding: '1rem 1.1rem', background: payMethod === m.id ? `${m.color}12` : 'var(--card)', border: `1.5px solid ${payMethod === m.id ? m.color : 'var(--border)'}`, borderRadius: '14px', boxShadow: payMethod === m.id ? `0 4px 16px ${m.color}33` : 'none', transition: 'all 0.2s' }}>
                    <span style={{ fontSize: '1.5rem' }}>{m.icon}</span>
                    <div>
                      <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: payMethod === m.id ? m.color : 'var(--text)' }}>{m.id}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{m.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* FUND BUTTON */}
            <div style={{ animation: mounted ? 'fadeSlideIn 0.4s ease 0.2s both' : 'none' }}>
              <button onClick={handleFund} disabled={!amount || Number(amount) < 100 || !payMethod || funding} className="fund-btn"
                style={{ width: '100%', padding: '0.95rem', background: (!amount || Number(amount) < 100 || !payMethod) ? 'var(--card2)' : funding ? 'var(--purple2)' : 'var(--purple)', color: (!amount || Number(amount) < 100 || !payMethod) ? 'var(--muted)' : '#fff', border: '1px solid var(--border)', borderRadius: '12px', fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', transition: 'background 0.2s, color 0.2s' }}>
                {funding ? (
                  <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>Processing...</>
                ) : amount && Number(amount) >= 100 && payMethod ? `Fund ₦${Number(amount).toLocaleString()} via ${payMethod}` : 'Enter amount & select method'}
              </button>
            </div>
          </>
        )}

        {/* TRANSACTION HISTORY */}
        <div style={{ marginTop: '2rem', animation: mounted ? 'fadeSlideIn 0.4s ease 0.25s both' : 'none' }}>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', marginBottom: '0.9rem' }}>Transaction History</div>
          {transactions.length === 0 ? (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '2rem', textAlign: 'center' }}>
              <div style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>No transactions yet.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {transactions.map(tx => (
                <div key={tx.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '0.85rem 1.1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '10px', background: tx.type === 'credit' ? 'rgba(29,158,117,0.1)' : 'rgba(220,50,50,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: tx.type === 'credit' ? '#34d399' : '#ff6b6b' }}>
                      {tx.type === 'credit' ? <ArrowDownIcon /> : <ArrowUpIcon />}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 500, color: 'var(--text)' }}>{tx.description}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{new Date(tx.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: tx.type === 'credit' ? '#34d399' : '#ff6b6b' }}>
                    {tx.type === 'credit' ? '+' : '-'}₦{tx.amount?.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  )
}

function BackIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
}
function CheckIcon({ size = 24 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
}
function EyeIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
}
function EyeOffIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
}
function ArrowDownIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
}
function ArrowUpIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
}