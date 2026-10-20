import React, { useState, useEffect, useId, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../services/api'
import { useAuth } from '../auth/authContext'
import { useLanguage } from '../../i18n/useLanguage'
import { getResourceSingular } from '../../i18n/resourceLabels'
import { FormField, Input, Select, Textarea, Button, Modal } from '../../components/ui'
import { MediaUploader } from '../../components/media/MediaUploader'
import { normalizeListResponse, unwrapApiResponse, getRelationValue } from '../../utils/apiResponse'
import { calculateTripArrivalAt } from '../admin/coach/coachAdminWorkflow.mjs'
import { buildParcelCreatePayload } from './parcelFormWorkflow.mjs'
import { AlertCircle, Check, Save, X, Loader2 } from 'lucide-react'

const toOptionsList = (payload) => normalizeListResponse(payload)
const getFieldLabel = (field, t) => {
  const translated = t(`resourceFields.${field.name}`)
  if (!translated.startsWith('resourceFields.')) return translated
  const extra = t(`resourceFieldExtras.${field.name}`)
  return extra.startsWith('resourceFieldExtras.') ? field.label : extra
}
const getFieldPlaceholder = (field, t) => {
  const translated = t(`resourcePlaceholders.${field.name}`)
  return translated.startsWith('resourcePlaceholders.') ? field.placeholder || '' : translated
}
const getFieldHelper = (field, t) => {
  const translated = t(`resourceHelpers.${field.name}`)
  return translated.startsWith('resourceHelpers.') ? field.helper : translated
}

// Relational select field that loads options asynchronously only when optionsUrl is provided
function RelationalSelectField({ field, value, onChange, disabled, hasError, inputId, optionsParams = {}, optionsReady = true }) {
  const { t } = useLanguage()
  const { data: remoteOptions = [], isLoading, isError } = useQuery({
    queryKey: ['resource-options', field.optionsUrl, optionsParams],
    queryFn: async () => {
      const response = await api.get(field.optionsUrl, { params: { limit: 100, ...optionsParams } })
      const raw = toOptionsList(unwrapApiResponse(response))
      if (typeof field.optionsMapper === 'function') {
        return raw.map((item) => ({ ...field.optionsMapper(item), source: item }))
      }
      return raw.map((item) => ({
        value: item.id || item.code || item.value,
        label: item.name || item.title || item.label || item.code || String(item.id),
        source: item,
      }))
    },
    enabled: Boolean(field.optionsUrl && optionsReady),
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
        onChange(field.name, val, remoteOptions.find((option) => String(option.value) === val))
      }}
      disabled={disabled || isLoading || !optionsReady}
      hasError={hasError}
    >
      <option value="">{isLoading ? t('resourceUi.loading') : isError || !optionsReady ? t('resourceFieldStatus.optionsUnavailable') : (getFieldPlaceholder(field, t) || t('resourceUi.selectOption'))}</option>
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
  mediaState,
  onPendingMediaChange,
  onSetPrimaryMedia,
  onDeleteExistingMedia,
  mediaProgress,
  optionsParams,
  optionsReady,
  dynamicRequired = false,
}) {
  const inputId = useId()
  const { t } = useLanguage()
  const label = getFieldLabel(field, t)

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
        label={label}
        required={field.required || dynamicRequired}
        helper={getFieldHelper(field, t)}
        error={error}
        className={field.fullWidth ? 'field-full-width' : ''}
      >
        <MediaUploader
          label={label}
          helperText={getFieldHelper(field, t)}
          existingMedia={mediaState?.existing || []}
          pendingFiles={mediaState?.pending || []}
          onPendingChange={onPendingMediaChange}
          onSetPrimary={onSetPrimaryMedia}
          onDeleteExisting={onDeleteExistingMedia}
          disabled={disabled}
          isUploading={disabled}
          uploadProgressText={mediaProgress || t('resourceUi.saving')}
          maxFiles={field.maxFiles || 12}
        />
      </FormField>
    )
  }

  return (
    <FormField
      id={inputId}
      label={label}
      required={field.required || dynamicRequired}
      helper={getFieldHelper(field, t)}
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
          optionsParams={optionsParams}
          optionsReady={optionsReady}
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
          <option value="">{getFieldPlaceholder(field, t) || t('resourceUi.selectOption')}</option>
          {staticOptions.map((opt) => {
            const valueKey = typeof opt.value === 'boolean' ? (opt.value ? 'active' : 'inactive') : String(opt.value)
            const optionTranslation = t(`resourceOptions.${field.name}.${valueKey}`)
            const extraOption = t(`resourceFieldOptionExtras.${field.name}.${valueKey}`)
            const translatedOption = !optionTranslation.startsWith('resourceOptions.')
              ? optionTranslation
              : !extraOption.startsWith('resourceFieldOptionExtras.')
                ? extraOption
                : t(`status.${String(opt.value).toLowerCase()}`)
            return (
            <option key={String(opt.value)} value={String(opt.value)}>
              {translatedOption.startsWith('status.') || translatedOption.startsWith('resourceOptions.') ? opt.label : translatedOption}
            </option>
            )
          })}
        </Select>
      ) : field.type === 'textarea' ? (
        <Textarea
          id={inputId}
          value={value ?? ''}
          onChange={handleChange}
          placeholder={getFieldPlaceholder(field, t)}
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
          <span>{field.checkboxLabel || label}</span>
        </label>
      ) : (
        <Input
          id={inputId}
          type={field.type || 'text'}
          value={value ?? ''}
          onChange={handleChange}
          placeholder={getFieldPlaceholder(field, t)}
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
  const [priceQuote, setPriceQuote] = useState(null)
  const [priceQuoteLoading, setPriceQuoteLoading] = useState(false)
  const [priceQuoteError, setPriceQuoteError] = useState(false)
  const priceQuoteRequestId = useRef(0)
  const [priceQuoteRetry, setPriceQuoteRetry] = useState(0)
  const { user } = useAuth()
  const { t } = useLanguage()
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const resourceSingular = getResourceSingular(t, resource)
  const title = mode === 'create'
    ? `${t('resourceUi.newItem')} ${resourceSingular}`
    : `${t('resourceUi.edit')} ${resourceSingular}`

  const subtitle = mode === 'create'
    ? t('resourceUi.fillNew')
    : t('resourceUi.updateRecord')

  // Fetch departments to auto-resolve departmentId for transport resources when SuperAdmin
  const departmentsQuery = useQuery({
    queryKey: ['departments-lookup'],
    queryFn: async () => {
      const response = await api.get('/api/departments')
      return toOptionsList(response.data?.data ?? response.data)
    },
    enabled: isOpen && isSuperAdmin,
    staleTime: 30 * 60 * 1000,
  })
  const departments = departmentsQuery.data || []

  // Determine current department type from resource path
  const targetDepartmentType = resource?.departmentType || (
    resource?.path?.startsWith('/transport') ? 'VANGUARD_COACH' :
    resource?.path?.startsWith('/automobile') ? 'AUTO_SALES' :
    resource?.path?.startsWith('/construction') ? 'CONSTRUCTION' : null
  )

  const defaultDept = departments.find((department) => department.type === targetDepartmentType)

  const [formData, setFormData] = useState({})
  const [errors, setErrors] = useState({})
  const [mediaState, setMediaState] = useState({
    pending: [],
    existing: [],
    deleted: [],
  })
  const isCoachTripForm = resource?.path === '/transport/trips' && mode === 'create'
  const selectedScheduleQuery = useQuery({
    queryKey: ['coach-trip-schedule-details', formData.scheduleId],
    queryFn: async () => {
      const response = await api.get(`/api/schedules/${encodeURIComponent(formData.scheduleId)}`)
      const payload = unwrapApiResponse(response)
      return payload?.schedule || payload
    },
    enabled: Boolean(isOpen && isCoachTripForm && formData.scheduleId),
  })

  const updateFields = resource.updateFields?.map((field) => typeof field === 'string'
    ? (resource.fields || []).find((resourceField) => resourceField.name === field)
    : field).filter(Boolean)
  const allFields = mode === 'edit' && resource.updateFields ? updateFields : (resource.fields || [])
  const fields = allFields.filter((field) => !field.visibleWhen || field.visibleWhen(formData))

  useEffect(() => {
    const requestId = ++priceQuoteRequestId.current
    if (!isOpen || !resource.priceQuote || !formData.pricingBasis) {
      setPriceQuote(null)
      setPriceQuoteLoading(false)
      setPriceQuoteError(false)
      return undefined
    }
    const basis = formData.pricingBasis
    const value = basis === 'WEIGHT' ? formData.weightKg : formData.volumeM3
    if (value === undefined || value === null || value === '') {
      setPriceQuote(null)
      setPriceQuoteLoading(false)
      setPriceQuoteError(false)
      return undefined
    }
    setPriceQuote(null)
    setPriceQuoteLoading(true)
    setPriceQuoteError(false)
    const timer = setTimeout(async () => {
      try {
        const response = await api.post('/api/parcels/quote', {
          weightKg: basis === 'WEIGHT' ? value : 0,
          volumeM3: basis === 'VOLUME' ? value : 0,
          category: formData.category,
          declaredValue: formData.declaredValue || 0,
          departmentId: defaultDept?.id || user?.departmentId,
        })
        if (requestId === priceQuoteRequestId.current) setPriceQuote(response.data?.data || null)
      } catch {
        if (requestId === priceQuoteRequestId.current) setPriceQuoteError(true)
      } finally {
        if (requestId === priceQuoteRequestId.current) setPriceQuoteLoading(false)
      }
    }, 250)
    return () => {
      clearTimeout(timer)
      if (priceQuoteRequestId.current === requestId) priceQuoteRequestId.current += 1
    }
  }, [isOpen, resource.priceQuote, formData.pricingBasis, formData.weightKg, formData.volumeM3, formData.category, formData.declaredValue, defaultDept?.id, user?.departmentId, priceQuoteRetry])

  useEffect(() => {
    if (!resource.priceQuote) return
    setFormData((current) => ({
      ...current,
      amount: priceQuote?.amount || '',
      ...(priceQuote?.currency ? { currency: priceQuote.currency } : {}),
    }))
  }, [priceQuote, resource.priceQuote])
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

  useEffect(() => {
    const schedule = selectedScheduleQuery.data
    const selectedDate = formData.date
    if (!isCoachTripForm || !schedule || !selectedDate) return
    const localArrival = calculateTripArrivalAt(selectedDate, schedule.departureTime, schedule.route?.durationHours)
    if (!localArrival) return
    setFormData((current) => current.arrivalAt === localArrival ? current : { ...current, arrivalAt: localArrival })
  }, [isCoachTripForm, selectedScheduleQuery.data, formData.date])

  if (!fields.length) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title={title} subtitle={subtitle} size="lg">
        <div className="form-alert-info" role="status">
          <AlertCircle size={18} className="alert-icon" />
          <div className="alert-content">
            <strong>{t('resourceUi.configurationUnavailable')}</strong>
            <p>{t('resourceUi.noFields')}</p>
          </div>
        </div>
      </Modal>
    )
  }

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

  const handleFieldChange = (name, value, selectedOption) => {
    const field = resource.fields?.find((candidate) => candidate.name === name)
    setFormData((prev) => {
      if (name === 'scheduleId') return { ...prev, scheduleId: value, arrivalAt: '' }
      if (field?.linkedCityField) return { ...prev, [name]: value, [field.linkedCityField]: selectedOption?.city || selectedOption?.source?.city || '' }
      return { ...prev, [name]: value }
    })
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
    if (field?.linkedCityField && errors[field.linkedCityField]) {
      setErrors((prev) => ({ ...prev, [field.linkedCityField]: undefined }))
    }
  }

  const validate = () => {
    const nextErrors = {}

    fields.forEach((field) => {
      const val = formData[field.name]
      const required = field.required || Boolean(field.requiredWhen?.(formData))
      if (required) {
        if (val === undefined || val === null || val === '') {
          nextErrors[field.name] = `${getFieldLabel(field, t)} ${t('resourceUi.required')}`
        } else if (field.type === 'checkbox' && val !== true) {
          nextErrors[field.name] = `${getFieldLabel(field, t)} ${t('resourceUi.required')}`
        } else if (field.type === 'multiselect' && Array.isArray(val) && val.length === 0) {
          nextErrors[field.name] = t('resourceUi.selectItem')
        }
      }

      if (field.type === 'email' && val) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(String(val).trim())) {
          nextErrors[field.name] = t('resourceUi.invalidEmail')
        }
      }

      if (field.type === 'number' && val !== '' && val !== undefined && val !== null) {
        const num = Number(val)
        if (isNaN(num)) {
          nextErrors[field.name] = t('resourceUi.validNumber')
        } else {
          if (field.min !== undefined && num < field.min) {
            nextErrors[field.name] = `${t('resourceUi.minValue')} ${field.min}.`
          }
          if (field.max !== undefined && num > field.max) {
            nextErrors[field.name] = `${t('resourceUi.maxValue')} ${field.max}.`
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

    let payload = mode === 'edit' && resource.updateFields
      ? Object.fromEntries(updateFields.map((field) => [field.name, formData[field.name]]))
      : { ...formData }

    if (mode === 'create' && resource.priceQuote) {
      if (!priceQuote) return
      payload = buildParcelCreatePayload(payload, priceQuote)
    }

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
        {user?.role === 'AGENT' && resource.agentFields && (
          <div className="form-alert-info" role="status">
            {t('agent.originAgency')}: <strong>{user.agency?.name || user.agency?.code || user.agencyId || '—'}</strong>
          </div>
        )}
        {serverError && (
          <div className="form-alert-error" role="alert">
            <AlertCircle size={18} className="alert-icon" />
            <div className="alert-content">
          <strong>{t('resourceUi.errorOccurred')}</strong>
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

        {isCoachTripForm && formData.scheduleId && (
          <div className="coach-trip-schedule-summary" role="status" aria-live="polite">
            {selectedScheduleQuery.isPending ? <span>{t('coachTripForm.loadingSchedule')}</span> : selectedScheduleQuery.isError ? <span role="alert">{t('coachTripForm.scheduleUnavailable')}</span> : selectedScheduleQuery.data && <>
              <strong>{t('coachTripForm.selectedSchedule')}</strong>
              <span>{selectedScheduleQuery.data.route?.departureCity || '—'} → {selectedScheduleQuery.data.route?.arrivalCity || '—'}</span>
              <span>{t('coachTripForm.bus')}: {selectedScheduleQuery.data.bus?.plateNumber || '—'}</span>
              <span>{t('coachTripForm.departure')}: {selectedScheduleQuery.data.departureTime || '—'}</span>
              <span>{t('coachTripForm.price')}: {selectedScheduleQuery.data.price || '—'} USD</span>
              <span>{t('coachTripForm.duration')}: {selectedScheduleQuery.data.route?.durationHours || '2'} h</span>
              <small>{t('coachTripForm.arrivalHint')}</small>
            </>}
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
                disabled={isSubmitting || Boolean(field.disabledWhen?.(formData))}
              initialData={initialData}
              mediaState={mediaState}
              onPendingMediaChange={handlePendingMediaChange}
              onSetPrimaryMedia={handleSetPrimaryMedia}
              onDeleteExistingMedia={handleDeleteExistingMedia}
              mediaProgress={mediaProgress}
                optionsParams={field.optionsDepartmentType ? (() => {
                  const optionDepartmentId = isSuperAdmin
                    ? departments.find((department) => department.type === field.optionsDepartmentType)?.id
                    : user?.departmentId || user?.department?.id
                  return optionDepartmentId ? { departmentId: optionDepartmentId } : {}
                })() : {}}
                optionsReady={!field.optionsDepartmentType || Boolean(isSuperAdmin
                  ? departments.some((department) => department.type === field.optionsDepartmentType && department.id)
                  : user?.departmentId || user?.department?.id)}
                dynamicRequired={Boolean(field.requiredWhen?.(formData))}
            />
          ))}
        </div>

        {resource.priceQuote && priceQuoteLoading && <div className="form-alert-info" role="status">{t('resourceFieldStatus.calculatingPrice')}</div>}
        {resource.priceQuote && priceQuoteError && <div className="form-alert-error" role="alert">{t('resourceFieldStatus.priceUnavailable')}</div>}
        {isSuperAdmin && resource.priceQuote && departmentsQuery.isError && (
          <div className="form-alert-error" role="alert">
            <span>{t('resourceFieldStatus.optionsUnavailable')}</span>
            <Button type="button" variant="secondary" onClick={() => departmentsQuery.refetch()}>{t('resourceFieldStatus.retry')}</Button>
          </div>
        )}
        {resource.priceQuote && priceQuoteError && (
          <Button type="button" variant="secondary" onClick={() => setPriceQuoteRetry((count) => count + 1)}>{t('resourceFieldStatus.retry')}</Button>
        )}
        {resource.priceQuote && priceQuote && (
          <div className="form-alert-info" role="status">
            <span>{t('resourceUi.amountDue')} <strong>{priceQuote.amount} {priceQuote.currency}</strong></span>
          </div>
        )}

        <div className="resource-form-footer">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <X size={16} />
            <span>{t('resourceUi.cancel')}</span>
          </Button>

          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || Boolean(resource.priceQuote && (!priceQuote || priceQuoteLoading || priceQuoteError))}
            className="submit-btn"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="spin-icon" />
                <span>{t('resourceUi.saving')}</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>{mode === 'create' ? t('resourceUi.create') : t('resourceUi.save')}</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
