import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../services/api'
import { useAuth } from '../../auth/authContext'
import { hasPermission } from '../../auth/permissions'
import { useLanguage } from '../../../i18n/useLanguage'

const STATUS_OPTIONS = ['AVAILABLE', 'RESERVED', 'SOLD', 'IN_MAINTENANCE']
const CURRENCY_OPTIONS = ['USD', 'CDF']
const SORT_OPTIONS = [
  { value: 'newest', labelKey: 'autosales.vehiclesPage.sortLabels.newest' },
  { value: 'oldest', labelKey: 'autosales.vehiclesPage.sortLabels.oldest' },
  { value: 'priceAsc', labelKey: 'autosales.vehiclesPage.sortLabels.priceAsc' },
  { value: 'priceDesc', labelKey: 'autosales.vehiclesPage.sortLabels.priceDesc' },
]

const STATUS_TRANSITIONS = {
  AVAILABLE: ['RESERVED', 'IN_MAINTENANCE'],
  RESERVED: ['AVAILABLE', 'SOLD', 'IN_MAINTENANCE'],
  IN_MAINTENANCE: ['AVAILABLE'],
  SOLD: [],
}

const EMPTY_FORM = {
  brand: '',
  model: '',
  year: new Date().getFullYear(),
  price: '',
  currency: 'USD',
  mileage: '',
  fuelType: '',
  transmission: '',
  color: '',
  description: '',
}

const toList = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.items)) return payload.data.items
  return []
}

const money = (value, currency, locale) => {
  const normalizedCurrency = CURRENCY_OPTIONS.includes(String(currency || '').toUpperCase()) ? String(currency).toUpperCase() : 'USD'
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'fr-FR', {
    style: 'currency',
    currency: normalizedCurrency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

const formatDate = (value, locale) => {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR')
  } catch {
    return '—'
  }
}

const statusLabel = (status, t) => t(`status.${String(status).toLowerCase()}`) || status

const getPrimaryMediaUrl = (vehicle, mediaMap = {}) => {
  const vehicleMedia = mediaMap[vehicle?.id] || []
  const primary = vehicleMedia.find((media) => media.isPrimary)?.media || vehicleMedia[0]?.media
  return primary?.url || null
}

const validateVehicleForm = (values) => {
  const errors = {}
  if (!String(values.brand || '').trim()) errors.brand = 'brand required'
  if (!String(values.model || '').trim()) errors.model = 'model required'
  if (!Number.isInteger(Number(values.year)) || Number(values.year) < 1886 || Number(values.year) > new Date().getFullYear() + 1) {
    errors.year = 'invalid year'
  }
  if (!values.price || Number(values.price) <= 0) {
    errors.price = 'invalid price'
  }
  if (values.mileage !== '' && values.mileage !== null && (!Number.isInteger(Number(values.mileage)) || Number(values.mileage) < 0)) {
    errors.mileage = 'invalid mileage'
  }
  if (!CURRENCY_OPTIONS.includes(String(values.currency || '').toUpperCase())) {
    errors.currency = 'invalid currency'
  }
  return errors
}

function VehicleForm({ initialValues = EMPTY_FORM, mode = 'create', onCancel, onSubmit, submitLabel, t }) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})

  const updateField = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const validation = validateVehicleForm(values)
    setErrors(validation)
    if (Object.keys(validation).length > 0) return

    const payload = {
      brand: String(values.brand || '').trim(),
      model: String(values.model || '').trim(),
      year: Number(values.year),
      price: String(values.price).trim(),
      currency: String(values.currency || '').toUpperCase(),
      mileage: values.mileage === '' || values.mileage === null ? null : Number(values.mileage),
      fuelType: String(values.fuelType || '').trim() || null,
      transmission: String(values.transmission || '').trim() || null,
      color: String(values.color || '').trim() || null,
      description: String(values.description || '').trim() || null,
    }
    onSubmit(payload)
  }

  return (
    <form className="card vehicle-form" onSubmit={handleSubmit}>
      <div className="page-head compact">
        <div>
          <h2>{mode === 'create' ? t('autosales.vehiclesPage.addVehicle') : t('autosales.vehiclesPage.editVehicle')}</h2>
        </div>
      </div>

      <div className="vehicle-form-grid">
        <label>
          <span>{t('autosales.vehiclesPage.brand')}</span>
          <input value={values.brand} onChange={(event) => updateField('brand', event.target.value)} />
          {errors.brand && <small className="field-error">{t('autosales.vehiclesPage.errors.requiredBrand')}</small>}
        </label>

        <label>
          <span>{t('autosales.vehiclesPage.model')}</span>
          <input value={values.model} onChange={(event) => updateField('model', event.target.value)} />
          {errors.model && <small className="field-error">{t('autosales.vehiclesPage.errors.requiredModel')}</small>}
        </label>

        <label>
          <span>{t('autosales.vehiclesPage.year')}</span>
          <input type="number" value={values.year} onChange={(event) => updateField('year', event.target.value)} />
          {errors.year && <small className="field-error">{t('autosales.vehiclesPage.errors.invalidYear')}</small>}
        </label>

        <label>
          <span>{t('autosales.vehiclesPage.price')}</span>
          <input type="number" min="0" step="0.01" value={values.price} onChange={(event) => updateField('price', event.target.value)} />
          {errors.price && <small className="field-error">{t('autosales.vehiclesPage.errors.invalidPrice')}</small>}
        </label>

        <label>
          <span>{t('autosales.vehiclesPage.currency')}</span>
          <select value={values.currency} onChange={(event) => updateField('currency', event.target.value)}>
            {CURRENCY_OPTIONS.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
          </select>
          {errors.currency && <small className="field-error">{t('autosales.vehiclesPage.errors.invalidCurrency')}</small>}
        </label>

        <label>
          <span>{t('autosales.vehiclesPage.mileage')}</span>
          <input type="number" min="0" step="1" value={values.mileage} onChange={(event) => updateField('mileage', event.target.value)} />
          {errors.mileage && <small className="field-error">{t('autosales.vehiclesPage.errors.invalidMileage')}</small>}
        </label>

        <label>
          <span>{t('autosales.vehiclesPage.fuelType')}</span>
          <input value={values.fuelType} onChange={(event) => updateField('fuelType', event.target.value)} />
        </label>

        <label>
          <span>{t('autosales.vehiclesPage.transmission')}</span>
          <input value={values.transmission} onChange={(event) => updateField('transmission', event.target.value)} />
        </label>

        <label>
          <span>{t('autosales.vehiclesPage.color')}</span>
          <input value={values.color} onChange={(event) => updateField('color', event.target.value)} />
        </label>

        <label className="full-width">
          <span>{t('autosales.vehiclesPage.description')}</span>
          <textarea rows="4" value={values.description} onChange={(event) => updateField('description', event.target.value)} />
        </label>
      </div>

      <div className="form-actions">
        <button type="submit" className="button">{submitLabel}</button>
        <button type="button" className="button secondary" onClick={onCancel}>{t('autosales.vehiclesPage.cancel')}</button>
      </div>
    </form>
  )
}

