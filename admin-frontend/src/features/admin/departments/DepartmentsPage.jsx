import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../services/api'
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
      setFormError(err?.response?.data?.message || 'Échec de la création du département.')
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
      setFormError(err?.response?.data?.message || 'Échec de la modification.')
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
      alert(err?.response?.data?.message || 'Échec de la suppression du département.')
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
          <h1>Départements</h1>
          <p>Gestion des entités opérationnelles de Vanguard Services</p>
        </div>
        <button type="button" className="button" onClick={() => { setIsCreateOpen(true); setFormError('') }}>
          <Plus size={16} />
          <span>Nouveau département</span>
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
          <div className="state-container">Chargement des départements...</div>
        ) : deptsQuery.isError ? (
          <div className="state-container">
            <AlertTriangle size={32} />
            <p>Erreur lors du chargement des départements.</p>
            <button type="button" className="button secondary sm" onClick={() => deptsQuery.refetch()}>
              Réessayer
            </button>
          </div>
        ) : deptsList.length === 0 ? (
          <div className="state-container">Aucune donnée disponible.</div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Nom du département</th>
                    <th>Description</th>
                    <th>Statut</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
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
                            title="Modifier"
                            onClick={() => startEdit(d)}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            className={`action-btn ${d.isActive ? 'danger' : ''}`}
                            title={d.isActive ? 'Désactiver' : 'Activer'}
                            onClick={() => toggleStatus(d)}
                          >
                            <Power size={14} />
                          </button>
                          <button
                            type="button"
                            className="action-btn danger"
                            title="Supprimer"
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
                Page {page} sur {totalPages} ({totalDepts} départements au total)
              </span>
              <div className="pagination-controls">
                <button
                  type="button"
                  className="button secondary sm"
                  disabled={page <= 1}
                  onClick={() => setPage((pr) => Math.max(1, pr - 1))}
                >
                  Précédent
                </button>
                <button
                  type="button"
                  className="button secondary sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((pr) => pr + 1)}
                >
                  Suivant
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
              <h3 className="modal-title">Créer un Département</h3>
              <button type="button" className="modal-close" onClick={() => setIsCreateOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                {formError && <div className="alert alert-danger">{formError}</div>}
                <div className="form-group">
                  <label className="form-label">Type *</label>
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
                  <label className="form-label">Nom du département *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
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
                    <span>Département actif</span>
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="button secondary" onClick={() => setIsCreateOpen(false)}>
                  Annuler
                </button>
                <button type="submit" className="button" disabled={createDeptMutation.isPending}>
                  {createDeptMutation.isPending ? 'Création...' : 'Créer'}
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
              <h3 className="modal-title">Modifier le Département</h3>
              <button type="button" className="modal-close" onClick={() => setEditingDept(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                {formError && <div className="alert alert-danger">{formError}</div>}
                <div className="form-group">
                  <label className="form-label">Nom du département</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
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
                    <span>Département actif</span>
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="button secondary" onClick={() => setEditingDept(null)}>
                  Annuler
                </button>
                <button type="submit" className="button" disabled={updateDeptMutation.isPending}>
                  {updateDeptMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
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
              <h3 className="modal-title">Confirmer la suppression</h3>
              <button type="button" className="modal-close" onClick={() => setDeletingDept(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Êtes-vous sûr de vouloir supprimer le département <strong>{deletingDept.name}</strong> ?
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-medium-gray)' }}>
                Cette action est irréversible. Un département lié à des utilisateurs ne peut pas être supprimé.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="button secondary" onClick={() => setDeletingDept(null)}>
                Annuler
              </button>
              <button
                type="button"
                className="button danger"
                disabled={deleteDeptMutation.isPending}
                onClick={() => deleteDeptMutation.mutate(deletingDept.id)}
              >
                {deleteDeptMutation.isPending ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
