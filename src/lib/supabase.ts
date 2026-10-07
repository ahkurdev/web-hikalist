import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://menfessdarmajaya.my.id/hikalist'
export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6Imh0dHBzOi8vbWVuZmVzc2Rhcm1hamF5YS5teS5pZC9oaWthbGlzdCIsImlhdCI6MTcyODI5MDAwMCwiZXhwIjoyMDQzNjUwMDAwfQ.gL-7u3aK87jXzN7RjJ4260a-t68JzYcR7l-5G9TvtfU'

export const AUTH_STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
    storageKey: AUTH_STORAGE_KEY,
  },
})
