import React, { useEffect, useState } from 'react'
import { getMediaUrl } from '../../utils/media'
import { MediaEmptyState } from './MediaEmptyState'
import { useLanguage } from '../../i18n/useLanguage'

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
}) {
  const { t } = useLanguage()
  const resolvedSrc = getMediaUrl(src || media, variant ? { variant } : {})
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setHasError(false)
  }, [resolvedSrc])

  if (!resolvedSrc || hasError) {
    if (fallback) return fallback
    if (fallbackSrc) {
      return (
        <img
          src={fallbackSrc}
          alt={alt}
          style={{ width: '100%', height: '100%', objectFit, ...style }}
          className={className}
          loading={loading}
          onClick={onClick}
        />
      )
    }
    return (
      <MediaEmptyState
        size="sm"
        title={t('mediaUi.noImage')}
        className={className}
        style={style}
        onClick={onClick}
      />
    )
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      loading={loading}
      className={className}
      style={{ width: '100%', height: '100%', objectFit, ...style }}
      onClick={onClick}
      onError={(event) => {
        if (onError) onError(event)
        setHasError(true)
      }}
    />
  )
}
