import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useAuth, useToast } from '../context'
import { Icon, Modal, Confirm, Avatar, RoleBadge, Empty, StatusBadge } from '../ui'
import {
  fmtMoney, fmtDate, todayISO, STATUSES, statusLabel, isDriveLink, drivePreview,
  isAdminRole,
} from '../lib/format'
import { BILL_TYPES, catIcon } from '../lib/categories'

const BLANK = (profile) => ({
  inward_no: '', user_id: profile.id, bill_type: 'TA Bill', bill_date: todayISO(),
  description: '', amount: '', e_office: '', status: 'processing',
  head_of_account: '', cp_no: '', due_date: '', assigned_to: '',
  drive_url: '', notes: '',
})

export default function Bills() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const admin = isAdminRole(profile.role)
  const master = profile.role === 'master_admin'

  const [tab, setTab] = useState('bills')
  const [bills, setBills] = useState([])
  const [users, setUsers] = useState([])
  const [types, setTypes] = useState(BILL_TYPES)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [scope, setScope] = useState('all')       // members: all | assigned | mine
  const [fStatus, setFStatus] = useState('all')   // everyone: status filter
  const [form, setForm] = useState(BLANK(profile))
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(null)   // bill being edited in modal
  const [deleting, setDeleting] = useState(null)
  const [viewing, setViewing] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const [b, c] = await Promise.all([api.getBills(), api.getCategories()])
      setBills(b); setTypes(c)
      if (admin) { try { setUsers(await api.listUsers()) } catch {} }
    } catch (e) { toast(e.message, 'err') }
    setLoading(false)
  }
  useEffect(() => { load() }, []) // eslint-disable-line

  const canEdit = (b) => admin || b.user_id === profile.id
  const userName = (id) => users.find(u => u.id === id)?.full_name || null

  const visible = useMemo(() => bills.filter(b => {
    if (!admin && scope === 'assigned' && b.assigned_to !== profile.id) return false
    if (!admin && scope === 'mine' && b.user_id !== profile.id) return false
    if (fStatus !== 'all' && b.status !== fStatus) return false
    if (!q) return true
    const hay = `${b.inward_no || ''} ${b.owner?.full_name || ''} ${b.owner?.designation || ''} ${b.bill_type} ${b.description || ''} ${b.notes || ''} ${b.head_of_account || ''} ${b.cp_no || ''}`.toLowerCase()
    return hay.includes(q.toLowerCase())
  }), [bills, q, scope, fStatus, admin, profile.id])

  const stats = useMemo(() => ({
    total: visible.length,
    approved: visible.filter(b => b.status === 'approved' || b.status === 'paid').length,
    processing: visible.filter(b => b.status === 'processing' || b.status === 'submitted').length,
    assignedMe: bills.filter(b => b.assigned_to === profile.id).length,
    claim: visible.reduce((s, b) => s + Number(b.amount || 0), 0),
  }), [visible, bills, profile.id])

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const selectedUser = users.find(u => u.id === (form.user_id || profile.id))

  async function addRecord(e) {
    e.preventDefault()
    if (!form.description && !form.inward_no && !form.amount) { toast('Enter at least a description, inward no. or claim amount', 'err'); return }
    if (form.drive_url && !isDriveLink(form.drive_url)) { toast('Bill copy link must be a Google Drive URL', 'err'); return }
    setBusy(true)
    try {
      const patch = {
        ...form,
        amount: Number(form.amount) || 0,
        due_date: form.due_date || null,
        assigned_to: admin ? (form.assigned_to || null) : null,
        user_id: admin && form.user_id ? form.user_id : profile.id,
      }
      if (file) { const d = await api.uploadDoc(file); patch.doc_url = d.url; patch.doc_name = d.name }
      await api.createBill(patch)
      toast('Record added 🧾')
      setForm(BLANK(profile)); setFile(null)
      load()
    } catch (err) { toast(err.message, 'err') }
    finally { setBusy(false) }
  }

  async function patchBill(id, patch, msg) {
    try {
      const upd = await api.updateBill(id, patch)
      setBills(bs => bs.map(x => x.id === id ? { ...x, ...upd, owner: x.owner } : x))
      if (msg) toast(msg)
    } catch (e) { toast(e.message, 'err') }
  }
  async function doDelete() {
    setBusy(true)
    try { await api.deleteBill(deleting.id); toast('Record deleted 🗑️'); setDeleting(null); load() }
    catch (e) { toast(e.message, 'err') }
    finally { setBusy(false) }
  }

  function exportCSV() {
    const head = ['Inward No', 'Name', 'Designation', 'Bills Type', 'Date', 'Description', 'Claim ₹', 'E-Office', 'Status', 'Head of Account', 'CP No', 'Modified', 'Doc', 'Remarks', 'Assigned']
    const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`
    const rows = visible.map(b => [
      b.inward_no, b.owner?.full_name, b.owner?.designation, b.bill_type, b.bill_date,
      b.description, b.amount, b.e_office, statusLabel(b.status), b.head_of_account,
      b.cp_no, fmtDate(b.updated_at), b.doc_url || b.drive_url || '', b.notes,
      b.assignee?.full_name || userName(b.assigned_to),
    ])
    const csv = [head, ...rows].map(r => r.map(esc).join(',')).join('\n')
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `bill-records-${todayISO()}.csv`
    a.click(); URL.revokeObjectURL(a.href)
    toast(`Exported ${visible.length} records to CSV 📤`)
  }

  return (
    <>
      {/* ---- stat cards ---- */}
      <div className="stat-cards">
        <div className="statcard"><div className="k">Total Bills</div><div className="v">{stats.total}</div></div>
        {!admin && <div className="statcard"><div className="k">Assigned to me</div><div className="v" style={{ color: 'var(--accent)' }}>{stats.assignedMe}</div></div>}
        <div className="statcard"><div className="k">Approved</div><div className="v" style={{ color: 'var(--ok)' }}>{stats.approved}</div></div>
        {admin
          ? <div className="statcard"><div className="k">Members</div><div className="v" style={{ color: 'var(--danger)' }}>{users.length || '…'}</div></div>
          : <div className="statcard"><div className="k">In Processing</div><div className="v" style={{ color: 'var(--warn)' }}>{stats.processing}</div></div>}
        <div className="statcard"><div className="k">Total Claim</div><div className="v">{fmtMoney(stats.claim)}</div></div>
      </div>

      {/* ---- toolbar: tabs · filters · search · export ---- */}
      <div className="toolbar">
        {admin && (
          <div className="tabs">
            <button className={`tab ${tab === 'bills' ? 'active' : ''}`} onClick={() => setTab('bills')}>Bills</button>
            <button className={`tab ${tab === 'members' ? 'active' : ''}`} onClick={() => setTab('members')}>Members</button>
          </div>
        )}
        {!admin && (
          <select className="field scope-sel" value={scope} onChange={e => setScope(e.target.value)}>
            <option value="all">All my bills</option>
            <option value="assigned">Assigned to me</option>
            <option value="mine">My own bills</option>
          </select>
        )}
        <select className="field scope-sel" value={fStatus} onChange={e => setFStatus(e.target.value)} title="Filter by status">
          <option value="all">All statuses</option>
          {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <div className="row search-box">
          <Icon name="search" size={15} style={{ color: 'var(--muted)' }} />
          <input className="field bare" placeholder="Search records by name, inward no, description…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <span className="grow" />
        <button className="btn green" onClick={exportCSV}><Icon name="upload" size={15} /> Export CSV</button>
      </div>

      {!admin && (
        <div className="member-note">
          👁️ <b>Member view</b> — you see bills <b>assigned to you</b> and your own submissions, with live status.
          Adding records &amp; changing status is done by the admins.
        </div>
      )}

      {tab === 'bills' ? (
        <>
          {/* ---- inline ADD RECORD form ---- */}
          {admin && <form className="card addrec-card" onSubmit={addRecord}>
            <div className="addrec">
              <input className="field" placeholder="Inward No" value={form.inward_no} onChange={set('inward_no')} />
              {admin ? (
                <select className="field" value={form.user_id} onChange={set('user_id')} title="Record of">
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              ) : (
                <input className="field" value={profile.full_name} disabled title="Your name" />
              )}
              <input className="field" value={selectedUser?.designation || profile.designation || ''} disabled placeholder="Designation" title="Designation (from profile)" />
              <select className="field" value={form.bill_type} onChange={set('bill_type')}>
                {types.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
              </select>
              <input className="field" type="date" title="Bill date" value={form.bill_date} onChange={set('bill_date')} />
              <input className="field" placeholder="Description" value={form.description} onChange={set('description')} />
              <input className="field" type="number" min="0" step="0.01" placeholder="Claim ₹" value={form.amount} onChange={set('amount')} />
              <input className="field" placeholder="e-office" value={form.e_office} onChange={set('e_office')} />
              <select className="field" value={form.status} onChange={set('status')}>
                {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <input className="field" placeholder="Head of Account" value={form.head_of_account} onChange={set('head_of_account')} />
              <input className="field" placeholder="CP No" value={form.cp_no} onChange={set('cp_no')} />
              <input className="field" type="date" title="Due date (optional — used for reminders)" value={form.due_date} onChange={set('due_date')} />
              {admin && (
                <select className="field" value={form.assigned_to} onChange={set('assigned_to')}>
                  <option value="">Assign to…</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              )}
              <label className="field file-field" title="Upload bill copy">
                <Icon name="upload" size={14} /> <span>{file ? file.name.slice(0, 18) : 'Choose File'}</span>
                <input type="file" hidden onChange={e => { setFile(e.target.files?.[0] || null); e.target.value = '' }} />
              </label>
              <input className="field" placeholder="Drive Link" value={form.drive_url} onChange={set('drive_url')} style={form.drive_url && !isDriveLink(form.drive_url) ? { borderColor: 'var(--danger)' } : undefined} />
              <input className="field" placeholder="Remarks" value={form.notes} onChange={set('notes')} />
              <button className="btn primary addbtn" disabled={busy}>{busy ? 'Adding…' : 'Add Record'}</button>
            </div>
          </form>}

          {/* ---- records table ---- */}
          <div className="card" style={{ padding: 6, marginTop: 14 }}>
            {loading ? <div className="empty">Loading records…</div> : visible.length === 0 ? (
              <Empty title="No records found" sub={q ? 'Try a different search.' : 'Add your first record using the form above.'} />
            ) : (
              <div className="table-wrap">
                <table className="tbl compact" style={{ minWidth: 1520 }}>
                  <thead><tr>
                    <th>Inward No</th><th>Name</th><th>Designation</th><th>Bills Type</th><th>Date</th>
                    <th>Description</th><th>Claim ₹</th><th>E-<br />Office</th><th>Status</th>
                    <th>Head<br />Account</th><th>CP No</th><th>Modified</th><th>Doc</th><th>Remarks</th><th>Assigned</th><th>Action</th>
                  </tr></thead>
                  <tbody>
                    {visible.map(b => {
                      const editable = canEdit(b)
                      return (
                        <tr key={b.id}>
                          <td className="muted small">{b.inward_no || '—'}</td>
                          <td style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>{b.owner?.full_name || '—'}</td>
                          <td className="muted small" style={{ whiteSpace: 'nowrap' }}>{b.owner?.designation || '—'}</td>
                          <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{catIcon(b.bill_type)} {b.bill_type}</td>
                          <td className="small" style={{ whiteSpace: 'nowrap' }}>{fmtDate(b.bill_date)}</td>
                          <td style={{ maxWidth: 260, fontSize: 13 }}>{b.description || '—'}</td>
                          <td style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>{fmtMoney(b.amount)}</td>
                          <td className="muted small">{b.e_office || '—'}</td>
                          <td>
                            {admin ? (
                              <select className={`field st-sel st-${b.status}`} value={b.status}
                                onChange={e => patchBill(b.id, { status: e.target.value }, `Status → ${statusLabel(e.target.value)}`)}>
                                {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                              </select>
                            ) : <StatusBadge bill={b} />}
                          </td>
                          <td className="muted small">{b.head_of_account || '—'}</td>
                          <td className="muted small">{b.cp_no || '—'}</td>
                          <td className="muted small" style={{ whiteSpace: 'nowrap' }}>{fmtDate(b.updated_at)}</td>
                          <td style={{ textAlign: 'center' }}>
                            {(b.doc_url || b.drive_url)
                              ? <button className="doc-link" onClick={() => setViewing(b)}>View</button>
                              : <span className="no-file">No<br />File</span>}
                          </td>
                          <td className="muted small" style={{ maxWidth: 200 }}>{b.notes || '—'}</td>
                          <td>
                            {admin ? (
                              <select className="field as-sel" value={b.assigned_to || ''}
                                onChange={e => patchBill(b.id, { assigned_to: e.target.value || null }, 'Assignee updated')}>
                                <option value="">—</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                              </select>
                            ) : (
                              <span className="small" style={{ whiteSpace: 'nowrap' }}>
                                {b.assigned_to === profile.id
                                  ? <b style={{ color: 'var(--accent)' }}>You ◀</b>
                                  : (b.assignee?.full_name || '—')}
                              </span>
                            )}
                          </td>
                          <td>
                            <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                              {editable && (
                                <button className="iconbtn" title="Edit record" onClick={() => setEditing(b)}>
                                  <Icon name="edit" size={14} />
                                </button>
                              )}
                              {editable && (
                                <button className="iconbtn danger" title="Delete record" onClick={() => setDeleting(b)}>
                                  <Icon name="x" size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* ---- MEMBERS tab ---- */
        <MembersTab users={users} bills={bills} master={master} me={profile}
          onChanged={load} onError={(m) => toast(m, 'err')} onOk={(m) => toast(m)} />
      )}

      {editing && (
        <EditModal bill={editing} types={types} users={users} admin={admin} profile={profile}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); toast('Record updated ✏️'); load() }} />
      )}
      {deleting && (
        <Confirm title="Delete this record?"
          message={`"${deleting.description || deleting.bill_type}" (${fmtMoney(deleting.amount)}) will be permanently removed.`}
          onYes={doDelete} onClose={() => setDeleting(null)} busy={busy} />
      )}
      {viewing && <DocModal bill={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}

/* ================= Members tab ================= */
function MembersTab({ users, bills, master, me, onChanged, onOk, onError }) {
  const [q, setQ] = useState('')
  const [busyId, setBusyId] = useState(null)

  async function changeRole(u, role) {
    if (role === u.role) return
    setBusyId(u.id)
    try { await api.adminUpdateUser(u.id, { role }); onOk(`${u.full_name} is now ${role === 'sub_admin' ? 'a Sub Admin 🛡️' : role === 'master_admin' ? 'a Master Admin 👑' : 'a Member'}`); onChanged() }
    catch (e) { onError(e.message) }
    finally { setBusyId(null) }
  }
  async function toggleActive(u) {
    setBusyId(u.id)
    try { await api.adminUpdateUser(u.id, { is_active: !u.is_active }); onOk(u.is_active ? `${u.full_name} deactivated 🚫` : `${u.full_name} re-activated ✅`); onChanged() }
    catch (e) { onError(e.message) }
    finally { setBusyId(null) }
  }

  const list = users.filter(u => `${u.full_name} ${u.email} ${u.designation}`.toLowerCase().includes(q.toLowerCase()))
  const count = (uid) => bills.filter(b => b.user_id === uid).length

  return (
    <div className="card" style={{ padding: 6 }}>
      <div className="toolbar" style={{ margin: '8px 8px 10px' }}>
        <div className="row search-box" style={{ maxWidth: 320 }}>
          <Icon name="search" size={15} style={{ color: 'var(--muted)' }} />
          <input className="field bare" placeholder="Search members…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        {!master && <span className="badge b-role-sub">Sub Admin — read-only</span>}
      </div>
      {list.length === 0 ? <Empty icon="users" title="No members found" /> : (
        <div className="table-wrap">
          <table className="tbl compact" style={{ minWidth: 860 }}>
            <thead><tr>
              <th>Member</th><th>Designation</th><th>WhatsApp</th><th>Bills</th><th>Role</th><th>Status</th>
              {master && <th style={{ textAlign: 'right' }}>Manage</th>}
            </tr></thead>
            <tbody>
              {list.map(u => (
                <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.55 }}>
                  <td>
                    <div className="row" style={{ gap: 10 }}>
                      <Avatar name={u.full_name} url={u.avatar_url} size={32} />
                      <div>
                        <div style={{ fontWeight: 800 }}>{u.full_name}{u.id === me.id && <span className="muted small"> (you)</span>}</div>
                        <div className="muted small">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="small">{u.designation || '—'}</td>
                  <td className="small">{u.phone || '—'}</td>
                  <td style={{ fontWeight: 800 }}>{count(u.id)}</td>
                  <td><RoleBadge role={u.role} /></td>
                  <td>{u.is_active ? <span className="badge b-paid">Active</span> : <span className="badge b-inactive">Deactivated</span>}</td>
                  {master && (
                    <td>
                      <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                        <select className="field st-sel" value={u.role} disabled={busyId === u.id || u.id === me.id}
                          onChange={e => changeRole(u, e.target.value)}>
                          <option value="user">Member</option>
                          <option value="sub_admin">Sub Admin</option>
                          <option value="master_admin">Master Admin</option>
                        </select>
                        <button className="iconbtn danger" title={u.is_active ? 'Deactivate' : 'Re-activate'}
                          disabled={busyId === u.id || u.id === me.id} onClick={() => toggleActive(u)}>
                          <Icon name={u.is_active ? 'lock' : 'check'} size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ================= Edit modal (full record) ================= */
function EditModal({ bill, types, users, admin, profile, onClose, onSaved }) {
  const { toast } = useToast()
  const [f, setF] = useState({
    inward_no: bill.inward_no || '', user_id: bill.user_id, bill_type: bill.bill_type,
    bill_date: bill.bill_date || todayISO(), description: bill.description || '',
    amount: bill.amount ?? '', e_office: bill.e_office || '', status: bill.status,
    head_of_account: bill.head_of_account || '', cp_no: bill.cp_no || '',
    due_date: bill.due_date || '', assigned_to: bill.assigned_to || '',
    drive_url: bill.drive_url || '', notes: bill.notes || '',
  })
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }))
  const selectedUser = users.find(u => u.id === (f.user_id || profile.id))

  async function save(e) {
    e.preventDefault()
    if (f.drive_url && !isDriveLink(f.drive_url)) { toast('Bill copy link must be a Google Drive URL', 'err'); return }
    setBusy(true)
    try {
      const patch = { ...f, amount: Number(f.amount) || 0, due_date: f.due_date || null }
      if (!admin) { delete patch.user_id; delete patch.assigned_to }
      if (file) { const d = await api.uploadDoc(file); patch.doc_url = d.url; patch.doc_name = d.name }
      await api.updateBill(bill.id, patch)
      onSaved()
    } catch (err) { toast(err.message, 'err'); setBusy(false) }
  }

  return (
    <Modal title={`Edit record — ${bill.bill_type}`} onClose={onClose} width="680px">
      <form onSubmit={save}>
        <div className="addrec" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <div><label className="lbl">Inward No</label>
            <input className="field" value={f.inward_no} onChange={set('inward_no')} /></div>
          {admin ? (
            <div><label className="lbl">Record of</label>
              <select className="field" value={f.user_id} onChange={set('user_id')}>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select></div>
          ) : (
            <div><label className="lbl">Name</label>
              <input className="field" value={bill.owner?.full_name || profile.full_name} disabled /></div>
          )}
          <div><label className="lbl">Designation</label>
            <input className="field" value={selectedUser?.designation || bill.owner?.designation || ''} disabled /></div>
          <div><label className="lbl">Bills Type</label>
            <select className="field" value={f.bill_type} onChange={set('bill_type')}>
              {types.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select></div>
          <div><label className="lbl">Bill date</label>
            <input className="field" type="date" value={f.bill_date} onChange={set('bill_date')} /></div>
          <div><label className="lbl">Claim ₹</label>
            <input className="field" type="number" min="0" step="0.01" value={f.amount} onChange={set('amount')} /></div>
          <div><label className="lbl">Status</label>
            <select className="field" value={f.status} onChange={set('status')}>
              {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select></div>
          <div><label className="lbl">E-office</label>
            <input className="field" value={f.e_office} onChange={set('e_office')} /></div>
          <div className="full"><label className="lbl">Description</label>
            <input className="field" value={f.description} onChange={set('description')} /></div>
          <div><label className="lbl">Head of Account</label>
            <input className="field" value={f.head_of_account} onChange={set('head_of_account')} /></div>
          <div><label className="lbl">CP No</label>
            <input className="field" value={f.cp_no} onChange={set('cp_no')} /></div>
          <div><label className="lbl">Due date (reminders)</label>
            <input className="field" type="date" value={f.due_date} onChange={set('due_date')} /></div>
          {admin && (
            <div><label className="lbl">Assigned to</label>
              <select className="field" value={f.assigned_to} onChange={set('assigned_to')}>
                <option value="">—</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select></div>
          )}
          <div><label className="lbl">Replace file</label>
            <label className="field file-field"><Icon name="upload" size={14} /> <span>{file ? file.name.slice(0, 22) : 'Choose File'}</span>
              <input type="file" hidden onChange={e => { setFile(e.target.files?.[0] || null); e.target.value = '' }} />
            </label></div>
          <div className="full"><label className="lbl">Bill copy — Google Drive URL</label>
            <input className="field" value={f.drive_url} onChange={set('drive_url')} placeholder="https://drive.google.com/file/d/…/view" />
            {bill.doc_name && <p className="muted small" style={{ marginTop: 4 }}>Current file: {bill.doc_name}</p>}</div>
          <div className="full"><label className="lbl">Remarks</label>
            <input className="field" value={f.notes} onChange={set('notes')} /></div>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </Modal>
  )
}

/* ================= Doc viewer ================= */
function DocModal({ bill, onClose }) {
  const url = bill.doc_url || bill.drive_url
  const dp = drivePreview(url)
  const isImg = url.startsWith('data:image') || /\.(png|jpe?g|gif|webp)$/i.test(url)
  const isPdf = url.startsWith('data:application/pdf') || /\.pdf(\?|$)/i.test(url)
  return (
    <Modal title={`Document — ${bill.bill_type}${bill.doc_name ? ` (${bill.doc_name})` : ''}`} onClose={onClose} width="640px">
      {dp || isPdf ? (
        <iframe className="drive-frame" src={dp || url} title="Document preview" allow="autoplay" />
      ) : isImg ? (
        <img src={url} alt="Bill copy" style={{ width: '100%', maxHeight: 380, objectFit: 'contain', borderRadius: 10, background: 'var(--surface-2)' }} />
      ) : (
        <div className="empty"><div className="big">🔗</div>
          <div style={{ fontWeight: 700, color: 'var(--text)' }}>This link can't be previewed inline</div>
          <div className="small" style={{ marginTop: 4 }}>Open it in a new tab below.</div>
        </div>
      )}
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 14 }}>
        <span className="muted small" style={{ wordBreak: 'break-all' }}>{url}</span>
        <a className="btn" href={url} target="_blank" rel="noreferrer"><Icon name="external" size={15} /> Open</a>
      </div>
    </Modal>
  )
}
