// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthApp } from '../src/AuthApp'
import type { AuthGateway, AuthSession, Profile } from '../src/lib/authGateway'
import type { PlaylistInviteGateway } from '../src/lib/playlistInviteGateway'

const SESSION: AuthSession = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  user: { id: 'user-1', email: 'allan@example.com' },
}

afterEach(cleanup)

function createGateway(overrides: Partial<AuthGateway> = {}): AuthGateway {
  const profile: Profile = { username: 'Allan', avatarUrl: null }
  return {
    currentSession: vi.fn().mockResolvedValue(null),
    signIn: vi.fn().mockResolvedValue(SESSION),
    signUp: vi.fn().mockResolvedValue({ existingAccount: false, session: SESSION }),
    signOut: vi.fn().mockResolvedValue(undefined),
    loadProfile: vi.fn().mockResolvedValue(profile),
    saveProfile: vi.fn().mockResolvedValue(profile),
    uploadAvatar: vi.fn().mockResolvedValue('https://example.com/avatar.webp'),
    requestPasswordReset: vi.fn().mockResolvedValue(undefined),
    updatePassword: vi.fn().mockResolvedValue(undefined),
    onAuthEvent: vi.fn(() => () => {}),
    ...overrides,
  }
}

function createInviteGateway(overrides: Partial<PlaylistInviteGateway> = {}): PlaylistInviteGateway {
  return {
    accept: vi.fn().mockResolvedValue({ playlistId: 'playlist-1', playlistName: 'Avām Eva' }),
    ...overrides,
  }
}

describe('AuthApp', () => {
  it('switches from login to the registration form', async () => {
    render(<AuthApp gateway={createGateway()} search="" />)

    fireEvent.click(screen.getByRole('button', { name: 'Daftar' }))

    expect(await screen.findByLabelText('Nama akun')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Buat akun' })).toBeTruthy()
  })

  it('signs in and displays the account profile', async () => {
    const gateway = createGateway()
    render(<AuthApp gateway={gateway} search="" />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'allan@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Masuk' })[1])

    expect(await screen.findByText('Akun Hikalist')).toBeTruthy()
    expect(screen.getByDisplayValue('Allan')).toBeTruthy()
    expect(gateway.signIn).toHaveBeenCalledWith('allan@example.com', 'password123')
  })

  it('registers immediately and creates the profile without OTP', async () => {
    const gateway = createGateway()
    render(<AuthApp gateway={gateway} search="?mode=register" />)

    fireEvent.change(await screen.findByLabelText('Nama akun'), { target: { value: 'Allan' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'allan@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buat akun' }))

    expect(await screen.findByText('Akun Hikalist')).toBeTruthy()
    expect(gateway.signUp).toHaveBeenCalledWith('allan@example.com', 'password123', 'Allan')
    expect(gateway.saveProfile).toHaveBeenCalledWith(SESSION, 'Allan', null)
    expect(screen.queryByText('Kode OTP')).toBeNull()
  })

  it('exposes self-service password recovery from the login form', async () => {
    render(<AuthApp gateway={createGateway()} search="" />)

    fireEvent.click(screen.getByRole('button', { name: 'Lupa password?' }))

    expect(await screen.findByText('Lupa password?')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Kirim tautan reset' })).toBeTruthy()
  })

  it('sends a reset link when the recovery email is submitted', async () => {
    const gateway = createGateway()
    render(<AuthApp gateway={gateway} search="" />)

    fireEvent.click(screen.getByRole('button', { name: 'Lupa password?' }))
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'allan@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Kirim tautan reset' }))

    expect(await screen.findByText(/Kami sudah mengirim tautan/)).toBeTruthy()
    expect(gateway.requestPasswordReset).toHaveBeenCalledWith('allan@example.com')
  })

  it('updates the password after a PASSWORD_RECOVERY auth event', async () => {
    let handler: ((event: string) => void) | null = null
    const gateway = createGateway({
      onAuthEvent: vi.fn((cb: (event: string) => void) => {
        handler = cb
        return () => {}
      }),
    })
    render(<AuthApp gateway={gateway} search="" />)

    expect(handler).not.toBeNull()
    handler!('PASSWORD_RECOVERY')

    fireEvent.change(await screen.findByLabelText('Password baru'), { target: { value: 'newpassword123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Perbarui password' }))

    expect(await screen.findByText('Password berhasil diperbarui. Silakan masuk dengan password baru.')).toBeTruthy()
    expect(gateway.updatePassword).toHaveBeenCalledWith('newpassword123')
  })

  it('shows field validation without calling Supabase', async () => {
    const gateway = createGateway()
    render(<AuthApp gateway={gateway} search="" />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'invalid' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'short' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Masuk' })[1])

    await waitFor(() => expect(screen.getByText('Masukkan alamat email yang valid.')).toBeTruthy())
    expect(gateway.signIn).not.toHaveBeenCalled()
  })

  it('accepts a playlist invite after the recipient signs in', async () => {
    const gateway = createGateway()
    const inviteGateway = createInviteGateway()
    render(
      <AuthApp
        gateway={gateway}
        inviteGateway={inviteGateway}
        search="?token=abcdefghijklmnopqrstuvwxyzABCDEFGH1234567890_-token"
      />,
    )

    expect(await screen.findByText('Undangan playlist')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'allan@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Masuk' })[1])

    expect(await screen.findByText('Anda sekarang menjadi editor.')).toBeTruthy()
    expect(screen.getByText('Avām Eva')).toBeTruthy()
    expect(inviteGateway.accept).toHaveBeenCalledWith(
      'abcdefghijklmnopqrstuvwxyzABCDEFGH1234567890_-token',
      SESSION,
    )
  })

  it('shows an expired invite error without opening the account profile', async () => {
    const inviteGateway = createInviteGateway({
      accept: vi.fn().mockRejectedValue(new Error('Invite link has expired')),
    })
    render(
      <AuthApp
        gateway={createGateway({ currentSession: vi.fn().mockResolvedValue(SESSION) })}
        inviteGateway={inviteGateway}
        search="?token=abcdefghijklmnopqrstuvwxyzABCDEFGH1234567890_-token"
      />,
    )

    expect((await screen.findByRole('alert')).textContent).toContain('Link undangan tidak valid atau sudah kedaluwarsa.')
    expect(screen.queryByText('Akun Hikalist')).toBeNull()
  })
})
