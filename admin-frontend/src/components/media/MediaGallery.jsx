import { useEffect, useMemo, useState } from 'react'
import { getMediaList, getMediaUrl } from '../../utils/media'
import { MediaImage } from './MediaImage'

export function MediaGallery({
  items,
  altPrefix = 'Image',
  fallback = null,
  fallbackSrc = '',
  thumbnailSize = 80,
  objectFit = 'cover',
  variant = 'detail',
  className = '',
}) {
  const ordered = useMemo(() => getMediaList(items), [items])
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    setSelectedIndex(0)
  }, [ordered.length])

  if (!ordered.length) {
    return fallback || (
      <div
        className={className}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F1F5F9',
          color: '#64748B',
          borderRadius: '12px',
        }}
      >
        Aucune image
      </div>
    )
  }

  const selected = ordered[selectedIndex] || ordered[0]

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ width: '100%', height: '100%', minHeight: 240, overflow: 'hidden', borderRadius: '12px', backgroundColor: '#0F172A' }}>
        <MediaImage
          media={selected}
          alt={`${altPrefix} ${selectedIndex + 1}`}
          fallback={fallback}
          fallbackSrc={fallbackSrc}
          objectFit={objectFit}
          variant={variant}
          loading="eager"
        />
      </div>

      {ordered.length > 1 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {ordered.map((item, index) => (
            <button
              key={`${getMediaUrl(item) || index}-${index}`}
              type="button"
              onClick={() => setSelectedIndex(index)}
              style={{
                width: thumbnailSize,
                height: thumbnailSize,
                border: index === selectedIndex ? '2px solid #2563EB' : '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: 0,
                overflow: 'hidden',
                background: '#fff',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              aria-label={`${altPrefix} ${index + 1}`}
            >
              <MediaImage
                media={item}
                alt={`${altPrefix} ${index + 1}`}
                fallbackSrc={fallbackSrc}
                objectFit={objectFit}
                variant="thumbnail"
                loading="lazy"
                style={{ borderRadius: '6px' }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
