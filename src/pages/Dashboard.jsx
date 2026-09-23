import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context'
import { BarChart, Donut } from '../charts'
import { Icon, Avatar, Empty } from '../ui'
import { fmtMoney, fmtDate, fmtShort, isOverdue, daysUntil, isAdminRole } from '../lib/format'
import { catIcon } from '../lib/categories'

const CHART_COLORS = ['var(--chart1)', 'var(--chart2)', 'var(--chart3)', 'var(--chart4)', 'var(--chart5)', 'var(--chart6)']

export default function Dashboard({ go }) {
  const { profile } = useAuth()
  const [bills, setBills] = useState(null)
  const admin = isAdminRole(profile?.role)

  useEffect(() => { api.getBills().then(setBills).catch(() => setBills([])) }, [])

  const stats = useMemo(() => {
    if (!bills) return null
    const thisM = new Date().toISOString().slice(0, 7)
    const active = bills.filter(b => b.status === 'processing' || b.status === 'submitted')
    const overdue = active.filter(isOverdue)
    const soon = active.filter(b => b.due_date && !isOverdue(b) && daysUntil(b.due_date) <= 7)
    const monthBills = bills.filter(b => (b.bill_date || '').slice(0, 7) === thisM)
    return {
      monthTotal: monthBills.reduce((s, b) => s + Number(b.amount), 0),
      monthN: monthBills.length,
      activeAmt: active.reduce((s, b) => s + Number(b.amount), 0),
      activeN: active.length,
      approvedN: bills.filter(b => b.status === 'approved' || b.status === 'paid').length,
      overdueN: overdue.length,
      overdueAmt: overdue.reduce((s, b) => s + Number(b.amount), 0),
      soon,
    }
  }, [bills])

  const months = useMemo(() => {
    if (!bills) return []
    const out = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i)
      const key = d.toISOString().slice(0, 7)
      out.push({
        label: d.toLocaleDateString('en-IN', { month: 'short' }),
        value: bills.filter(b => (b.bill_date || '').slice(0, 7) === key).reduce((s, b) => s + Number(b.amount), 0),
      })
    }
    return out
  }, [bills])

  const byType = useMemo(() => {
    if (!bills) return []
    const m = {}
    for (const b of bills) m[b.bill_type] = (m[b.bill_type] || 0) + Number(b.amount)
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([label, value], i) => ({ label, value, color: CHART_COLORS[i % 6] }))
  }, [bills])

  if (!bills || !stats) return <div className="card"><p className="muted">Loading dashboard…</p></div>

  return (
    <>
      <p className="muted small" style={{ marginBottom: 14 }}>
        {admin ? '👑 Team-wide data (all members) — you are an admin.' : 'Bills assigned to you & your own submissions.'}
      </p>

      <div className="stat-grid">
        <div className="card stat">
          <div className="k"><Icon name="calendar" size={14} /> Claims this month</div>
          <div className="v">{fmtMoney(stats.monthTotal)}</div>
          <div className="s muted">{stats.monthN} bill{stats.monthN === 1 ? '' : 's'} dated this month</div>
        </div>
        <div className="card stat">
          <div className="k"><Icon name="wallet" size={14} /> In processing</div>
          <div className="v">{fmtShort(stats.activeAmt)}</div>
          <div className="s muted">{stats.activeN} bill{stats.activeN === 1 ? '' : 's'} not yet approved</div>
        </div>
        <div className="card stat">
          <div className="k"><Icon name="check" size={14} /> Approved / Paid</div>
          <div className="v" style={{ color: 'var(--ok)' }}>{stats.approvedN}</div>
          <div className="s muted">fully cleared records</div>
        </div>
        <div className="card stat">
          <div className="k"><Icon name="alert" size={14} /> Overdue / Due ≤7d</div>
          <div className="v" style={{ color: stats.overdueN ? 'var(--danger)' : 'var(--ok)' }}>{stats.overdueN + stats.soon.length}</div>
          <div className="s muted">{fmtMoney(stats.overdueAmt)} past due — WhatsApp reminders active</div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <h3>📈 Monthly claims — last 6 months</h3>
          <BarChart data={months} />
        </div>
        <div className="card">
          <h3>🏷️ Claims by bill type</h3>
          <Donut data={byType} />
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
          <h3 style={{ margin: 0 }}>⏰ Due soon & overdue</h3>
          <button className="btn sm ghost" onClick={() => go('bills')}>Open register →</button>
        </div>
        {stats.soon.length === 0 && <Empty icon="check" title="Nothing due in the next 7 days" sub="You're all caught up 🎉" />}
        <div className="up-list">
          {stats.soon.map(b => (
            <div className="up-item" key={b.id}>
              <span style={{ fontSize: 18 }}>{catIcon(b.bill_type)}</span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {b.description || b.bill_type}
                </div>
                <div className="muted small">Due {fmtDate(b.due_date)}{admin && b.owner ? ` · ${b.owner.full_name}` : ''}</div>
              </div>
              {admin && b.owner && <Avatar name={b.owner.full_name} url={b.owner.avatar_url} size={26} />}
              <div style={{ fontWeight: 800 }}>{fmtMoney(b.amount)}</div>
              <span className="badge b-pending">in {daysUntil(b.due_date)}d</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
