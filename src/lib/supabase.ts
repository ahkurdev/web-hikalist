import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://api-hikalist.ahkur.my.id'
export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6Imh0dHBzOi8vYXBpLWhpa2FsaXN0LmFoa3VyLm15LmlkIiwiaWF0IjoxNzkxNDAwMDAwLCJleHAiOjIxMDY3NjAwMDB9.Xg9wI1QPMGoOFp1ecXwJipbTkm_cwLdpS-aIEI0pD_o'

export const AUTH_STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
    storageKey: AUTH_STORAGE_KEY,
  },
})
