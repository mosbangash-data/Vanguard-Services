import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Expand, ImageOff, X } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageProvider'
import { getMediaList, getMediaUrl } from '../../utils/media'
import { MediaImage } from './MediaImage'

export function MediaGallery({ items, altPrefix = '', fallback = null, thumbnailSize = 76, objectFit = 'cover', variant = 'detail', className = '' }) {
  const { t } = useLanguage()
  const ordered = useMemo(() => getMediaList(items), [items])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const closeButtonRef = useRef(null)
  const previousFocusRef = useRef(null)
  const dialogRef = useRef(null)

  useEffect(() => setSelectedIndex(0), [ordered.length])
  const move = useCallback((direction) => {
    setSelectedIndex((current) => (current + direction + ordered.length) % ordered.length)
  }, [ordered.length])

  useEffect(() => {
    if (!lightboxOpen) return undefined
    previousFocusRef.current = document.activeElement
    closeButtonRef.current?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setLightboxOpen(false)
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        event.stopPropagation()
        move(event.key === 'ArrowLeft' ? -1 : 1)
      }
      if (event.key === 'Tab' && dialogRef.current) {
        const controls = [...dialogRef.current.querySelectorAll('button:not([disabled])')]
        const first = controls[0]
        const last = controls.at(-1)
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = oldOverflow
      previousFocusRef.current?.focus?.()
    }
  }, [lightboxOpen, move])

  const label = (index) => ordered[index]?.alt || ordered[index]?.caption || `${altPrefix} ${index + 1}`.trim()
  const selectedKey = selectedIndex
  if (!ordered.length) return fallback || (
    <div className={`media-gallery-empty ${className}`} role="status">
      <ImageOff size={24} aria-hidden="true" /><span>{t('media.empty')}</span>
    </div>
  )

  const selected = ordered[selectedIndex] || ordered[0]
  const source = getMediaUrl(selected, selected.type === 'image' ? { variant } : {})
  const renderActive = (lightbox = false) => selected.type === 'video'
    ? <video className="media-gallery-video" src={source} poster={selected.previewUrl || undefined} controls playsInline aria-label={label(selectedIndex)} />
    : <MediaImage key={`${lightbox ? 'lightbox' : 'stage'}-${selectedKey}`} media={selected} alt={label(selectedIndex)} objectFit={lightbox ? 'contain' : objectFit} variant={lightbox ? 'fullscreen' : variant} loading="eager" showLoading />

  return (
    <div className={`media-gallery ${className}`} onKeyDown={(event) => {
      if (lightboxOpen) return
      if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1) }
      if (event.key === 'ArrowRight') { event.preventDefault(); move(1) }
    }}>
      <div className="media-gallery-stage">
        {selected.type === 'image' ? <MediaImage key={selectedKey} media={selected} alt={label(selectedIndex)} objectFit={objectFit} variant={variant} loading="eager" showLoading /> : renderActive()}
        {ordered.length > 1 && <>
          <button className="media-gallery-arrow media-gallery-previous" type="button" aria-label={t('media.previous')} onClick={() => move(-1)}><ChevronLeft aria-hidden="true" /></button>
          <button className="media-gallery-arrow media-gallery-next" type="button" aria-label={t('media.next')} onClick={() => move(1)}><ChevronRight aria-hidden="true" /></button>
        </>}
        <span className="media-gallery-counter" aria-live="polite">{selectedIndex + 1} / {ordered.length}</span>
        <button className="media-gallery-expand" type="button" aria-label={t('media.fullscreen')} onClick={() => setLightboxOpen(true)}><Expand size={18} aria-hidden="true" /></button>
      </div>
      {ordered.length > 1 && <div className="media-gallery-thumbnails" role="group" aria-label={t('media.gallery')}>
        {ordered.map((item, index) => <button key={`${item.id || getMediaUrl(item)}-${index}`} className={`media-gallery-thumbnail${index === selectedIndex ? ' is-active' : ''}`} style={{ '--thumbnail-size': `${thumbnailSize}px` }} type="button" aria-label={`${label(index)} (${index + 1} / ${ordered.length})`} aria-pressed={index === selectedIndex} onClick={() => setSelectedIndex(index)}>
          {item.type === 'video' ? <span className="media-gallery-video-thumb">▶</span> : <MediaImage media={item} alt="" variant="thumbnail" loading="lazy" />}
        </button>)}
      </div>}
      {lightboxOpen && <div ref={dialogRef} className="media-lightbox" role="dialog" aria-modal="true" aria-label={t('media.fullscreen')} onMouseDown={(event) => { if (event.target === event.currentTarget) setLightboxOpen(false) }}>
        <button ref={closeButtonRef} className="media-lightbox-close" type="button" aria-label={t('media.close')} onClick={() => setLightboxOpen(false)}><X aria-hidden="true" /></button>
        {ordered.length > 1 && <button className="media-gallery-arrow media-lightbox-previous" type="button" aria-label={t('media.previous')} onClick={() => move(-1)}><ChevronLeft aria-hidden="true" /></button>}
        <div className="media-lightbox-content">{renderActive(true)}<span className="media-gallery-counter">{selectedIndex + 1} / {ordered.length}</span></div>
        {ordered.length > 1 && <button className="media-gallery-arrow media-lightbox-next" type="button" aria-label={t('media.next')} onClick={() => move(1)}><ChevronRight aria-hidden="true" /></button>}
      </div>}
    </div>
  )
}
