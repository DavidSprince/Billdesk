import { fmtShort, fmtMoney } from './lib/format'

/* Simple dependency-free SVG charts */

export function BarChart({ data, height = 230 }) {
  const w = 620, h = height, padL = 14, padR = 8, padT = 24, padB = 30
  const max = Math.max(...data.map(d => d.value), 1)
  const iw = w - padL - padR, ih = h - padT - padB
  const step = iw / Math.max(data.length, 1)
  const bw = Math.min(52, step * 0.56)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <linearGradient id="bgbar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-2)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map(f => (
        <line key={f} x1={padL} x2={w - padR} y1={padT + ih * (1 - f)} y2={padT + ih * (1 - f)}
          stroke="var(--border)" strokeDasharray="3 5" />
      ))}
      {data.map((d, i) => {
        const bh = Math.max((d.value / max) * ih, d.value > 0 ? 4 : 0)
        const x = padL + step * i + (step - bw) / 2
        const y = padT + ih - bh
        return (
          <g key={i}>
            <title>{`${d.label}: ${fmtMoney(d.value)}`}</title>
            <rect x={x} y={y} width={bw} height={bh} rx={7} fill="url(#bgbar)" opacity={0.92} />
            <text x={x + bw / 2} y={y - 7} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="var(--muted)">{fmtShort(d.value)}</text>
            <text x={x + bw / 2} y={h - 9} textAnchor="middle" fontSize="11" fill="var(--muted)">{d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

export function Donut({ data, size = 190 }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const r = 62, c = 2 * Math.PI * r
  let acc = 0
  const cx = 80, cy = 80
  return (
    <div className="row" style={{ gap: 18, flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox="0 0 160 160" style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="20" />
        {total > 0 && data.map((d, i) => {
          const frac = d.value / total
          const dash = `${Math.max(frac * c - 2, 0.5)} ${c}`
          const el = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth="20"
              strokeDasharray={dash} strokeDashoffset={-acc * c} transform={`rotate(-90 ${cx} ${cy})`}>
              <title>{`${d.label}: ${fmtMoney(d.value)}`}</title>
            </circle>
          )
          acc += frac
          return el
        })}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="15" fontWeight="800" fill="var(--text)">{fmtShort(total)}</text>
        <text x={cx} y={cy + 15} textAnchor="middle" fontSize="9.5" fill="var(--muted)">TOTAL</text>
      </svg>
      <div style={{ flex: 1, minWidth: 150 }}>
        {data.map((d, i) => (
          <div key={i} className="row" style={{ justifyContent: 'space-between', padding: '4.5px 0' }}>
            <span className="row small" style={{ gap: 7 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: d.color, flexShrink: 0 }} />
              {d.label}
            </span>
            <span className="small" style={{ fontWeight: 700 }}>{fmtShort(d.value)}{total > 0 && <span className="muted"> · {Math.round((d.value / total) * 100)}%</span>}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
