import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api, MOCK } from './lib/api'

/* ---------------- Toasts ---------------- */
const ToastCtx = createContext(null)
export const useToast = () => useContext(ToastCtx)

/* ---------------- Auth ---------------- */
const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let off = () => {}
    ;(async () => {
      if (api.onAuthChange) off = api.onAuthChange((s) => setSession(s))
      try { setSession(await api.getSession()) } catch {}
      setReady(true)
    })()
    return () => off()
  }, [])

  const signIn = useCallback(async (email, password) => {
    const s = await api.signIn(email, password)
    setSession(s); return s
  }, [])

  const signUp = useCallback(async (fields) => {
    const s = await api.signUp(fields)
    if (s) setSession(s)
    return s
  }, [])

  const signOut = useCallback(async () => { await api.signOut(); setSession(null) }, [])

  const updateMe = useCallback(async (patch) => {
    const p = await api.updateMe(patch)
    setSession(prev => (prev ? { ...prev, profile: p } : prev))
    return p
  }, [])

  return (
    <AuthCtx.Provider value={{ session, profile: session?.profile || null, ready, signIn, signUp, signOut, updateMe }}>
      {children}
    </AuthCtx.Provider>
  )
}

/* ---------------- Theme (6 themes; Royal Golden = Master Admin only) ---------------- */
export const THEMES = [
  { id: 'light', name: 'Pearl Light', desc: 'Clean & minimal' },
  { id: 'dark', name: 'Midnight Dark', desc: 'Low-light friendly' },
  { id: 'ocean', name: 'Ocean Blue', desc: 'Calm & cool' },
  { id: 'forest', name: 'Forest Green', desc: 'Fresh & focused' },
  { id: 'sunset', name: 'Sunset Rose', desc: 'Warm & bold' },
  { id: 'golden', name: 'Royal Golden', desc: 'Exclusive — Master Admin only' },
]
export const MASTER_ONLY_THEMES = ['golden']

const ThemeCtx = createContext(null)
export const useTheme = () => useContext(ThemeCtx)

function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t)
}

function ThemeProvider({ children }) {
  const { profile, updateMe } = useAuth()
  const [theme, setThemeState] = useState(() => localStorageSafe('billdesk_theme') || 'dark')

  // Apply the profile's saved theme whenever profile changes; guard Golden.
  useEffect(() => {
    if (!profile) return
    let t = profile.theme || 'light'
    if (MASTER_ONLY_THEMES.includes(t) && profile.role !== 'master_admin') t = 'light'
    setThemeState(t); applyTheme(t)
  }, [profile?.id, profile?.theme, profile?.role])

  // Apply before login too (remember last used theme)
  useEffect(() => { if (!profile) applyTheme(theme) }, []) // eslint-disable-line

  const setTheme = useCallback(async (t) => {
    if (MASTER_ONLY_THEMES.includes(t) && profile?.role !== 'master_admin') {
      return 'Golden theme is reserved for the Master Admin'
    }
    setThemeState(t); applyTheme(t)
    localStorageSafe('billdesk_theme', t)
    try { await updateMe({ theme: t }) } catch {}
    return null
  }, [profile?.role, updateMe])

  return <ThemeCtx.Provider value={{ theme, setTheme, THEMES }}>{children}</ThemeCtx.Provider>
}

function localStorageSafe(k, v) {
  try {
    if (v === undefined) return window.localStorage.getItem(k)
    window.localStorage.setItem(k, v)
  } catch {}
  return null
}

/* ---------------- Root providers ---------------- */
export function Providers({ children }) {
  const [toasts, setToasts] = useState([])
  const push = useCallback((msg, kind = 'ok') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(t => [...t, { id, msg, kind }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
  }, [])

  return (
    <ToastCtx.Provider value={{ toast: push, demo: MOCK }}>
      <AuthProvider>
        <ThemeProvider>
          {children}
          <div className="toasts">
            {toasts.map(t => <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>)}
          </div>
        </ThemeProvider>
      </AuthProvider>
    </ToastCtx.Provider>
  )
}
