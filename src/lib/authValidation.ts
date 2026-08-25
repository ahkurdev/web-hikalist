const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface ValidatedValue {
  value: string
  error: string | null
}

export function validateEmail(input: string): ValidatedValue {
  const value = input.trim().toLowerCase()
  return {
    value,
    error: EMAIL_PATTERN.test(value) ? null : 'Masukkan alamat email yang valid.',
  }
}

export function validatePassword(password: string): string | null {
  return password.length >= 8 ? null : 'Password minimal 8 karakter.'
}

export function validateUsername(input: string): ValidatedValue {
  const value = input.trim()
  if (!value) return { value, error: 'Nama akun wajib diisi.' }
  if (value.length > 40) return { value, error: 'Nama akun maksimal 40 karakter.' }
  return { value, error: null }
}

export function normalizeAuthError(message: string): string {
  const normalizedMessage = message.toLowerCase()
  if (normalizedMessage.includes('invalid login credentials')) return 'Email atau password salah.'
  if (normalizedMessage.includes('email not confirmed')) return 'Email belum diverifikasi.'
  if (normalizedMessage.includes('already registered') || normalizedMessage.includes('already exists')) {
    return 'Email ini sudah terdaftar. Silakan masuk dengan akun tersebut.'
  }
  if (normalizedMessage.includes('rate limit') || normalizedMessage.includes('too many')) {
    return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.'
  }
  if (normalizedMessage.includes('network') || normalizedMessage.includes('fetch')) {
    return 'Koneksi bermasalah. Periksa internet lalu coba lagi.'
  }
  if (normalizedMessage.includes('invite link') && (
    normalizedMessage.includes('expired') || normalizedMessage.includes('invalid')
  )) {
    return 'Link undangan tidak valid atau sudah kedaluwarsa.'
  }
  return 'Terjadi kesalahan. Silakan coba lagi.'
}
