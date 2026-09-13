import React, { useState, useRef, useEffect } from 'react'
import { UploadCloud, Image as ImageIcon, Star, Trash2, Plus, AlertCircle, Check, Loader2, X } from 'lucide-react'
import { resolveMediaUrl, ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE, formatFileSize } from '../../utils/media'

export function MediaUploader({
  existingMedia = [],
  pendingFiles = [],
  onPendingChange,
  onExistingChange,
  primaryIdOrIndex = null,
  onSetPrimary,
  onDeleteExisting,
  disabled = false,
  isUploading = false,
  uploadProgressText = '',
  maxFiles = 10,
  label = 'Photos & Galerie',
  helperText = 'Formats supportés : JPEG, PNG, WEBP, GIF. Taille maximale : 10 Mo par image.',
}) {
  const fileInputRef = useRef(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Validate files
  const validateFile = (file) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
      return `Le format "${file.type || 'inconnu'}" n'est pas autorisé. Utilisez JPEG, PNG, WEBP ou GIF.`
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return `Le fichier "${file.name}" dépasse la taille maximale autorisée (10 Mo).`
    }
    return null
  }

  // Handle new files from input or drop
  const handleFiles = (fileList) => {
    setErrorMessage('')
    if (!fileList || fileList.length === 0) return

    const newFiles = Array.from(fileList)
    const validFiles = []
    let err = null

    for (const file of newFiles) {
      const validationError = validateFile(file)
      if (validationError) {
        err = validationError
        break
      }
      validFiles.push(file)
    }

    if (err) {
      setErrorMessage(err)
      return
    }

    const currentCount = existingMedia.length + pendingFiles.length
    if (currentCount + validFiles.length > maxFiles) {
      setErrorMessage(`Vous ne pouvez pas ajouter plus de ${maxFiles} photos au total.`)
      return
    }

    const newPendingItems = validFiles.map((file, idx) => ({
      id: `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      name: file.name,
      size: file.size,
      previewUrl: URL.createObjectURL(file),
      isPrimary: existingMedia.length === 0 && pendingFiles.length === 0 && idx === 0,
    }))

    const updatedPending = [...pendingFiles, ...newPendingItems]
    if (onPendingChange) {
      onPendingChange(updatedPending)
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Drag & drop handlers
  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled && !isUploading) {
      setIsDragOver(true)
    }
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    if (disabled || isUploading) return
    if (e.dataTransfer?.files) {
      handleFiles(e.dataTransfer.files)
    }
  }

  // Remove pending file
  const handleRemovePending = (pendingId) => {
    const itemToRemove = pendingFiles.find((p) => p.id === pendingId)
    if (itemToRemove?.previewUrl) {
      URL.revokeObjectURL(itemToRemove.previewUrl)
    }
    const updated = pendingFiles.filter((p) => p.id !== pendingId)
    // If the removed item was primary, make the first remaining item primary
    if (itemToRemove?.isPrimary && updated.length > 0) {
      updated[0].isPrimary = true
    }
    if (onPendingChange) {
      onPendingChange(updated)
    }
  }

  // Set pending item as primary
  const handleSetPendingPrimary = (pendingId) => {
    if (onSetPrimary) {
      onSetPrimary(pendingId)
    } else if (onPendingChange) {
      const updated = pendingFiles.map((p) => ({
        ...p,
        isPrimary: p.id === pendingId,
      }))
      onPendingChange(updated)
    }
  }

  return (
    <div className="media-uploader-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>
            {label}
          </label>
          <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
            {existingMedia.length + pendingFiles.length} / {maxFiles} photos
          </span>
        </div>
      )}

      {/* Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (!disabled && !isUploading && fileInputRef.current) {
            fileInputRef.current.click()
          }
        }}
        style={{
          border: `2px dashed ${isDragOver ? '#2563EB' : '#CBD5E1'}`,
          backgroundColor: isDragOver ? '#EFF6FF' : '#F8FAFC',
          borderRadius: '10px',
          padding: '24px 16px',
          textAlign: 'center',
          cursor: disabled || isUploading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          disabled={disabled || isUploading}
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />

        {isUploading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <Loader2 size={32} className="animate-spin" style={{ color: '#2563EB' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#2563EB' }}>
              {uploadProgressText || 'Téléversement des photos en cours…'}
            </span>
          </div>
        ) : (
          <>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: '#EEF2F6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#475569',
              }}
            >
              <UploadCloud size={24} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#1E293B' }}>
                Glissez-déposez vos photos ici, ou{' '}
                <span style={{ color: '#2563EB', textDecoration: 'underline' }}>parcourez</span>
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#64748B' }}>
                {helperText}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5',
            color: '#B91C1C',
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '0.8125rem',
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B91C1C', padding: 0 }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Photos Grid (Existing & Pending) */}
      {(existingMedia.length > 0 || pendingFiles.length > 0) && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: '12px',
            marginTop: '8px',
          }}
        >
          {/* Existing Photos */}
          {existingMedia.map((mediaItem) => {
            const url = resolveMediaUrl(mediaItem.media?.url || mediaItem.url)
            const isPrimary = Boolean(mediaItem.isPrimary)

            return (
              <div
                key={mediaItem.id}
                style={{
                  position: 'relative',
                  borderRadius: '8px',
                  border: isPrimary ? '2px solid #2563EB' : '1px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Image container */}
                <div style={{ width: '100%', height: '95px', backgroundColor: '#F1F5F9', position: 'relative' }}>
                  <img
                    src={url}
                    alt={mediaItem.caption || mediaItem.originalName || 'Photo'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />

                  {/* Primary Badge */}
                  {isPrimary && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '6px',
                        left: '6px',
                        backgroundColor: '#2563EB',
                        color: '#FFFFFF',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <Star size={10} fill="#FFFFFF" /> Principale
                    </span>
                  )}
                </div>

                {/* Card actions */}
                <div
                  style={{
                    padding: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {!isPrimary ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (onSetPrimary) onSetPrimary(mediaItem.id)
                        }}
                        disabled={disabled || isUploading}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#2563EB',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: '2px 0',
                          textAlign: 'left',
                        }}
                      >
                        Définir principale
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.7rem', color: '#16A34A', fontWeight: 600 }}>Active</span>
                    )}

                    {onDeleteExisting && (
                      <button
                        type="button"
                        title="Supprimer la photo"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteExisting(mediaItem.id)
                        }}
                        disabled={disabled || isUploading}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#DC2626',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Pending New Files */}
          {pendingFiles.map((pending) => {
            const isPrimary = Boolean(pending.isPrimary)

            return (
              <div
                key={pending.id}
                style={{
                  position: 'relative',
                  borderRadius: '8px',
                  border: isPrimary ? '2px solid #2563EB' : '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Image container */}
                <div style={{ width: '100%', height: '95px', backgroundColor: '#F1F5F9', position: 'relative' }}>
                  <img
                    src={pending.previewUrl}
                    alt={pending.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />

                  {/* New File Tag */}
                  <span
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      backgroundColor: 'rgba(15, 23, 42, 0.75)',
                      color: '#FFFFFF',
                      fontSize: '0.625rem',
                      fontWeight: 600,
                      padding: '1px 5px',
                      borderRadius: '3px',
                    }}
                  >
                    Nouveau
                  </span>

                  {/* Primary Badge */}
                  {isPrimary && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '6px',
                        left: '6px',
                        backgroundColor: '#2563EB',
                        color: '#FFFFFF',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <Star size={10} fill="#FFFFFF" /> Principale
                    </span>
                  )}
                </div>

                {/* Card actions & info */}
                <div
                  style={{
                    padding: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <div
                    title={pending.name}
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 500,
                      color: '#334155',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {pending.name}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.65rem', color: '#64748B' }}>
                      {formatFileSize(pending.size)}
                    </span>

                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {!isPrimary && (
                        <button
                          type="button"
                          title="Définir comme photo principale"
                          onClick={() => handleSetPendingPrimary(pending.id)}
                          disabled={disabled || isUploading}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#2563EB',
                            cursor: 'pointer',
                            padding: '1px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Star size={13} />
                        </button>
                      )}

                      <button
                        type="button"
                        title="Retirer cette photo"
                        onClick={() => handleRemovePending(pending.id)}
                        disabled={disabled || isUploading}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#DC2626',
                          cursor: 'pointer',
                          padding: '1px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
