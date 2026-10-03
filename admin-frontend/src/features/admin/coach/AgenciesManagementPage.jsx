import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  Plus,
  Eye,
  Edit2,
  Trash2,
  Power,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  UserCheck,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { api } from '../../../services/api'

const EMPTY_AGENCIES = []
import { useAuth } from '../../auth/authContext'
import { hasPermission } from '../../auth/permissions'
import { useLanguage } from '../../../i18n/useLanguage'
import {
  PageHeader,
  StatCard,
  Card,
  FilterBar,
  SearchBar,
  Button,
  StatusBadge,
  ActionMenu,
  Modal,
  ConfirmDialog,
  FormField,
  Input,
  Select,
  Textarea,
  LoadingState,
  ErrorState,
  EmptyState,
} from '../../../components/ui'

const toList = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.items)) return payload.data.items
  return []
}

const EMPTY_AGENCY_FORM = {
  name: '',
  code: '',
  city: 'Kinshasa',
  address: '',
  phone: '',
  email: '',
  managerName: '',
  openingHours: '06:00 - 20:00',
  isActive: true,
  departmentId: '',
}

export function AgenciesManagementPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL') // 'ALL' | 'ACTIVE' | 'INACTIVE'
  const [formState, setFormState] = useState(null) // null | { mode: 'create' | 'edit', values, id }
  const [serverError, setServerError] = useState('')
  const [deletingAgency, setDeletingAgency] = useState(null)

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const canManage = isSuperAdmin || user?.role === 'SERVICE_ADMIN' || hasPermission(user, 'MANAGE_AGENCY')

  // Fetch agencies
  const agenciesQuery = useQuery({
    queryKey: ['coach-agencies', search],
    queryFn: async () => {
      const params = { page: 1, limit: 100 }
      if (search.trim()) params.search = search.trim()
      const response = await api.get('/api/agencies', { params })
      return toList(response.data?.data || response.data)
    },
  })

  // Fetch departments list for SuperAdmin to attach coach department if needed
  const deptsQuery = useQuery({
    queryKey: ['admin-departments-coach'],
    queryFn: async () => {
      const response = await api.get('/api/departments')
      return toList(response.data?.data || response.data)
    },
    enabled: isSuperAdmin,
  })

  const agencies = agenciesQuery.data ?? EMPTY_AGENCIES
  const departments = deptsQuery.data || []
  const coachDept = departments.find((d) => d.type === 'VANGUARD_COACH' || d.name?.includes('Coach') || d.name?.includes('Transport'))

  const filteredAgencies = useMemo(() => {
    let list = [...agencies]
    if (statusFilter === 'ACTIVE') {
      list = list.filter((a) => a.isActive === true)
    } else if (statusFilter === 'INACTIVE') {
      list = list.filter((a) => a.isActive === false)
    }
    return list
  }, [agencies, statusFilter])

  const totalCount = agencies.length
  const activeCount = agencies.filter((a) => a.isActive === true).length
  const inactiveCount = agencies.filter((a) => a.isActive === false).length

  // Save Mutation (Create / Update)
  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (formState.mode === 'create') {
        const finalDeptId = payload.departmentId || coachDept?.id || user?.departmentId
        return api.post('/api/agencies', { ...payload, departmentId: finalDeptId })
      }
      return api.put(`/api/agencies/${formState.id}`, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-agencies'] })
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-overview'] })
      setFormState(null)
    },
    onError: (err) => {
      setServerError(err?.response?.data?.message || 'Erreur lors de l’enregistrement de l’agence.')
    },
  })

  // Toggle Active/Inactive Status Mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }) => {
      return api.put(`/api/agencies/${id}`, { isActive })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-agencies'] })
    },
    onError: (err) => {
      setServerError(err?.response?.data?.message || 'Impossible de modifier le statut de l’agence.')
    },
  })

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/api/agencies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-agencies'] })
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-overview'] })
      setDeletingAgency(null)
    },
    onError: (err) => {
      setServerError(err?.response?.data?.message || 'Impossible de supprimer cette agence.')
    },
  })

  const openCreateForm = () => {
    setServerError('')
    setFormState({
      mode: 'create',
      values: {
        ...EMPTY_AGENCY_FORM,
        departmentId: coachDept?.id || user?.departmentId || '',
      },
    })
  }

  const openEditForm = (agency) => {
    setServerError('')
    setFormState({
      mode: 'edit',
      id: agency.id,
      values: {
        name: agency.name || '',
        code: agency.code || '',
        city: agency.city || 'Kinshasa',
        address: agency.address || '',
        phone: agency.phone || '',
        email: agency.email || '',
        managerName: agency.managerName || '',
        openingHours: agency.openingHours || '06:00 - 20:00',
        isActive: agency.isActive !== undefined ? Boolean(agency.isActive) : true,
        departmentId: agency.departmentId || '',
      },
    })
  }

  const handleFormSubmit = (e) => {
    e.preventDefault()
    if (!formState.values.name || !formState.values.code) {
      setServerError('Le nom et le code de l’agence sont obligatoires.')
      return
    }
    saveMutation.mutate(formState.values)
  }

  return (
    <div className="page vanguard-agencies-page">
      <PageHeader
        eyebrow={t('agencyUi.eyebrow')}
        title={t('agencyUi.title')}
        subtitle={t('agencyUi.subtitle')}
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              loading={agenciesQuery.isFetching}
              onClick={() => agenciesQuery.refetch()}
            >
              {t('commonUi.refresh')}
            </Button>
            {canManage && (
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={openCreateForm}
              >
                {t('agencyUi.new')}
              </Button>
            )}
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="vanguard-stats-grid">
        <StatCard
          title={t('agencyUi.total')}
          value={totalCount}
          subtitle={t('agencyUi.networkSubtitle')}
          icon={Building2}
          accent="coach"
        />
        <StatCard
          title={t('agencyUi.active')}
          value={activeCount}
          subtitle={t('agencyUi.activeSubtitle')}
          icon={CheckCircle2}
          accent="revenue"
        />
        <StatCard
          title={t('agencyUi.inactive')}
          value={inactiveCount}
          subtitle={t('agencyUi.inactiveSubtitle')}
          icon={XCircle}
          accent="warning"
        />
      </div>

      <FilterBar onRefresh={() => agenciesQuery.refetch()} isRefreshing={agenciesQuery.isFetching}>
        <SearchBar
          value={search}
          onChange={(val) => setSearch(val)}
          placeholder={t('agencyUi.searchPlaceholder')}
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: 'auto', minWidth: '170px' }}
        >
          <option value="ALL">{t('agencyUi.allStatuses', { count: totalCount })}</option>
          <option value="ACTIVE">{t('agencyUi.activeCount', { count: activeCount })}</option>
          <option value="INACTIVE">{t('agencyUi.inactiveCount', { count: inactiveCount })}</option>
        </Select>
      </FilterBar>

      {serverError && (
        <div style={{
          backgroundColor: '#FEF2F2',
          border: '1px solid #FECACA',
          color: '#B91C1C',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
          fontSize: '0.84rem'
        }}>
          {serverError}
        </div>
      )}

      {agenciesQuery.isPending ? (
        <LoadingState message={t('agencyUi.loading')} />
      ) : agenciesQuery.isError ? (
        <ErrorState
          title={t('agencyUi.loadError')}
          message={agenciesQuery.error?.response?.data?.message || t('agencyUi.loadMessage')}
          onRetry={() => agenciesQuery.refetch()}
        />
      ) : filteredAgencies.length === 0 ? (
        <EmptyState
          title={t('agencyUi.emptyTitle')}
          description={t('agencyUi.emptyDescription')}
          icon={Building2}
          actionLabel={canManage ? t('agencyUi.create') : undefined}
          onAction={openCreateForm}
          actionIcon={Plus}
        />
      ) : (
        <Card>
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>{t('agencyUi.agencyCode')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>{t('agencyUi.cityAddress')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>{t('agencyUi.manager')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>{t('agencyUi.contact')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>{t('commonUi.status')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>{t('commonUi.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredAgencies.map((agency) => (
                  <tr
                    key={agency.id}
                    style={{ borderBottom: '1px solid #E2E8F0', cursor: 'pointer' }}
                    onClick={() => navigate(`/transport/agencies/${agency.id}`)}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '8px',
                          backgroundColor: '#EFF6FF',
                          color: '#2563EB',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Building2 size={18} />
                        </div>
                        <div>
                          <strong style={{ fontSize: '0.9rem', color: '#0F172A' }}>
                            {agency.name}
                          </strong>
                          <div style={{ fontSize: '0.78rem', color: '#64748B', fontFamily: 'monospace' }}>
                            {agency.code}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px', fontSize: '0.84rem', color: '#334155' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                        <MapPin size={13} color="#64748B" />
                        <span>{agency.city || 'Kinshasa'}</span>
                      </div>
                      {agency.address && (
                        <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>
                          {agency.address}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '12px 16px', fontSize: '0.84rem', color: '#334155' }}>
                      {agency.managerName ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <UserCheck size={13} color="#2563EB" />
                          <span>{agency.managerName}</span>
                        </div>
                      ) : (
                        <span style={{ color: '#94A3B8' }}>{t('agencyUi.unassigned')}</span>
                      )}
                    </td>

                    <td style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#64748B' }}>
                      {agency.phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Phone size={12} />
                          <span>{agency.phone}</span>
                        </div>
                      )}
                      {agency.email && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <Mail size={12} />
                          <span>{agency.email}</span>
                        </div>
                      )}
                      {!agency.phone && !agency.email && '—'}
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <StatusBadge
                        status={agency.isActive ? 'ACTIVE' : 'INACTIVE'}
                        variant={agency.isActive ? 'success' : 'neutral'}
                      />
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <ActionMenu
                        items={[
                          {
                            label: 'Consulter la fiche',
                            icon: Eye,
                            onClick: () => navigate(`/transport/agencies/${agency.id}`),
                          },
                          ...(canManage
                            ? [
                                {
                                  label: 'Modifier les informations',
                                  icon: Edit2,
                                  onClick: () => openEditForm(agency),
                                },
                                {
                                  label: agency.isActive ? t('agencyUi.deactivate') : t('agencyUi.activate'),
                                  icon: Power,
                                  onClick: () => toggleStatusMutation.mutate({ id: agency.id, isActive: !agency.isActive }),
                                },
                                { divider: true },
                                {
                                  label: 'Supprimer',
                                  icon: Trash2,
                                  variant: 'danger',
                                  onClick: () => setDeletingAgency(agency),
                                },
                              ]
                            : []),
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal Form for Create / Edit */}
      {formState && (
        <Modal
          isOpen={Boolean(formState)}
          onClose={() => setFormState(null)}
          title={formState.mode === 'create' ? t('agencyUi.newCoach') : t('agencyUi.editTitle')}
          subtitle={t('agencyUi.formSubtitle')}
          size="lg"
        >
          <form onSubmit={handleFormSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <FormField label={t('agencyUi.name')} required>
                <Input
                  value={formState.values.name}
                  onChange={(e) => setFormState({ ...formState, values: { ...formState.values, name: e.target.value } })}
                  placeholder={t('agencyUi.nameExample')}
                  required
                />
              </FormField>

              <FormField label={t('agencyUi.code')} helper={t('agencyUi.codeHelper')} required>
                <Input
                  value={formState.values.code}
                  onChange={(e) => setFormState({ ...formState, values: { ...formState.values, code: e.target.value.toUpperCase() } })}
                  placeholder={t('agencyUi.codeExample')}
                  disabled={formState.mode === 'edit'}
                  required
                />
              </FormField>

              <FormField label={t('agencyUi.city')} required>
                <Input
                  value={formState.values.city}
                  onChange={(e) => setFormState({ ...formState, values: { ...formState.values, city: e.target.value } })}
                  placeholder={t('agencyUi.cityExample')}
                  required
                />
              </FormField>

              <FormField label={t('agencyUi.manager')}>
                <Input
                  value={formState.values.managerName}
                  onChange={(e) => setFormState({ ...formState, values: { ...formState.values, managerName: e.target.value } })}
                  placeholder={t('agencyUi.managerExample')}
                />
              </FormField>

              <FormField label={t('agencyUi.phone')}>
                <Input
                  value={formState.values.phone}
                  onChange={(e) => setFormState({ ...formState, values: { ...formState.values, phone: e.target.value } })}
                  placeholder={t('agencyUi.phoneExample')}
                />
              </FormField>

              <FormField label={t('agencyUi.email')}>
                <Input
                  type="email"
                  value={formState.values.email}
                  onChange={(e) => setFormState({ ...formState, values: { ...formState.values, email: e.target.value } })}
                  placeholder={t('agencyUi.emailExample')}
                />
              </FormField>

              <FormField label={t('agencyUi.openingHours')}>
                <Input
                  value={formState.values.openingHours}
                  onChange={(e) => setFormState({ ...formState, values: { ...formState.values, openingHours: e.target.value } })}
                  placeholder="Ex: 06:00 - 20:00"
                />
              </FormField>

              <FormField label={t('agencyUi.initialStatus')}>
                <Select
                  value={formState.values.isActive ? 'ACTIVE' : 'INACTIVE'}
                  onChange={(e) => setFormState({ ...formState, values: { ...formState.values, isActive: e.target.value === 'ACTIVE' } })}
                >
                  <option value="ACTIVE">{t('agencyUi.openStatus')}</option>
                  <option value="INACTIVE">{t('agencyUi.closedStatus')}</option>
                </Select>
              </FormField>

              <div style={{ gridColumn: 'span 2' }}>
                <FormField label={t('agencyUi.address')}>
                  <Textarea
                    rows={2}
                    value={formState.values.address}
                    onChange={(e) => setFormState({ ...formState, values: { ...formState.values, address: e.target.value } })}
                    placeholder={t('agencyUi.addressExample')}
                  />
                </FormField>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #E2E8F0' }}>
              <Button variant="secondary" onClick={() => setFormState(null)} disabled={saveMutation.isPending}>
                Annuler
              </Button>
              <Button type="submit" variant="primary" loading={saveMutation.isPending}>
                {formState.mode === 'create' ? t('agencyUi.create') : t('agencyUi.save')}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {deletingAgency && (
        <ConfirmDialog
          isOpen={Boolean(deletingAgency)}
          onClose={() => setDeletingAgency(null)}
          onConfirm={() => deleteMutation.mutate(deletingAgency.id)}
          title={t('agencyUi.confirmDelete')}
          message={t('agencyUi.deletePrompt', { name: deletingAgency.name, code: deletingAgency.code })}
          confirmText={t('agencyUi.deletePermanently')}
          loading={deleteMutation.isPending}
          variant="danger"
        />
      )}
    </div>
  )
}
