import { useState } from 'react'
import { useAuth, useToast } from '../context'
import { Icon } from '../ui'
import { resetDemo } from '../lib/api'

export default function Auth() {
  const { signIn } = useAuth()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const [showDemo, setShowDemo] = useState(false)
  const [f, setF] = useState({ email: '', password: '' })
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }))

  async function doSignIn(email, password) {
    setBusy(true)
    try { await signIn(email, password); toast('Welcome back! 👋') }
    catch (e) { toast(e.message, 'err') }
    finally { setBusy(false) }
  }
  async function onSubmit(e) {
    e.preventDefault()
    if (!f.email || !f.password) return
    doSignIn(f.email, f.password)
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
                placeholder="Official email" autoComplete="username" required />
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
            <button type="button" className="linklike" onClick={() => setShowDemo(s => !s)}>
              {showDemo ? '▾' : '▸'} Demo accounts
            </button>
          </div>

          {showDemo && (
            <div className="demo-drop">
              <button type="button" className="btn sm" onClick={() => doSignIn('master@demo.io', 'demo1234')}>
                <span className="crown"><Icon name="crown" size={14} /></span> Master Admin — Ramesh Gowda
              </button>
              <button type="button" className="btn sm" onClick={() => doSignIn('sub@demo.io', 'demo1234')}>
                <Icon name="users" size={14} /> Sub Admin — Arun Kumar
              </button>
              <button type="button" className="btn sm" onClick={() => doSignIn('user@demo.io', 'demo1234')}>
                <Icon name="user" size={14} /> Member — Sudha Kumari
              </button>
              <button type="button" className="linklike" style={{ marginTop: 2 }}
                onClick={() => { if (confirm('Reset all demo data?')) resetDemo() }}>
                ↺ Reset demo data
              </button>
            </div>
          )}
        </div>
        <p className="login-copy">🔐 Secured with Supabase Auth · JWT · Row Level Security</p>
      </div>
    </div>
  )
}
