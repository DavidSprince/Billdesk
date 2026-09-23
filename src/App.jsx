import { useEffect, useRef, useState } from 'react'
import { useAuth, useTheme, useToast, THEMES, MASTER_ONLY_THEMES } from './context'
import { Icon, Avatar, RoleBadge } from './ui'
import { isAdminRole } from './lib/format'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Bills from './pages/Bills'
import Users from './pages/Users'
import Profile from './pages/Profile'
import Appearance from './pages/Appearance'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'bills', label: 'Bills', icon: 'receipt' },
  { id: 'users', label: 'Users', icon: 'users', admin: true },
  { id: 'appearance', label: 'Themes', icon: 'palette' },
  { id: 'profile', label: 'Profile', icon: 'user', admin: true },
]
const TITLES = { dashboard: 'Dashboard', bills: 'Bills', users: 'User Management', appearance: 'Appearance & Themes', profile: 'My Profile' }

function useHashRoute() {
  const [route, setRoute] = useState(() => window.location.hash.replace('#/', '') || 'dashboard')
  useEffect(() => {
    const h = () => setRoute(window.location.hash.replace('#/', '') || 'dashboard')
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])
  return [route, (r) => { window.location.hash = '#/' + r }]
}

export default function App() {
  const { session, profile, ready, signOut } = useAuth()
  const { demo } = useToast()
  const [route, go] = useHashRoute()

  if (!ready) return <div className="splash"><div className="logo"><Icon name="receipt" size={26} /></div></div>
  if (!session || !profile) return <Auth />

  const admin = isAdminRole(profile.role)
  const active = NAV.find(n => n.id === route) ? (NAV.find(n => n.id === route).admin && !admin ? 'dashboard' : route) : 'dashboard'

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo"><Icon name="receipt" size={19} /></span>
          <span className="brand-text">BillDesk</span>
          {profile.role === 'master_admin' && <span className="crown" title="Master Admin"><Icon name="crown" size={15} /></span>}
        </div>
        <nav className="nav">
          {NAV.filter(n => !n.admin || admin).map(n => (
            <button key={n.id} className={`nav-item ${active === n.id ? 'active' : ''}`} onClick={() => go(n.id)}>
              <Icon name={n.icon} size={17} /> <span className="label">{n.label}</span>
            </button>
          ))}
          <button className="nav-item" onClick={() => { signOut() }}>
            <Icon name="logout" size={17} /> <span className="label">Sign out</span>
          </button>
        </nav>
        <div className="side-user">
          <Avatar name={profile.full_name} url={profile.avatar_url} size={34} />
          <div className="who">
            <div className="nm">{profile.full_name}</div>
            <div className="rl">{isAdminRole(profile.role) ? (profile.role === 'master_admin' ? '👑 Master Admin' : '🛡️ Sub Admin') : 'Member'}</div>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <h1>{TITLES[active]}</h1>
          {demo && <span className="demo-pill" title="Set VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY to go live">DEMO MODE</span>}
          <span className="spacer" />
          <ThemeMenu />
          <button className="iconbtn" onClick={() => go('profile')} title="My profile">
            <Avatar name={profile.full_name} url={profile.avatar_url} size={28} />
          </button>
        </header>
        <main className="page">
          {active === 'dashboard' && <Dashboard go={go} />}
          {active === 'bills' && <Bills />}
          {active === 'users' && <Users />}
          {active === 'appearance' && <Appearance />}
          {active === 'profile' && <Profile />}
        </main>
      </div>
    </div>
  )
}

/* Quick theme switcher dropdown in the topbar */
function ThemeMenu() {
  const { theme, setTheme } = useTheme()
  const { profile } = useAuth()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const isMaster = profile?.role === 'master_admin'
  const list = THEMES.filter(t => !MASTER_ONLY_THEMES.includes(t.id) || isMaster)

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="iconbtn" title="Switch theme" onClick={() => setOpen(o => !o)}><Icon name="palette" size={17} /></button>
      {open && (
        <div className="card" style={{ position: 'absolute', right: 0, top: 40, width: 218, padding: 8, zIndex: 60 }}>
          {list.map(t => (
            <button key={t.id} className="nav-item" style={{ color: 'var(--text)', width: '100%' }}
              onClick={async () => { setOpen(false); const err = await setTheme(t.id); if (err) toast(err, 'err') }}>
              <Icon name={theme === t.id ? 'check' : (t.id === 'golden' ? 'crown' : 'palette')} size={15} />
              <span className="label" style={{ flex: 1 }}>{t.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
