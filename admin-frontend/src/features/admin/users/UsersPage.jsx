import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../services/api'
import {
  UserPlus,
  Search,
  RefreshCw,
  Eye,
  Edit2,
  Lock,
  Power,
  X,
  AlertTriangle,
} from 'lucide-react'

// API Call Helpers
async function fetchUsers({ page, limit, search, roleId, departmentId, status }) {
  const params = { page, limit }
  if (search) params.search = search
  if (roleId) params.roleId = roleId
  if (departmentId) params.departmentId = departmentId
  if (status) params.status = status
  const response = await api.get('/api/users', { params })
  return response.data?.data || { items: [], total: 0, page: 1, limit: 20 }
}

async function fetchRoles() {
  const response = await api.get('/api/roles?limit=100')
  return response.data?.data?.items || response.data?.data || []
}

async function fetchDepartments() {
  const response = await api.get('/api/departments?limit=100')
  return response.data?.data?.items || response.data?.data || []
}

export function UsersPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [selectedDept, setSelectedDept] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [viewingUser, setViewingUser] = useState(null)
  const [passwordResetUser, setPasswordResetUser] = useState(null)
  const [tempPassword, setTempPassword] = useState('')

  // Form States
  const [createForm, setCreateForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    roleId: '',
    departmentId: '',
  })
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
  })
  const [formError, setFormError] = useState('')

  // Queries
  const usersQuery = useQuery({
    queryKey: ['admin-users', { page, search, selectedRole, selectedDept, selectedStatus }],
    queryFn: () =>
      fetchUsers({
        page,
        limit: 15,
        search,
        roleId: selectedRole,
        departmentId: selectedDept,
        status: selectedStatus,
      }),
  })

  const rolesQuery = useQuery({
    queryKey: ['admin-roles-list'],
    queryFn: fetchRoles,
  })

  const deptsQuery = useQuery({
    queryKey: ['admin-depts-list'],
    queryFn: fetchDepartments,
  })

  // Mutations
  const createUserMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post('/api/users', data)
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setIsCreateOpen(false)
      setCreateForm({ firstName: '', lastName: '', email: '', phone: '', roleId: '', departmentId: '' })
      setFormError('')
      alert('Utilisateur créé avec succès. Un parcours sécurisé de définition du mot de passe est requis.')
    },
    onError: (err) => {
      setFormError(err?.response?.data?.message || 'Échec de la création de l’utilisateur.')
    },
  })

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await api.put(`/api/users/${id}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setEditingUser(null)
      setFormError('')
    },
    onError: (err) => {
      setFormError(err?.response?.data?.message || 'Échec de la modification.')
    },
  })

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const newStatus = status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
      const response = await api.patch(`/api/users/${id}/status`, { status: newStatus })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: (err) => {
      alert(err?.response?.data?.message || 'Échec du changement de statut.')
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: async (id) => {
      const response = await api.patch(`/api/users/${id}/password-reset`, {})
      return response.data
    },
    onSuccess: () => {
      setTempPassword('')
      alert('Mot de passe réinitialisé. Un parcours sécurisé de définition du mot de passe est requis.')
    },
    onError: (err) => {
      alert(err?.response?.data?.message || 'Échec de la réinitialisation du mot de passe.')
    },
  })

  const usersList = usersQuery.data?.items || []
  const totalUsers = usersQuery.data?.total || 0
  const totalPages = Math.ceil(totalUsers / 15) || 1
  const rolesList = rolesQuery.data || []
  const deptsList = deptsQuery.data || []

  const handleCreateSubmit = (e) => {
    e.preventDefault()
    setFormError('')
    if (!createForm.firstName || !createForm.lastName || !createForm.email || !createForm.roleId || !createForm.departmentId) {
      setFormError('Veuillez remplir tous les champs obligatoires.')
      return
    }
    createUserMutation.mutate(createForm)
  }

  const handleEditSubmit = (e) => {
    e.preventDefault()
    setFormError('')
    updateUserMutation.mutate({ id: editingUser.id, data: editForm })
  }

  const startEdit = (user) => {
    setEditingUser(user)
    setEditForm({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      phone: user.phone || '',
    })
    setFormError('')
  }

  const startPasswordReset = (user) => {
    setPasswordResetUser(user)
    setTempPassword('')
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Utilisateurs</h1>
          <p>Gestion des comptes utilisateurs et de leurs autorisations</p>
        </div>
        <button type="button" className="button" onClick={() => { setIsCreateOpen(true); setFormError('') }}>
          <UserPlus size={16} />
          <span>Nouvel utilisateur</span>
        </button>
      </div>

      {/* Toolbar & Filters */}
      <div className="toolbar">
        <div className="toolbar-filters">
          <div className="search-input-wrap">
            <Search />
            <input
              type="text"
              className="search-input"
              placeholder="Rechercher nom, email, téléphone..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>

          <select
            className="select-filter"
            value={selectedRole}
            onChange={(e) => { setSelectedRole(e.target.value); setPage(1) }}
          >
            <option value="">Tous les rôles</option>
            {rolesList.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          <select
            className="select-filter"
            value={selectedDept}
            onChange={(e) => { setSelectedDept(e.target.value); setPage(1) }}
          >
            <option value="">Tous les départements</option>
            {deptsList.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.type})
              </option>
            ))}
          </select>

          <select
            className="select-filter"
            value={selectedStatus}
            onChange={(e) => { setSelectedStatus(e.target.value); setPage(1) }}
          >
            <option value="">Tous les statuts</option>
            <option value="ACTIVE">Actif</option>
            <option value="INACTIVE">Inactif</option>
          </select>
        </div>

        <button type="button" className="button secondary sm" onClick={() => usersQuery.refetch()}>
          <RefreshCw size={14} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* Main Table */}
      <div className="table-container">
        {usersQuery.isPending ? (
          <div className="state-container">Chargement des utilisateurs...</div>
        ) : usersQuery.isError ? (
          <div className="state-container">
            <AlertTriangle size={32} />
            <p>Erreur lors du chargement des utilisateurs.</p>
            <button type="button" className="button secondary sm" onClick={() => usersQuery.refetch()}>
              Réessayer
            </button>
          </div>
        ) : usersList.length === 0 ? (
          <div className="state-container">Aucune donnée disponible.</div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nom & Prénom</th>
                    <th>Email</th>
                    <th>Téléphone</th>
                    <th>Rôle</th>
                    <th>Département</th>
                    <th>Statut</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.firstName} {u.lastName}</strong>
                      </td>
                      <td>{u.email}</td>
                      <td>{u.phone || '-'}</td>
                      <td>
                        <span className="badge info">{u.role?.name || u.role || 'N/A'}</span>
                      </td>
                      <td>{u.department?.name || u.department?.type || 'Global'}</td>
                      <td>
                        <span className={`badge ${u.status === 'ACTIVE' ? 'active' : 'inactive'}`}>
                          {u.status === 'ACTIVE' ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="action-btn"
                            title="Voir"
                            onClick={() => setViewingUser(u)}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            className="action-btn"
                            title="Modifier"
                            onClick={() => startEdit(u)}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            className={`action-btn ${u.status === 'ACTIVE' ? 'danger' : ''}`}
                            title={u.status === 'ACTIVE' ? 'Désactiver' : 'Activer'}
                            onClick={() => toggleStatusMutation.mutate({ id: u.id, status: u.status })}
                          >
                            <Power size={14} />
                          </button>
                          <button
                            type="button"
                            className="action-btn"
                            title="Réinitialiser le mot de passe"
                            onClick={() => startPasswordReset(u)}
                          >
                            <Lock size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="pagination-wrap">
              <span>
                Page {page} sur {totalPages} ({totalUsers} utilisateurs au total)
              </span>
              <div className="pagination-controls">
                <button
                  type="button"
                  className="button secondary sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Précédent
                </button>
                <button
                  type="button"
                  className="button secondary sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Suivant
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal Creation */}
      {isCreateOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <div className="modal-header-text">
                <h3 className="modal-title">Créer un Utilisateur</h3>
                <p className="modal-subtitle">Renseignez les informations du nouvel utilisateur</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setIsCreateOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="modal-form">
              <div className="modal-body">
                {formError && <div className="alert alert-danger">{formError}</div>}
                <div className="form-group">
                  <label className="form-label">Prénom *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={createForm.firstName}
                    onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Nom *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={createForm.lastName}
                    onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input
                    type="email"
                    className="form-control"
                    required
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Téléphone</label>
                  <input
                    type="text"
                    className="form-control"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Rôle *</label>
                  <select
                    className="form-control"
                    required
                    value={createForm.roleId}
                    onChange={(e) => setCreateForm({ ...createForm, roleId: e.target.value })}
                  >
                    <option value="">Sélectionnez un rôle</option>
                    {rolesList.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Département *</label>
                  <select
                    className="form-control"
                    required
                    value={createForm.departmentId}
                    onChange={(e) => setCreateForm({ ...createForm, departmentId: e.target.value })}
                  >
                    <option value="">Sélectionnez un département</option>
                    {deptsList.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="button secondary" onClick={() => setIsCreateOpen(false)}>
                  Annuler
                </button>
                <button type="submit" className="button" disabled={createUserMutation.isPending}>
                  {createUserMutation.isPending ? 'Création...' : 'Créer l’utilisateur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edition */}
      {editingUser && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <div className="modal-header-text">
                <h3 className="modal-title">Modifier Utilisateur</h3>
                <p className="modal-subtitle">Mettez à jour les informations de l&rsquo;utilisateur</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setEditingUser(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="modal-form">
              <div className="modal-body">
                {formError && <div className="alert alert-danger">{formError}</div>}
                <div className="form-group">
                  <label className="form-label">Prénom</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Nom</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Téléphone</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="button secondary" onClick={() => setEditingUser(null)}>
                  Annuler
                </button>
                <button type="submit" className="button" disabled={updateUserMutation.isPending}>
                  {updateUserMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal View Details */}
      {viewingUser && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">Détails de l’utilisateur</h3>
              <button type="button" className="modal-close" onClick={() => setViewingUser(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p><strong>ID :</strong> {viewingUser.id}</p>
              <p><strong>Nom complet :</strong> {viewingUser.firstName} {viewingUser.lastName}</p>
              <p><strong>Email :</strong> {viewingUser.email}</p>
              <p><strong>Téléphone :</strong> {viewingUser.phone || 'Non renseigné'}</p>
              <p><strong>Rôle :</strong> {viewingUser.role?.name || viewingUser.role}</p>
              <p><strong>Département :</strong> {viewingUser.department?.name || viewingUser.department?.type || 'Global'}</p>
              <p><strong>Statut :</strong> {viewingUser.status}</p>
              <p><strong>Première connexion :</strong> {viewingUser.firstLogin ? 'Oui' : 'Non'}</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="button secondary" onClick={() => setViewingUser(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reset Password */}
      {passwordResetUser && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">Réinitialiser le mot de passe</h3>
              <button type="button" className="modal-close" onClick={() => setPasswordResetUser(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Êtes-vous sûr de vouloir réinitialiser le mot de passe de{' '}
                <strong>{passwordResetUser.firstName} {passwordResetUser.lastName}</strong> ({passwordResetUser.email}) ?
              </p>

              {tempPassword && (
                <div className="alert alert-success" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <strong>Nouveau mot de passe temporaire :</strong>
                  <code style={{ fontSize: '1.1rem', marginTop: '6px' }}>{tempPassword}</code>
                  <span style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                    Communiquez ce mot de passe à l’utilisateur de manière sécurisée.
                  </span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="button secondary" onClick={() => setPasswordResetUser(null)}>
                Fermer
              </button>
              {!tempPassword && (
                <button
                  type="button"
                  className="button danger"
                  disabled={resetPasswordMutation.isPending}
                  onClick={() => resetPasswordMutation.mutate(passwordResetUser.id)}
                >
                  {resetPasswordMutation.isPending ? 'Réinitialisation...' : 'Confirmer la réinitialisation'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
