import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, RefreshCw, Search, X, Edit2, Trash2, KeyRound, AlertTriangle, CheckCircle2, Eye, Ticket } from 'lucide-react'
import { hasPermission } from '../auth/permissions'
import { useAuth } from '../auth/authContext'
import { useLanguage } from '../../i18n/useLanguage'
import { getResourceTitle, getResourceSingular } from '../../i18n/resourceLabels'
import { createResource, deleteResource, listResource, patchResource, updateResource } from './resourceApi'
import { DynamicResourceForm } from './DynamicResourceForm'
import { AgentParcelModal } from '../admin/coach/AgentParcelModal'
import { api, uploadMedia } from '../../services/api'
import { syncMediaRelations } from '../../utils/mediaSync'
import { normalizeListResponse, getRelationValue } from '../../utils/apiResponse'
import {
  Button,
  StatusBadge,
  PageHeader,
  EmptyState,
  LoadingState,
  ErrorState,
  ConfirmDialog,
  Modal,
  FormField,
  Input,
} from '../../components/ui'

const errorMessage = (error, t) =>
  error?.response?.data?.message ||
  error?.message ||
  t('resourceUi.operationFailed')

const toList = (data) => normalizeListResponse(data)

const getId = (item) => item.id || item._id || item.code || item.ticketCode
const SENSITIVE_RESOURCE_KEYS = new Set([
  'password', 'passwordhash', 'token', 'resettoken', 'accesstoken',
  'refreshtoken', 'secret', 'apikey', 'databaseurl', 'database_url',
  'sessionsecret', 'session_secret', 'jwtsecret', 'jwt_secret', 'stack', 'rawdata', 'raw_data'
])

const formatCellValue = (value, colKey = '', t) => {
  if (SENSITIVE_RESOURCE_KEYS.has(String(colKey).toLowerCase())) return '—'
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return t ? t(value ? 'status.active' : 'status.inactive') : String(value)
  if (Array.isArray(value)) return value.length ? value.map((item) => getRelationValue(item)).filter(Boolean).join(', ') : '—'
  if (typeof value === 'object') {
    const label = getRelationValue(value)
    if (!label) return '—'
    return String(label)
  }
  return String(value)
}

const formatDate = (val, includeTime = false, lang = 'fr') => {
  if (!val) return '—'
  try {
    const d = new Date(val)
    if (isNaN(d.getTime())) return String(val)
    return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    })
  } catch {
    return String(val)
  }
}

