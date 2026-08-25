import { describe, expect, it } from 'vitest'
import {
  normalizeAuthError,
  validateEmail,
  validatePassword,
  validateUsername,
} from '../src/lib/authValidation'

describe('auth validation', () => {
  it('normalizes valid email addresses before submission', () => {
    expect(validateEmail('  USER@Example.COM ')).toEqual({
      value: 'user@example.com',
      error: null,
    })
  })

  it('rejects malformed email addresses', () => {
    expect(validateEmail('not-an-email').error).toBe('Masukkan alamat email yang valid.')
  })

  it('requires a password with at least eight characters', () => {
    expect(validatePassword('1234567')).toBe('Password minimal 8 karakter.')
    expect(validatePassword('12345678')).toBeNull()
  })

  it('trims usernames and enforces the database length', () => {
    expect(validateUsername('  Allan  ')).toEqual({ value: 'Allan', error: null })
    expect(validateUsername('')).toEqual({ value: '', error: 'Nama akun wajib diisi.' })
    expect(validateUsername('a'.repeat(41)).error).toBe('Nama akun maksimal 40 karakter.')
  })

  it('maps Supabase errors to clear Indonesian messages', () => {
    expect(normalizeAuthError('Invalid login credentials')).toBe('Email atau password salah.')
    expect(normalizeAuthError('Email not confirmed')).toBe('Email belum diverifikasi.')
    expect(normalizeAuthError('User already registered')).toBe(
      'Email ini sudah terdaftar. Silakan masuk dengan akun tersebut.',
    )
  })
})
