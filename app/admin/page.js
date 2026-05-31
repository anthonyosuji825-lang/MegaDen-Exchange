'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function AdminPanel() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [mounted, setMounted] = useState(false)

  // Data
  const [stats, setStats] = useState({ users: 0, orders: 0, revenue: 0, pending: 0 })
  const [users, setUsers] = useState([])
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [vpnKeys, setVpnKeys] = useState([])

  // Product form
  const [showProductForm, setShowProductForm] = useState(false)
  const [productForm, setProductForm] = useState({ name: '', category: 'number', price: '', description: '', country: '', platform: '', stock: '' })
  const [savingProduct, setSavingProduct] = useState(false)

  // VPN key form
  const [showVpnForm, setShowVpnForm] = useState(false)
  const [vpnForm, setVpnForm] = useState({ provider: 'NordVPN', plan: '1 Month', key: '' })
  const [savingVpn, setSavingVpn] = useState(false)
  const [vpnBulk, setVpnBulk] = useState('')

  // Balance edit
  const [editingBalance, setEditingBalance] = useState(null)
  const [newBalance, setNewBalance] = useState('')

  // Delivery
  const [deliveringOrder, setDeliveringOrder] = useState(null)
  const [deliveryKey, setDeliveryKey] = useState('')
  const [delivering, setDelivering] = useState(false)

  useEffect(() => {
    setMounted(true)
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
      if (!profile?.is_admin) { router.push('/dashboard'); return }
      setAuthorized(true)

      const [usersRes, ordersRes, productsRes, vpnRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('*').order('created_at', { ascending: false }),
        supabase.from('vpn_keys').select('*').order('created_at', { ascending: false }),
      ])

      const allUsers = usersRes.data || []
      const allOrders = ordersRes.data || []
      const allProducts = productsRes.data || []
      const allVpnKeys = vpnRes.data || []

      setUsers(allUsers)
      setOrders(allOrders)
      setProducts(allProducts)
      setVpnKeys(allVpnKeys)
      setStats({
        users: allUsers.length,
        orders: allOrders.length,
        revenue: allOrders.filter(o => o.status === 'completed').reduce((sum, o) => sum + (o.amount || 0), 0),
        pending: allOrders.filter(o => o.status === 'pending').length,
      })
      setLoading(false)
    }
    load()
  }, [router])

  const updateOrderStatus = async (orderId, status) => {
    const supabase = createClient()
    await supabase.from('orders').update({ status }).eq('id', orderId)
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o))
  }

  const updateBalance = async (userId) => {
    const supabase = createClient()
    await supabase.from('profiles').update({ wallet_balance: Number(newBalance) }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, wallet_balance: Number(newBalance) } : u))
    setEditingBalance(null)
    setNewBalance('')
  }

  const toggleBan = async (userId, currentStatus) => {
    const supabase = createClient()
    await supabase.from('profiles').update({ is_banned: !currentStatus }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_banned: !currentStatus } : u))
  }

  const saveProduct = async () => {
    setSavingProduct(true)
    const supabase = createClient()
    await supabase.from('products').insert({
      name: productForm.name, category: productForm.category,
      price: Number(productForm.price), description: productForm.description,
      country: productForm.country, platform: productForm.platform,
      stock: Number(productForm.stock) || 0, is_active: true,
    })
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false })
    setProducts(data || [])
    setSavingProduct(false)
    setShowProductForm(false)
    setProductForm({ name: '', category: 'number', price: '', description: '', country: '', platform: '', stock: '' })
  }

  const deleteProduct = async (id) => {
    const supabase = createClient()
    await supabase.from('products').delete().eq('id', id)
    setProducts(prev => prev.filter(p => p.id !== id))
  }

  const toggleProduct = async (id, current) => {
    const supabase = createClient()
    await supabase.from('products').update({ is_active: !current }).eq('id', id)
    setProducts(prev => prev.map(p => p.id === id ? { ...p, is_active: !current } : p))
  }

  const saveVpnKey = async () => {
    setSavingVpn(true)
    const supabase = createClient()
    const keys = vpnBulk
      ? vpnBulk.split('\n').map(k => k.trim()).filter(k => k.length > 0)
      : [vpnForm.key.trim()]

    const inserts = keys.map(k => ({
      provider: vpnForm.provider,
      plan: vpnForm.plan,
      key: k,
      is_used: false,
    }))

    await supabase.from('vpn_keys').insert(inserts)
    const { data } = await supabase.from('vpn_keys').select('*').order('created_at', { ascending: false })
    setVpnKeys(data || [])
    setSavingVpn(false)
    setShowVpnForm(false)
    setVpnForm({ provider: 'NordVPN', plan: '1 Month', key: '' })
    setVpnBulk('')
  }

  const deleteVpnKey = async (id) => {
    const supabase = createClient()
    await supabase.from('vpn_keys').delete().eq('id', id)
    setVpnKeys(prev => prev.filter(k => k.id !== id))
  }

  const deliverOrder = async (order) => {
    if (!deliveryKey.trim()) return
    setDelivering(true)
    const supabase = createClient()

    await supabase.from('orders').update({
      status: 'completed',
      details: { ...order.details, delivery_key: deliveryKey }
    }).eq('id', order.id)

    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'completed' } : o))
    setDeliveringOrder(null)
    setDeliveryKey('')
    setDelivering(false)
  }

  const vpnProviders = ['NordVPN', 'ExpressVPN', 'Surfshark', 'CyberGhost']
  const vpnPlans = ['1 Month', '6 Months', '1 Year']

  // VPN inventory stats
  const vpnStats = vpnProviders.map(p => ({
    provider: p,
    total: vpnKeys.filter(k => k.provider === p).length,
    available: vpnKeys.filter(k => k.provider === p && !k.is_used).length,
    used: vpnKeys.filter(k => k.provider === p && k.is_used).length,
  }))

  if (loading) return (
    <main style={{ background: 'var(--navy)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)' }}>Mega<span style={{ color: 'var(--gold)' }}>Den</span> Admin</div>
        <div style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: '0.5rem' }}>Loading...</div>
      </div>
    </main>
  )

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <GridIcon /> },
    { id: 'users', label: 'Users', icon: <UsersIcon /> },
    { id: 'orders', label: 'Orders', icon: <PackageIcon /> },
    { id: 'products', label: 'Products', icon: <ShopIcon /> },
    { id: 'vpn', label: 'VPN Stock', icon: <VpnIcon /> },
  ]

  const statusStyle = (status) => {
    if (status === 'completed') return { bg: 'rgba(29,158,117,0.12)', color: '#34d399' }
    if (status === 'pending') return { bg: 'rgba(240,180,41,0.12)', color: '#f0b429' }
    if (status === 'failed') return { bg: 'rgba(220,50,50,0.12)', color: '#ff6b6b' }
    return { bg: 'var(--card2)', color: 'var(--muted)' }
  }

  return (
    <main style={{ background: 'var(--navy)', minHeight: '100vh', paddingBottom: '5rem' }}>
      <style>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .tab-btn { transition: background 0.18s, color 0.18s; cursor: pointer; }
        .tab-btn:hover { background: var(--card2) !important; }
        .action-btn { transition: transform 0.15s, opacity 0.15s; cursor: pointer; }
        .action-btn:hover { transform: scale(1.05); }
        .action-btn:active { transform: scale(0.97); }
        .stat-card { transition: transform 0.18s, box-shadow 0.18s; }
        .stat-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
        .row-item { transition: background 0.15s; }
        .row-item:hover { background: var(--card2) !important; }
      `}</style>

      {/* TOP BAR */}
      <div style={{ padding: '1rem 1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, background: 'var(--navy)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)' }}>
        <div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.1rem', color: 'var(--text)' }}>Mega<span style={{ color: 'var(--gold)' }}>Den</span> <span style={{ color: 'var(--purple2)' }}>Admin</span></div>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Control Panel</div>
        </div>
        <a href="/dashboard" style={{ padding: '0.4rem 0.9rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--muted)', fontSize: '0.75rem', textDecoration: 'none', fontWeight: 500 }}>← App</a>
      </div>

      <div style={{ padding: '1.2rem 1.4rem' }}>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div style={{ animation: mounted ? 'fadeSlideIn 0.4s ease' : 'none' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.8rem', marginBottom: '1.5rem' }}>
              {[
                { label: 'Total Users', value: stats.users, color: 'var(--purple2)', icon: <UsersIcon /> },
                { label: 'Total Orders', value: stats.orders, color: 'var(--gold)', icon: <PackageIcon /> },
                { label: 'Revenue', value: `₦${stats.revenue.toLocaleString()}`, color: '#34d399', icon: <MoneyIcon /> },
                { label: 'Pending Orders', value: stats.pending, color: '#f0b429', icon: <ClockIcon /> },
              ].map((s, i) => (
                <div key={s.label} className="stat-card" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.1rem', animation: mounted ? `fadeSlideIn 0.35s ease ${0.06 * i}s both` : 'none' }}>
                  <div style={{ color: s.color, opacity: 0.7, marginBottom: '0.6rem' }}>{s.icon}</div>
                  <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.2rem' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* VPN Stock Overview */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.92rem', color: 'var(--text)', marginBottom: '0.9rem' }}>VPN Stock Overview</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem' }}>
                {vpnStats.map(v => (
                  <div key={v.provider} style={{ background: 'var(--card)', border: `1px solid ${v.available < 3 ? 'rgba(220,50,50,0.4)' : 'var(--border)'}`, borderRadius: '14px', padding: '0.9rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>{v.provider}</div>
                      {v.available < 3 && <span style={{ fontSize: '0.62rem', background: 'rgba(220,50,50,0.15)', color: '#ff6b6b', borderRadius: '50px', padding: '0.15rem 0.5rem', fontWeight: 700 }}>LOW STOCK</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.75rem' }}>
                      <span style={{ color: '#34d399' }}>{v.available} available</span>
                      <span style={{ color: 'var(--muted)' }}>{v.used} used</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Orders */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.92rem', color: 'var(--text)', marginBottom: '0.9rem' }}>Recent Orders</div>
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
                {orders.slice(0, 5).map((order, i) => {
                  const s = statusStyle(order.status)
                  return (
                    <div key={order.id} className="row-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.1rem', borderBottom: i < 4 ? '1px solid var(--border)' : 'none', background: 'transparent' }}>
                      <div>
                        <div style={{ fontSize: '0.83rem', fontWeight: 500, color: 'var(--text)' }}>{order.product_name || 'Order'}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{new Date(order.created_at).toLocaleDateString()}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                        <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.85rem', color: 'var(--gold)' }}>₦{order.amount?.toLocaleString()}</span>
                        <span style={{ padding: '0.2rem 0.6rem', borderRadius: '50px', background: s.bg, color: s.color, fontSize: '0.68rem', fontWeight: 600 }}>{order.status}</span>
                      </div>
                    </div>
                  )
                })}
                {orders.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.82rem' }}>No orders yet</div>}
              </div>
            </div>

            {/* Recent Users */}
            <div>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.92rem', color: 'var(--text)', marginBottom: '0.9rem' }}>Recent Users</div>
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
                {users.slice(0, 5).map((user, i) => (
                  <div key={user.id} className="row-item" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.85rem 1.1rem', borderBottom: i < 4 ? '1px solid var(--border)' : 'none', background: 'transparent' }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, var(--purple), var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.85rem', color: '#fff', flexShrink: 0 }}>
                      {user.full_name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.83rem', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.full_name || 'User'}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{user.email}</div>
                    </div>
                    <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.8rem', color: '#34d399' }}>₦{(user.wallet_balance || 0).toLocaleString()}</div>
                  </div>
                ))}
                {users.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.82rem' }}>No users yet</div>}
              </div>
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div style={{ animation: 'fadeSlideIn 0.4s ease' }}>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.92rem', color: 'var(--text)', marginBottom: '0.9rem' }}>All Users ({users.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {users.map((user, i) => (
                <div key={user.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1rem 1.1rem', animation: `fadeSlideIn 0.3s ease ${0.04 * i}s both` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.8rem' }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, var(--purple), var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.9rem', color: '#fff', flexShrink: 0 }}>
                      {user.full_name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.full_name || 'User'}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
                    </div>
                    {user.is_admin && <span style={{ padding: '0.2rem 0.6rem', borderRadius: '50px', background: 'rgba(108,78,242,0.15)', color: 'var(--purple2)', fontSize: '0.65rem', fontWeight: 700 }}>ADMIN</span>}
                    {user.is_banned && <span style={{ padding: '0.2rem 0.6rem', borderRadius: '50px', background: 'rgba(220,50,50,0.15)', color: '#ff6b6b', fontSize: '0.65rem', fontWeight: 700 }}>BANNED</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.7rem' }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>Wallet Balance</div>
                      {editingBalance === user.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                          <input value={newBalance} onChange={e => setNewBalance(e.target.value)} type="number"
                            style={{ width: '100px', padding: '0.3rem 0.6rem', background: 'var(--navy2)', border: '1px solid var(--purple)', borderRadius: '6px', color: 'var(--text)', fontSize: '0.82rem', outline: 'none' }} />
                          <button className="action-btn" onClick={() => updateBalance(user.id)} style={{ padding: '0.3rem 0.6rem', background: 'var(--purple)', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.72rem', fontWeight: 600 }}>Save</button>
                          <button className="action-btn" onClick={() => setEditingBalance(null)} style={{ padding: '0.3rem 0.6rem', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--muted)', fontSize: '0.72rem' }}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: 'var(--gold)' }}>₦{(user.wallet_balance || 0).toLocaleString()}</div>
                      )}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--muted)', textAlign: 'right' }}>
                      <div>Joined</div>
                      <div style={{ color: 'var(--text)', fontWeight: 500 }}>{new Date(user.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="action-btn" onClick={() => { setEditingBalance(user.id); setNewBalance(String(user.wallet_balance || 0)) }}
                      style={{ flex: 1, padding: '0.5rem', background: 'rgba(240,180,41,0.1)', border: '1px solid rgba(240,180,41,0.3)', borderRadius: '8px', color: 'var(--gold)', fontSize: '0.72rem', fontWeight: 600 }}>
                      Edit Balance
                    </button>
                    <button className="action-btn" onClick={() => toggleBan(user.id, user.is_banned)}
                      style={{ flex: 1, padding: '0.5rem', background: user.is_banned ? 'rgba(29,158,117,0.1)' : 'rgba(220,50,50,0.1)', border: `1px solid ${user.is_banned ? 'rgba(29,158,117,0.3)' : 'rgba(220,50,50,0.3)'}`, borderRadius: '8px', color: user.is_banned ? '#34d399' : '#ff6b6b', fontSize: '0.72rem', fontWeight: 600 }}>
                      {user.is_banned ? 'Unban User' : 'Ban User'}
                    </button>
                  </div>
                </div>
              ))}
              {users.length === 0 && <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.82rem' }}>No users yet</div>}
            </div>
          </div>
        )}

        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
          <div style={{ animation: 'fadeSlideIn 0.4s ease' }}>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.92rem', color: 'var(--text)', marginBottom: '0.9rem' }}>All Orders ({orders.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {orders.map((order, i) => {
                const s = statusStyle(order.status)
                return (
                  <div key={order.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1rem 1.1rem', animation: `fadeSlideIn 0.3s ease ${0.04 * i}s both` }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.7rem' }}>
                      <div>
                        <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.15rem' }}>{order.product_name || 'Order'}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'capitalize' }}>{order.product_type} · {new Date(order.created_at).toLocaleDateString()}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.9rem', color: 'var(--gold)', marginBottom: '0.3rem' }}>₦{order.amount?.toLocaleString()}</div>
                        <span style={{ padding: '0.2rem 0.6rem', borderRadius: '50px', background: s.bg, color: s.color, fontSize: '0.68rem', fontWeight: 600, textTransform: 'capitalize' }}>{order.status}</span>
                      </div>
                    </div>

                    {/* Delivery section for pending orders */}
                    {order.status === 'pending' && (
                      <div style={{ marginBottom: '0.7rem' }}>
                        {deliveringOrder === order.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <textarea
                              placeholder="Paste activation key or account details here..."
                              value={deliveryKey}
                              onChange={e => setDeliveryKey(e.target.value)}
                              rows={3}
                              style={{ width: '100%', padding: '0.6rem', background: 'var(--navy2)', border: '1px solid var(--purple)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.8rem', outline: 'none', resize: 'none', fontFamily: 'Inter, sans-serif' }}
                            />
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button className="action-btn" onClick={() => deliverOrder(order)} disabled={delivering}
                                style={{ flex: 1, padding: '0.5rem', background: 'rgba(29,158,117,0.15)', border: '1px solid rgba(29,158,117,0.3)', borderRadius: '8px', color: '#34d399', fontSize: '0.72rem', fontWeight: 600 }}>
                                {delivering ? 'Delivering...' : '✓ Deliver & Complete'}
                              </button>
                              <button className="action-btn" onClick={() => { setDeliveringOrder(null); setDeliveryKey('') }}
                                style={{ padding: '0.5rem 0.8rem', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--muted)', fontSize: '0.72rem' }}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button className="action-btn" onClick={() => setDeliveringOrder(order.id)}
                            style={{ width: '100%', padding: '0.5rem', background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.3)', borderRadius: '8px', color: '#34d399', fontSize: '0.72rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                            📦 Deliver Order
                          </button>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {['pending', 'completed', 'failed'].map(status => (
                        <button key={status} className="action-btn" onClick={() => updateOrderStatus(order.id, status)}
                          style={{ flex: 1, padding: '0.45rem', background: order.status === status ? statusStyle(status).bg : 'var(--card2)', border: `1px solid ${order.status === status ? statusStyle(status).color : 'var(--border)'}`, borderRadius: '8px', color: order.status === status ? statusStyle(status).color : 'var(--muted)', fontSize: '0.68rem', fontWeight: 600, textTransform: 'capitalize' }}>
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
              {orders.length === 0 && <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.82rem' }}>No orders yet</div>}
            </div>
          </div>
        )}

        {/* PRODUCTS TAB */}
        {activeTab === 'products' && (
          <div style={{ animation: 'fadeSlideIn 0.4s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.92rem', color: 'var(--text)' }}>Products ({products.length})</div>
              <button className="action-btn" onClick={() => setShowProductForm(!showProductForm)}
                style={{ padding: '0.5rem 1rem', background: 'var(--purple)', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
                {showProductForm ? 'Cancel' : '+ Add Product'}
              </button>
            </div>

            {showProductForm && (
              <div style={{ background: 'var(--card)', border: '1px solid var(--purple)', borderRadius: '16px', padding: '1.2rem', marginBottom: '1rem', animation: 'scaleIn 0.3s ease' }}>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)', marginBottom: '1rem' }}>New Product</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                  {[
                    { key: 'name', label: 'Product Name', placeholder: 'e.g. USA Virtual Number' },
                    { key: 'price', label: 'Price (₦)', placeholder: '0', type: 'number' },
                    { key: 'description', label: 'Description', placeholder: 'Short description' },
                    { key: 'country', label: 'Country (for numbers)', placeholder: 'e.g. United States' },
                    { key: 'platform', label: 'Platform (for logs)', placeholder: 'e.g. Facebook' },
                    { key: 'stock', label: 'Stock', placeholder: '0', type: 'number' },
                  ].map(field => (
                    <div key={field.key}>
                      <label style={{ fontSize: '0.72rem', color: 'var(--muted)', display: 'block', marginBottom: '0.3rem' }}>{field.label}</label>
                      <input type={field.type || 'text'} placeholder={field.placeholder}
                        value={productForm[field.key]} onChange={e => setProductForm(f => ({ ...f, [field.key]: e.target.value }))}
                        style={{ width: '100%', padding: '0.65rem 0.9rem', background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: '9px', color: 'var(--text)', fontSize: '0.85rem', outline: 'none', fontFamily: 'Inter, sans-serif' }} />
                    </div>
                  ))}
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--muted)', display: 'block', marginBottom: '0.3rem' }}>Category</label>
                    <select value={productForm.category} onChange={e => setProductForm(f => ({ ...f, category: e.target.value }))}
                      style={{ width: '100%', padding: '0.65rem 0.9rem', background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: '9px', color: 'var(--text)', fontSize: '0.85rem', outline: 'none', fontFamily: 'Inter, sans-serif' }}>
                      <option value="number">Foreign Number</option>
                      <option value="log">Social Media Log</option>
                      <option value="boosting">Boosting</option>
                      <option value="vpn">VPN</option>
                    </select>
                  </div>
                  <button onClick={saveProduct} disabled={savingProduct} className="action-btn"
                    style={{ padding: '0.8rem', background: 'var(--purple)', border: 'none', borderRadius: '10px', color: '#fff', fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', fontWeight: 700 }}>
                    {savingProduct ? 'Saving...' : 'Save Product'}
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {products.map((product, i) => (
                <div key={product.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1rem 1.1rem', animation: `fadeSlideIn 0.3s ease ${0.04 * i}s both` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.7rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.15rem' }}>{product.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'capitalize' }}>{product.category} · Stock: {product.stock || 0}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.9rem', color: 'var(--gold)', marginBottom: '0.3rem' }}>₦{product.price?.toLocaleString()}</div>
                      <span style={{ padding: '0.2rem 0.6rem', borderRadius: '50px', background: product.is_active ? 'rgba(29,158,117,0.12)' : 'rgba(220,50,50,0.12)', color: product.is_active ? '#34d399' : '#ff6b6b', fontSize: '0.65rem', fontWeight: 600 }}>
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="action-btn" onClick={() => toggleProduct(product.id, product.is_active)}
                      style={{ flex: 1, padding: '0.45rem', background: product.is_active ? 'rgba(240,180,41,0.1)' : 'rgba(29,158,117,0.1)', border: `1px solid ${product.is_active ? 'rgba(240,180,41,0.3)' : 'rgba(29,158,117,0.3)'}`, borderRadius: '8px', color: product.is_active ? 'var(--gold)' : '#34d399', fontSize: '0.72rem', fontWeight: 600 }}>
                      {product.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button className="action-btn" onClick={() => deleteProduct(product.id)}
                      style={{ flex: 1, padding: '0.45rem', background: 'rgba(220,50,50,0.1)', border: '1px solid rgba(220,50,50,0.3)', borderRadius: '8px', color: '#ff6b6b', fontSize: '0.72rem', fontWeight: 600 }}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {products.length === 0 && !showProductForm && (
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.82rem' }}>No products yet.</div>
              )}
            </div>
          </div>
        )}

        {/* VPN STOCK TAB */}
        {activeTab === 'vpn' && (
          <div style={{ animation: 'fadeSlideIn 0.4s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.92rem', color: 'var(--text)' }}>VPN Keys ({vpnKeys.filter(k => !k.is_used).length} available)</div>
              <button className="action-btn" onClick={() => setShowVpnForm(!showVpnForm)}
                style={{ padding: '0.5rem 1rem', background: 'var(--purple)', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
                {showVpnForm ? 'Cancel' : '+ Add Keys'}
              </button>
            </div>

            {/* Stock summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem', marginBottom: '1.2rem' }}>
              {vpnStats.map(v => (
                <div key={v.provider} style={{ background: 'var(--card)', border: `1px solid ${v.available < 3 ? 'rgba(220,50,50,0.4)' : 'var(--border)'}`, borderRadius: '14px', padding: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>{v.provider}</div>
                    {v.available < 3 && <span style={{ fontSize: '0.6rem', background: 'rgba(220,50,50,0.15)', color: '#ff6b6b', borderRadius: '50px', padding: '0.15rem 0.5rem', fontWeight: 700 }}>LOW</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 600 }}>{v.available} keys left</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{v.used} delivered</div>
                </div>
              ))}
            </div>

            {/* Add VPN form */}
            {showVpnForm && (
              <div style={{ background: 'var(--card)', border: '1px solid var(--purple)', borderRadius: '16px', padding: '1.2rem', marginBottom: '1rem', animation: 'scaleIn 0.3s ease' }}>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)', marginBottom: '1rem' }}>Add VPN Keys</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--muted)', display: 'block', marginBottom: '0.3rem' }}>Provider</label>
                    <select value={vpnForm.provider} onChange={e => setVpnForm(f => ({ ...f, provider: e.target.value }))}
                      style={{ width: '100%', padding: '0.65rem 0.9rem', background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: '9px', color: 'var(--text)', fontSize: '0.85rem', outline: 'none', fontFamily: 'Inter, sans-serif' }}>
                      {vpnProviders.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--muted)', display: 'block', marginBottom: '0.3rem' }}>Plan</label>
                    <select value={vpnForm.plan} onChange={e => setVpnForm(f => ({ ...f, plan: e.target.value }))}
                      style={{ width: '100%', padding: '0.65rem 0.9rem', background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: '9px', color: 'var(--text)', fontSize: '0.85rem', outline: 'none', fontFamily: 'Inter, sans-serif' }}>
                      {vpnPlans.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--muted)', display: 'block', marginBottom: '0.3rem' }}>Single Key</label>
                    <input placeholder="Paste activation key here..." value={vpnForm.key}
                      onChange={e => setVpnForm(f => ({ ...f, key: e.target.value }))}
                      style={{ width: '100%', padding: '0.65rem 0.9rem', background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: '9px', color: 'var(--text)', fontSize: '0.85rem', outline: 'none', fontFamily: 'Inter, sans-serif' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--muted)', display: 'block', marginBottom: '0.3rem' }}>Bulk Keys (one per line)</label>
                    <textarea placeholder={'KEY-XXXX-XXXX\nKEY-YYYY-YYYY\nKEY-ZZZZ-ZZZZ'} value={vpnBulk}
                      onChange={e => setVpnBulk(e.target.value)} rows={5}
                      style={{ width: '100%', padding: '0.65rem 0.9rem', background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: '9px', color: 'var(--text)', fontSize: '0.82rem', outline: 'none', fontFamily: 'Inter, sans-serif', resize: 'vertical' }} />
                  </div>
                  <button onClick={saveVpnKey} disabled={savingVpn} className="action-btn"
                    style={{ padding: '0.8rem', background: 'var(--purple)', border: 'none', borderRadius: '10px', color: '#fff', fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', fontWeight: 700 }}>
                    {savingVpn ? 'Saving...' : `Save ${vpnBulk ? vpnBulk.split('\n').filter(k => k.trim()).length : vpnForm.key ? 1 : 0} Key(s)`}
                  </button>
                </div>
              </div>
            )}

            {/* Keys list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {vpnKeys.map((k, i) => (
                <div key={k.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '0.85rem 1.1rem', animation: `fadeSlideIn 0.3s ease ${0.03 * i}s both` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>{k.provider}</span>
                      <span style={{ fontSize: '0.65rem', background: 'var(--card2)', color: 'var(--muted)', borderRadius: '50px', padding: '0.1rem 0.4rem' }}>{k.plan}</span>
                      <span style={{ fontSize: '0.65rem', background: k.is_used ? 'rgba(220,50,50,0.12)' : 'rgba(29,158,117,0.12)', color: k.is_used ? '#ff6b6b' : '#34d399', borderRadius: '50px', padding: '0.1rem 0.4rem', fontWeight: 600 }}>{k.is_used ? 'Used' : 'Available'}</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'Inter, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.key}</div>
                  </div>
                  {!k.is_used && (
                    <button className="action-btn" onClick={() => deleteVpnKey(k.id)}
                      style={{ marginLeft: '0.8rem', padding: '0.35rem 0.7rem', background: 'rgba(220,50,50,0.1)', border: '1px solid rgba(220,50,50,0.3)', borderRadius: '8px', color: '#ff6b6b', fontSize: '0.68rem', fontWeight: 600, flexShrink: 0 }}>
                      Delete
                    </button>
                  )}
                </div>
              ))}
              {vpnKeys.length === 0 && (
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.82rem' }}>No VPN keys yet. Add your first keys!</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--navy)', backdropFilter: 'blur(12px)', borderTop: '1px solid var(--border)', padding: '0.7rem 1rem 0.9rem', display: 'flex', justifyContent: 'space-around', zIndex: 100 }}>
        {tabs.map(tab => (
          <button key={tab.id} className="tab-btn" onClick={() => setActiveTab(tab.id)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.22rem', background: 'transparent', border: 'none', padding: '0.3rem 0.8rem', borderRadius: '10px' }}>
            <div style={{ color: activeTab === tab.id ? 'var(--purple2)' : 'var(--muted)' }}>{tab.icon}</div>
            <span style={{ fontSize: '0.62rem', color: activeTab === tab.id ? 'var(--purple2)' : 'var(--muted)', fontWeight: activeTab === tab.id ? 600 : 400 }}>{tab.label}</span>
          </button>
        ))}
      </div>
    </main>
  )
}

function GridIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> }
function UsersIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> }
function PackageIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> }
function ShopIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg> }
function MoneyIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> }
function ClockIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> }
function VpnIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> }