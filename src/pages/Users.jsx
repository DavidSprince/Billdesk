import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth, useToast } from '../context'
import { Icon, Avatar, RoleBadge, Modal, Empty } from '../ui'
import { fmtDate } from '../lib/format'

export default function Users() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const master = profile.role === 'master_admin'
  const [users, setUsers] = useState(null)
  const [q, setQ] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)

  async function load() {
    try { setUsers(await api.listUsers()) }
    catch (e) { toast(e.message, 'err'); setUsers([]) }
  }
  useEffect(() => { load() }, []) // eslint-disable-line

  async function changeRole(u, role) {
    if (role === u.role) return
    setBusyId(u.id)
    try { await api.adminUpdateUser(u.id, { role }); toast(`${u.full_name} is now ${role === 'sub_admin' ? 'a Sub Admin 🛡️' : role === 'master_admin' ? 'a Master Admin 👑' : 'a Member'}`); load() }
    catch (e) { toast(e.message, 'err') }
    finally { setBusyId(null) }
  }
  async function toggleActive(u) {
    setBusyId(u.id)
    try { await api.adminUpdateUser(u.id, { is_active: !u.is_active }); toast(u.is_active ? `${u.full_name} deactivated 🚫` : `${u.full_name} re-activated ✅`); load() }
    catch (e) { toast(e.message, 'err') }
    finally { setBusyId(null) }
  }

  if (users === null) return <div className="card"><p className="muted">Loading users…</p></div>

  const list = users.filter(u => `${u.full_name} ${u.email} ${u.designation}`.toLowerCase().includes(q.toLowerCase()))
  const counts = {
    total: users.length,
    masters: users.filter(u => u.role === 'master_admin').length,
    subs: users.filter(u => u.role === 'sub_admin').length,
    active: users.filter(u => u.is_active).length,
  }

  return (
    <>
      <div className="stat-grid" style={{ marginBottom: 14 }}>
        <div className="card stat"><div className="k"><Icon name="users" size={14} /> Total users</div><div className="v">{counts.total}</div></div>
        <div className="card stat"><div className="k"><span className="crown"><Icon name="crown" size={14} /></span> Master Admins</div><div className="v">{counts.masters}</div></div>
        <div className="card stat"><div className="k"><Icon name="shield" size={14} /> Sub Admins</div><div className="v">{counts.subs}</div></div>
        <div className="card stat"><div className="k"><Icon name="check" size={14} /> Active</div><div className="v">{counts.active}</div></div>
      </div>

      <div className="filter-bar">
        <div className="row" style={{ flex: 1, minWidth: 200 }}>
          <Icon name="search" size={15} style={{ color: 'var(--muted)' }} />
          <input className="field" style={{ flex: 1 }} placeholder="Search users…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        {master && (
          <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" size={15} /> Add user</button>
        )}
        {!master && <span className="badge b-role-sub">Sub Admin — read-only access</span>}
      </div>

      <div className="card" style={{ padding: 6 }}>
        {list.length === 0 ? <Empty icon="users" title="No users found" /> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr>
                <th>User</th><th>Designation</th><th>WhatsApp</th><th>Role</th><th>Joined</th><th>Status</th>
                {master && <th style={{ textAlign: 'right' }}>Manage</th>}
              </tr></thead>
              <tbody>
                {list.map(u => (
                  <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.55 }}>
                    <td>
                      <div className="row" style={{ gap: 10 }}>
                        <Avatar name={u.full_name} url={u.avatar_url} size={34} />
                        <div>
                          <div style={{ fontWeight: 700 }}>{u.full_name}{u.id === profile.id && <span className="muted small"> (you)</span>}</div>
                          <div className="muted small">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="small">{u.designation || '—'}</td>
                    <td className="small">{u.phone || '—'}</td>
                    <td><RoleBadge role={u.role} /></td>
                    <td className="small" style={{ whiteSpace: 'nowrap' }}>{fmtDate(u.created_at)}</td>
                    <td>{u.is_active ? <span className="badge b-paid">Active</span> : <span className="badge b-inactive">Deactivated</span>}</td>
                    {master && (
                      <td>
                        <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                          <button className="iconbtn" title="Edit user (name, designation, password…)" onClick={() => setEditing(u)}>
                            <Icon name="edit" size={15} />
                          </button>
                          <select className="field" style={{ width: 140, padding: '6px 9px', fontSize: 12.5 }}
                            value={u.role} disabled={busyId === u.id || u.id === profile.id}
                            onChange={e => changeRole(u, e.target.value)}>
                            <option value="user">Member</option>
                            <option value="sub_admin">Sub Admin</option>
                            <option value="master_admin">Master Admin</option>
                          </select>
                          <button className="iconbtn danger" title={u.is_active ? 'Deactivate' : 'Re-activate'}
                            disabled={busyId === u.id || u.id === profile.id}
                            onClick={() => toggleActive(u)}>
                            <Icon name={u.is_active ? 'lock' : 'check'} size={15} />
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
      {master && (
        <p className="muted small" style={{ marginTop: 10 }}>
          👑 <b>Add user</b> creates an account with a password. <b>Edit ✏️</b> changes the user's name, designation, WhatsApp and password. Golden-theme access follows the role automatically.
        </p>
      )}

      {adding && <UserModal onClose={() => setAdding(false)}
        onSaved={() => { setAdding(false); toast('User created ✅'); load() }} />}
      {editing && <UserModal user={editing} onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); toast('User updated ✏️'); load() }} />}
    </>
  )
}

