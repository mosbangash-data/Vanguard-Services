import React, { useState, useEffect, useId } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../services/api'
import { useAuth } from '../auth/authContext'
import { FormField, Input, Select, Textarea, Button, Modal } from '../../components/ui'
import { MediaUploader } from '../../components/media/MediaUploader'
import { normalizeListResponse, unwrapApiResponse, getRelationValue } from '../../utils/apiResponse'
import { AlertCircle, Check, Save, X, Loader2 } from 'lucide-react'

const toOptionsList = (payload) => normalizeListResponse(payload)

// Relational select field that loads options asynchronously only when optionsUrl is provided
function RelationalSelectField({ field, value, onChange, disabled, hasError, inputId }) {
  const { data: remoteOptions = [], isLoading } = useQuery({
    queryKey: ['resource-options', field.optionsUrl],
    queryFn: async () => {
      const response = await api.get(field.optionsUrl, { params: { limit: 100 } })
      const raw = toOptionsList(unwrapApiResponse(response))
      if (typeof field.optionsMapper === 'function') {
        return raw.map(field.optionsMapper)
      }
      return raw.map((item) => ({
        value: item.id || item.code || item.value,
        label: item.name || item.title || item.label || item.code || String(item.id),
      }))
    },
    enabled: Boolean(field.optionsUrl),
    staleTime: 10 * 60 * 1000,
  })

  return (
    <Select
      id={inputId}
      value={value === undefined || value === null ? '' : String(value)}
      onChange={(e) => {
        let val = e.target.value
        if (field.type === 'number') val = val === '' ? '' : Number(val)
        if (val === 'true') val = true
        if (val === 'false') val = false
        onChange(field.name, val)
      }}
      disabled={disabled || isLoading}
      hasError={hasError}
    >
      <option value="">{isLoading ? 'Chargement des options…' : (field.placeholder || 'Sélectionner…')}</option>
      {remoteOptions.map((opt) => (
        <option key={String(opt.value)} value={String(opt.value)}>
          {opt.label}
        </option>
      ))}
    </Select>
  )
}

// Field wrapper to handle dynamic form inputs cleanly
function DynamicField({
  field,
  value,
  onChange,
  error,
  disabled,
  initialData,
  mediaState,
  onPendingMediaChange,
  onSetPrimaryMedia,
  onDeleteExistingMedia,
  mediaProgress,
}) {
  const inputId = useId()

  const handleChange = (e) => {
    let val = e.target.value
    if (field.type === 'number') {
      val = val === '' ? '' : Number(val)
    } else if (field.type === 'checkbox') {
      val = e.target.checked
    } else if (field.uppercase && typeof val === 'string') {
      val = val.toUpperCase()
    }
    onChange(field.name, val)
  }

  const handleMultiToggle = (optVal) => {
    const current = Array.isArray(value) ? value : []
    const updated = current.includes(optVal)
      ? current.filter((v) => v !== optVal)
      : [...current, optVal]
    onChange(field.name, updated)
  }

  const isRelationalSelect = field.type === 'select' && Boolean(field.optionsUrl)
  const staticOptions = field.options || []
  const mediaFieldTypes = new Set(['file', 'image', 'gallery'])
  const isMediaField = mediaFieldTypes.has(field.type)

  if (isMediaField) {
    return (
      <FormField
        id={inputId}
        label={field.label}
        required={field.required}
        helper={field.helper}
        error={error}
        className={field.fullWidth ? 'field-full-width' : ''}
      >
        <MediaUploader
          label={field.label}
          helperText={field.helper}
          existingMedia={mediaState?.existing || []}
          pendingFiles={mediaState?.pending || []}
          onPendingChange={onPendingMediaChange}
          onSetPrimary={onSetPrimaryMedia}
          onDeleteExisting={onDeleteExistingMedia}
          disabled={disabled}
          isUploading={disabled}
          uploadProgressText={mediaProgress || 'Enregistrement et traitement des médias…'}
          maxFiles={field.maxFiles || 12}
        />
      </FormField>
    )
  }

  return (
    <FormField
      id={inputId}
      label={field.label}
      required={field.required}
      helper={field.helper}
      error={error}
      className={field.fullWidth ? 'field-full-width' : ''}
    >
      {isRelationalSelect ? (
        <RelationalSelectField
          field={field}
          value={value}
          onChange={onChange}
          disabled={disabled}
          hasError={Boolean(error)}
          inputId={inputId}
        />
      ) : field.type === 'select' ? (
        <Select
          id={inputId}
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) => {
            let val = e.target.value
            if (field.type === 'number') val = val === '' ? '' : Number(val)
            if (val === 'true') val = true
            if (val === 'false') val = false
            onChange(field.name, val)
          }}
          disabled={disabled}
          hasError={Boolean(error)}
        >
          <option value="">{field.placeholder || 'Sélectionner…'}</option>
          {staticOptions.map((opt) => (
            <option key={String(opt.value)} value={String(opt.value)}>
              {opt.label}
            </option>
          ))}
        </Select>
      ) : field.type === 'textarea' ? (
        <Textarea
          id={inputId}
          value={value ?? ''}
          onChange={handleChange}
          placeholder={field.placeholder || ''}
          rows={field.rows || 3}
          disabled={disabled}
          hasError={Boolean(error)}
        />
      ) : field.type === 'multiselect' ? (
        <div className="multiselect-pill-grid">
          {(field.options || []).map((opt) => {
            const isSelected = Array.isArray(value) && value.includes(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                className={`multiselect-pill ${isSelected ? 'selected' : ''}`}
                onClick={() => handleMultiToggle(opt.value)}
                disabled={disabled}
              >
                {isSelected && <Check size={14} className="pill-check-icon" />}
                <span>{opt.label}</span>
              </button>
            )
          })}
        </div>
      ) : field.type === 'checkbox' ? (
        <label className="checkbox-toggle-label" htmlFor={inputId}>
          <input
            id={inputId}
            type="checkbox"
            checked={Boolean(value)}
            onChange={handleChange}
            disabled={disabled}
          />
          <span>{field.checkboxLabel || field.label}</span>
        </label>
      ) : (
        <Input
          id={inputId}
          type={field.type || 'text'}
          value={value ?? ''}
          onChange={handleChange}
          placeholder={field.placeholder || ''}
          min={field.min}
          max={field.max}
          step={field.step}
          disabled={disabled}
          hasError={Boolean(error)}
          autoComplete="off"
        />
      )}
    </FormField>
  )
}

