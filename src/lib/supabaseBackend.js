// Production backend — talks to Supabase (Auth, Postgres w/ RLS, Storage).
// Row Level Security (see supabase/migration.sql) enforces the same rules
// as the demo backend: users see their own bills, admins see everything.
import { supabase } from './supabaseClient'

const PROFILE_COLS = 'full_name, email, avatar_url, designation'
const fail = (msg) => { throw new Error(msg) }

const shape = (user, profile) => ({ user: { id: user.id, email: user.email }, profile })

async function fetchProfile(id) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  return shape(session.user, await fetchProfile(session.user.id))
}

function onAuthChange(cb) {
  const { data } = supabase.auth.onAuthStateChange(async (event, s) => {
    if (event === 'SIGNED_OUT' || !s) return cb(null)
    try { cb(shape(s.user, await fetchProfile(s.user.id))) } catch { cb(null) }
  })
  return () => data.subscription.unsubscribe()
}

async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: String(email).trim(), password })
  if (error) fail(error.message)
  const profile = await fetchProfile(data.user.id)
  if (profile && profile.is_active === false) {
    await supabase.auth.signOut()
    fail('Account deactivated — contact the Master Admin')
  }
  return shape(data.user, profile)
}

async function signUp({ email, password, full_name, designation, phone }) {
  const { data, error } = await supabase.auth.signUp({
    email: String(email).trim(), password,
    options: { data: { full_name, designation: designation || '', phone: phone || '' } },
  })
  if (error) fail(error.message)
  // profile row is auto-created by the on_auth_user_created trigger
  let profile = null
  if (data.user) { await new Promise(r => setTimeout(r, 400)); profile = await fetchProfile(data.user.id).catch(() => null) }
  return data.user ? shape(data.user, profile) : null
}

const signOut = async () => { await supabase.auth.signOut() }

async function updateMe(patch) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) fail('Not signed in')
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', session.user.id).select().single()
  if (error) fail(error.message)
  return data
}

async function uploadToBucket(bucket, file, maxMB = 5) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) fail('Not signed in')
  if (file.size > maxMB * 1024 * 1024) fail(`File too large (max ${maxMB} MB)`)
  const safe = file.name.replace(/[^\w.\-]+/g, '_')
  const path = `${session.user.id}/${Date.now()}-${safe}`
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
  if (error) fail(error.message)
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

async function uploadAvatar(file) {
  const url = await uploadToBucket('avatars', file, 5)
  return updateMe({ avatar_url: url })
}

async function uploadDoc(file) {
  const url = await uploadToBucket('bill-copies', file, 10)
  return { url, name: file.name }
}

async function listUsers() {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at')
  if (error) fail(error.message)
  return data
}

async function adminUpdateUser(id, patch) {
  // Password changes need the admin API → routed through the Edge Function
  // (supabase/functions/admin-manage-user). Other fields go direct via RLS.
  const { password, ...rest } = patch
  if (password) {
    if (String(password).length < 6) fail('Password must be at least 6 characters')
    const { error } = await supabase.functions.invoke('admin-manage-user', {
      body: { action: 'set-password', id, password },
    })
    if (error) fail(error.message)
  }
  if (Object.keys(rest).length) {
    const { data, error } = await supabase.from('profiles').update(rest).eq('id', id).select().single()
    if (error) fail(error.message)
    return data
  }
  const { data } = await supabase.from('profiles').select('*').eq('id', id).single()
  return data
}

// Master Admin creates accounts (needs the service role → Edge Function)
async function createUser({ email, password, full_name, designation, phone, role }) {
  if (!email || !password || String(password).length < 6) fail('Name, email and a 6+ char password are required')
  const { data, error } = await supabase.functions.invoke('admin-manage-user', {
    body: { action: 'create', email, password, full_name, designation, phone, role },
  })
  if (error) fail(error.message)
  return data
}

async function getBills() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) fail('Not signed in')
  const me = await fetchProfile(session.user.id)
  const admin = me.role === 'sub_admin' || me.role === 'master_admin'

  let q = supabase
    .from('bills')
    .select(`*, owner:profiles!bills_user_id_fkey(${PROFILE_COLS}), assignee:profiles!bills_assigned_to_fkey(${PROFILE_COLS})`)
    .order('bill_date', { ascending: false })
    .order('created_at', { ascending: false })

  // Members: their own bills + bills assigned to them for processing
  if (!admin) q = q.or(`user_id.eq.${session.user.id},assigned_to.eq.${session.user.id}`)

  const { data, error } = await q
  if (error) fail(error.message)
  return (data || []).map(b => ({ ...b, amount: Number(b.amount) }))
}

async function createBill(fields) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) fail('Not signed in')
  const row = {
    user_id: fields.user_id || session.user.id,
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
    assigned_to: fields.assigned_to || null,
  }
  const { data, error } = await supabase.from('bills').insert(row).select().single()
  if (error) fail(error.message)
  return data
}

async function updateBill(id, patch) {
  const { data, error } = await supabase.from('bills').update(patch).eq('id', id).select().single()
  if (error) fail(error.message)
  return data
}

async function deleteBill(id) {
  const { error } = await supabase.from('bills').delete().eq('id', id)
  if (error) fail(error.message)
}

async function getCategories() {
  const { data, error } = await supabase.from('categories').select('*').order('id')
  if (error || !data?.length) fail(error?.message || 'No bill types — run the seed SQL')
  return data
}

export const api = {
  getSession, onAuthChange, signIn, signUp, signOut,
  updateMe, uploadAvatar, uploadDoc, listUsers, adminUpdateUser, createUser,
  getBills, createBill, updateBill, deleteBill,
  getCategories, mock: false,
}
