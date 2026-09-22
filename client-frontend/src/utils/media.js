const rawApiUrl = (import.meta.env?.VITE_API_URL || '').trim()
const API_URL = rawApiUrl ? rawApiUrl.replace(/\/+$/, '').replace(/\/api$/, '') : ''

export const MEDIA_VARIANTS = {
  thumbnail: { width: 240, height: 180, crop: 'fill' },
  card: { width: 640, height: 400, crop: 'fill' },
  detail: { width: 1600, height: 1200, crop: 'limit' },
}

export const isCloudinaryUrl = (url) => typeof url === 'string' && /^https:\/\/res\.cloudinary\.com\//i.test(url)

export const hasCloudinaryTransformation = (url) => {
  if (!isCloudinaryUrl(url)) return false
  const uploadIndex = url.indexOf('/upload/')
  if (uploadIndex === -1) return false
  const afterUpload = url.slice(uploadIndex + '/upload/'.length).split('/')[0]
  return Boolean(afterUpload && !/^v\d+$/i.test(afterUpload) && /[,=]/.test(afterUpload))
}

export const optimizeCloudinaryUrl = (url, options = {}) => {
  if (!isCloudinaryUrl(url) || hasCloudinaryTransformation(url)) return url

  const variant = typeof options === 'string' ? options : options.variant
  const dimensions = MEDIA_VARIANTS[variant] || options
  if (!dimensions?.width || !dimensions?.height) return url

  const transformation = [
    `f_auto`,
    `q_auto`,
    `c_${dimensions.crop || 'limit'}`,
    `w_${Math.max(1, Math.round(Number(dimensions.width)))}`,
    `h_${Math.max(1, Math.round(Number(dimensions.height)))}`,
  ].join(',')

  return url.replace('/upload/', `/upload/${transformation}/`)
}

/**
 * Normalizes any media representation into a standardized frontend contract.
 */
export function normalizeMedia(input) {
  if (!input) return null

  if (typeof input === 'string') {
    const clean = input.trim()
    if (!clean) return null
    return {
      id: null,
      relationId: null,
      mediaId: null,
      url: clean,
      secureUrl: clean,
      publicId: null,
      resourceType: 'image',
      mimeType: null,
      originalName: null,
      fileName: null,
      width: null,
      height: null,
      size: null,
      isPrimary: false,
      order: 0,
      caption: null,
      file: null,
      previewUrl: null,
      raw: input,
    }
  }

  if (typeof input !== 'object') return null

  const isRelation = Boolean(input.media && typeof input.media === 'object')
  const inner = isRelation ? input.media : input

  const relationId = isRelation ? (input.id || input.relationId || null) : (input.relationId || null)
  const mediaId = isRelation ? (inner?.id || input.mediaId || null) : (input.mediaId || input.id || null)
  const resolvedId = isRelation ? (relationId || mediaId) : (input.id || inner?.id || relationId || null)

  const isPrimary = Boolean(input.isPrimary ?? inner?.isPrimary ?? false)
  const order = Number.isFinite(Number(input.order))
    ? Number(input.order)
    : Number.isFinite(Number(inner?.order))
    ? Number(inner.order)
    : 0
  const caption = input.caption || inner?.caption || null

  const url = (
    inner?.secureUrl ||
    inner?.url ||
    input.secureUrl ||
    input.url ||
    input.previewUrl ||
    inner?.previewUrl ||
    inner?.src ||
    inner?.path ||
    inner?.imageUrl ||
    input.imageUrl ||
    ''
  ).trim()

  const secureUrl = (inner?.secureUrl || inner?.url || input.secureUrl || input.url || url || '').trim()
  const publicId = inner?.publicId || input.publicId || null
  const resourceType = inner?.resourceType || input.resourceType || 'image'
  const mimeType = inner?.mimeType || input.mimeType || null
  const originalName = inner?.originalName || inner?.fileName || inner?.name || input.name || null
  const fileName = inner?.fileName || inner?.originalName || inner?.name || input.name || null
  const width = inner?.width || input.width || null
  const height = inner?.height || input.height || null
  const size = inner?.size || input.size || null

  return {
    id: resolvedId,
    relationId,
    mediaId,
    url,
    secureUrl: secureUrl || url,
    publicId,
    resourceType,
    mimeType,
    originalName,
    fileName,
    width,
    height,
    size,
    isPrimary,
    order,
    caption,
    file: input.file || null,
    previewUrl: input.previewUrl || null,
    raw: input,
  }
}

export function normalizeMediaList(mediaList) {
  if (!Array.isArray(mediaList)) {
    if (mediaList && typeof mediaList === 'object') {
      const single = normalizeMedia(mediaList)
      return single ? [single] : []
    }
    return []
  }

  return mediaList
    .map((item) => normalizeMedia(item))
    .filter((item) => Boolean(item && (item.url || item.previewUrl || item.file)))
}

export function resolveMediaUrl(value, options = {}) {
  const normalized = typeof value === 'object' && value !== null ? normalizeMedia(value) : null
  const url = (normalized ? normalized.url : (typeof value === 'string' ? value.trim() : '')).trim()

  if (!url) return ''

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
  return resolveMediaUrl(media, options)
}

export function getOrderedMediaList(mediaList) {
  if (!mediaList) return []

  if (!Array.isArray(mediaList)) {
    const single = normalizeMedia(mediaList)
    return single ? [single] : []
  }

  const normalized = mediaList
    .map((entry, index) => {
      const item = normalizeMedia(entry)
      if (!item) return null
      return { ...item, __index: index }
    })
    .filter(Boolean)

  return normalized.sort((a, b) => {
    const primaryDiff = Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary))
    if (primaryDiff !== 0) return primaryDiff

    const orderA = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER
    const orderB = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER
    if (orderA !== orderB) return orderA - orderB

    return a.__index - b.__index
  })
}

export function getPrimaryMedia(mediaList) {
  const ordered = getOrderedMediaList(mediaList)
  return ordered[0] ?? null
}

export function getMediaList(mediaList) {
  return getOrderedMediaList(mediaList)
}
