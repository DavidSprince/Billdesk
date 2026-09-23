import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// null ⇒ the app runs in Demo Mode with a local mock backend
export const supabase = url && key ? createClient(url, key) : null
