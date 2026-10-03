import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../services/api'
import { useLanguage } from '../../../i18n/useLanguage'
import {
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  Key,
  X,
  AlertTriangle,
} from 'lucide-react'

const getRoleDescription = (roleName, t) => {
  const value = t(`roleUi.roleDescriptions.${roleName}`)
  return value.startsWith('roleUi.') ? '' : value
}

const getPermissionDescription = (permissionName, t) => {
  const value = t(`roleUi.permissionDescriptions.${permissionName}`)
  return value.startsWith('roleUi.') ? '' : value
}

// Regroupement visuel des permissions par module (aucun impact sur la logique)
const PERMISSION_GROUP_ORDER = [
  'GLOBAL / ADMINISTRATION',
  'TRANSPORT',
  'CONSTRUCTION',
  'AUTOMOBILE',
  'UTILISATEURS',
  'RÔLES & PERMISSIONS',
]

const PERMISSION_GROUPS = {
  'GLOBAL / ADMINISTRATION': [
    'CREATE_CUSTOMER_REQUEST',
    'VIEW_CUSTOMER_REQUEST',
    'UPDATE_CUSTOMER_REQUEST',
    'CREATE_DEPARTMENT',
    'VIEW_DEPARTMENT',
    'UPDATE_DEPARTMENT',
    'DELETE_DEPARTMENT',
  ],
  'TRANSPORT': [
    'CREATE_RESERVATION',
    'VIEW_RESERVATION',
    'UPDATE_RESERVATION',
    'MANAGE_RESERVATION_PAYMENT',
  ],
  'CONSTRUCTION': [
    'CREATE_PROJECT',
    'VIEW_PROJECT',
    'UPDATE_PROJECT',
    'DELETE_PROJECT',
    'CREATE_QUOTE_REQUEST',
    'VIEW_QUOTE_REQUEST',
    'UPDATE_QUOTE_REQUEST',
  ],
  'AUTOMOBILE': [
    'CREATE_VEHICLE',
    'VIEW_VEHICLE',
    'UPDATE_VEHICLE',
    'DELETE_VEHICLE',
    'MANAGE_VEHICLE_MEDIA',
    'CREATE_VEHICLE_INQUIRY',
    'VIEW_VEHICLE_INQUIRY',
    'UPDATE_VEHICLE_INQUIRY',
    'ASSIGN_VEHICLE_INQUIRY',
    'CLOSE_VEHICLE_INQUIRY',
    'MANAGE_VEHICLE_INQUIRY',
    'MANAGE_VEHICLE_RESERVATION',
    'CANCEL_VEHICLE_RESERVATION',
  ],
  'UTILISATEURS': [
    'CREATE_USER',
    'VIEW_USER',
    'UPDATE_USER',
    'DELETE_USER',
    'MANAGE_USERS',
  ],
  'RÔLES & PERMISSIONS': [
    'CREATE_ROLE',
    'VIEW_ROLE',
    'UPDATE_ROLE',
    'DELETE_ROLE',
    'CREATE_PERMISSION',
    'VIEW_PERMISSION',
    'UPDATE_PERMISSION',
    'DELETE_PERMISSION',
  ],
}

const PERMISSION_GROUP_KEYS = {
  'GLOBAL / ADMINISTRATION': 'global', TRANSPORT: 'transport', CONSTRUCTION: 'construction',
  AUTOMOBILE: 'automotive', UTILISATEURS: 'users', 'RÔLES & PERMISSIONS': 'rolesPermissions',
}

const getPermissionGroup = (permissionName) => {
  for (const [group, perms] of Object.entries(PERMISSION_GROUPS)) {
    if (perms.includes(permissionName)) return group
  }
  return null
}

// Regroupe les permissions visuellement mais conserve les structures existantes
const groupPermissions = (permissions) => {
  const groups = new Map()
  for (const group of PERMISSION_GROUP_ORDER) {
    groups.set(group, [])
  }
  const ungrouped = []

  permissions.forEach((p) => {
    const group = getPermissionGroup(p.name)
    if (group && groups.has(group)) {
      groups.get(group).push(p)
    } else {
      ungrouped.push(p)
    }
  })

  return { grouped: [...groups.entries()].filter(([, perms]) => perms.length > 0), ungrouped }
}

