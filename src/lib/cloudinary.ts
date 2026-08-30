const CLOUDINARY_CLOUD_NAME =
  import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim() || 'fva9uxpv'
const CLOUDINARY_UPLOAD_PRESET =
  import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim() || 'hikalist_unsigned'

export async function uploadToCloudinary(file: File, publicId: string): Promise<string> {
  const body = new FormData()
  body.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)
  body.append('public_id', publicId)
  body.append('file', file)

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: 'POST', body },
  )
  if (!response.ok) {
    let detail = ''
    try {
      const parsed = (await response.json()) as { error?: { message?: string } }
      detail = parsed.error?.message ?? ''
    } catch {
      // response was not JSON; keep detail empty and use the generic message
    }
    throw new Error(
      detail
        ? `Gagal mengunggah gambar: ${detail}`
        : 'Gagal mengunggah gambar. Periksa koneksi lalu coba lagi.',
    )
  }
  const json = (await response.json()) as { secure_url?: string }
  if (!json.secure_url) throw new Error('Layanan gambar tidak mengembalikan URL.')
  return json.secure_url
}