export function DynamicResourceForm({
  resource,
  isOpen,
  mode = 'create', // 'create' | 'edit'
  initialData = {},
  onSubmit,
  onClose,
  isSubmitting = false,
  serverError = '',
  mediaProgress = '',
}) {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const title = mode === 'create'
    ? `Nouveau ${resource.singularLabel || resource.label}`
    : `Modifier ${resource.singularLabel || resource.label}`

  const subtitle = mode === 'create'
    ? `Remplissez les informations ci-dessous pour ajouter un nouvel enregistrement.`
    : `Mettez à jour les informations de cet enregistrement.`

  // Fetch departments to auto-resolve departmentId for transport resources when SuperAdmin
  const { data: departments = [] } = useQuery({
    queryKey: ['departments-lookup'],
    queryFn: async () => {
      const response = await api.get('/api/departments')
      return toOptionsList(response.data?.data ?? response.data)
    },
    enabled: isOpen && isSuperAdmin,
    staleTime: 30 * 60 * 1000,
  })

  // Determine current department type from resource path
  const targetDepartmentType = resource?.departmentType || (
    resource?.path?.startsWith('/transport') ? 'VANGUARD_COACH' :
    resource?.path?.startsWith('/automobile') ? 'AUTO_SALES' :
    resource?.path?.startsWith('/construction') ? 'CONSTRUCTION' : null
  )

  const defaultDept = departments.find(
    (d) => d.type === targetDepartmentType || d.name?.toLowerCase().includes('coach')
  )

  const [formData, setFormData] = useState({})
  const [errors, setErrors] = useState({})
  const [mediaState, setMediaState] = useState({
    pending: [],
    existing: [],
    deleted: [],
  })

  const fields = resource.fields || []
  if (!fields.length) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title={title} subtitle={subtitle} size="lg">
        <div className="form-alert-info" role="status">
          <AlertCircle size={18} className="alert-icon" />
          <div className="alert-content">
            <strong>Configuration du formulaire indisponible</strong>
            <p>Aucune configuration de champ n’a été définie pour cette ressource. Le formulaire ne peut pas être affiché.</p>
          </div>
        </div>
      </Modal>
    )
  }

  // Initialize form state
  useEffect(() => {
    if (!isOpen) return

    const initialValues = {}
    const fields = resource.fields || []

    fields.forEach((field) => {
      if (initialData && initialData[field.name] !== undefined && initialData[field.name] !== null) {
        let val = initialData[field.name]
        if (field.type === 'select' && typeof val === 'object') {
          val = getRelationValue(val)
        }
        // Handle datetime-local format if date object or string
        if (field.type === 'datetime-local' && val) {
          try {
            const d = new Date(val)
            val = d.toISOString().slice(0, 16)
          } catch {
            // keep raw
          }
        }
        initialValues[field.name] = val
      } else if (field.defaultValue !== undefined) {
        initialValues[field.name] = field.defaultValue
      } else if (field.type === 'checkbox') {
        initialValues[field.name] = false
      } else if (field.type === 'multiselect') {
        initialValues[field.name] = []
      } else {
        initialValues[field.name] = ''
      }
    })

    // Preserve ID if edit
    if (initialData?.id) {
      initialValues.id = initialData.id
    }

    setFormData(initialValues)
    setErrors({})

    // Initialize media state from initialData.media
    const existing = Array.isArray(initialData?.media)
      ? initialData.media.map((m) => ({ ...m }))
      : []
    setMediaState({
      pending: [],
      existing,
      deleted: [],
    })
  }, [isOpen, resource, initialData, mode])

  const handlePendingMediaChange = (newPending) => {
    setMediaState((prev) => ({ ...prev, pending: newPending }))
  }

  const handleSetPrimaryMedia = (idOrPendingId) => {
    setMediaState((prev) => {
      const isExisting = prev.existing.some((m) => m.id === idOrPendingId)
      if (isExisting) {
        return {
          ...prev,
          existing: prev.existing.map((m) => ({
            ...m,
            isPrimary: m.id === idOrPendingId,
          })),
          pending: prev.pending.map((p) => ({
            ...p,
            isPrimary: false,
          })),
        }
      }

      return {
        ...prev,
        existing: prev.existing.map((m) => ({
          ...m,
          isPrimary: false,
        })),
        pending: prev.pending.map((p) => ({
          ...p,
          isPrimary: p.id === idOrPendingId,
        })),
      }
    })
  }

  const handleDeleteExistingMedia = (mediaId) => {
    setMediaState((prev) => {
      const deletedItem = prev.existing.find((m) => m.id === mediaId)
      const remainingExisting = prev.existing.filter((m) => m.id !== mediaId)
      let nextPending = [...prev.pending]

      if (deletedItem?.isPrimary) {
        if (remainingExisting.length > 0) {
          remainingExisting[0].isPrimary = true
        } else if (nextPending.length > 0) {
          nextPending[0].isPrimary = true
        }
      }

      return {
        ...prev,
        existing: remainingExisting,
        deleted: [...prev.deleted, mediaId],
        pending: nextPending,
      }
    })
  }

  const handleFieldChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const validate = () => {
    const nextErrors = {}

    fields.forEach((field) => {
      const val = formData[field.name]
      if (field.required) {
        if (val === undefined || val === null || val === '') {
          nextErrors[field.name] = `${field.label} est obligatoire.`
        } else if (field.type === 'multiselect' && Array.isArray(val) && val.length === 0) {
          nextErrors[field.name] = `Veuillez sélectionner au moins un élément.`
        }
      }

      if (field.type === 'email' && val) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(String(val).trim())) {
          nextErrors[field.name] = 'Format d’adresse email invalide.'
        }
      }

      if (field.type === 'number' && val !== '' && val !== undefined && val !== null) {
        const num = Number(val)
        if (isNaN(num)) {
          nextErrors[field.name] = 'Ce champ doit être un nombre valide.'
        } else {
          if (field.min !== undefined && num < field.min) {
            nextErrors[field.name] = `La valeur minimale autorisée est ${field.min}.`
          }
          if (field.max !== undefined && num > field.max) {
            nextErrors[field.name] = `La valeur maximale autorisée est ${field.max}.`
          }
        }
      }
    })

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return

    const payload = { ...formData }

    const hasMediaField = resource.fields?.some((field) => ['file', 'image', 'gallery'].includes(field.type))
    if (hasMediaField) {
      payload.__pendingMedia = mediaState.pending
      payload.__deletedMediaIds = mediaState.deleted
      payload.__existingMedia = mediaState.existing
      resource.fields?.forEach((field) => {
        if (['file', 'image', 'gallery'].includes(field.type)) {
          delete payload[field.name]
        }
      })
    }

    // Auto-resolve departmentId for resources that require it
    if (!payload.departmentId) {
      if (initialData?.departmentId) {
        payload.departmentId = initialData.departmentId
      } else if (defaultDept?.id) {
        payload.departmentId = defaultDept.id
      } else if (user?.departmentId) {
        payload.departmentId = user.departmentId
      }
    }

    // Clean payload: omit empty strings for optional fields or normalize
    resource.fields?.forEach((field) => {
      if (payload[field.name] === '' && !field.required) {
        payload[field.name] = null
      }
      if (typeof field.transform === 'function') {
        payload[field.name] = field.transform(payload[field.name])
      }
    })

    onSubmit(payload)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      size="lg"
      className="resource-form-modal"
    >
      <form onSubmit={handleSubmit} className="resource-dynamic-form" noValidate>
        {serverError && (
          <div className="form-alert-error" role="alert">
            <AlertCircle size={18} className="alert-icon" />
            <div className="alert-content">
              <strong>Une erreur est survenue :</strong>
              <p>{serverError}</p>
            </div>
          </div>
        )}

        {mediaProgress && !serverError && (
          <div className="form-alert-info" role="status">
            <Loader2 size={18} className="spin-icon" />
            <span>{mediaProgress}</span>
          </div>
        )}

        <div className="resource-form-grid">
          {fields.map((field) => (
            <DynamicField
              key={field.name}
              field={field}
              value={formData[field.name]}
              onChange={handleFieldChange}
              error={errors[field.name]}
              disabled={isSubmitting}
              initialData={initialData}
              mediaState={mediaState}
              onPendingMediaChange={handlePendingMediaChange}
              onSetPrimaryMedia={handleSetPrimaryMedia}
              onDeleteExistingMedia={handleDeleteExistingMedia}
              mediaProgress={mediaProgress}
            />
          ))}
        </div>

        <div className="resource-form-footer">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <X size={16} />
            <span>Annuler</span>
          </Button>

          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="submit-btn"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="spin-icon" />
                <span>Enregistrement…</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>{mode === 'create' ? 'Créer' : 'Enregistrer'}</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
