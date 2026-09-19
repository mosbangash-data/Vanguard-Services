const rawApiUrl = (import.meta.env?.VITE_API_URL || '').trim()
const API_URL = rawApiUrl ? rawApiUrl.replace(/\/+$/, '').replace(/\/api$/, '') : ''

/**
 * Resolves a media URL while preserving Cloudinary URLs and legacy relative URLs.
 * Supports absolute URLs, relative URLs, data URLs, and object URLs.
 */
export function resolveMediaUrl(value) {
  const url = typeof value === 'object'
    ? value?.secureUrl || value?.url || ''
    : value
  if (!url || typeof url !== 'string') return ''
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  ) {
    return url
  }

  const cleanPath = url.startsWith('/') ? url : `/${url}`
  return API_URL ? `${API_URL}${cleanPath}` : cleanPath
}

export function getMediaUrl(media) {
  return resolveMediaUrl(media)
}

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB

export function formatFileSize(bytes) {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return '0 B'
  const num = Number(bytes)
  if (num < 1024) return `${num} B`
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} Ko`
  return `${(num / (1024 * 1024)).toFixed(1)} Mo`
}
