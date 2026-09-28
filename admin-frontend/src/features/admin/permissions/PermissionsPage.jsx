import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../services/api'
import { useLanguage } from '../../../i18n/useLanguage'
import {
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
} from 'lucide-react'

async function fetchPermissions({ page, limit, search }) {
  const params = { page, limit }
  if (search) params.search = search
  const response = await api.get('/api/permissions', { params })
  return response.data?.data || { items: [], total: 0, page: 1, limit: 20 }
}

export function PermissionsPage() {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingPermission, setEditingPermission] = useState(null)
  const [deletingPermission, setDeletingPermission] = useState(null)

  // Forms
  const [createForm, setCreateForm] = useState({ name: '', description: '' })
  const [editForm, setEditForm] = useState({ name: '', description: '' })
  const [formError, setFormError] = useState('')

  const permissionsQuery = useQuery({
    queryKey: ['admin-permissions', { page, search }],
    queryFn: () => fetchPermissions({ page, limit: 20, search }),
  })

  // Mutations
  const createPermissionMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post('/api/permissions', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-permissions'] })
      setIsCreateOpen(false)
      setCreateForm({ name: '', description: '' })
      setFormError('')
    },
    onError: (err) => {
      setFormError(err?.response?.data?.message || t('permissionUi.createFailed'))
    },
  })

  const updatePermissionMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await api.put(`/api/permissions/${id}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-permissions'] })
      setEditingPermission(null)
      setFormError('')
    },
    onError: (err) => {
      setFormError(err?.response?.data?.message || t('permissionUi.updateFailed'))
    },
  })

  const deletePermissionMutation = useMutation({
    mutationFn: async (id) => {
      const response = await api.delete(`/api/permissions/${id}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-permissions'] })
      setDeletingPermission(null)
    },
    onError: (err) => {
      alert(err?.response?.data?.message || t('permissionUi.deleteFailed'))
    },
  })

  const permissionsList = permissionsQuery.data?.items || []
  const totalPermissions = permissionsQuery.data?.total || 0
  const totalPages = Math.ceil(totalPermissions / 20) || 1

  const handleCreateSubmit = (e) => {
    e.preventDefault()
    setFormError('')
    if (!createForm.name) {
      setFormError('Le nom de la permission est obligatoire.')
      return
    }
    createPermissionMutation.mutate(createForm)
  }

  const handleEditSubmit = (e) => {
    e.preventDefault()
    setFormError('')
    updatePermissionMutation.mutate({ id: editingPermission.id, data: editForm })
  }

  const startEdit = (p) => {
    setEditingPermission(p)
    setEditForm({ name: p.name || '', description: p.description || '' })
    setFormError('')
  }

  // Extract domain/prefix from name (e.g. VIEW_USER -> USER, CREATE_PROJECT -> PROJECT)
  const getDomain = (name) => {
    if (!name) return 'GENERAL'
    const parts = name.split('_')
    if (parts.length > 1) return parts.slice(1).join('_')
    return name
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{t('permissionUi.title')}</h1>
          <p>{t('permissionUi.subtitle')}</p>
        </div>
        <button type="button" className="button" onClick={() => { setIsCreateOpen(true); setFormError('') }}>
          <Plus size={16} />
          <span>{t('permissionUi.new')}</span>
        </button>
      </div>

      <div className="toolbar">
        <div className="toolbar-filters">
          <div className="search-input-wrap">
            <Search />
            <input
              type="text"
              className="search-input"
              placeholder={t('permissionUi.searchPlaceholder')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
        </div>
        <button type="button" className="button secondary sm" onClick={() => permissionsQuery.refetch()}>
          <RefreshCw size={14} />
          <span>{t('commonUi.refresh')}</span>
        </button>
      </div>

      <div className="table-container">
        {permissionsQuery.isPending ? (
          <div className="state-container">{t('permissionUi.loading')}</div>
        ) : permissionsQuery.isError ? (
          <div className="state-container">
            <AlertTriangle size={32} />
            <p>{t('permissionUi.loadError')}</p>
            <button type="button" className="button secondary sm" onClick={() => permissionsQuery.refetch()}>
              {t('commonUi.retry')}
            </button>
          </div>
        ) : permissionsList.length === 0 ? (
          <div className="state-container">{t('permissionUi.empty')}</div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('permissionUi.name')}</th>
                    <th>{t('permissionUi.domain')}</th>
                    <th>{t('permissionUi.description')}</th>
                    <th style={{ textAlign: 'right' }}>{t('commonUi.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {permissionsList.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                      </td>
                      <td>
                        <span className="badge gray">{getDomain(p.name)}</span>
                      </td>
                      <td>{p.description || t('permissionUi.noDescription')}</td>
                      <td>
                        <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="action-btn"
                            title={t('commonUi.edit')}
                            onClick={() => startEdit(p)}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            className="action-btn danger"
                            title={t('commonUi.delete')}
                            onClick={() => setDeletingPermission(p)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination-wrap">
              <span>
                {t('permissionUi.pageSummary', { page, totalPages, total: totalPermissions })}
              </span>
              <div className="pagination-controls">
                <button
                  type="button"
                  className="button secondary sm"
                  disabled={page <= 1}
                  onClick={() => setPage((pr) => Math.max(1, pr - 1))}
                >
                  {t('commonUi.previous')}
                </button>
                <button
                  type="button"
                  className="button secondary sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((pr) => pr + 1)}
                >
                  {t('commonUi.next')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal Create */}
      {isCreateOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">{t('permissionUi.createTitle')}</h3>
              <button type="button" className="modal-close" onClick={() => setIsCreateOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                {formError && <div className="alert alert-danger">{formError}</div>}
                <div className="form-group">
                  <label className="form-label">{t('permissionUi.name')} * ({t('permissionUi.example')}: VIEW_USER)</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('permissionUi.description')}</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="button secondary" onClick={() => setIsCreateOpen(false)}>
                  {t('commonUi.cancel')}
                </button>
                <button type="submit" className="button" disabled={createPermissionMutation.isPending}>
                  {createPermissionMutation.isPending ? t('permissionUi.creating') : t('permissionUi.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit */}
      {editingPermission && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">{t('permissionUi.editTitle')}</h3>
              <button type="button" className="modal-close" onClick={() => setEditingPermission(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                {formError && <div className="alert alert-danger">{formError}</div>}
                <div className="form-group">
                  <label className="form-label">{t('permissionUi.name')}</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('permissionUi.description')}</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="button secondary" onClick={() => setEditingPermission(null)}>
                  {t('commonUi.cancel')}
                </button>
                <button type="submit" className="button" disabled={updatePermissionMutation.isPending}>
                  {updatePermissionMutation.isPending ? t('permissionUi.saving') : t('permissionUi.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Delete Confirmation */}
      {deletingPermission && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">{t('permissionUi.confirmDelete')}</h3>
              <button type="button" className="modal-close" onClick={() => setDeletingPermission(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                {t('permissionUi.deletePrompt', { name: deletingPermission.name })}
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-medium-gray)' }}>
                {t('permissionUi.deleteWarning')}
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="button secondary" onClick={() => setDeletingPermission(null)}>
                {t('commonUi.cancel')}
              </button>
              <button
                type="button"
                className="button danger"
                disabled={deletePermissionMutation.isPending}
                onClick={() => deletePermissionMutation.mutate(deletingPermission.id)}
              >
                {deletePermissionMutation.isPending ? t('permissionUi.deleting') : t('permissionUi.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
