import React, { useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { getMediaUrl, normalizeMedia } from '../../utils/media'

export function MediaViewer({
  isOpen,
  images = [],
  currentIndex = 0,
  onClose,
  onChangeIndex,
}) {
  const normalizedImages = (images || []).map((img) => normalizeMedia(img)).filter(Boolean)
  const total = normalizedImages.length
  const current = normalizedImages[currentIndex] || normalizedImages[0]

  const handlePrev = useCallback(() => {
    if (total <= 1) return
    const nextIdx = (currentIndex - 1 + total) % total
    onChangeIndex?.(nextIdx)
  }, [currentIndex, total, onChangeIndex])

  const handleNext = useCallback(() => {
    if (total <= 1) return
    const nextIdx = (currentIndex + 1) % total
    onChangeIndex?.(nextIdx)
  }, [currentIndex, total, onChangeIndex])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
      if (e.key === 'ArrowLeft') handlePrev()
      if (e.key === 'ArrowRight') handleNext()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handlePrev, handleNext, onClose])

  if (!isOpen || !current) return null

  const currentUrl = getMediaUrl(current, { variant: 'detail' })
  const caption = current.caption || current.originalName || ''

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      {/* Top Bar */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          left: '20px',
          right: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#FFFFFF',
        }}
      >
        <div style={{ fontSize: '0.875rem', fontWeight: 600, opacity: 0.9 }}>
          {total > 1 ? `${currentIndex + 1} / ${total}` : ''}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la visionneuse"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
        >
          <X size={22} />
        </button>
      </div>

      {/* Main image container */}
      <div
        style={{
          maxWidth: '90vw',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <img
          src={currentUrl}
          alt={caption || 'Photo agrandie'}
          style={{
            maxWidth: '100%',
            maxHeight: '75vh',
            objectFit: 'contain',
            borderRadius: '8px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          }}
        />

        {caption && (
          <div
            style={{
              marginTop: '12px',
              color: '#E2E8F0',
              fontSize: '0.875rem',
              textAlign: 'center',
              maxWidth: '600px',
            }}
          >
            {caption}
          </div>
        )}
      </div>

      {/* Navigation Arrows */}
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handlePrev()
            }}
            aria-label="Image précédente"
            style={{
              position: 'absolute',
              left: '20px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              borderRadius: '50%',
              width: '48px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            <ChevronLeft size={28} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleNext()
            }}
            aria-label="Image suivante"
            style={{
              position: 'absolute',
              right: '20px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              borderRadius: '50%',
              width: '48px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            <ChevronRight size={28} />
          </button>
        </>
      )}
    </div>
  )
}
