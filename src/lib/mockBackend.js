// Demo Mode backend — mirrors the Supabase schema in localStorage/memory.
// Used automatically when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set.
import { store } from './storage'
import { BILL_TYPES } from './categories'
import { addDaysISO, isDriveLink } from './format'

const DB_KEY = 'billdesk_db_v5'
const SES_KEY = 'billdesk_session_v2'

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2))
const delay = (ms = 120) => new Promise(r => setTimeout(r, ms))
const fail = (msg) => { throw new Error(msg) }
const daysAgoISO = (n) => new Date(Date.now() - n * 86400000).toISOString()

function seed() {
  const profiles = [
    { id: 'u1', email: 'master@demo.io', password: 'demo1234', full_name: 'Ramesh Gowda', designation: 'Administrative Officer', avatar_url: null, phone: '+91 98450 11223', role: 'master_admin', theme: 'golden', is_active: true, created_at: daysAgoISO(400) },
    { id: 'u2', email: 'sub@demo.io', password: 'demo1234', full_name: 'Arun Kumar', designation: 'Senior Accountant', avatar_url: null, phone: '+91 98860 44510', role: 'sub_admin', theme: 'dark', is_active: true, created_at: daysAgoISO(320) },
    { id: 'u3', email: 'user@demo.io', password: 'demo1234', full_name: 'Sudha Kumari', designation: 'Ad M&A', avatar_url: null, phone: '+91 97390 81245', role: 'user', theme: 'dark', is_active: true, created_at: daysAgoISO(240) },
    { id: 'u4', email: 'deepa@demo.io', password: 'demo1234', full_name: 'Deepa Nair', designation: 'First Division Clerk', avatar_url: null, phone: '+91 96110 33450', role: 'user', theme: 'ocean', is_active: true, created_at: daysAgoISO(180) },
    { id: 'u5', email: 'vikram@demo.io', password: 'demo1234', full_name: 'Vikram Rao', designation: 'Field Executive', avatar_url: null, phone: '+91 90080 71234', role: 'user', theme: 'forest', is_active: false, created_at: daysAgoISO(120) },
  ]
  const b = (inward_no, user_id, bill_type, bill_date, description, amount, status, extra = {}) => ({
    id: uid(), user_id, inward_no, bill_type, bill_date, description,
    amount, status, e_office: null, head_of_account: null, cp_no: null,
    due_date: null, drive_url: null, doc_url: null, doc_name: null,
    notes: '', assigned_to: null,
    created_at: daysAgoISO(90), updated_at: daysAgoISO(30), ...extra,
  })
  const bills = [
    // — current, mirroring a live inward register —
    b('IN-104', 'u3', 'TA Bill', '2026-07-29', 'TA bill of JSJB site visit Ramonagara', 2835, 'submitted',
      { assigned_to: 'u2', updated_at: daysAgoISO(2), created_at: daysAgoISO(20) }),
    b('IN-098', 'u3', 'TA Advance', '2026-08-21', 'TA Advance for Deputation of harding bridge bangaladesh, at Delhi', 6500, 'processing',
      { assigned_to: 'u2', updated_at: daysAgoISO(4), created_at: daysAgoISO(22) }),
    b('IN-099', 'u3', 'TA Bill', '2026-08-21', 'TA Bill of JSJB Filed visit DC office Kamanagara.', 1420, 'processing',
      { due_date: addDaysISO(-3), assigned_to: 'u1', updated_at: daysAgoISO(4), created_at: daysAgoISO(22) }),
    b('IN-087', 'u3', 'TA Bill', '2026-08-12', 'Tour from 04-01-2026 to 09-01-2026 Goa, Resubmitted an', 3180, 'processing',
      { updated_at: daysAgoISO(6), created_at: daysAgoISO(26) }),
    b('IN-090', 'u3', 'TA Bill', '2026-08-20', 'TA Bill of JSJB Filed visit DC office Doddaballapura Bengaluru Rural.', 2260, 'processing',
      { updated_at: daysAgoISO(5), created_at: daysAgoISO(24) }),
    b('IN-096', 'u3', 'TA Bill', '2026-09-10', 'TA bill — DC office visit Kamanagara', 1560, 'processing',
      { due_date: addDaysISO(2), updated_at: daysAgoISO(1), created_at: daysAgoISO(10) }),
    b('IN-101', 'u4', 'Medical Bill', '2026-09-02', 'Medical reimbursement — Apollo Hospital, Bengaluru', 12450, 'approved',
      { cp_no: 'CP-2231', head_of_account: '8449-00-101', assigned_to: 'u3', updated_at: daysAgoISO(3), created_at: daysAgoISO(14) }),
    b('IN-103', 'u4', 'Office Expense', '2026-09-15', 'Stationery & printer cartridges — July quarter', 1899, 'processing',
      { due_date: addDaysISO(5), assigned_to: 'u3', updated_at: daysAgoISO(2), created_at: daysAgoISO(8) }),
    b('IN-094', 'u2', 'Tour Bill', '2026-08-28', 'Field inspection tour — Tumakuru division', 4210, 'paid',
      { head_of_account: '8449-00-108', assigned_to: 'u3', updated_at: daysAgoISO(8), created_at: daysAgoISO(30) }),
    b('IN-088', 'u5', 'TA Bill', '2026-08-15', 'Bus fare claim — site visits', 640, 'rejected',
      { notes: 'Receipts missing — resubmit with original tickets', updated_at: daysAgoISO(9), created_at: daysAgoISO(28) }),
    b('IN-081', 'u1', 'Electricity', '2026-07-12', 'BESCOM office electricity — July', 4120, 'approved',
      { drive_url: 'https://drive.google.com/file/d/1a2B3c4D5e6F7g8H9i0JkLmNoPqRsTuV/view', assigned_to: 'u2', updated_at: daysAgoISO(7), created_at: daysAgoISO(32) }),
    b('IN-076', 'u1', 'Internet & Phone', '2026-07-05', 'ACT Fiber office broadband — July', 1183, 'paid',
      { updated_at: daysAgoISO(10), created_at: daysAgoISO(36) }),
    // — older history feeding the dashboard charts —
    b('IN-062', 'u2', 'Office Expense', '2026-06-18', 'Water cans & housekeeping — June', 850, 'paid', { updated_at: daysAgoISO(40), created_at: daysAgoISO(48) }),
    b('IN-070', 'u2', 'Internet & Phone', '2026-07-02', 'Jio postpaid — June', 599, 'paid', { updated_at: daysAgoISO(42), created_at: daysAgoISO(52) }),
    b('IN-055', 'u3', 'TA Bill', '2026-06-10', 'TA bill — site visit Yelahanka', 980, 'paid', { updated_at: daysAgoISO(45), created_at: daysAgoISO(58) }),
    b('IN-049', 'u1', 'Purchase Bill', '2026-05-22', 'Filing cabinets & racks purchase', 8699, 'paid', { cp_no: 'CP-2107', updated_at: daysAgoISO(60), created_at: daysAgoISO(66) }),
  ]
  return { profiles, bills, payments: [], notifications: [] }
}