export function VehicleManagementPage() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [currencyFilter, setCurrencyFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState('newest')
  const [formState, setFormState] = useState(null)
  const [serverError, setServerError] = useState('')

  const canView = hasPermission(user, 'VIEW_VEHICLE') || user?.role === 'SUPER_ADMIN'
  const canCreate = hasPermission(user, 'CREATE_VEHICLE') || user?.role === 'SUPER_ADMIN'
  const canUpdate = hasPermission(user, 'UPDATE_VEHICLE') || user?.role === 'SUPER_ADMIN'
  const canDelete = hasPermission(user, 'DELETE_VEHICLE') || user?.role === 'SUPER_ADMIN'
  const canManageMedia = hasPermission(user, 'MANAGE_VEHICLE_MEDIA') || user?.role === 'SUPER_ADMIN'

  const query = useQuery({
    queryKey: ['autosales-vehicles', search, statusFilter],
    queryFn: async () => {
      const params = { page: 1, limit: 100 }
      if (search.trim()) params.search = search.trim()
      if (statusFilter !== 'ALL') params.status = statusFilter
      const response = await api.get('/api/vehicles', { params })
      return toList(response.data?.data || response.data)
    },
    enabled: canView,
  })

  const vehicles = query.data || []

  const mediaQuery = useQuery({
    queryKey: ['autosales-vehicle-media', vehicles.map((vehicle) => vehicle.id).join('|')],
    queryFn: async () => {
      if (!canManageMedia || vehicles.length === 0) return {}

      const result = {}
      await Promise.all(
        vehicles.map(async (vehicle) => {
          try {
            const response = await api.get(`/api/vehicle-media/vehicle/${vehicle.id}`)
            result[vehicle.id] = response.data?.data?.items || []
          } catch {
            result[vehicle.id] = []
          }
        }),
      )
      return result
    },
    enabled: canManageMedia && canView && vehicles.length > 0,
  })

  const mediaByVehicle = mediaQuery.data || {}

  const filteredVehicles = useMemo(() => {
    let list = [...vehicles]

    if (currencyFilter !== 'ALL') {
      list = list.filter((vehicle) => String(vehicle.currency || 'USD').toUpperCase() === currencyFilter)
    }

    if (search.trim()) {
      const normalized = search.trim().toLowerCase()
      list = list.filter((vehicle) => {
        const searchFields = [vehicle.brand, vehicle.model, vehicle.color, vehicle.description, vehicle.status]
        return searchFields.some((field) => String(field || '').toLowerCase().includes(normalized))
      })
    }

    switch (sortBy) {
      case 'oldest':
        list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); break
      case 'priceAsc':
        list.sort((a, b) => Number(a.price) - Number(b.price)); break
      case 'priceDesc':
        list.sort((a, b) => Number(b.price) - Number(a.price)); break
      case 'newest':
      default:
        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break
    }

    return list
  }, [currencyFilter, search, sortBy, vehicles])

  const openCreateForm = () => {
    setServerError('')
    setFormState({ mode: 'create', values: { ...EMPTY_FORM } })
  }

  const openEditForm = (vehicle) => {
    setServerError('')
    setFormState({
      mode: 'edit',
      id: vehicle.id,
      values: {
        brand: vehicle.brand || '',
        model: vehicle.model || '',
        year: vehicle.year || new Date().getFullYear(),
        price: vehicle.price ?? '',
        currency: String(vehicle.currency || 'USD').toUpperCase(),
        mileage: vehicle.mileage ?? '',
        fuelType: vehicle.fuelType || '',
        transmission: vehicle.transmission || '',
        color: vehicle.color || '',
        description: vehicle.description || '',
      },
    })
  }

  const saveVehicle = async (payload) => {
    try {
      setServerError('')
      if (formState.mode === 'create') {
        await api.post('/api/vehicles', payload)
      } else {
        await api.patch(`/api/vehicles/${formState.id}`, payload)
      }
      qc.invalidateQueries({ queryKey: ['autosales-vehicles'] })
      qc.invalidateQueries({ queryKey: ['autosales-dashboard-vehicles'] })
      setFormState(null)
    } catch (error) {
      setServerError(error?.response?.data?.message || t('autosales.vehiclesPage.errors.generic'))
    }
  }

  const changeStatus = async (vehicle, nextStatus) => {
    try {
      setServerError('')
      await api.patch(`/api/vehicles/${vehicle.id}`, { status: nextStatus })
      qc.invalidateQueries({ queryKey: ['autosales-vehicles'] })
      qc.invalidateQueries({ queryKey: ['autosales-dashboard-vehicles'] })
    } catch (error) {
      setServerError(error?.response?.data?.message || t('autosales.vehiclesPage.errors.generic'))
    }
  }

  const deleteVehicle = async (vehicle) => {
    if (!window.confirm(`${t('autosales.vehiclesPage.confirmDelete')} ${vehicle.brand} ${vehicle.model}?`)) return
    try {
      setServerError('')
      await api.delete(`/api/vehicles/${vehicle.id}`)
      qc.invalidateQueries({ queryKey: ['autosales-vehicles'] })
      qc.invalidateQueries({ queryKey: ['autosales-dashboard-vehicles'] })
    } catch (error) {
      setServerError(error?.response?.data?.message || t('autosales.vehiclesPage.errors.deleteFailed'))
    }
  }

  if (!canView) {
    return <section className="page"><div className="card"><h1>{t('autosales.vehiclesPage.title')}</h1><p className="empty">{t('autosales.vehiclesPage.noAccess')}</p></div></section>
  }

  return (
    <section className="page autosales-vehicles-page">
      <div className="page-head">
        <div>
          <p className="autosales-eyebrow">VANGUARD SERVICES · AUTOSALES</p>
          <h1>{t('autosales.vehiclesPage.title')}</h1>
        </div>
        {canCreate && <button className="button" type="button" onClick={openCreateForm}>{t('autosales.vehiclesPage.addVehicle')}</button>}
      </div>

      <div className="card vehicle-toolbar">
        <div className="toolbar-grid">
          <label>
            <span>{t('autosales.vehiclesPage.search')}</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('autosales.vehiclesPage.searchPlaceholder')} />
          </label>

          <label>
            <span>{t('autosales.vehiclesPage.status')}</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="ALL">{t('autosales.vehiclesPage.allStatuses')}</option>
              {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{statusLabel(status, t)}</option>)}
            </select>
          </label>

          <label>
            <span>{t('autosales.vehiclesPage.currency')}</span>
            <select value={currencyFilter} onChange={(event) => setCurrencyFilter(event.target.value)}>
              <option value="ALL">{t('autosales.vehiclesPage.allCurrencies')}</option>
              {CURRENCY_OPTIONS.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </label>

          <label>
            <span>{t('autosales.vehiclesPage.sort')}</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{t(option.labelKey)}</option>)}
            </select>
          </label>
        </div>
      </div>

      {serverError && <p className="error-box">{serverError}</p>}

      {formState && (
        <VehicleForm
          initialValues={formState.values}
          mode={formState.mode}
          submitLabel={formState.mode === 'create' ? t('autosales.vehiclesPage.create') : t('autosales.vehiclesPage.save')}
          onCancel={() => setFormState(null)}
          onSubmit={saveVehicle}
          t={t}
        />
      )}

      {query.isPending && <p className="empty">{t('dashboard.loading')}</p>}
      {query.isError && <p className="error-box">{t('dashboard.errorState')}</p>}

      {!query.isPending && !query.isError && (
        <div className="vehicle-grid-wrap">
          {filteredVehicles.length === 0 ? (
            <div className="card empty-card"><p className="empty">{t('autosales.vehiclesPage.empty')}</p></div>
          ) : (
            <div className="vehicle-grid">
              {filteredVehicles.map((vehicle) => {
                const imageUrl = getPrimaryMediaUrl(vehicle, mediaByVehicle)
                const allowedTransitions = STATUS_TRANSITIONS[vehicle.status] || []

                return (
                  <article className="card vehicle-card" key={vehicle.id}>
                    <div className="vehicle-image-box">
                      {imageUrl ? <img src={imageUrl} alt={`${vehicle.brand} ${vehicle.model}`} /> : <div className="vehicle-image-fallback">{t('autosales.noImage')}</div>}
                    </div>

                    <div className="vehicle-card-body">
                      <div className="vehicle-card-topline">
                        <div>
                          <h3>{vehicle.brand} {vehicle.model}</h3>
                          <p>{vehicle.year}</p>
                        </div>
                        <span className={`status-pill status-${String(vehicle.status).toLowerCase()}`}>{statusLabel(vehicle.status, t)}</span>
                      </div>

                      <ul className="vehicle-meta-list">
                        <li><strong>{t('autosales.vehiclesPage.price')}:</strong> {money(vehicle.price, vehicle.currency, lang)}</li>
                        <li><strong>{t('autosales.vehiclesPage.currency')}:</strong> {vehicle.currency || 'USD'}</li>
                        <li><strong>{t('autosales.vehiclesPage.color')}:</strong> {vehicle.color || '—'}</li>
                        <li><strong>{t('autosales.vehiclesPage.mileage')}:</strong> {vehicle.mileage != null ? `${vehicle.mileage.toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR')} km` : '—'}</li>
                        <li><strong>{t('autosales.vehiclesPage.createdAt')}:</strong> {formatDate(vehicle.createdAt, lang)}</li>
                      </ul>

                      <div className="vehicle-actions">
                        <Link className="button secondary sm" to={`/automobile/vehicles/${vehicle.id}`}>{t('autosales.vehiclesPage.details')}</Link>
                        {canUpdate && <button type="button" className="button secondary sm" onClick={() => openEditForm(vehicle)}>{t('autosales.vehiclesPage.edit')}</button>}
                        {canUpdate && allowedTransitions.length > 0 && (
                          <select
                            className="status-select"
                            value={vehicle.status}
                            onChange={(event) => changeStatus(vehicle, event.target.value)}
                            aria-label={t('autosales.vehiclesPage.status')}
                          >
                            {STATUS_OPTIONS.filter((status) => status === vehicle.status || allowedTransitions.includes(status)).map((status) => (
                              <option key={status} value={status}>{statusLabel(status, t)}</option>
                            ))}
                          </select>
                        )}
                        {canDelete && <button type="button" className="button danger sm" onClick={() => deleteVehicle(vehicle)}>{t('autosales.vehiclesPage.delete')}</button>}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export function VehicleDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { lang, t } = useLanguage()
  const navigate = useNavigate()
  const canView = hasPermission(user, 'VIEW_VEHICLE') || user?.role === 'SUPER_ADMIN'
  const canManageMedia = hasPermission(user, 'MANAGE_VEHICLE_MEDIA') || user?.role === 'SUPER_ADMIN'

  const vehicleQuery = useQuery({
    queryKey: ['autosales-vehicle-detail', id],
    queryFn: async () => {
      const response = await api.get(`/api/vehicles/${id}`)
      return response.data?.data?.vehicle || response.data?.vehicle || response.data
    },
    enabled: canView && !!id,
  })

  const mediaQuery = useQuery({
    queryKey: ['autosales-vehicle-detail-media', id],
    queryFn: async () => {
      if (!canManageMedia) return []
      const response = await api.get(`/api/vehicle-media/vehicle/${id}`)
      return response.data?.data?.items || []
    },
    enabled: canView && canManageMedia && !!id,
  })

  const vehicle = vehicleQuery.data
  const media = mediaQuery.data || []
  const gallery = media.length > 0 ? media.map((item) => item.media?.url).filter(Boolean) : []
  const primaryImage = gallery[0] || null

  if (!canView) {
    return <section className="page"><div className="card"><h1>{t('autosales.vehiclesPage.title')}</h1><p className="empty">{t('autosales.vehiclesPage.noAccess')}</p></div></section>
  }

  if (vehicleQuery.isPending) return <section className="page"><div className="card"><p>{t('dashboard.loading')}</p></div></section>
  if (vehicleQuery.isError) return <section className="page"><div className="card"><p className="error-box">{t('dashboard.errorState')}</p></div></section>
  if (!vehicle) return <section className="page"><div className="card"><p className="empty">{t('autosales.vehiclesPage.notFound')}</p></div></section>

  return (
    <section className="page vehicle-detail-page">
      <div className="page-head">
        <div>
          <h1>{vehicle.brand} {vehicle.model}</h1>
          <p>{vehicle.year} · {money(vehicle.price, vehicle.currency, lang)}</p>
        </div>
        <div className="button-row">
          <button type="button" className="button secondary" onClick={() => navigate('/automobile/vehicles')}>{t('autosales.vehiclesPage.back')}</button>
        </div>
      </div>

      <div className="vehicle-detail-grid">
        <div className="card vehicle-gallery">
          {gallery.length > 0 ? (
            <div className="gallery-grid">
              {gallery.map((url, index) => <img key={`${url}-${index}`} src={url} alt={`${vehicle.brand} ${vehicle.model}`} />)}
            </div>
          ) : (
            <div className="vehicle-image-fallback large">{t('autosales.noImage')}</div>
          )}
        </div>

        <div className="card vehicle-summary">
          <div className="summary-row">
            <span>{t('autosales.vehiclesPage.status')}</span>
            <strong>{statusLabel(vehicle.status, t)}</strong>
          </div>
          <div className="summary-row">
            <span>{t('autosales.vehiclesPage.price')}</span>
            <strong>{money(vehicle.price, vehicle.currency, lang)}</strong>
          </div>
          <div className="summary-row">
            <span>{t('autosales.vehiclesPage.currency')}</span>
            <strong>{vehicle.currency || 'USD'}</strong>
          </div>
          <div className="summary-row">
            <span>{t('autosales.vehiclesPage.mileage')}</span>
            <strong>{vehicle.mileage != null ? `${Number(vehicle.mileage).toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR')} km` : '—'}</strong>
          </div>
          <div className="summary-row">
            <span>{t('autosales.vehiclesPage.color')}</span>
            <strong>{vehicle.color || '—'}</strong>
          </div>
          <div className="summary-row">
            <span>{t('autosales.vehiclesPage.fuelType')}</span>
            <strong>{vehicle.fuelType || '—'}</strong>
          </div>
          <div className="summary-row">
            <span>{t('autosales.vehiclesPage.transmission')}</span>
            <strong>{vehicle.transmission || '—'}</strong>
          </div>
          <div className="summary-row">
            <span>{t('autosales.vehiclesPage.createdAt')}</span>
            <strong>{formatDate(vehicle.createdAt, lang)}</strong>
          </div>
          <div className="summary-row">
            <span>{t('autosales.vehiclesPage.updatedAt')}</span>
            <strong>{formatDate(vehicle.updatedAt, lang)}</strong>
          </div>
        </div>
      </div>

      <div className="card vehicle-description">
        <h2>{t('autosales.vehiclesPage.description')}</h2>
        <p>{vehicle.description || '—'}</p>
      </div>

      {primaryImage && (
        <div className="card vehicle-featured-image">
          <h2>{t('autosales.vehiclesPage.primaryImage')}</h2>
          <img src={primaryImage} alt={`${vehicle.brand} ${vehicle.model}`} />
        </div>
      )}
    </section>
  )
}
