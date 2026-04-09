import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// navigator.locks hangs indefinitely with sb_publishable_ keys in this version
// of supabase-js. Provide a no-op lock so auth initialization resolves
// immediately. Session persistence (localStorage) is unaffected.
const noLock = (_name, _timeout, fn) => fn()

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { lock: noLock },
})

export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'sb-kiosk-public',
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    lock: noLock,
  },
})
