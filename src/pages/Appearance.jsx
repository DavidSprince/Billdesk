import { useTheme, useAuth, useToast, THEMES, MASTER_ONLY_THEMES } from '../context'
import { Icon } from '../ui'

const SWATCH = {
  light: { bg: '#f2f5fb', panel: '#ffffff', accent: '#2f6bff', side: '#101a33' },
  dark: { bg: '#0a1020', panel: '#121b30', accent: '#4f8cff', side: '#0d1526' },
  ocean: { bg: '#e9f7fb', panel: '#ffffff', accent: '#0891b2', side: '#083344' },
  forest: { bg: '#f0f6ee', panel: '#ffffff', accent: '#1f9d55', side: '#14301c' },
  sunset: { bg: '#fdf1f5', panel: '#ffffff', accent: '#e0417d', side: '#41122f' },
  golden: { bg: '#0f0d08', panel: '#191510', accent: '#d9b452', side: '#131007' },
}

export default function Appearance() {
  const { theme, setTheme } = useTheme()
  const { profile } = useAuth()
  const { toast } = useToast()
  const isMaster = profile?.role === 'master_admin'

  async function pick(t) {
    const err = await setTheme(t)
    if (err) toast(err, 'err')
    else toast(`Theme switched to “${THEMES.find(x => x.id === t).name}” 🎨`)
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 6 }}>🎨 Themes</h3>
        <p className="muted small">
          5 themes are available to every user. <b style={{ color: 'var(--accent)' }}>Royal Golden</b>{' '}
          <span className="crown" style={{ display: 'inline-flex', verticalAlign: '-2px' }}><Icon name="crown" size={13} /></span>{' '}
          is reserved for the <b>Master Admin</b> — enforced in the UI and by a database trigger.
          {!isMaster && <span> Ask your Master Admin for access.</span>}
        </p>
      </div>

      <div className="themes-grid">
        {THEMES.map(t => {
          const locked = MASTER_ONLY_THEMES.includes(t.id) && !isMaster
          const active = theme === t.id
          const s = SWATCH[t.id]
          return (
            <button key={t.id} disabled={locked}
              className={`theme-card ${active ? 'active' : ''} ${locked ? 'locked' : ''}`}
              onClick={() => pick(t.id)} title={locked ? 'Master Admin only' : t.name}>
              <div className="shot" style={{ background: s.bg }}>
                <div className="win">
                  <div className="wside" style={{ background: s.side }} />
                  <div className="wmain" style={{ background: s.panel }}>
                    <div className="wline" style={{ width: '70%', background: s.bg }} />
                    <div className="wline" style={{ width: '45%', background: s.bg }} />
                    <div className="wline" style={{ width: '58%', background: s.bg }} />
                    <div className="wbtn" style={{ background: s.accent }} />
                  </div>
                </div>
              </div>
              <div className="meta">
                {t.id === 'golden' && <span className="crown"><Icon name="crown" size={15} /></span>}
                <div style={{ flex: 1 }}>
                  <div className="tn">{t.name}</div>
                  <div className="muted small">{t.desc}</div>
                </div>
                {locked && <span className="lock-row"><Icon name="lock" size={13} /> Master only</span>}
                {active && !locked && <span className="badge b-paid"><Icon name="check" size={11} /> Active</span>}
              </div>
            </button>
          )
        })}
      </div>
    </>
  )
}
