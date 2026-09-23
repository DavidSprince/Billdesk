import { useState } from 'react'
import { useAuth, useToast } from '../context'
import { api } from '../lib/api'
import { Icon, Avatar, RoleBadge } from '../ui'
import { fmtDate } from '../lib/format'

export default function Profile() {
  const { profile, updateMe } = useAuth()
  const { toast } = useToast()
  const [f, setF] = useState({
    full_name: profile.full_name || '', designation: profile.designation || '', phone: profile.phone || '',
  })
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }))

  async function pickFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try { await api.uploadAvatar(file); toast('Profile photo updated 📸') }
    catch (err) { toast(err.message, 'err') }
    finally { setBusy(false) }
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const patch = { ...f }
      if (avatarUrl !== (profile.avatar_url || '')) patch.avatar_url = avatarUrl.trim() || null
      await updateMe(patch)
      toast('Profile saved ✅')
    } catch (err) { toast(err.message, 'err') }
    finally { setBusy(false) }
  }

  return (
    <div className="profile-grid">
      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ display: 'grid', placeItems: 'center', marginBottom: 12 }}>
          <Avatar name={f.full_name || profile.email} url={profile.avatar_url} size={92} />
        </div>
        <h2 style={{ fontSize: 18 }}>{profile.full_name}</h2>
        <p className="muted small" style={{ margin: '3px 0 10px' }}>{profile.designation || 'No designation set'}</p>
        <RoleBadge role={profile.role} />
        <p className="muted small" style={{ marginTop: 14 }}>Member since {fmtDate(profile.created_at)}</p>

        <label className="btn" style={{ marginTop: 14, justifyContent: 'center', cursor: 'pointer' }}>
          <Icon name="camera" size={15} /> {busy ? 'Working…' : 'Change photo'}
          <input type="file" accept="image/*" hidden onChange={pickFile} />
        </label>
        {profile.avatar_url && (
          <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={async () => { await updateMe({ avatar_url: null }); toast('Photo removed') }}>
            Remove photo
          </button>
        )}
      </div>

      <form className="card" onSubmit={save}>
        <h3>✏️ Edit profile</h3>
        <div className="fgrid">
          <div><label className="lbl">Full name</label>
            <input className="field" value={f.full_name} onChange={set('full_name')} placeholder="Your name" required /></div>
          <div><label className="lbl">Designation</label>
            <input className="field" value={f.designation} onChange={set('designation')} placeholder="e.g. Senior Accountant" /></div>
          <div><label className="lbl">WhatsApp number (for bill reminders)</label>
            <input className="field" value={f.phone} onChange={set('phone')} placeholder="+91 98xxx xxxxx" /></div>
          <div><label className="lbl">Email (read-only)</label>
            <input className="field" value={profile.email} disabled style={{ opacity: .65 }} /></div>
          <div className="full"><label className="lbl">Profile image URL (or upload from the left)</label>
            <input className="field" value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://…/photo.jpg" /></div>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
        </div>
        <p className="muted small" style={{ marginTop: 12 }}>
          💡 Your WhatsApp number is used by the Supabase Edge Function + Twilio to send bill reminders.
        </p>
      </form>
    </div>
  )
}