async function fetchRoles({ page, limit, search }) {
  const params = { page, limit }
  if (search) params.search = search
  const response = await api.get('/api/roles', { params })
  return response.data?.data || { items: [], total: 0, page: 1, limit: 20 }
}

async function fetchRolePermissions(roleId) {
  const response = await api.get(`/api/roles/${roleId}/permissions`)
  return response.data?.data || response.data || []
}

async function fetchAllPermissions() {
  const response = await api.get('/api/roles/permissions?limit=100')
  return response.data?.data?.items || response.data?.data || []
}

export function RolesPage() {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingRole, setEditingRole] = useState(null)
  const [deletingRole, setDeletingRole] = useState(null)
  const [managingPermissionsRole, setManagingPermissionsRole] = useState(null)

  // Forms
  const [createForm, setCreateForm] = useState({ name: 'AGENT', description: '' })
  const [editForm, setEditForm] = useState({ name: '', description: '' })
  const [formError, setFormError] = useState('')

  // Permission selection state
  const [selectedPermissionIds, setSelectedPermissionIds] = useState([])

  const rolesQuery = useQuery({
    queryKey: ['admin-roles', { page, search }],
    queryFn: () => fetchRoles({ page, limit: 15, search }),
  })

  const rolePermissionsQuery = useQuery({
    queryKey: ['admin-role-permissions', managingPermissionsRole?.id],
    queryFn: () => fetchRolePermissions(managingPermissionsRole.id),
    enabled: Boolean(managingPermissionsRole?.id),
  })

  const allPermissionsQuery = useQuery({
    queryKey: ['admin-all-permissions'],
    queryFn: fetchAllPermissions,
  })

  // Mutations
  const createRoleMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post('/api/roles', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
      setIsCreateOpen(false)
      setCreateForm({ name: 'AGENT', description: '' })
      setFormError('')
    },
    onError: (err) => {
      setFormError(err?.response?.data?.message || t('roleUi.createFailed'))
    },
  })

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await api.put(`/api/roles/${id}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
      setEditingRole(null)
      setFormError('')
    },
    onError: (err) => {
      setFormError(err?.response?.data?.message || t('roleUi.updateFailed'))
    },
  })

  const deleteRoleMutation = useMutation({
    mutationFn: async (id) => {
      const response = await api.delete(`/api/roles/${id}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
      setDeletingRole(null)
    },
    onError: (err) => {
      alert(err?.response?.data?.message || t('roleUi.deleteFailed'))
    },
  })

  const updateRolePermissionsMutation = useMutation({
    mutationFn: async ({ id, permissionIds }) => {
      const response = await api.put(`/api/roles/${id}/permissions`, { permissionIds })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
      queryClient.invalidateQueries({ queryKey: ['admin-role-permissions'] })
      setManagingPermissionsRole(null)
      setSelectedPermissionIds([])
    },
    onError: (err) => {
      alert(err?.response?.data?.message || t('roleUi.permissionsFailed'))
    },
  })

  const rolesList = rolesQuery.data?.items || []
  const totalRoles = rolesQuery.data?.total || 0
  const totalPages = Math.ceil(totalRoles / 15) || 1
  const allPermissionsList = allPermissionsQuery.data || []

  const { grouped: groupedPermissions, ungrouped } = groupPermissions(allPermissionsList)

  const handleCreateSubmit = (e) => {
    e.preventDefault()
    setFormError('')
    createRoleMutation.mutate(createForm)
  }

  const handleEditSubmit = (e) => {
    e.preventDefault()
    setFormError('')
    updateRoleMutation.mutate({ id: editingRole.id, data: editForm })
  }

  const startEdit = (role) => {
    setEditingRole(role)
    setEditForm({ name: role.name || '', description: role.description || '' })
    setFormError('')
  }

  const startManagePermissions = (role) => {
    setManagingPermissionsRole(role)
    setSelectedPermissionIds([])
  }

  // Initialize selected permissions from the role's existing permissions once loaded
  useEffect(() => {
    if (managingPermissionsRole && rolePermissionsQuery.data) {
      const ids = rolePermissionsQuery.data
        .map((p) => p.id || p.permission?.id)
        .filter(Boolean)
      setSelectedPermissionIds(ids)
    }
  }, [managingPermissionsRole, rolePermissionsQuery.data])

  const handlePermissionToggle = (permissionId) => {
    setSelectedPermissionIds((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId]
    )
  }

  const handleSelectAllPermissions = () => {
    if (selectedPermissionIds.length === allPermissionsList.length) {
      setSelectedPermissionIds([])
    } else {
      setSelectedPermissionIds(allPermissionsList.map((p) => p.id))
    }
  }

  const handleSavePermissions = () => {
    if (!managingPermissionsRole) return
    updateRolePermissionsMutation.mutate({
      id: managingPermissionsRole.id,
      permissionIds: selectedPermissionIds,
    })
  }

  const renderPermissionItem = (p) => {
    const isChecked = selectedPermissionIds.includes(p.id)
    return (
      <label key={p.id} className="permission-check">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => handlePermissionToggle(p.id)}
        />
        <span className="permission-check-label">
          <strong>{p.name}</strong>
          {getPermissionDescription(p.name, t) ? (
            <small>{getPermissionDescription(p.name, t)}</small>
          ) : null}
        </span>
      </label>
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{t('roleUi.title')}</h1>
          <p>{t('roleUi.subtitle')}</p>
        </div>
        <button type="button" className="button" onClick={() => { setIsCreateOpen(true); setFormError('') }}>
          <Plus size={16} />
          <span>{t('roleUi.newRole')}</span>
        </button>
      </div>

      <div className="toolbar">
        <div className="toolbar-filters">
          <div className="search-input-wrap">
            <Search />
            <input
              type="text"
              className="search-input"
              placeholder={t('roleUi.searchPlaceholder')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
        </div>
        <button type="button" className="button secondary sm" onClick={() => rolesQuery.refetch()}>
          <RefreshCw size={14} />
          <span>{t('commonUi.refresh')}</span>
        </button>
      </div>

      <div className="table-container">
        {rolesQuery.isPending ? (
          <div className="state-container">{t('roleUi.loading')}</div>
        ) : rolesQuery.isError ? (
          <div className="state-container">
            <AlertTriangle size={32} />
            <p>{t('roleUi.loadError')}</p>
            <button type="button" className="button secondary sm" onClick={() => rolesQuery.refetch()}>
              {t('commonUi.retry')}
            </button>
          </div>
        ) : rolesList.length === 0 ? (
          <div className="state-container">{t('roleUi.empty')}</div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('roleUi.roleName')}</th>
                    <th>{t('roleUi.description')}</th>
                    <th>{t('roleUi.permissions')}</th>
                    <th style={{ textAlign: 'right' }}>{t('roleUi.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rolesList.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div className="role-cell">
                          <strong className="role-code">{r.name}</strong>
                          <span className="role-description">{getRoleDescription(r.name, t)}</span>
                        </div>
                      </td>
                      <td>{r.description || t('roleUi.noDescription')}</td>
                      <td>
                        <span className="badge info">
                          {t('roleUi.permissionCount', { count: Array.isArray(r.permissions) ? r.permissions.length : 0 })}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="action-btn"
                            title={t('roleUi.managePermissions')}
                            onClick={() => startManagePermissions(r)}
                          >
                            <Key size={14} />
                            <span>{t('roleUi.permissions')}</span>
                          </button>
                          <button
                            type="button"
                            className="action-btn"
                            title={t('roleUi.edit')}
                            onClick={() => startEdit(r)}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            className="action-btn danger"
                            title={t('roleUi.delete')}
                            onClick={() => setDeletingRole(r)}
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
                {t('roleUi.pageSummary', { page, totalPages, total: totalRoles })}
              </span>
              <div className="pagination-controls">
                <button
                  type="button"
                  className="button secondary sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t('commonUi.previous')}
                </button>
                <button
                  type="button"
                  className="button secondary sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
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
              <div className="modal-header-text">
                <h3 className="modal-title">{t('roleUi.createTitle')}</h3>
                <p className="modal-subtitle">{t('roleUi.createSubtitle')}</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setIsCreateOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="modal-form">
              <div className="modal-body">
                {formError && <div className="alert alert-danger">{formError}</div>}
                <div className="form-group">
                  <label className="form-label">{t('roleUi.roleName')} *</label>
                  <select
                    className="form-control"
                    required
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  >
                    <option value="AGENT">AGENT</option>
                    <option value="MANAGER">MANAGER</option>
                    <option value="SERVICE_ADMIN">SERVICE_ADMIN</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('roleUi.description')}</label>
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
                <button type="submit" className="button" disabled={createRoleMutation.isPending}>
                  {createRoleMutation.isPending ? t('roleUi.creating') : t('roleUi.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit */}
      {editingRole && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <div className="modal-header-text">
                <h3 className="modal-title">{t('roleUi.editTitle')}</h3>
                <p className="modal-subtitle">{t('roleUi.editSubtitle')}</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setEditingRole(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="modal-form">
              <div className="modal-body">
                {formError && <div className="alert alert-danger">{formError}</div>}
                <div className="form-group">
                  <label className="form-label">{t('roleUi.roleName')}</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('roleUi.description')}</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="button secondary" onClick={() => setEditingRole(null)}>
                  {t('commonUi.cancel')}
                </button>
                <button type="submit" className="button" disabled={updateRoleMutation.isPending}>
                  {updateRoleMutation.isPending ? t('roleUi.saving') : t('roleUi.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Manage Permissions */}
      {managingPermissionsRole && (
        <div className="modal-backdrop">
          <div className="modal-dialog modal-dialog-lg">
            <div className="modal-header">
              <div className="modal-header-text">
                <h3 className="modal-title">{t('roleUi.permissionsTitle', { role: managingPermissionsRole.name })}</h3>
                <p className="modal-subtitle">{t('roleUi.permissionsSubtitle')}</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setManagingPermissionsRole(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {allPermissionsQuery.isPending ? (
                <p>{t('roleUi.permissionsLoading')}</p>
              ) : allPermissionsQuery.isError ? (
                <p className="form-error">{t('roleUi.permissionsLoadError')}</p>
              ) : (
                <>
                  <div className="permissions-toolbar">
                    <button
                      type="button"
                      className="button secondary sm"
                      onClick={handleSelectAllPermissions}
                    >
                      {selectedPermissionIds.length === allPermissionsList.length
                        ? t('roleUi.deselectAll')
                        : t('roleUi.selectAll')}
                    </button>
                    <span className="permissions-count">
                      {t('roleUi.selectedCount', { selected: selectedPermissionIds.length, total: allPermissionsList.length })}
                    </span>
                  </div>

                  {groupedPermissions.map(([groupName, perms]) => (
                    <div key={groupName} className="permission-group">
                      <h4 className="permission-group-title">
                        {t(`roleUi.groups.${PERMISSION_GROUP_KEYS[groupName]}`)}
                        <span className="permission-group-count">
                          {perms.filter((p) => selectedPermissionIds.includes(p.id)).length}/{perms.length}
                        </span>
                      </h4>
                      <div className="permissions-grid">
                        {perms.map((p) => renderPermissionItem(p))}
                      </div>
                    </div>
                  ))}

                  {ungrouped.length > 0 && (
                    <div className="permission-group">
                      <h4 className="permission-group-title">
                        {t('roleUi.otherPermissions')}
                        <span className="permission-group-count">
                          {ungrouped.filter((p) => selectedPermissionIds.includes(p.id)).length}/{ungrouped.length}
                        </span>
                      </h4>
                      <div className="permissions-grid">
                        {ungrouped.map((p) => renderPermissionItem(p))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="button secondary" onClick={() => setManagingPermissionsRole(null)}>
                {t('commonUi.cancel')}
              </button>
              <button
                type="button"
                className="button"
                disabled={updateRolePermissionsMutation.isPending}
                onClick={handleSavePermissions}
              >
                {updateRolePermissionsMutation.isPending ? t('roleUi.saving') : t('roleUi.savePermissions')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Delete Confirmation */}
      {deletingRole && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">{t('roleUi.confirmDelete')}</h3>
              <button type="button" className="modal-close" onClick={() => setDeletingRole(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                {t('roleUi.deletePrompt', { role: deletingRole.name })}
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-medium-gray)' }}>
                {t('roleUi.deleteWarning')}
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="button secondary" onClick={() => setDeletingRole(null)}>
                {t('commonUi.cancel')}
              </button>
              <button
                type="button"
                className="button danger"
                disabled={deleteRoleMutation.isPending}
                onClick={() => deleteRoleMutation.mutate(deletingRole.id)}
              >
                {deleteRoleMutation.isPending ? t('roleUi.deleting') : t('roleUi.deletePermanently')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
