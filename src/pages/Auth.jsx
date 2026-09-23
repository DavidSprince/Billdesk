import { useState } from 'react'
import { useAuth, useToast } from '../context'
import { Icon } from '../ui'

export default function Auth() {
  const { signIn } = useAuth()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState({ email: '', password: '' })
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }))

  async function onSubmit(e) {
    e.preventDefault()
    if (!f.email || !f.password) return
    setBusy(true)
    try { await signIn(f.email, f.password); toast('Welcome back! 👋') }
    catch (e) { toast(e.message, 'err') }
    finally { setBusy(false) }
  }

  return (
    <div className="login-stage">
      {/* animated backdrop */}
      <div className="orb o1" /><div className="orb o2" /><div className="orb o3" />
      <div className="grid-overlay" />
      <span className="float-chip c1">🧾</span>
      <span className="float-chip c2">📊</span>
      <span className="float-chip c3">💳</span>
      <span className="float-chip c4">📁</span>

      {/* login card */}
      <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 410 }}>
        <div className="login-card">
          <div className="login-brand">
            <div className="logo-ring"><span className="logo-core"><Icon name="receipt" size={26} /></span></div>
            <h1>BillDesk</h1>
            <p>Bill &amp; Claim Management Portal</p>
          </div>

          <form onSubmit={onSubmit}>
            <div className="lg-input" style={{ animationDelay: '.38s' }}>
              <span className="ico"><Icon name="user" size={16} /></span>
              <input className="field" type="email" value={f.email} onChange={set('email')}
                placeholder="Login ID" autoComplete="username" required />
            </div>
            <div className="lg-input" style={{ animationDelay: '.46s' }}>
              <span className="ico"><Icon name="lock" size={16} /></span>
              <input className="field" type="password" value={f.password} onChange={set('password')}
                placeholder="Password" autoComplete="current-password" required />
            </div>
            <button className="btn primary btn-shine lg-btn" disabled={busy} style={{ animationDelay: '.54s' }}>
              {busy ? 'Signing in…' : 'Sign in securely'} <Icon name="logout" size={15} style={{ transform: 'rotate(180deg)' }} />
            </button>
          </form>

          <div className="login-foot" style={{ animationDelay: '.62s' }}>
            <p className="muted small">Accounts are created by the Master Admin.<br />Contact your administrator if you need access.</p>
          </div>
        </div>
        <p className="login-copy">🔐 Secured with Supabase Auth · JWT · Row Level Security</p>
      </div>
    </div>
  )
}
