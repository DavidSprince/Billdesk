import { supabase } from './supabaseClient'
import * as mock from './mockBackend'
import * as sb from './supabaseBackend'

// Demo Mode when Supabase env vars are absent — the whole UI stays fully
// functional with seeded local data, so you can try every role & theme.
export const MOCK = !supabase
export const api = MOCK ? mock.api : sb.api
export { resetDemo } from './mockBackend'
