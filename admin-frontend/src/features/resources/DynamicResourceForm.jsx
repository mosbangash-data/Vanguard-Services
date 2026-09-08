import React, { useState, useEffect, useId } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../services/api'
import { useAuth } from '../auth/authContext'
import { FormField, Input, Select, Textarea, Button, Modal } from '../../components/ui'
import { AlertCircle, Check, Save, X, Loader2 } from 'lucide-react'

const toOptionsList = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.items)) return payload.data.items
  return []
}

// Field wrapper to handle dynamic options fetching for relational selects
function DynamicField({ field, value, onChange, error, disabled }) {
  const inputId = useId()

  const { data: remoteOptions = [], isLoading: isLoadingOptions } = useQuery({
    queryKey: ['resource-options', field.optionsUrl],
    queryFn: async () => {
      const response = await api.get(field.optionsUrl, { params: { limit: 100 } })
      const raw = toOptionsList(response.data?.data ?? response.data)
      if (typeof field.optionsMapper === 'function') {
        return raw.map(field.optionsMapper)
      }
      return raw.map((item) => ({
        value: item.id || item.code || item.value,
        label: item.name || item.title || item.label || item.code || String(item.id),
      }))
    },
    enabled: Boolean(field.optionsUrl),
    staleTime: 5 * 60 * 1000,
  })

  const availableOptions = field.optionsUrl ? remoteOptions : (field.options || [])

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

  return (
    <FormField
      id={inputId}
      label={field.label}
      required={field.required}
      helper={field.helper}
      error={error}
      className={field.fullWidth ? 'field-full-width' : ''}
    >
      {field.type === 'select' ? (
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
          disabled={disabled || isLoadingOptions}
          hasError={Boolean(error)}
        >
          <option value="">{isLoadingOptions ? 'Chargement des options…' : (field.placeholder || 'Sélectionner…')}</option>
          {availableOptions.map((opt) => (
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
          {availableOptions.map((opt) => {
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
}) {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  // Fetch departments to auto-resolve departmentId for transport resources when SuperAdmin
  const { data: departments = [] } = useQuery({
    queryKey: ['departments-lookup'],
    queryFn: async () => {
      const response = await api.get('/api/departments')
      return toOptionsList(response.data?.data ?? response.data)
    },
    enabled: isOpen && isSuperAdmin,
    staleTime: 10 * 60 * 1000,
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

  // Initialize form state
  useEffect(() => {
    if (!isOpen) return

    const initialValues = {}
    const fields = resource.fields || []

    fields.forEach((field) => {
      if (initialData && initialData[field.name] !== undefined && initialData[field.name] !== null) {
        let val = initialData[field.name]
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
  }, [isOpen, resource, initialData, mode])

  const handleFieldChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const validate = () => {
    const nextErrors = {}
    const fields = resource.fields || []

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

  const title = mode === 'create'
    ? `Nouveau ${resource.singularLabel || resource.label}`
    : `Modifier ${resource.singularLabel || resource.label}`

  const subtitle = mode === 'create'
    ? `Remplissez les informations ci-dessous pour ajouter un nouvel enregistrement.`
    : `Mettez à jour les informations de cet enregistrement.`

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

        <div className="resource-form-grid">
          {(resource.fields || []).map((field) => (
            <DynamicField
              key={field.name}
              field={field}
              value={formData[field.name]}
              onChange={handleFieldChange}
              error={errors[field.name]}
              disabled={isSubmitting}
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