export function loadDB() {
  try { const raw = store.getItem(DB_KEY); if (raw) return JSON.parse(raw) } catch {}
  const db = seed(); saveDB(db); return db
}
function saveDB(db) { store.setItem(DB_KEY, JSON.stringify(db)) }
export function resetDemo() { store.removeItem(DB_KEY); store.removeItem(SES_KEY); location.hash = ''; location.reload() }

const db = () => loadDB()
const me = () => {
  const sid = store.getItem(SES_KEY)
  if (!sid) return null
  return db().profiles.find(p => p.id === sid) || null
}
const shape = (p) => ({ user: { id: p.id, email: p.email }, profile: p })
const owner = (p) => p && ({ full_name: p.full_name, email: p.email, avatar_url: p.avatar_url, designation: p.designation })
const canAll = (p) => p && (p.role === 'sub_admin' || p.role === 'master_admin')

async function getSession() {
  await delay(60)
  const p = me(); return p ? shape(p) : null
}
const onAuthChange = () => () => {}

async function signIn(email, password) {
  await delay()
  const p = db().profiles.find(x => x.email.toLowerCase() === String(email).trim().toLowerCase())
  if (!p) fail('No account found with this email')
  if (!p.is_active) fail('Account deactivated — contact the Master Admin')
  if (p.password) {
    if (String(password) !== p.password) fail('Incorrect password')
  } else if (String(password).length < 4) {
    fail('Password must be at least 4 characters')
  }
  store.setItem(SES_KEY, p.id)
  return shape(p)
}

async function signUp({ email, password, full_name, designation, phone }) {
  await delay()
  const d = db()
  if (!email || !password || !full_name) fail('Name, email and password are required')
  if (String(password).length < 4) fail('Password must be at least 4 characters')
  if (d.profiles.some(x => x.email.toLowerCase() === String(email).toLowerCase())) fail('An account with this email already exists')
  const p = { id: uid(), email: String(email).trim(), full_name, designation: designation || '', avatar_url: null, phone: phone || '', role: 'user', theme: 'dark', is_active: true, created_at: new Date().toISOString() }
  d.profiles.push(p); saveDB(d)
  store.setItem(SES_KEY, p.id)
  return shape(p)
}

async function signOut() { store.removeItem(SES_KEY) }

async function updateMe(patch) {
  await delay(80)
  const d = db(); const p = d.profiles.find(x => x.id === me()?.id)
  if (!p) fail('Not signed in')
  Object.assign(p, patch); saveDB(d)
  return p
}

async function uploadFileGeneric(file, maxKB) {
  if (file.size > maxKB * 1024) fail(`File too large — please pick one under ${maxKB} KB (demo mode stores it locally)`)
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file)
  })
  return dataUrl
}

async function uploadAvatar(file) {
  const url = await uploadFileGeneric(file, 700)
  return updateMe({ avatar_url: url })
}

async function uploadDoc(file) {
  const url = await uploadFileGeneric(file, 450)
  return { url, name: file.name }
}

async function listUsers() {
  await delay(80)
  if (!canAll(me())) fail('Not allowed')
  return db().profiles.slice().sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
}

