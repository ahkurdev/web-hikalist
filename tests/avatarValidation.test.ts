import { describe, expect, it } from 'vitest'
import { MAX_AVATAR_BYTES, validateAvatar } from '../src/lib/avatarValidation'

describe('avatar validation', () => {
  it('accepts supported images within the ten megabyte limit', () => {
    expect(MAX_AVATAR_BYTES).toBe(10 * 1024 * 1024)
    expect(validateAvatar({ type: 'image/webp', size: MAX_AVATAR_BYTES })).toBeNull()
  })

  it('rejects unsupported and oversized files', () => {
    expect(validateAvatar({ type: 'image/gif', size: 100 })).toBe(
      'Gunakan gambar JPG, PNG, atau WebP.',
    )
    expect(validateAvatar({ type: 'image/png', size: MAX_AVATAR_BYTES + 1 })).toBe(
      'Ukuran avatar maksimal 10 MB.',
    )
  })
})
