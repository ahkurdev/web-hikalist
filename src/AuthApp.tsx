import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { discardLocalSession, isSessionForCurrentProject } from './lib/authGateway'
import type { AuthGateway, AuthSession, Profile } from './lib/authGateway'
import { normalizeAuthError, validateEmail, validatePassword, validateUsername } from './lib/authValidation'
import { validateAvatar } from './lib/avatarValidation'
import { parseDesktopHandoff, submitDesktopSession } from './lib/desktopHandoff'
import {
  parsePlaylistInviteToken,
  supabasePlaylistInviteGateway,
  type PlaylistInviteAcceptance,
  type PlaylistInviteGateway,
} from './lib/playlistInviteGateway'

type AuthScreen =
  | 'login'
  | 'register'
  | 'account'
  | 'connecting'
  | 'invite'
  | 'forgot'
  | 'recovery'

interface AuthAppProps {
  gateway: AuthGateway
  inviteGateway?: PlaylistInviteGateway
  search: string
}

export function AuthApp({ gateway, inviteGateway = supabasePlaylistInviteGateway, search }: AuthAppProps) {
  const params = useMemo(() => new URLSearchParams(search), [search])
  const desktopHandoff = useMemo(() => parseDesktopHandoff(params), [params])
  const inviteToken = useMemo(() => parsePlaylistInviteToken(params), [params])
  const initialScreen: AuthScreen =
    desktopHandoff?.initialMode === 'register' || params.get('mode') === 'register'
      ? 'register'
      : 'login'

  // A password-reset link delivers its token through the URL hash with
  // type=recovery. Supabase stores the recovered session during client init, so
  // currentSession() will already return it — but we must surface the update
  // form instead of signing the user straight into their account.
  const recoveryHash = useMemo(
    () => new URLSearchParams(window.location.hash.replace(/^#/, '')),
    [],
  )
  const isRecoveryLink = recoveryHash.get('type') === 'recovery'
  // When a reset link is opened after it expired or was already used, Supabase
  // redirects back with #error=access_denied&error_code=otp_expired. Surface a
  // clear message and clear the hash so the user isn't stuck on a dead URL.
  const recoveryError = recoveryHash.get('error')
  const isRecoveryError = recoveryError === 'access_denied' || recoveryHash.get('error_code') === 'otp_expired'

  const [screen, setScreen] = useState<AuthScreen>(initialScreen)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [session, setSession] = useState<AuthSession | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [inviteAcceptance, setInviteAcceptance] = useState<PlaylistInviteAcceptance | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [newPassword, setNewPassword] = useState('')

  async function finishAuthentication(nextSession: AuthSession, knownProfile?: Profile) {
    setSession(nextSession)
    if (inviteToken) {
      setScreen('connecting')
      try {
        const acceptance = await inviteGateway.accept(inviteToken, nextSession)
        setInviteAcceptance(acceptance)
        setScreen('invite')
      } catch (cause) {
        setScreen('login')
        throw cause
      }
      return
    }
    if (desktopHandoff) {
      setScreen('connecting')
      if (!isSessionForCurrentProject(nextSession)) {
        setError('Sesi web ini dari server Hikalist yang berbeda. Silakan masuk kembali.')
        setScreen('login')
        return
      }
      await discardLocalSession()
      submitDesktopSession(desktopHandoff, {
        accessToken: nextSession.accessToken,
        refreshToken: nextSession.refreshToken,
      })
      return
    }
    const nextProfile = knownProfile ?? await gateway.loadProfile(nextSession)
    setProfile(nextProfile)
    setUsername(nextProfile.username)
    setScreen('account')
  }

  useEffect(() => {
    let active = true
    let recovered = false
    const stopListening = gateway.onAuthEvent((event) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY') {
        recovered = true
        setScreen('recovery')
      }
    })
    if (desktopHandoff) {
      // Desktop handoff must always come from a fresh, explicit sign-in —
      // never from a session silently restored from localStorage.
      setScreen(initialScreen)
      return
    }
    if (isRecoveryError) {
      // A reset link opened after expiry/use bounces back with an error hash.
      // Tell the user clearly and drop the dead hash so a refresh is clean.
      setError('Tautan reset sudah kedaluwarsa atau sudah dipakai. Minta link baru dari halaman "Lupa password?".')
      setScreen('forgot')
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      }
      return
    }
    if (isRecoveryLink) {
      // The reset token already established a recovery session; show the update
      // form instead of treating it as a normal sign-in.
      setScreen('recovery')
      return
    }
    gateway
      .currentSession()
      .then(async (currentSession) => {
        if (active && currentSession && !recovered) await finishAuthentication(currentSession)
      })
      .catch((cause) => {
        if (!active) return
        setError(normalizeAuthError(cause instanceof Error ? cause.message : String(cause)))
        setScreen('login')
      })
    return () => {
      active = false
      stopListening()
    }
    // This initialization intentionally runs only for the provided gateway and URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateway, search, isRecoveryLink])

  function resetFeedback() {
    setError(null)
    setMessage(null)
  }

  async function run(action: () => Promise<void>) {
    resetFeedback()
    setLoading(true)
    try {
      await action()
    } catch (cause) {
      setError(normalizeAuthError(cause instanceof Error ? cause.message : String(cause)))
    } finally {
      setLoading(false)
    }
  }

  function validatedCredentials(): { email: string; password: string } | null {
    const validatedEmail = validateEmail(email)
    if (validatedEmail.error) {
      setError(validatedEmail.error)
      return null
    }
    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return null
    }
    return { email: validatedEmail.value, password }
  }

  function submitLogin(event: FormEvent) {
    event.preventDefault()
    resetFeedback()
    const credentials = validatedCredentials()
    if (!credentials) return
    void run(async () => finishAuthentication(await gateway.signIn(credentials.email, credentials.password)))
  }

  function submitRegistration(event: FormEvent) {
    event.preventDefault()
    resetFeedback()
    const credentials = validatedCredentials()
    const validatedUsername = validateUsername(username)
    if (!credentials) return
    if (validatedUsername.error) {
      setError(validatedUsername.error)
      return
    }
    setUsername(validatedUsername.value)
    setEmail(credentials.email)
    void run(async () => {
      const result = await gateway.signUp(credentials.email, credentials.password, validatedUsername.value)
      if (result.existingAccount) {
        setError('Email ini sudah terdaftar. Silakan masuk dengan akun tersebut.')
        return
      }
      if (!result.session) throw new Error('Supabase did not return a session for the new account')
      const nextProfile = await gateway.saveProfile(result.session, validatedUsername.value, null)
      await finishAuthentication(result.session, nextProfile)
    })
  }

  function saveProfile(event: FormEvent) {
    event.preventDefault()
    if (!session) return
    const validatedUsername = validateUsername(username)
    if (validatedUsername.error) {
      setError(validatedUsername.error)
      return
    }
    void run(async () => {
      const nextProfile = await gateway.saveProfile(
        session,
        validatedUsername.value,
        profile?.avatarUrl ?? null,
      )
      setProfile(nextProfile)
      setMessage('Profil berhasil disimpan.')
    })
  }

  function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !session) return
    const validationError = validateAvatar(file)
    if (validationError) {
      setError(validationError)
      return
    }
    void run(async () => {
      const avatarUrl = await gateway.uploadAvatar(session, file)
      const nextProfile = await gateway.saveProfile(session, username, avatarUrl)
      setProfile(nextProfile)
      setMessage('Avatar berhasil diperbarui.')
    })
  }

  function logout() {
    void run(async () => {
      await gateway.signOut()
      setSession(null)
      setProfile(null)
      setPassword('')
      setScreen('login')
    })
  }

  function submitForgot(event: FormEvent) {
    event.preventDefault()
    resetFeedback()
    const validatedEmail = validateEmail(email)
    if (validatedEmail.error) {
      setError(validatedEmail.error)
      return
    }
    setEmail(validatedEmail.value)
    void run(async () => {
      await gateway.requestPasswordReset(validatedEmail.value)
      setMessage('Cek email Anda. Kami sudah mengirim tautan untuk mengatur ulang password.')
    })
  }

  function submitRecovery(event: FormEvent) {
    event.preventDefault()
    resetFeedback()
    const passwordError = validatePassword(newPassword)
    if (passwordError) {
      setError(passwordError)
      return
    }
    void run(async () => {
      await gateway.updatePassword(newPassword)
      setNewPassword('')
      // Drop the recovery token from the URL so a refresh won't re-enter the
      // recovery screen with a now-expired session.
      if (window.location.hash.includes('type=recovery')) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      }
      setMessage('Password berhasil diperbarui. Silakan masuk dengan password baru.')
      setScreen('login')
    })
  }

  const feedback = (
    <>
      {error && <div className="feedback feedback-error" role="alert">{error}</div>}
      {message && <div className="feedback feedback-success">{message}</div>}
    </>
  )

  if (screen === 'connecting') {
    return (
      <AuthFrame
        eyebrow={inviteToken ? 'PLAYLIST INVITE' : 'DESKTOP CONNECTION'}
        title={inviteToken ? 'Menambahkan playlist…' : 'Menghubungkan ke Hikalist…'}
      >
        <div className="connecting-indicator" aria-hidden="true"><span /><span /><span /></div>
        <p className="form-copy">
          {inviteToken ? 'Memeriksa undangan dan akses editor Anda.' : 'Brave akan kembali ke aplikasi setelah sesi diterima.'}
        </p>
      </AuthFrame>
    )
  }

  if (screen === 'invite' && inviteAcceptance) {
    return (
      <AuthFrame eyebrow="PLAYLIST INVITE" title="Anda sekarang menjadi editor.">
        <div className="invite-success-mark" aria-hidden="true">✓</div>
        <p className="invite-playlist-name">{inviteAcceptance.playlistName}</p>
        <p className="form-copy">Playlist akan tersinkron otomatis ketika Hikalist Desktop terhubung ke internet.</p>
      </AuthFrame>
    )
  }

  if (screen === 'account' && session && profile) {
    return (
      <AuthFrame eyebrow="PROFILE" title="Akun Hikalist">
        <form className="auth-form" onSubmit={saveProfile}>
          <div className="avatar-row">
            <div className="avatar-preview">
              {profile.avatarUrl ? <img src={profile.avatarUrl} alt="Avatar akun" /> : username.slice(0, 1).toUpperCase()}
            </div>
            <label className="secondary-button avatar-button">
              Ganti avatar
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar} />
            </label>
          </div>
          <Field label="Email" value={session.user.email} disabled />
          <Field label="Nama akun" value={username} onChange={setUsername} autoComplete="nickname" />
          {feedback}
          <button className="primary-button" disabled={loading} type="submit">Simpan profil</button>
          <button className="text-button" disabled={loading} onClick={logout} type="button">Keluar dari akun</button>
        </form>
      </AuthFrame>
    )
  }

  const isRegister = screen === 'register'
  const isForgot = screen === 'forgot'
  const isRecovery = screen === 'recovery'
  if (isForgot) {
    return (
      <AuthFrame eyebrow="RESET PASSWORD" title="Lupa password?">
        <p className="form-copy">Masukkan email akun Anda dan kami akan mengirim tautan untuk mengatur ulang password.</p>
        <form className="auth-form" noValidate onSubmit={submitForgot}>
          <Field label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" />
          {feedback}
          <button className="primary-button" disabled={loading} type="submit">
            {loading ? 'Mohon tunggu…' : 'Kirim tautan reset'}
          </button>
          <button className="text-button" disabled={loading} onClick={() => setScreen('login')} type="button">
            Kembali ke masuk
          </button>
        </form>
      </AuthFrame>
    )
  }
  if (isRecovery) {
    return (
      <AuthFrame eyebrow="RESET PASSWORD" title="Atur ulang password">
        <p className="form-copy">Buat password baru untuk akun Anda.</p>
        <form className="auth-form" noValidate onSubmit={submitRecovery}>
          <Field label="Password baru" value={newPassword} onChange={setNewPassword} type="password" autoComplete="new-password" />
          {feedback}
          <button className="primary-button" disabled={loading} type="submit">
            {loading ? 'Mohon tunggu…' : 'Perbarui password'}
          </button>
        </form>
      </AuthFrame>
    )
  }
  return (
    <AuthFrame
      eyebrow={inviteToken ? 'PLAYLIST INVITE' : isRegister ? 'CREATE ACCOUNT' : 'WELCOME BACK'}
      title={inviteToken ? 'Undangan playlist' : isRegister ? 'Mulai ruang musik Anda.' : 'Masuk ke Hikalist.'}
    >
      {inviteToken && <p className="form-copy">Masuk atau daftar untuk bergabung sebagai editor. Link ini berlaku selama 2 jam.</p>}
      <div className="auth-tabs" aria-label="Pilihan autentikasi">
        <button className={!isRegister ? 'active' : ''} onClick={() => setScreen('login')} type="button">Masuk</button>
        <button className={isRegister ? 'active' : ''} onClick={() => setScreen('register')} type="button">Daftar</button>
      </div>
      <form className="auth-form" noValidate onSubmit={isRegister ? submitRegistration : submitLogin}>
        {isRegister && <Field label="Nama akun" value={username} onChange={setUsername} autoComplete="nickname" />}
        <Field label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" />
        <Field label="Password" value={password} onChange={setPassword} type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} />
        {feedback}
        <button className="primary-button" disabled={loading} type="submit">
          {loading ? 'Mohon tunggu…' : isRegister ? 'Buat akun' : 'Masuk'}
        </button>
        {!isRegister && (
          <button className="text-button" disabled={loading} onClick={() => setScreen('forgot')} type="button">
            Lupa password?
          </button>
        )}
      </form>
    </AuthFrame>
  )
}