async function adminUpdateUser(id, patch) {
  await delay()
  const d = db(); const caller = me()
  if (!caller || caller.role !== 'master_admin') fail('Only the Master Admin can manage users')
  const p = d.profiles.find(x => x.id === id)
  if (!p) fail('User not found')
  // profile fields (name, designation, phone, avatar, password)
  for (const k of ['full_name', 'designation', 'phone', 'avatar_url', 'password']) {
    if (patch[k] !== undefined) {
      if (k === 'password' && String(patch[k]).length < 4) fail('Password must be at least 4 characters')
      p[k] = patch[k]
    }
  }
  if (patch.role !== undefined && patch.role !== p.role) {
    if (id === caller.id) fail('You cannot change your own role')
    if (patch.role !== 'master_admin' && p.theme === 'golden') p.theme = 'dark' // Golden is Master-Admin-only
    p.role = patch.role
  }
  if (patch.is_active !== undefined) {
    if (id === caller.id) fail('You cannot deactivate yourself')
    p.is_active = patch.is_active
  }
  saveDB(d)
  return p
}

async function createUser({ email, password, full_name, designation, phone, role }) {
  await delay()
  const d = db(); const caller = me()
  if (!caller || caller.role !== 'master_admin') fail('Only the Master Admin can add users')
  if (!email || !password || !full_name) fail('Name, email and password are required')
  if (String(password).length < 4) fail('Password must be at least 4 characters')
  if (d.profiles.some(x => x.email.toLowerCase() === String(email).toLowerCase())) fail('An account with this email already exists')
  const p = {
    id: uid(), email: String(email).trim(), password: String(password),
    full_name, designation: designation || '', avatar_url: null, phone: phone || '',
    role: ['user', 'sub_admin', 'master_admin'].includes(role) ? role : 'user',
    theme: 'dark', is_active: true, created_at: new Date().toISOString(),
  }
  d.profiles.push(p); saveDB(d)
  return p
}

function withOwner(list) {
  const d = db()
  return list.map(b => ({
    ...b,
    owner: owner(d.profiles.find(p => p.id === b.user_id)),
    assignee: owner(d.profiles.find(p => p.id === b.assigned_to)),
  }))
}

async function getBills() {
  await delay()
  const p = me(); if (!p) return []
  // Members see their own bills PLUS bills assigned to them for processing.
  const rows = canAll(p)
    ? db().bills
    : db().bills.filter(b => b.user_id === p.id || b.assigned_to === p.id)
  return withOwner(rows.slice().sort((a, b) => ((a.bill_date < b.bill_date) ? 1 : (a.bill_date > b.bill_date ? -1 : 0))))
}

function assertBillAccess(bill, patch) {
  const p = me()
  if (!p) fail('Not signed in')
  if (bill && bill.user_id !== p.id && !canAll(p)) fail('Not allowed')
  if (patch && patch.drive_url && !isDriveLink(patch.drive_url)) fail('Bill copy URL must be a Google Drive link (https://drive.google.com/…)')
}

async function createBill(fields) {
  await delay()
  const p = me(); const d = db()
  const row = {
    id: uid(),
    user_id: canAll(p) && fields.user_id ? fields.user_id : p.id,
    inward_no: fields.inward_no || null,
    bill_type: fields.bill_type || 'Other',
    bill_date: fields.bill_date || new Date().toISOString().slice(0, 10),
    description: fields.description || '',
    amount: Number(fields.amount) || 0,
    e_office: fields.e_office || null,
    status: fields.status || 'processing',
    head_of_account: fields.head_of_account || null,
    cp_no: fields.cp_no || null,
    due_date: fields.due_date || null,
    drive_url: fields.drive_url || null,
    doc_url: fields.doc_url || null,
    doc_name: fields.doc_name || null,
    notes: fields.notes || '',
    assigned_to: canAll(p) ? (fields.assigned_to || null) : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  assertBillAccess(null, fields)
  d.bills.push(row); saveDB(d)
  return row
}

async function updateBill(id, patch) {
  await delay()
  const d = db(); const b = d.bills.find(x => x.id === id)
  if (!b) fail('Bill not found')
  assertBillAccess(b, patch)
  const { user_id, assigned_to, ...rest } = patch
  if (user_id && canAll(me())) b.user_id = user_id // re-assign owner (admins only)
  if (assigned_to !== undefined && canAll(me())) b.assigned_to = assigned_to || null
  Object.assign(b, rest, { updated_at: new Date().toISOString() })
  saveDB(d)
  return b
}

async function deleteBill(id) {
  await delay()
  const d = db(); const b = d.bills.find(x => x.id === id)
  if (!b) fail('Bill not found')
  assertBillAccess(b)
  d.bills = d.bills.filter(x => x.id !== id); saveDB(d)
}

async function getCategories() { return BILL_TYPES.map(c => ({ ...c })) }

export const api = {
  getSession, onAuthChange, signIn, signUp, signOut,
  updateMe, uploadAvatar, uploadDoc, listUsers, adminUpdateUser, createUser,
  getBills, createBill, updateBill, deleteBill,
  getCategories, resetDemo, mock: true,
}
