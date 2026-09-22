import React, { useEffect, useMemo, useState } from 'react'
import { getMediaList, getMediaUrl } from '../../utils/media'
import { MediaImage } from './MediaImage'
import { MediaViewer } from './MediaViewer'
import { MediaEmptyState } from './MediaEmptyState'
import { Maximize2 } from 'lucide-react'

export function MediaGallery({
  items = [],
  altPrefix = 'Photo',
  fallback = null,
  thumbnailSize = 72,
  objectFit = 'cover',
  variant = 'detail',
  className = '',
  allowViewer = true,
  aspectRatio = '16/9',
  minHeight = 240,
}) {
  const ordered = useMemo(() => getMediaList(items), [items])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isViewerOpen, setIsViewerOpen] = useState(false)

  // When items change, reset to 0 (which is always the primary image due to sorting)
  useEffect(() => {
    setSelectedIndex(0)
  }, [ordered.length])

  if (!ordered.length) {
    if (fallback) return fallback
    return (
      <MediaEmptyState
        size="lg"
        title="Aucune photo disponible"
        description="Ce véhicule ou ce bus ne dispose pas encore de photos dans sa galerie."
        className={className}
      />
    )
  }

  const selected = ordered[selectedIndex] || ordered[0]

  return (
    <div className={`media-gallery-container ${className}`} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Main Image Stage */}
      <div
        style={{
          width: '100%',
          minHeight,
          borderRadius: '10px',
          overflow: 'hidden',
          backgroundColor: '#0F172A',
          position: 'relative',
          cursor: allowViewer ? 'pointer' : 'default',
        }}
        onClick={() => {
          if (allowViewer) setIsViewerOpen(true)
        }}
        title={allowViewer ? 'Cliquer pour agrandir' : undefined}
      >
        <MediaImage
          media={selected}
          alt={`${altPrefix} ${selectedIndex + 1}`}
          fallback={fallback}
          objectFit={objectFit}
          variant={variant}
          loading="eager"
        />

        {allowViewer && (
          <div
            style={{
              position: 'absolute',
              bottom: '10px',
              right: '10px',
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              color: '#FFFFFF',
              borderRadius: '6px',
              padding: '6px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.75rem',
              backdropFilter: 'blur(2px)',
            }}
          >
            <Maximize2 size={13} />
            <span>Agrandir</span>
          </div>
        )}
      </div>

      {/* Thumbnail Strip */}
      {ordered.length > 1 && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '4px',
            scrollbarWidth: 'thin',
          }}
        >
          {ordered.map((item, index) => {
            const isSelected = index === selectedIndex
            return (
              <button
                key={`${item.id || index}-${index}`}
                type="button"
                onClick={() => setSelectedIndex(index)}
                style={{
                  width: thumbnailSize,
                  height: thumbnailSize,
                  borderRadius: '6px',
                  border: isSelected ? '2px solid #2563EB' : '1px solid #CBD5E1',
                  padding: 0,
                  overflow: 'hidden',
                  background: '#F1F5F9',
                  cursor: 'pointer',
                  flexShrink: 0,
                  opacity: isSelected ? 1 : 0.75,
                  transition: 'all 0.15s ease-in-out',
                }}
                aria-label={`${altPrefix} miniature ${index + 1}`}
              >
                <MediaImage
                  media={item}
                  alt={`${altPrefix} miniature ${index + 1}`}
                  objectFit={objectFit}
                  variant="thumbnail"
                  loading="lazy"
                />
              </button>
            )
          })}
        </div>
      )}

      {/* Lightbox Viewer */}
      {allowViewer && (
        <MediaViewer
          isOpen={isViewerOpen}
          images={ordered}
          currentIndex={selectedIndex}
          onClose={() => setIsViewerOpen(false)}
          onChangeIndex={(newIdx) => setSelectedIndex(newIdx)}
        />
      )}
    </div>
  )
}
