import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../services/api'
import { useLanguage } from '../../../i18n/useLanguage'
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

async function fetchAgencies() {
  const response = await api.get('/api/agencies?limit=100')
  return response.data?.data?.items || response.data?.data || []
}

export function UsersPage() {
  const { t } = useLanguage()
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
  const [generatedPasswordUser, setGeneratedPasswordUser] = useState(null)

  // Form States
  const [createForm, setCreateForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    roleId: '',
    departmentId: '',
    agencyId: '',
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

  const agenciesQuery = useQuery({
    queryKey: ['admin-agencies-list'],
    queryFn: fetchAgencies,
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
      setCreateForm({ firstName: '', lastName: '', email: '', phone: '', roleId: '', departmentId: '', agencyId: '' })
      setFormError('')
      setGeneratedPasswordUser({
        name: `${data?.data?.user?.firstName || ''} ${data?.data?.user?.lastName || ''}`.trim(),
        email: data?.data?.user?.email || '',
        password: data?.data?.temporaryPassword || '',
      })
    },
    onError: (err) => {
      setFormError(err?.response?.data?.message || t('userAdmin.createFailed'))
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
      setFormError(err?.response?.data?.message || t('userAdmin.updateFailed'))
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
      alert(err?.response?.data?.message || t('userAdmin.statusFailed'))
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: async (id) => {
      const response = await api.patch(`/api/users/${id}/password-reset`, {})
      return response.data
    },
    onSuccess: (data) => {
      setTempPassword(data?.data?.temporaryPassword || '')
    },
    onError: (err) => {
      alert(err?.response?.data?.message || t('userAdmin.resetFailed'))
    },
  })

  const usersList = usersQuery.data?.items || []
  const totalUsers = usersQuery.data?.total || 0
  const totalPages = Math.ceil(totalUsers / 15) || 1
  const rolesList = rolesQuery.data || []
  const deptsList = deptsQuery.data || []
  const agenciesList = agenciesQuery.data || []

  const handleCreateSubmit = (e) => {
    e.preventDefault()
    setFormError('')
    const selectedRole = rolesList.find((role) => role.id === createForm.roleId)?.name
    if (!createForm.firstName || !createForm.lastName || !createForm.email || !createForm.roleId || !createForm.departmentId || (selectedRole === 'AGENT' && !createForm.agencyId)) {
      setFormError(t('userAdmin.requiredFields'))
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
          <h1>{t('userAdmin.title')}</h1>
          <p>{t('userAdmin.subtitle')}</p>
        </div>
        <button type="button" className="button" onClick={() => { setIsCreateOpen(true); setFormError('') }}>
          <UserPlus size={16} />
          <span>{t('userAdmin.newUser')}</span>
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
              placeholder={t('userAdmin.search')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>

          <select
            className="select-filter"
            value={selectedRole}
            onChange={(e) => { setSelectedRole(e.target.value); setPage(1) }}
          >
            <option value="">{t('userAdmin.allRoles')}</option>
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
            <option value="">{t('userAdmin.allDepartments')}</option>
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
            <option value="">{t('userAdmin.allStatuses')}</option>
            <option value="ACTIVE">{t('userAdmin.active')}</option>
            <option value="INACTIVE">{t('userAdmin.inactive')}</option>
          </select>
        </div>

        <button type="button" className="button secondary sm" onClick={() => usersQuery.refetch()}>
          <RefreshCw size={14} />
          <span>{t('userAdmin.refresh')}</span>
        </button>
      </div>

      {/* Main Table */}
      <div className="table-container">
        {usersQuery.isPending ? (
          <div className="state-container">{t('userAdmin.loading')}</div>
        ) : usersQuery.isError ? (
          <div className="state-container">
            <AlertTriangle size={32} />
            <p>{t('userAdmin.loadError')}</p>
            <button type="button" className="button secondary sm" onClick={() => usersQuery.refetch()}>
              {t('userAdmin.retry')}
            </button>
          </div>
        ) : usersList.length === 0 ? (
          <div className="state-container">{t('userAdmin.empty')}</div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('userAdmin.fullName')}</th>
                    <th>{t('userAdmin.email')}</th>
                    <th>{t('userAdmin.phone')}</th>
                    <th>{t('userAdmin.role')}</th>
                    <th>{t('userAdmin.department')}</th>
                    <th>{t('userAdmin.status')}</th>
                    <th style={{ textAlign: 'right' }}>{t('userAdmin.actions')}</th>
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
                      <td>{u.department?.name || u.department?.type || t('userAdmin.global')}</td>
                      <td>
                        <span className={`badge ${u.status === 'ACTIVE' ? 'active' : 'inactive'}`}>
                          {u.status === 'ACTIVE' ? t('userAdmin.active') : t('userAdmin.inactive')}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="action-btn"
                            title={t('userAdmin.view')}
                            onClick={() => setViewingUser(u)}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            className="action-btn"
                            title={t('userAdmin.edit')}
                            onClick={() => startEdit(u)}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            className={`action-btn ${u.status === 'ACTIVE' ? 'danger' : ''}`}
                            title={u.status === 'ACTIVE' ? t('userAdmin.deactivate') : t('userAdmin.activate')}
                            onClick={() => toggleStatusMutation.mutate({ id: u.id, status: u.status })}
                          >
                            <Power size={14} />
                          </button>
                          <button
                            type="button"
                            className="action-btn"
                            title={t('userAdmin.resetPassword')}
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
                {t('userAdmin.page')} {page} {t('userAdmin.of')} {totalPages} ({totalUsers} {t('userAdmin.totalUsers')})
              </span>
              <div className="pagination-controls">
                <button
                  type="button"
                  className="button secondary sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t('userAdmin.previous')}
                </button>
                <button
                  type="button"
                  className="button secondary sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t('userAdmin.next')}
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
                <h3 className="modal-title">{t('userAdmin.createTitle')}</h3>
                <p className="modal-subtitle">{t('userAdmin.createSubtitle')}</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setIsCreateOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="modal-form">
              <div className="modal-body">
                {formError && <div className="alert alert-danger">{formError}</div>}
                <div className="form-group">
                  <label className="form-label">{t('userAdmin.firstName')} *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={createForm.firstName}
                    onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('userAdmin.lastName')} *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={createForm.lastName}
                    onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('userAdmin.email')} *</label>
                  <input
                    type="email"
                    className="form-control"
                    required
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('userAdmin.phone')}</label>
                  <input
                    type="text"
                    className="form-control"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('userAdmin.role')} *</label>
                  <select
                    className="form-control"
                    required
                    value={createForm.roleId}
                    onChange={(e) => setCreateForm({ ...createForm, roleId: e.target.value })}
                  >
                    <option value="">{t('userAdmin.selectRole')}</option>
                    {rolesList.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('userAdmin.department')} *</label>
                  <select
                    className="form-control"
                    required
                    value={createForm.departmentId}
                    onChange={(e) => setCreateForm({ ...createForm, departmentId: e.target.value })}
                  >
                    <option value="">{t('userAdmin.selectDepartment')}</option>
                    {deptsList.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.type})
                      </option>
                    ))}
                  </select>
                </div>
                {rolesList.find((role) => role.id === createForm.roleId)?.name === 'AGENT' && (
                  <div className="form-group">
                    <label className="form-label">{t('userAdmin.agency')} *</label>
                    <select
                      className="form-control"
                      required
                      value={createForm.agencyId}
                      onChange={(e) => setCreateForm({ ...createForm, agencyId: e.target.value })}
                    >
                      <option value="">{t('userAdmin.selectAgency')}</option>
                      {agenciesList.map((agency) => (
                        <option key={agency.id} value={agency.id}>{agency.name} ({agency.code})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="button secondary" onClick={() => setIsCreateOpen(false)}>
                  {t('userAdmin.cancel')}
                </button>
                <button type="submit" className="button" disabled={createUserMutation.isPending}>
                  {createUserMutation.isPending ? t('userAdmin.creating') : t('userAdmin.create')}
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
                <h3 className="modal-title">{t('userAdmin.editTitle')}</h3>
                <p className="modal-subtitle">{t('userAdmin.editSubtitle')}</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setEditingUser(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="modal-form">
              <div className="modal-body">
                {formError && <div className="alert alert-danger">{formError}</div>}
                <div className="form-group">
                  <label className="form-label">{t('userAdmin.firstName')}</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('userAdmin.lastName')}</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('userAdmin.phone')}</label>
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
                  {t('userAdmin.cancel')}
                </button>
                <button type="submit" className="button" disabled={updateUserMutation.isPending}>
                  {updateUserMutation.isPending ? t('userAdmin.saving') : t('userAdmin.save')}
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
              <h3 className="modal-title">{t('userAdmin.details')}</h3>
              <button type="button" className="modal-close" onClick={() => setViewingUser(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p><strong>{t('userAdmin.id')}:</strong> {viewingUser.id}</p>
              <p><strong>{t('userAdmin.fullNameLabel')}:</strong> {viewingUser.firstName} {viewingUser.lastName}</p>
              <p><strong>{t('userAdmin.email')}:</strong> {viewingUser.email}</p>
              <p><strong>{t('userAdmin.phone')}:</strong> {viewingUser.phone || t('userAdmin.notProvided')}</p>
              <p><strong>{t('userAdmin.role')}:</strong> {viewingUser.role?.name || viewingUser.role}</p>
              <p><strong>{t('userAdmin.department')}:</strong> {viewingUser.department?.name || viewingUser.department?.type || t('userAdmin.global')}</p>
              <p><strong>{t('userAdmin.status')}:</strong> {t(`status.${String(viewingUser.status || '').toLowerCase()}`)}</p>
              <p><strong>{t('userAdmin.firstLogin')}:</strong> {viewingUser.firstLogin ? t('userAdmin.yes') : t('userAdmin.no')}</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="button secondary" onClick={() => setViewingUser(null)}>
                {t('userAdmin.close')}
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
              <h3 className="modal-title">{t('userAdmin.resetTitle')}</h3>
              <button type="button" className="modal-close" onClick={() => setPasswordResetUser(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                {t('userAdmin.resetConfirm')}{' '}
                <strong>{passwordResetUser.firstName} {passwordResetUser.lastName}</strong> ({passwordResetUser.email}) ?
              </p>

              {tempPassword && (
                <div className="alert alert-success" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <strong>{t('userAdmin.temporaryPassword')}</strong>
                  <code style={{ fontSize: '1.1rem', marginTop: '6px' }}>{tempPassword}</code>
                  <span style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                    {t('userAdmin.secureCommunication')}
                  </span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="button secondary" onClick={() => setPasswordResetUser(null)}>
                {t('userAdmin.close')}
              </button>
              {!tempPassword && (
                <button
                  type="button"
                  className="button danger"
                  disabled={resetPasswordMutation.isPending}
                  onClick={() => resetPasswordMutation.mutate(passwordResetUser.id)}
                >
                  {resetPasswordMutation.isPending ? t('userAdmin.resetting') : t('userAdmin.confirmReset')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {generatedPasswordUser && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">{t('userAdmin.createdTitle')}</h3>
              <button type="button" className="modal-close" onClick={() => setGeneratedPasswordUser(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                {t('userAdmin.createdDescription')} <strong>{generatedPasswordUser.name}</strong> ({generatedPasswordUser.email}) {t('userAdmin.createdVerb')}
              </p>
              <div className="alert alert-success" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <strong>{t('userAdmin.temporaryPasswordLabel')}</strong>
                <code style={{ fontSize: '1.1rem', marginTop: '6px' }}>{generatedPasswordUser.password || t('userAdmin.unavailable')}</code>
                <span style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                  {t('userAdmin.firstLoginHint')}
                </span>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="button" onClick={() => setGeneratedPasswordUser(null)}>
                {t('userAdmin.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
