import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { getMediaUrl } from '../../utils/media'
import { useLanguage } from '../../i18n/LanguageProvider'

export function MediaImage({
  media,
  src,
  alt = '',
  fallback = null,
  fallbackSrc = '',
  objectFit = 'cover',
  variant,
  loading = 'lazy',
  style = {},
  className = '',
  onClick,
  onError,
  onLoad,
  showLoading = false,
}) {
  const { t } = useLanguage()
  const resolvedSrc = getMediaUrl(src || media, variant ? { variant } : {})
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(Boolean(resolvedSrc && showLoading))

  useEffect(() => {
    setHasError(false)
    setIsLoading(Boolean(resolvedSrc && showLoading))
  }, [resolvedSrc, showLoading])

  if (!resolvedSrc || hasError) {
    if (fallback) return fallback
    if (fallbackSrc) return <img src={fallbackSrc} alt={alt} style={{ width: '100%', height: '100%', objectFit, ...style }} className={className} loading={loading} onClick={onClick} />
    return (
      <div
        className={className}
        role="status"
        aria-live="polite"
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F1F5F9',
          color: '#64748B',
          ...style,
        }}
        onClick={onClick}
      >
        <span style={{ display: 'grid', justifyItems: 'center', gap: 8, fontSize: '0.75rem', fontWeight: 600 }}>
          <ImageOff size={22} aria-hidden="true" />{t('media.unavailable')}
        </span>
      </div>
    )
  }

  const image = (
    <img
      src={resolvedSrc}
      alt={alt}
      loading={loading}
      className={className}
      style={{ width: '100%', height: '100%', objectFit, ...style }}
      onClick={onClick}
      onLoad={(event) => {
        setIsLoading(false)
        if (onLoad) onLoad(event)
      }}
      onError={(event) => {
        setIsLoading(false)
        if (onError) onError(event)
        setHasError(true)
      }}
    />
  )

  if (!showLoading) return image
  return (
    <div className={`media-image-loading${className ? ` ${className}` : ''}`} aria-busy={isLoading}>
      {image}
      {isLoading && <span className="media-image-loading-indicator" role="status" aria-label={t('media.loading')}>
        <span aria-hidden="true" />{t('media.loading')}
      </span>}
    </div>
  )
}
