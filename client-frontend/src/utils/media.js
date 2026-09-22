const rawApiUrl = (import.meta.env?.VITE_API_URL || '').trim()
const API_URL = rawApiUrl ? rawApiUrl.replace(/\/+$/, '').replace(/\/api$/, '') : ''

export function normalizeMediaValue(value) {
  if (!value) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'object') {
    return value.url || value.secureUrl || value.src || value.path || ''
  }
  return ''
}

const MEDIA_VARIANTS = {
  thumbnail: { width: 240, height: 180, crop: 'fill' },
  card: { width: 640, height: 400, crop: 'fill' },
  detail: { width: 1600, height: 1200, crop: 'limit' },
}

const isCloudinaryUrl = (url) => /^https:\/\/res\.cloudinary\.com\//i.test(url)

const hasCloudinaryTransformation = (url) => {
  if (!isCloudinaryUrl(url)) return false
  const uploadIndex = url.indexOf('/upload/')
  if (uploadIndex === -1) return false
  const afterUpload = url.slice(uploadIndex + '/upload/'.length).split('/')[0]
  return Boolean(afterUpload && !/^v\d+$/i.test(afterUpload) && /[,=]/.test(afterUpload))
}

const optimizeCloudinaryUrl = (url, options = {}) => {
  if (!isCloudinaryUrl(url) || hasCloudinaryTransformation(url)) return url

  const variant = typeof options === 'string' ? options : options.variant
  const dimensions = MEDIA_VARIANTS[variant] || options
  if (!dimensions?.width || !dimensions?.height) return url

  const transformation = [
    `f_auto`,
    `q_auto`,
    `c_${dimensions.crop || 'limit'}`,
    `w_${Math.max(1, Number(dimensions.width))}`,
    `h_${Math.max(1, Number(dimensions.height))}`,
  ].join(',')
  return url.replace('/upload/', `/upload/${transformation}/`)
}

export function resolveMediaUrl(value, options = {}) {
  const url = normalizeMediaValue(value)
  if (!url || typeof url !== 'string') return ''

  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  ) {
    return optimizeCloudinaryUrl(url, options)
  }

  const cleanPath = url.startsWith('/') ? url : `/${url}`
  return API_URL ? `${API_URL}${cleanPath}` : cleanPath
}

export function getMediaUrl(media, options = {}) {
  return resolveMediaUrl(normalizeMediaValue(media), options)
}

export function getOrderedMediaList(mediaList) {
  if (!Array.isArray(mediaList)) return []

  return mediaList
    .map((entry, index) => {
      const media = entry?.media ?? entry ?? null
      const url = getMediaUrl(media)
      return { ...entry, media, url, __index: index }
    })
    .filter((entry) => Boolean(entry.url))
    .sort((a, b) => {
      const primaryDiff = Number(Boolean(b.media?.isPrimary || b.isPrimary)) - Number(Boolean(a.media?.isPrimary || a.isPrimary))
      if (primaryDiff !== 0) return primaryDiff

      const orderA = Number(a.media?.order ?? a.order ?? Number.MAX_SAFE_INTEGER)
      const orderB = Number(b.media?.order ?? b.order ?? Number.MAX_SAFE_INTEGER)
      if (orderA !== orderB) return orderA - orderB

      return a.__index - b.__index
    })
    .map(({ media, url, __index, ...rest }) => ({ ...rest, media, url, __index }))
}

export function getPrimaryMedia(mediaList) {
  return getOrderedMediaList(mediaList)[0]?.media ?? null
}

export function getMediaList(mediaList) {
  return getOrderedMediaList(mediaList).map((entry) => entry.media)
}
