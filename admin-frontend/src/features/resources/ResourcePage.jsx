import React, { useState, useMemo, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, RefreshCw, Search, X, Edit2, Trash2, KeyRound, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { hasPermission } from '../auth/permissions'
import { useAuth } from '../auth/authContext'
import { createResource, deleteResource, listResource, patchResource, updateResource } from './resourceApi'
import { DynamicResourceForm } from './DynamicResourceForm'
import { api, uploadMedia } from '../../services/api'
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

const errorMessage = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  'L’opération a échoué. Vérifiez les données saisies.'

const toList = (data) => {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.data?.items)) return data.data.items
  const found = Object.values(data).find(Array.isArray)
  return Array.isArray(found) ? found : []
}

const getId = (item) => item.id || item._id || item.code || item.ticketCode

const SENSITIVE_RESOURCE_KEYS = new Set([
  'password', 'passwordhash', 'token', 'resettoken', 'accesstoken',
  'refreshtoken', 'secret', 'apikey', 'databaseurl', 'database_url',
  'sessionsecret', 'session_secret', 'jwtsecret', 'jwt_secret', 'stack', 'rawdata', 'raw_data'
])

const formatCellValue = (value, colKey = '') => {
  if (SENSITIVE_RESOURCE_KEYS.has(String(colKey).toLowerCase())) return '—'
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  if (typeof value === 'object') {
    const label = value.name || value.title || value.label || value.code || value.type || value.plateNumber
    return label ? String(label) : '—'
  }
  return String(value)
}