/* ============ Add / Edit user modal (Master Admin) ============ */
function UserModal({ user, onClose, onSaved }) {
  const { toast } = useToast()
  const isEdit = !!user
  const [f, setF] = useState(isEdit ? {
    full_name: user.full_name, email: user.email, password: '',
    designation: user.designation || '', phone: user.phone || '',
    avatar_url: user.avatar_url || '', role: user.role,
  } : {
    full_name: '', email: '', password: '', designation: '', phone: '', role: 'user',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }))

  async function save(e) {
    e.preventDefault()
    if (!isEdit && (!f.full_name || !f.email || f.password.length < 4)) { toast('Name, email and a password (4+ chars) are required', 'err'); return }
    setBusy(true)
    try {
      if (isEdit) {
        const patch = { full_name: f.full_name, designation: f.designation, phone: f.phone }
        if (f.avatar_url !== (user.avatar_url || '')) patch.avatar_url = f.avatar_url.trim() || null
        if (f.password) patch.password = f.password
        await api.adminUpdateUser(user.id, patch)
      } else {
        await api.createUser({ ...f })
      }
      onSaved()
    } catch (err) { toast(err.message, 'err'); setBusy(false) }
  }

  return (
    <Modal title={isEdit ? `Edit user — ${user.full_name}` : 'Add user'} onClose={onClose} width="560px">
      <form onSubmit={save}>
        <div className="addrec" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div><label className="lbl">Full name *</label>
            <input className="field" value={f.full_name} onChange={set('full_name')} placeholder="e.g. Priya Nair" required /></div>
          <div><label className="lbl">Email {!isEdit && '* (login id)'}</label>
            <input className="field" type="email" value={f.email} onChange={set('email')} disabled={isEdit} placeholder="name@office.gov.in" /></div>
          <div><label className="lbl">{isEdit ? 'New password (blank = keep current)' : 'Password *'}</label>
            <input className="field" type="text" value={f.password} onChange={set('password')}
              placeholder={isEdit ? '••••••' : 'Min 4 characters'} autoComplete="new-password" /></div>
          <div><label className="lbl">Designation</label>
            <input className="field" value={f.designation} onChange={set('designation')} placeholder="e.g. First Division Clerk" /></div>
          <div><label className="lbl">WhatsApp number</label>
            <input className="field" value={f.phone} onChange={set('phone')} placeholder="+91 98xxx xxxxx" /></div>
          <div><label className="lbl">Role</label>
            <select className="field" value={f.role} onChange={set('role')} disabled={isEdit && user.id === user.id && false}>
              <option value="user">Member</option>
              <option value="sub_admin">Sub Admin</option>
              <option value="master_admin">Master Admin</option>
            </select></div>
          {isEdit && (
            <div className="full"><label className="lbl">Profile image URL</label>
              <input className="field" value={f.avatar_url} onChange={set('avatar_url')} placeholder="https://…/photo.jpg" /></div>
          )}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create user'}</button>
        </div>
        {!isEdit && <p className="muted small" style={{ marginTop: 10 }}>The new user can sign in immediately with this email &amp; password. Share the credentials securely.</p>}
      </form>
    </Modal>
  )
}
