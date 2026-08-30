import type { Session } from '@supabase/supabase-js'
import { uploadToCloudinary } from './cloudinary'
import { AUTH_STORAGE_KEY, SUPABASE_URL, supabase } from './supabase'

export function isSessionForCurrentProject(session: { accessToken: string }): boolean {
  try {
    const parts = session.accessToken.split('.')
    if (parts.length !== 3) return false
    let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    payload += '='.repeat((4 - (payload.length % 4)) % 4)
    const claims = JSON.parse(atob(payload)) as { iss?: unknown }
    return typeof claims.iss === 'string' && claims.iss.startsWith(SUPABASE_URL)
  } catch {
    return false
  }
}

export async function discardLocalSession(): Promise<void> {
  await supabase.auth.stopAutoRefresh()
  localStorage.removeItem(AUTH_STORAGE_KEY)
}

export interface AuthUser {
  id: string
  email: string
}

export interface AuthSession {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

export interface Profile {
  username: string
  avatarUrl: string | null
}

export interface SignupResult {
  existingAccount: boolean
  session: AuthSession | null
}

export interface AuthGateway {
  currentSession(): Promise<AuthSession | null>
  signIn(email: string, password: string): Promise<AuthSession>
  signUp(email: string, password: string, username: string): Promise<SignupResult>
  signOut(): Promise<void>
  loadProfile(session: AuthSession): Promise<Profile>
  saveProfile(session: AuthSession, username: string, avatarUrl: string | null): Promise<Profile>
  uploadAvatar(session: AuthSession, file: File): Promise<string>
  requestPasswordReset(email: string): Promise<void>
  updatePassword(newPassword: string): Promise<void>
  onAuthEvent(handler: (event: string) => void): () => void
}

function requireSession(session: Session | null): AuthSession {
  if (!session?.user.email) throw new Error('Supabase did not return an authenticated email session')
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    user: { id: session.user.id, email: session.user.email },
  }
}

function fallbackUsername(email: string): string {
  return email.split('@')[0]?.slice(0, 40) || 'Hikalist user'
}

export function createSupabaseAuthGateway(): AuthGateway {
  return {
    async currentSession() {
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      return data.session ? requireSession(data.session) : null
    },

    async signIn(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      return requireSession(data.session)
    },

    async signUp(email, password, username) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      })
      if (error) throw error
      const existingAccount = data.user?.identities?.length === 0
      return {
        existingAccount,
        session: existingAccount ? null : requireSession(data.session),
      }
    },

    async signOut() {
      const { error } = await supabase.auth.signOut({ scope: 'global' })
      if (error) throw error
    },

    async loadProfile(session) {
      const { data, error } = await supabase
        .from('hika_profiles')
        .select('username, avatar_url')
        .eq('user_id', session.user.id)
        .maybeSingle()
      if (error) throw error
      if (data) return { username: data.username, avatarUrl: data.avatar_url }
      return this.saveProfile(session, fallbackUsername(session.user.email), null)
    },

    async saveProfile(session, username, avatarUrl) {
      const profileValues = {
        username,
        email: session.user.email.toLowerCase(),
        avatar_url: avatarUrl,
      }
      const { data: updatedProfile, error: updateError } = await supabase
        .from('hika_profiles')
        .update(profileValues)
        .eq('user_id', session.user.id)
        .select('username, avatar_url')
        .maybeSingle()
      if (updateError) throw updateError
      if (updatedProfile) {
        return { username: updatedProfile.username, avatarUrl: updatedProfile.avatar_url }
      }

      const { data: insertedProfile, error: insertError } = await supabase
        .from('hika_profiles')
        .insert({ user_id: session.user.id, ...profileValues })
        .select('username, avatar_url')
        .single()
      if (insertError) throw insertError
      return { username: insertedProfile.username, avatarUrl: insertedProfile.avatar_url }
    },

    async uploadAvatar(session, file) {
      return uploadToCloudinary(file, `hikalist/avatars/${session.user.id}`)
    },

    async requestPasswordReset(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        // Always land on the production reset handler, never a dev origin like
        // localhost:5173 — Supabase only honors redirectTo URLs present in the
        // project's Site URL / Redirect URLs allowlist.
        redirectTo: 'https://hikalist.ahkur.my.id/',
      })
      if (error) throw error
    },

    async updatePassword(newPassword) {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
    },

    onAuthEvent(handler) {
      const { data } = supabase.auth.onAuthStateChange((event) => handler(event))
      return () => data.subscription.unsubscribe()
    },
  }
}