interface FieldProps {
  label: string
  value: string
  onChange?: (value: string) => void
  type?: string
  autoComplete?: string
  disabled?: boolean
}

function Field({ label, value, onChange, type = 'text', autoComplete, disabled }: FieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        autoComplete={autoComplete}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
        type={type}
        value={value}
      />
    </label>
  )
}

interface AuthFrameProps {
  eyebrow: string
  title: string
  children: React.ReactNode
}

function AuthFrame({ eyebrow, title, children }: AuthFrameProps) {
  return (
    <main className="auth-layout">
      <section className="brand-panel">
        <div className="brand-topline"><span className="brand-mark">H</span><span>Hikalist</span></div>
        <div className="brand-message">
          <p>YOUR MUSIC, TOGETHER</p>
          <h1>Keep every song close.<br />Share every feeling.</h1>
          <span>Playlist dan profil Anda tersinkron aman di semua perangkat.</span>
        </div>
        <div className="brand-orbit orbit-one" />
        <div className="brand-orbit orbit-two" />
      </section>
      <section className="form-panel">
        <div className="form-card">
          <div className="mobile-brand"><span className="brand-mark">H</span><span>Hikalist</span></div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          {children}
          <p className="privacy-note">Hikalist hanya memakai email untuk keamanan akun dan sinkronisasi.</p>
        </div>
      </section>
    </main>
  )
}