const formatDate = (val, includeTime = false) => {
  if (!val) return '—'
  try {
    const d = new Date(val)
    if (isNaN(d.getTime())) return String(val)
    return d.toLocaleDateString('fr-FR', {
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
  const client = useQueryClient()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [formState, setFormState] = useState(null) // { mode: 'create' | 'edit', item: {...} }
  const [deleteDialog, setDeleteDialog] = useState(null) // item to delete
  const [passwordModal, setPasswordModal] = useState(null) // item to reset password
  const [newPassword, setNewPassword] = useState('')
  const [notice, setNotice] = useState('')
  const [serverError, setServerError] = useState('')

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
      const primaryExistingId = data?.__primaryExistingId
      const payload = { ...data }
      delete payload.__mediaFiles
      delete payload.__pendingMedia
      delete payload.__deletedMediaIds
      delete payload.__primaryExistingId

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

      // 1. Process deletions of existing media
      if (Array.isArray(deletedMediaIds) && deletedMediaIds.length > 0) {
        for (const delId of deletedMediaIds) {
          try {
            await api.delete(`${mediaConfig.mediaEndpoint}/${delId}`)
          } catch (e) {
            console.error('Erreur suppression media', delId, e)
          }
        }
      }

      // 2. Process primary update on existing media
      if (primaryExistingId) {
        try {
          await api.put(`${mediaConfig.mediaEndpoint}/${primaryExistingId}`, { isPrimary: true })
        } catch (e) {
          console.error('Erreur mise à jour primary media', primaryExistingId, e)
        }
      }

      // 3. Process uploads for pending files
      if (Array.isArray(pendingMedia) && pendingMedia.length > 0) {
        for (let index = 0; index < pendingMedia.length; index += 1) {
          const item = pendingMedia[index]
          const file = item.file
          if (!file) continue

          const uploadedMedia = await uploadMedia(file, {
            department: mediaConfig.department,
            entityType: mediaConfig.uploadEntityType || 'bus',
            entityId,
          })

          const mediaPayload = {
            [mediaConfig.relationKey || 'busId']: entityId,
            mediaId: uploadedMedia.id,
            fileName: uploadedMedia.fileName || file.name,
            originalName: uploadedMedia.originalName || file.name,
            mimeType: uploadedMedia.mimeType || file.type,
            size: uploadedMedia.size || file.size,
            url: uploadedMedia.secureUrl || uploadedMedia.url,
            isPrimary: Boolean(item.isPrimary),
            order: index,
          }

          if (mediaConfig.mediaEndpoint) {
            await api.post(mediaConfig.mediaEndpoint, mediaPayload)
          }
        }
      }

      return result
    },
    onSuccess: (_, variables) => {
      setFormState(null)
      setDeleteDialog(null)
      setPasswordModal(null)
      setNewPassword('')
      setServerError('')

      const msg = variables.action === 'create'
        ? 'Élément créé avec succès.'
        : variables.action === 'delete'
        ? 'Élément supprimé.'
        : 'Modifications enregistrées avec succès.'
      setNotice(msg)

      // Single targeted refetch of the active resource list (exactly 1 GET)
      query.refetch()

      setTimeout(() => setNotice(''), 4000)
    },
    onError: (err) => {
      setServerError(errorMessage(err))
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

  const canCreate = can(resource.createPermission) && !resource.readOnly
  const canUpdate = can(resource.updatePermission) && !resource.readOnly
  const canDelete = can(resource.deletePermission) && !resource.readOnly

  if (resource.unavailable) {
    return (
      <section className="vanguard-page-container">
        <PageHeader title={resource.label} subtitle="Module indisponible" />
        <EmptyState title="Ressource non disponible" description={resource.unavailable} />
      </section>
    )
  }

  if (!enabled) {
    return (
      <section className="vanguard-page-container">
        <PageHeader title={resource.label} subtitle="Accès restreint" />
        <EmptyState
          title="Accès non autorisé"
          description="Vous ne disposez pas des permissions nécessaires pour consulter cette ressource administrative."
        />
      </section>
    )
  }

  // Derive columns: prefer explicit resource.columns, else generate from first item
  const columns = resource.columns || (
    items.length
      ? Object.keys(items[0])
          .filter((k) => !SENSITIVE_RESOURCE_KEYS.has(k.toLowerCase()) && k !== 'id' && k !== '_id' && k !== 'departmentId')
          .slice(0, 6)
          .map((key) => ({ key, label: key.charAt(0).toUpperCase() + key.slice(1) }))
      : []
  )

  const renderCell = (item, col) => {
    if (typeof col.render === 'function') {
      return col.render(item)
    }

    const val = item[col.key]

    if (col.badge) {
      if (col.badgeMap && col.badgeMap[val] !== undefined) {
        const b = col.badgeMap[val]
        return <StatusBadge status={b.label} variant={b.variant} />
      }
      return <StatusBadge status={String(val)} />
    }

    if (col.type === 'date') {
      return formatDate(val, false)
    }

    if (col.type === 'datetime') {
      return formatDate(val, true)
    }

    return formatCellValue(val, col.key)
  }

  return (
    <section className="vanguard-page-container">
      {/* Page Header */}
      <PageHeader
        title={resource.label}
        subtitle={resource.description || `Gestion et suivi des ${resource.label.toLowerCase()}.`}
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
              <span>Nouveau {resource.singularLabel || 'élément'}</span>
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
            placeholder={`Rechercher parmi les ${resource.label.toLowerCase()}…`}
          />
          {search && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearch('')}
              aria-label="Effacer la recherche"
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
            <span>Actualiser</span>
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
          <span>{errorMessage(mutation.error)}</span>
        </div>
      )}

      {/* Main Content Area: Loading / Error / Empty / Data */}
      {query.isPending ? (
        <LoadingState message={`Chargement des ${resource.label.toLowerCase()}…`} />
      ) : query.isError ? (
        <ErrorState
          title="Impossible de charger les données"
          message={errorMessage(query.error)}
          onRetry={refresh}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title={search ? 'Aucun résultat trouvé' : 'Aucune donnée disponible'}
          description={
            search
              ? `Aucun élément ne correspond à votre recherche "${search}".`
              : `Aucun enregistrement n’a encore été créé dans ${resource.label}.`
          }
          actionLabel={canCreate && !search ? `Créer ${resource.singularLabel || 'un élément'}` : undefined}
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
                      <th key={col.key}>{col.label}</th>
                    ))}
                    <th className="th-actions">Actions</th>
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
                            {id && canUpdate && (
                              <button
                                type="button"
                                className="table-action-btn edit-btn"
                                onClick={() => {
                                  setServerError('')
                                  setFormState({ mode: 'edit', initialData: item })
                                }}
                                title="Modifier"
                                aria-label="Modifier"
                              >
                                <Edit2 size={14} />
                                <span className="btn-label-desktop">Modifier</span>
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
                                title="Changer le statut"
                              >
                                <span>{item.status === 'ACTIVE' ? 'Désactiver' : 'Activer'}</span>
                              </button>
                            )}

                            {id && resource.passwordReset && (
                              <button
                                type="button"
                                className="table-action-btn reset-btn"
                                onClick={() => setPasswordModal({ id, item })}
                                title="Réinitialiser le mot de passe"
                              >
                                <KeyRound size={14} />
                              </button>
                            )}

                            {id && canDelete && (
                              <button
                                type="button"
                                className="table-action-btn delete-btn"
                                onClick={() => setDeleteDialog({ id, item })}
                                title="Supprimer"
                                aria-label="Supprimer"
                              >
                                <Trash2 size={14} />
                                <span className="btn-label-desktop">Supprimer</span>
                              </button>
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
                        <span className="card-field-label">{col.label} :</span>
                        <span className="card-field-value">{renderCell(item, col)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="resource-mobile-card-actions">
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
                        <span>Modifier</span>
                      </Button>
                    )}

                    {id && canDelete && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setDeleteDialog({ id, item })}
                      >
                        <Trash2 size={14} />
                        <span>Supprimer</span>
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Dynamic Creation / Modification Modal */}
      {formState && (
        <DynamicResourceForm
          resource={resource}
          isOpen={Boolean(formState)}
          mode={formState.mode}
          initialData={formState.initialData}
          isSubmitting={mutation.isPending}
          serverError={serverError}
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

      {/* Confirm Delete Dialog */}
      {deleteDialog && (
        <ConfirmDialog
          isOpen={Boolean(deleteDialog)}
          onClose={() => setDeleteDialog(null)}
          onConfirm={() => {
            mutation.mutate({ action: 'delete', id: deleteDialog.id })
          }}
          title={`Supprimer ce ${resource.singularLabel?.toLowerCase() || 'élément'} ?`}
          message="Cette action est irréversible. Toutes les données associées seront supprimées du système."
          confirmText="Supprimer définitivement"
          cancelText="Annuler"
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
          title="Réinitialiser le mot de passe"
          subtitle={`Pour : ${passwordModal.item?.email || passwordModal.item?.firstName || 'l’utilisateur'}`}
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
              label="Nouveau mot de passe"
              required
              helper="Minimum 6 caractères"
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
                Annuler
              </Button>
              <Button type="submit" variant="primary" disabled={newPassword.length < 6}>
                Enregistrer
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  )
}
