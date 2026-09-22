import React from 'react'
import { getPrimaryMedia, getMediaUrl } from '../../utils/media'
import { MediaImage } from './MediaImage'
import { Image as ImageIcon } from 'lucide-react'

export function MediaThumbnail({
  media,
  alt = '',
  size = 40,
  width,
  height,
  rounded = 6,
  objectFit = 'cover',
  className = '',
  style = {},
  onClick,
  fallbackIcon: FallbackIcon = ImageIcon,
}) {
  const primaryMedia = getPrimaryMedia(media)

  const finalWidth = width || size
  const finalHeight = height || size

  const fallback = (
    <div
      style={{
        width: finalWidth,
        height: finalHeight,
        borderRadius: rounded,
        backgroundColor: '#F1F5F9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#94A3B8',
        flexShrink: 0,
        ...style,
      }}
      className={className}
      onClick={onClick}
    >
      <FallbackIcon size={Math.min(finalWidth, finalHeight) * 0.5} />
    </div>
  )

  return (
    <div
      style={{
        width: finalWidth,
        height: finalHeight,
        borderRadius: rounded,
        overflow: 'hidden',
        flexShrink: 0,
        backgroundColor: '#F1F5F9',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
      className={`media-thumbnail ${className}`}
      onClick={onClick}
    >
      <MediaImage
        media={primaryMedia}
        alt={alt}
        variant="thumbnail"
        objectFit={objectFit}
        loading="lazy"
        fallback={fallback}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
