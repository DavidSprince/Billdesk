export const fmtMoney = (n) => '₹' + Number(n || 0).toLocaleString('en-IN')
export const fmtShort = (n) => {
  n = Number(n || 0)
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(1) + 'Cr'
  if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L'
  if (n >= 1000) return '₹' + (n / 1000).toFixed(1) + 'k'
  return '₹' + n
}
export const fmtDate = (d) => {
  if (!d) return '—'
  const dt = new Date(String(d).length <= 10 ? d + 'T00:00:00' : d)
  if (isNaN(dt)) return '—'
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
export const todayISO = () => new Date().toISOString().slice(0, 10)
export const addDaysISO = (n) => {
  const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10)
}
export const daysUntil = (d) => {
  if (!d) return null
  const due = new Date(d + 'T00:00:00'); const now = new Date(todayISO() + 'T00:00:00')
  return Math.round((due - now) / 86400000)
}

/* ------- Status workflow ------- */
export const STATUSES = [
  { id: 'processing', label: 'Processing' },
  { id: 'submitted', label: 'Submitted to Admin' },
  { id: 'approved', label: 'Approved' },
  { id: 'paid', label: 'Paid' },
  { id: 'rejected', label: 'Rejected' },
]
export const statusLabel = (s) => (STATUSES.find(x => x.id === s) || { label: s }).label
export const isActiveStatus = (b) => b.status === 'processing' || b.status === 'submitted'
export const isOverdue = (b) => isActiveStatus(b) && b.due_date && b.due_date < todayISO()

/* ------- Misc ------- */
export const hashHue = (s) => {
  let h = 0; for (const c of String(s || '?')) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}
export const drivePreview = (url) => {
  const m = String(url || '').match(/drive\.google\.com\/file\/d\/([^/]+)/)
  return m ? `https://drive.google.com/file/d/${m[1]}/preview` : null
}
export const isDriveLink = (url) => /^https:\/\/(drive|docs)\.google\.com\//.test(String(url || '').trim())
export const roleLabel = (r) => ({ master_admin: 'Master Admin', sub_admin: 'Sub Admin', user: 'Member' }[r] || r)
export const isAdminRole = (r) => r === 'sub_admin' || r === 'master_admin'
