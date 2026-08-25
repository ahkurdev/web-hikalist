export const MAX_AVATAR_BYTES = 10 * 1024 * 1024

const AVATAR_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

interface AvatarCandidate {
  type: string
  size: number
}

export function validateAvatar(file: AvatarCandidate): string | null {
  if (!AVATAR_EXTENSIONS[file.type]) return 'Gunakan gambar JPG, PNG, atau WebP.'
  if (file.size > MAX_AVATAR_BYTES) return 'Ukuran avatar maksimal 10 MB.'
  return null
}