export function ResourcePage({ resource }) {
  const { user } = useAuth()
  const { t, lang } = useLanguage()
  const pageTitle = getResourceTitle(t, resource)
  const singularLabel = getResourceSingular(t, resource)
  const client = useQueryClient()
  const navigate = useNavigate()

  const [viewTripModal, setViewTripModal] = useState(null)
  const isAgentTrips = user?.role === 'AGENT' && resource.endpoint === '/api/trips'
  const isAgentParcels = user?.role === 'AGENT' && resource.endpoint === '/api/parcels'
  const displayPageTitle = isAgentTrips ? t('trips.scheduledTrips') : pageTitle

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [formState, setFormState] = useState(null) // { mode: 'create' | 'edit', item: {...} }
  const [deleteDialog, setDeleteDialog] = useState(null) // item to delete
  const [passwordModal, setPasswordModal] = useState(null) // item to reset password
  const [newPassword, setNewPassword] = useState('')
  const [notice, setNotice] = useState('')
  const [serverError, setServerError] = useState('')
  const [mediaProgress, setMediaProgress] = useState('')

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const hasRequiredRole = !resource.roles || resource.roles.includes(user?.role)
  const enabled =
    !resource.unavailable &&
    hasRequiredRole &&
    (!resource.permission || hasPermission(user, resource.permission) || user?.role === 'SUPER_ADMIN')

  const query = useQuery({
    queryKey: ['resource', resource.endpoint, debouncedSearch],
    queryFn: () =>
      listResource(
        resource.endpoint,
        debouncedSearch ? { search: debouncedSearch, page: 1, limit: 100 } : { page: 1, limit: 100 }
      ),
    enabled,
  })

  const refresh = () => {
    setServerError('')
    query.refetch()
  }

  // Mutations
  const mutation = useMutation({
    mutationFn: async ({ action, id, data }) => {
      const mediaConfig = resource.mediaConfig
      const pendingMedia = data?.__pendingMedia || []
      const deletedMediaIds = data?.__deletedMediaIds || []
      const existingMedia = data?.__existingMedia || []
      const payload = { ...data }
      delete payload.__mediaFiles
      delete payload.__pendingMedia
      delete payload.__deletedMediaIds
      delete payload.__existingMedia

      let result
      if (action === 'create') {
        result = await createResource(resource.endpoint, payload)
      } else if (action === 'update') {
        result = await updateResource(resource.endpoint, id, payload)
      } else if (action === 'status') {
        result = await patchResource(resource.endpoint, id, '/status', payload)
      } else if (action === 'reset') {
        result = await patchResource(resource.endpoint, id, '/password-reset', payload)
      } else {
        result = await deleteResource(resource.endpoint, id)
      }

      if (!mediaConfig) {
        return result
      }

      const entityId = result?.id || result?.bus?.id || result?.vehicle?.id || result?.project?.id || id
      if (!entityId) return result

      const mediaFailure = (operation, error, detail) => {
        const reason = errorMessage(error, t)
        const failure = new Error(`Media: ${operation}${detail ? ` (${detail})` : ''}: ${reason}`)
        failure.cause = error
        return failure
      }

      try {
        await syncMediaRelations({
          api,
          uploadMedia,
          endpoint: mediaConfig.mediaEndpoint,
          relationKey: mediaConfig.relationKey || 'busId',
          uploadOptions: {
            department: mediaConfig.department,
            entityType: mediaConfig.uploadEntityType || mediaConfig.entityType || 'bus',
          },
          entityId,
          existingMedia,
          pendingMedia,
          deletedMediaIds,
          onProgress: setMediaProgress,
          primaryMode: mediaConfig.primaryMode || 'update',
        })
      } catch (error) {
        throw mediaFailure('synchronisation', error)
      }

      setMediaProgress('')
      return result
    },
    onSuccess: (result, variables) => {
      setFormState(null)
      setDeleteDialog(null)
      setPasswordModal(null)
      setNewPassword('')
      setServerError('')
      setMediaProgress('')

      const msg = variables.action === 'create'
        ? resource.endpoint === '/api/parcels' && result?.parcel?.amount
          ? `${t('resourceUi.parcelCreated')} ${result.parcel.amount} ${result.parcel.currency}`
          : t('resourceUi.created')
        : variables.action === 'delete'
        ? t('resourceUi.deleted')
        : t('resourceUi.saved')
      setNotice(msg)

      // Single targeted refetch of the active resource list (exactly 1 GET)
      query.refetch()

      setTimeout(() => setNotice(''), 4000)
    },
    onError: (err) => {
      setServerError(errorMessage(err, t))
      setMediaProgress('')
    },
  })

  // Extract raw list
  const rawItems = useMemo(() => toList(query.data), [query.data])

  // Client-side fallback filter for search
  const items = useMemo(() => {
    if (!debouncedSearch) return rawItems
    const s = debouncedSearch.toLowerCase()
    return rawItems.filter((item) => {
      return Object.entries(item).some(([k, v]) => {
        if (v === null || v === undefined) return false
        if (SENSITIVE_RESOURCE_KEYS.has(k.toLowerCase())) return false
        if (typeof v === 'string' || typeof v === 'number') {
          return String(v).toLowerCase().includes(s)
        }
        if (typeof v === 'object' && v.name) {
          return String(v.name).toLowerCase().includes(s)
        }
        return false
      })
    })
  }, [rawItems, debouncedSearch])

  // Permissions checks
  const can = (permission) =>
    hasRequiredRole &&
    (!permission ? !resource.readOnly : hasPermission(user, permission) || user?.role === 'SUPER_ADMIN')

  const canWriteResource = !resource.writeRoles || resource.writeRoles.includes(user?.role)
  const canCreate = can(resource.createPermission) && !resource.readOnly && canWriteResource
  const canUpdate = can(resource.updatePermission) && !resource.readOnly && canWriteResource
  const canDelete = can(resource.deletePermission) && !resource.readOnly && canWriteResource && (!resource.deleteRoles || resource.deleteRoles.includes(user?.role))

  if (resource.unavailable) {
    return (
      <section className="vanguard-page-container">
        <PageHeader title={pageTitle} subtitle={t('resourceUi.moduleUnavailable')} />
        <EmptyState title={t('resourceUi.resourceUnavailable')} description={resource.unavailable} />
      </section>
    )
  }

  if (!enabled) {
    return (
      <section className="vanguard-page-container">
        <PageHeader title={pageTitle} subtitle={t('resourceUi.restricted')} />
        <EmptyState
          title={t('resourceUi.notAuthorized')}
          description={t('resourceUi.resourceAccessDenied')}
        />
      </section>
    )
  }

  const agentTripColumns = useMemo(() => [
    {
      key: 'departure',
      label: t('trips.departure'),
      render: (trip) => trip.schedule?.route?.departureCity || '—',
    },
    {
      key: 'destination',
      label: t('trips.destination'),
      render: (trip) => trip.schedule?.route?.arrivalCity || '—',
    },
    {
      key: 'date',
      label: t('trips.date'),
      render: (trip) => formatDate(trip.departureAt, false, lang),
    },
    {
      key: 'time',
      label: t('trips.time'),
      render: (trip) => trip.schedule?.departureTime || (trip.departureAt ? new Date(trip.departureAt).toLocaleTimeString(lang === 'en' ? 'en-US' : 'fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'),
    },
    {
      key: 'bus',
      label: t('trips.bus'),
      render: (trip) => trip.schedule?.bus ? `${trip.schedule.bus.plateNumber} (${trip.schedule.bus.brand || ''})` : '—',
    },
    {
      key: 'seatsAvailable',
      label: t('trips.availableSeats'),
      render: (trip) => {
        const remaining = trip.seatsRemaining ?? Math.max((trip.schedule?.bus?.seats || 0) - (trip.seatsReserved || 0), 0)
        const total = trip.schedule?.bus?.seats || 0
        return (
          <span className="vanguard-badge vanguard-badge--info" style={{ fontWeight: 600 }}>
            {remaining} / {total}
          </span>
        )
      },
    },
    {
      key: 'status',
      label: t('trips.status'),
      badge: true,
    },
    {
      key: 'agency',
      label: t('trips.agency'),
      render: (trip) => trip.schedule?.agency?.name ? `${trip.schedule.agency.name} (${trip.schedule.agency.city || ''})` : '—',
    },
  ], [lang, t])

  // Derive columns: prefer explicit resource.columns, else generate from first item
  const columns = isAgentTrips ? agentTripColumns : (resource.columns || (
    items.length
      ? Object.keys(items[0])
          .filter((k) => !SENSITIVE_RESOURCE_KEYS.has(k.toLowerCase()) && k !== 'id' && k !== '_id' && k !== 'departmentId')
          .slice(0, 6)
          .map((key) => ({ key, label: key.charAt(0).toUpperCase() + key.slice(1) }))
      : []
  ))

  const renderCell = (item, col) => {
    if (typeof col.render === 'function') {
      return col.render(item)
    }

    const val = item[col.key]

    if (col.badge) {
      const normalizedValue = typeof val === 'object' ? getRelationValue(val) : val
      if (col.badgeMap && col.badgeMap[normalizedValue] !== undefined) {
        const b = col.badgeMap[normalizedValue]
        const badgeStatus = typeof normalizedValue === 'boolean'
          ? normalizedValue ? 'ACTIVE' : 'INACTIVE'
          : normalizedValue
        return <StatusBadge status={badgeStatus} variant={b.variant} />
      }
      return <StatusBadge status={normalizedValue === undefined || normalizedValue === null || normalizedValue === '' ? '—' : String(normalizedValue)} />
    }

    if (col.type === 'date') {
      return formatDate(val, false, lang)
    }

    if (col.type === 'datetime') {
      return formatDate(val, true, lang)
    }

    return formatCellValue(val, col.key, t)
  }

  return (
    <section className="vanguard-page-container">
      {/* Page Header */}
      <PageHeader
        title={displayPageTitle}
        subtitle={resource.description}
        actions={
          canCreate && (
            <Button
              variant="primary"
              onClick={() => {
                setServerError('')
                setFormState({ mode: 'create', initialData: {} })
              }}
            >
              <Plus size={16} />
              <span>{t('resourceUi.newItem')} {singularLabel}</span>
            </Button>
          )
        }
      />

      {/* Toolbar: Search + Refresh */}
      <div className="resource-toolbar">
        <div className="resource-search-wrap">
          <Search size={16} className="search-icon" aria-hidden="true" />
          <input
            type="text"
            className="resource-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`${t('resourceUi.searchAmong')} ${displayPageTitle.toLowerCase()}…`}
          />
          {search && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearch('')}
              aria-label={t('resourceUi.clearSearch')}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="resource-toolbar-actions">
          <Button
            variant="secondary"
            size="sm"
            onClick={refresh}
            disabled={query.isFetching}
            className="refresh-btn"
          >
            <RefreshCw size={14} className={query.isFetching ? 'spin-icon' : ''} />
            <span>{t('dashboard.refresh')}</span>
          </Button>
        </div>
      </div>

      {/* Feedback Alerts */}
      {notice && (
        <div className="vanguard-alert vanguard-alert--success" role="status">
          <CheckCircle2 size={16} />
          <span>{notice}</span>
        </div>
      )}

      {mutation.isError && !formState && (
        <div className="vanguard-alert vanguard-alert--danger" role="alert">
          <AlertTriangle size={16} />
          <span>{errorMessage(mutation.error, t)}</span>
        </div>
      )}

      {/* Main Content Area: Loading / Error / Empty / Data */}
      {query.isPending ? (
        <LoadingState message={`${t('resourceUi.loading')} ${pageTitle.toLowerCase()}…`} />
      ) : query.isError ? (
        <ErrorState
          title={t('resourceUi.loadError')}
          message={errorMessage(query.error, t)}
          onRetry={refresh}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title={search ? t('resourceUi.noSearchResults') : t('resourceUi.noData')}
          description={
            search
              ? `${t('resourceUi.noMatch')} « ${search} ».`
              : `${t('resourceUi.noRecords')} ${pageTitle}.`
          }
          actionLabel={canCreate && !search ? `${t('resourceUi.create')} ${singularLabel}` : undefined}
          onAction={canCreate && !search ? () => setFormState({ mode: 'create', initialData: {} }) : undefined}
        />
      ) : (
        <div className="resource-content-wrapper">
          {/* Desktop Table View */}
          <div className="resource-table-container">
            <div className="table-responsive">
              <table className="data-table vanguard-table">
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th key={col.key}>{t(`resourceFields.${col.key}`).startsWith('resourceFields.') ? col.label : t(`resourceFields.${col.key}`)}</th>
                    ))}
                    <th className="th-actions">{t('resourceUi.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const id = getId(item)
                    return (
                      <tr key={id || index}>
                        {columns.map((col) => (
                          <td key={col.key}>{renderCell(item, col)}</td>
                        ))}
                        <td className="actions-cell">
                          <div className="action-buttons-wrap">
                            {isAgentTrips ? (
                              <>
                                <button
                                  type="button"
                                  className="table-action-btn view-btn"
                                  onClick={() => setViewTripModal(item)}
                                  title={t('trips.view')}
                                >
                                  <Eye size={14} />
                                  <span className="btn-label-desktop">{t('trips.view')}</span>
                                </button>
                                <button
                                  type="button"
                                  className="table-action-btn book-btn"
                                  style={{ color: 'var(--primary)' }}
                                  onClick={() => navigate(`/transport/reservations?tripId=${item.id}`)}
                                  title={t('trips.book')}
                                >
                                  <Ticket size={14} />
                                  <span className="btn-label-desktop">{t('trips.book')}</span>
                                </button>
                              </>
                            ) : (
                              <>
                                {id && canUpdate && (
                                  <button
                                    type="button"
                                    className="table-action-btn edit-btn"
                                    onClick={() => {
                                      setServerError('')
                                      setFormState({ mode: 'edit', initialData: item })
                                    }}
                                    title={t('resourceUi.edit')}
                                    aria-label={t('resourceUi.edit')}
                                  >
                                    <Edit2 size={14} />
                                    <span className="btn-label-desktop">{t('resourceUi.edit')}</span>
                                  </button>
                                )}

                                {id && resource.status && (
                                  <button
                                    type="button"
                                    className="table-action-btn status-btn"
                                    onClick={() =>
                                      mutation.mutate({
                                        action: 'status',
                                        id,
                                        data: { status: item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' },
                                      })
                                    }
                                    title={t('resourceUi.changeStatus')}
                                  >
                                    <span>{item.status === 'ACTIVE' ? t('resourceUi.deactivate') : t('resourceUi.activate')}</span>
                                  </button>
                                )}

                                {id && resource.passwordReset && (
                                  <button
                                    type="button"
                                    className="table-action-btn reset-btn"
                                    onClick={() => setPasswordModal({ id, item })}
                                    title={t('resourceUi.resetPassword')}
                                  >
                                    <KeyRound size={14} />
                                  </button>
                                )}

                                {id && canDelete && (
                                  <button
                                    type="button"
                                    className="table-action-btn delete-btn"
                                    onClick={() => setDeleteDialog({ id, item })}
                                    title={t('resourceUi.delete')}
                                    aria-label={t('resourceUi.delete')}
                                  >
                                    <Trash2 size={14} />
                                    <span className="btn-label-desktop">{t('resourceUi.delete')}</span>
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards View */}
          <div className="resource-mobile-cards">
            {items.map((item, index) => {
              const id = getId(item)
              return (
                <div key={id || index} className="resource-mobile-card">
                  <div className="resource-mobile-card-body">
                    {columns.map((col) => (
                      <div key={col.key} className="resource-card-field-row">
                        <span className="card-field-label">{t(`resourceFields.${col.key}`).startsWith('resourceFields.') ? col.label : t(`resourceFields.${col.key}`)} :</span>
                        <span className="card-field-value">{renderCell(item, col)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="resource-mobile-card-actions">
                    {isAgentTrips ? (
                      <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                        <Button
                          size="sm"
                          variant="secondary"
                          style={{ flex: 1 }}
                          onClick={() => setViewTripModal(item)}
                        >
                          <Eye size={14} />
                          <span>{t('trips.view')}</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          style={{ flex: 1 }}
                          onClick={() => navigate(`/transport/reservations?tripId=${item.id}`)}
                        >
                          <Ticket size={14} />
                          <span>{t('trips.book')}</span>
                        </Button>
                      </div>
                    ) : (
                      <>
                        {id && canUpdate && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setServerError('')
                              setFormState({ mode: 'edit', initialData: item })
                            }}
                          >
                            <Edit2 size={14} />
                            <span>{t('resourceUi.edit')}</span>
                          </Button>
                        )}

                        {id && canDelete && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => setDeleteDialog({ id, item })}
                          >
                            <Trash2 size={14} />
                            <span>{t('resourceUi.delete')}</span>
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Creation / Modification Modal */}
      {isAgentParcels ? (
        <AgentParcelModal
          isOpen={Boolean(formState && formState.mode === 'create')}
          onClose={() => {
            setFormState(null)
            setServerError('')
          }}
          onSuccess={(parcel) => {
            setFormState(null)
            setNotice(`${t('resourceUi.parcelCreated')} ${parcel.amount} ${parcel.currency || 'USD'}`)
            query.refetch()
            setTimeout(() => setNotice(''), 4000)
          }}
        />
      ) : formState && (
        <DynamicResourceForm
          resource={user?.role === 'AGENT' && resource.agentFields ? { ...resource, fields: resource.agentFields } : resource}
          isOpen={Boolean(formState)}
          mode={formState.mode}
          initialData={formState.initialData}
          isSubmitting={mutation.isPending}
          serverError={serverError}
          mediaProgress={mediaProgress}
          onClose={() => {
            setFormState(null)
            setServerError('')
          }}
          onSubmit={(data) => {
            mutation.mutate({
              action: formState.mode,
              id: formState.mode === 'edit' ? formState.initialData.id : undefined,
              data,
            })
          }}
        />
      )}

      {/* View Trip Modal for Agent */}
      {viewTripModal && (
        <Modal
          isOpen={Boolean(viewTripModal)}
          onClose={() => setViewTripModal(null)}
          title={t('trips.tripDetails')}
          size="md"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
            <div style={{ background: 'var(--surface-raised, #f9fafb)', padding: '1rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('trips.departure')} :</span>
                <strong>{viewTripModal.schedule?.route?.departureCity || '—'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('trips.destination')} :</span>
                <strong>{viewTripModal.schedule?.route?.arrivalCity || '—'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('trips.date')} :</span>
                <strong>{formatDate(viewTripModal.departureAt, false, lang)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('trips.time')} :</span>
                <strong>{viewTripModal.schedule?.departureTime || (viewTripModal.departureAt ? new Date(viewTripModal.departureAt).toLocaleTimeString(lang === 'en' ? 'en-US' : 'fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('trips.bus')} :</span>
                <strong>{viewTripModal.schedule?.bus ? `${viewTripModal.schedule.bus.plateNumber} (${viewTripModal.schedule.bus.brand || ''})` : '—'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('trips.availableSeats')} :</span>
                <strong style={{ color: '#10b981' }}>
                  {viewTripModal.seatsRemaining ?? Math.max((viewTripModal.schedule?.bus?.seats || 0) - (viewTripModal.seatsReserved || 0), 0)} / {viewTripModal.schedule?.bus?.seats || 0}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('trips.status')} :</span>
                <StatusBadge status={viewTripModal.status} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('trips.agency')} :</span>
                <strong>{viewTripModal.schedule?.agency?.name ? `${viewTripModal.schedule.agency.name} (${viewTripModal.schedule.agency.city || ''})` : '—'}</strong>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <Button variant="secondary" onClick={() => setViewTripModal(null)}>
                {t('resourceUi.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  const id = viewTripModal.id
                  setViewTripModal(null)
                  navigate(`/transport/reservations?tripId=${id}`)
                }}
              >
                <Ticket size={16} /> {t('trips.book')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirm Delete Dialog */}
      {deleteDialog && (
        <ConfirmDialog
          isOpen={Boolean(deleteDialog)}
          onClose={() => setDeleteDialog(null)}
          onConfirm={() => {
            mutation.mutate({ action: 'delete', id: deleteDialog.id })
          }}
          title={`${t('resourceUi.delete')} ${singularLabel.toLowerCase()} ?`}
          message={t('resourceUi.deleteWarning')}
          confirmText={t('resourceUi.confirmDelete')}
          cancelText={t('resourceUi.cancel')}
          variant="danger"
          loading={mutation.isPending}
        />
      )}

      {/* Password Reset Modal for User management */}
      {passwordModal && (
        <Modal
          isOpen={Boolean(passwordModal)}
          onClose={() => {
            setPasswordModal(null)
            setNewPassword('')
          }}
          title={t('resourceUi.resetPassword')}
          subtitle={`${t('resourceUi.forUser')} ${passwordModal.item?.email || passwordModal.item?.firstName || t('resourceUi.item')}`}
          size="sm"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!newPassword || newPassword.length < 6) return
              mutation.mutate({
                action: 'reset',
                id: passwordModal.id,
                data: { newPassword },
              })
            }}
            className="password-reset-form"
          >
            <FormField
              label={t('resourceUi.newPassword')}
              required
              helper={t('commonUi.minimumChars')}
              id="new-password-input"
            >
              <Input
                id="new-password-input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </FormField>

            <div className="resource-form-footer">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setPasswordModal(null)
                  setNewPassword('')
                }}
              >
                {t('resourceUi.cancel')}
              </Button>
              <Button type="submit" variant="primary" disabled={newPassword.length < 6}>
                {t('resourceUi.save')}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  )
}
