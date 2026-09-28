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
  Power,
  X,
  AlertTriangle,
} from 'lucide-react'

async function fetchDepartments({ page, limit, search }) {
  const params = { page, limit }
  if (search) params.search = search
  const response = await api.get('/api/departments', { params })
  return response.data?.data || { items: [], total: 0, page: 1, limit: 20 }
}

export function DepartmentsPage() {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingDept, setEditingDept] = useState(null)
  const [deletingDept, setDeletingDept] = useState(null)

  // Forms
  const [createForm, setCreateForm] = useState({
    type: 'VANGUARD_COACH',
    name: '',
    description: '',
    isActive: true,
  })
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    isActive: true,
  })
  const [formError, setFormError] = useState('')

  const deptsQuery = useQuery({
    queryKey: ['admin-departments', { page, search }],
    queryFn: () => fetchDepartments({ page, limit: 15, search }),
  })

  // Mutations
  const createDeptMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post('/api/departments', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-departments'] })
      setIsCreateOpen(false)
      setCreateForm({ type: 'VANGUARD_COACH', name: '', description: '', isActive: true })
      setFormError('')
    },
    onError: (err) => {
      setFormError(err?.response?.data?.message || t('departmentUi.createFailed'))
    },
  })

  const updateDeptMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await api.put(`/api/departments/${id}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-departments'] })
      setEditingDept(null)
      setFormError('')
    },
    onError: (err) => {
      setFormError(err?.response?.data?.message || t('departmentUi.updateFailed'))
    },
  })

  const deleteDeptMutation = useMutation({
    mutationFn: async (id) => {
      const response = await api.delete(`/api/departments/${id}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-departments'] })
      setDeletingDept(null)
    },
    onError: (err) => {
      alert(err?.response?.data?.message || t('departmentUi.deleteFailed'))
    },
  })

  const toggleStatus = (dept) => {
    updateDeptMutation.mutate({
      id: dept.id,
      data: { isActive: !dept.isActive },
    })
  }

  const deptsList = deptsQuery.data?.items || []
  const totalDepts = deptsQuery.data?.total || 0
  const totalPages = Math.ceil(totalDepts / 15) || 1

  const handleCreateSubmit = (e) => {
    e.preventDefault()
    setFormError('')
    if (!createForm.name || !createForm.type) {
      setFormError('Le type et le nom sont obligatoires.')
      return
    }
    createDeptMutation.mutate(createForm)
  }

  const handleEditSubmit = (e) => {
    e.preventDefault()
    setFormError('')
    updateDeptMutation.mutate({ id: editingDept.id, data: editForm })
  }

  const startEdit = (d) => {
    setEditingDept(d)
    setEditForm({
      name: d.name || '',
      description: d.description || '',
      isActive: Boolean(d.isActive),
    })
    setFormError('')
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{t('departmentUi.title')}</h1>
          <p>{t('departmentUi.subtitle')}</p>
        </div>
        <button type="button" className="button" onClick={() => { setIsCreateOpen(true); setFormError('') }}>
          <Plus size={16} />
          <span>{t('departmentUi.new')}</span>
        </button>
      </div>

      <div className="toolbar">
        <div className="toolbar-filters">
          <div className="search-input-wrap">
            <Search />
            <input
              type="text"
              className="search-input"
              placeholder="Rechercher type ou nom..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
        </div>
        <button type="button" className="button secondary sm" onClick={() => deptsQuery.refetch()}>
          <RefreshCw size={14} />
          <span>Actualiser</span>
        </button>
      </div>

      <div className="table-container">
        {deptsQuery.isPending ? (
          <div className="state-container">{t('departmentUi.loading')}</div>
        ) : deptsQuery.isError ? (
          <div className="state-container">
            <AlertTriangle size={32} />
            <p>{t('departmentUi.loadError')}</p>
            <button type="button" className="button secondary sm" onClick={() => deptsQuery.refetch()}>
              {t('commonUi.retry')}
            </button>
          </div>
        ) : deptsList.length === 0 ? (
          <div className="state-container">{t('departmentUi.empty')}</div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('departmentUi.type')}</th>
                    <th>{t('departmentUi.name')}</th>
                    <th>{t('departmentUi.description')}</th>
                    <th>Statut</th>
                    <th style={{ textAlign: 'right' }}>{t('commonUi.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {deptsList.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <span className="badge info">{d.type}</span>
                      </td>
                      <td>
                        <strong>{d.name}</strong>
                      </td>
                      <td>{d.description || 'Aucune description'}</td>
                      <td>
                        <span className={`badge ${d.isActive ? 'active' : 'inactive'}`}>
                          {d.isActive ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="action-btn"
                            title={t('commonUi.edit')}
                            onClick={() => startEdit(d)}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            className={`action-btn ${d.isActive ? 'danger' : ''}`}
                            title={d.isActive ? t('departmentUi.deactivate') : t('departmentUi.activate')}
                            onClick={() => toggleStatus(d)}
                          >
                            <Power size={14} />
                          </button>
                          <button
                            type="button"
                            className="action-btn danger"
                            title={t('commonUi.delete')}
                            onClick={() => setDeletingDept(d)}
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
                {t('departmentUi.pageSummary', { page, totalPages, total: totalDepts })}
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
              <h3 className="modal-title">{t('departmentUi.createTitle')}</h3>
              <button type="button" className="modal-close" onClick={() => setIsCreateOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                {formError && <div className="alert alert-danger">{formError}</div>}
                <div className="form-group">
                  <label className="form-label">{t('departmentUi.type')} *</label>
                  <select
                    className="form-control"
                    required
                    value={createForm.type}
                    onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
                  >
                    <option value="VANGUARD_COACH">VANGUARD_COACH</option>
                    <option value="CONSTRUCTION">CONSTRUCTION</option>
                    <option value="AUTO_SALES">AUTO_SALES</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('departmentUi.name')} *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('departmentUi.description')}</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={createForm.isActive}
                      onChange={(e) => setCreateForm({ ...createForm, isActive: e.target.checked })}
                    />
                    <span>{t('departmentUi.active')}</span>
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="button secondary" onClick={() => setIsCreateOpen(false)}>
                  {t('commonUi.cancel')}
                </button>
                <button type="submit" className="button" disabled={createDeptMutation.isPending}>
                  {createDeptMutation.isPending ? t('departmentUi.creating') : t('departmentUi.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit */}
      {editingDept && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">{t('departmentUi.editTitle')}</h3>
              <button type="button" className="modal-close" onClick={() => setEditingDept(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                {formError && <div className="alert alert-danger">{formError}</div>}
                <div className="form-group">
                  <label className="form-label">{t('departmentUi.name')}</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('departmentUi.description')}</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={editForm.isActive}
                      onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                    />
                    <span>{t('departmentUi.active')}</span>
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="button secondary" onClick={() => setEditingDept(null)}>
                  {t('commonUi.cancel')}
                </button>
                <button type="submit" className="button" disabled={updateDeptMutation.isPending}>
                  {updateDeptMutation.isPending ? t('departmentUi.saving') : t('departmentUi.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Delete Confirmation */}
      {deletingDept && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">{t('departmentUi.confirmDelete')}</h3>
              <button type="button" className="modal-close" onClick={() => setDeletingDept(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                {t('departmentUi.deletePrompt', { name: deletingDept.name })}
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-medium-gray)' }}>
                {t('departmentUi.deleteWarning')}
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="button secondary" onClick={() => setDeletingDept(null)}>
                {t('commonUi.cancel')}
              </button>
              <button
                type="button"
                className="button danger"
                disabled={deleteDeptMutation.isPending}
                onClick={() => deleteDeptMutation.mutate(deletingDept.id)}
              >
                {deleteDeptMutation.isPending ? t('departmentUi.deleting') : t('departmentUi.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
