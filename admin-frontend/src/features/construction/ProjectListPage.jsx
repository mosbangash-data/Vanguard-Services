import React, { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  HardHat,
  Plus,
  Eye,
  Edit2,
  Trash2,
  Layers,
  MapPin,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../services/api'
import { useAuth } from '../auth/authContext'
import { hasPermission } from '../auth/permissions'
import { useLanguage } from '../../i18n/useLanguage'
import { MediaThumbnail } from '../../components/media'
import {
  PageHeader,
  Card,
  FilterBar,
  SearchBar,
  Button,
  StatusBadge,
  ActionMenu,
  ConfirmDialog,
  Select,
  LoadingState,
  ErrorState,
  EmptyState,
} from '../../components/ui'


const toPage = (payload) => {
  const data = payload?.data || payload || {}
  return { items: Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : [], pagination: data.pagination || data }
}

const formatMoney = (value, locale = 'fr') => {
  const numeric = Number(value || 0)
  if (!Number.isFinite(numeric)) return '—'
  return `$ ${new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'fr-FR', {
    maximumFractionDigits: 2,
  }).format(numeric)}`
}

const formatDate = (value, locale = 'fr') => {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR')
  } catch {
    return '—'
  }
}

export function ProjectListPage() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [publicationFilter, setPublicationFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [deletingProject, setDeletingProject] = useState(null)

  const canView = hasPermission(user, 'VIEW_PROJECT') || user?.role === 'SUPER_ADMIN'
  const canCreate = hasPermission(user, 'CREATE_PROJECT') || user?.role === 'SUPER_ADMIN'
  const canUpdate = hasPermission(user, 'UPDATE_PROJECT') || user?.role === 'SUPER_ADMIN'
  const canDelete = hasPermission(user, 'DELETE_PROJECT') || user?.role === 'SUPER_ADMIN'

  const projectsQuery = useQuery({
    queryKey: ['construction-projects', search, statusFilter, publicationFilter, page],
    queryFn: async () => {
      const params = { page, limit: 20 }
      if (search.trim()) params.search = search.trim()
      if (statusFilter !== 'ALL') params.status = statusFilter
      if (publicationFilter !== 'ALL') params.publicationStatus = publicationFilter
      const response = await api.get('/api/construction/projects', { params })
      return toPage(response.data)
    },
    enabled: canView,
  })

  const deleteMutation = useMutation({
    mutationFn: async (projectId) => api.delete(`/api/construction/projects/${projectId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['construction-projects'] })
      queryClient.invalidateQueries({ queryKey: ['construction-dashboard-overview'] })
      setDeletingProject(null)
    },
  })

  const projects = useMemo(() => projectsQuery.data?.items || [], [projectsQuery.data])
  const pagination = projectsQuery.data?.pagination || {}
  const totalPages = Number(pagination.totalPages || pagination.pages || Math.ceil(Number(pagination.total || 0) / Number(pagination.limit || 20)) || 1)

  if (!canView) {
    return (
      <div className="page vanguard-projects-page">
        <EmptyState
          title={t('construction.projects.accessDenied')}
          description={t('construction.projects.accessDenied')}
        />
      </div>
    )
  }

  return (
    <div className="page vanguard-projects-page">
      <PageHeader
        eyebrow={t('construction.title')}
        title={t('construction.projects.title')}
        subtitle={t('construction.projects.subtitle')}
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button
              variant="outline"
              size="sm"
              icon={Layers}
              onClick={() => navigate('/construction/templates')}
            >
              {t('construction.projectTemplates')}
            </Button>
            {canCreate && (
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => navigate('/construction/projects/new')}
              >
                {t('construction.projects.new')}
              </Button>
            )}
          </div>
        }
      />

      <FilterBar onRefresh={() => projectsQuery.refetch()} isRefreshing={projectsQuery.isFetching}>
        <SearchBar
          value={search}
          onChange={(val) => { setSearch(val); setPage(1) }}
          placeholder={t('construction.projects.searchProjects')}
        />
        <Select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          style={{ width: 'auto', minWidth: '160px' }}
        >
          <option value="ALL">{t('construction.projects.allStatuses')}</option>
          {['DRAFT', 'PUBLISHED', 'ARCHIVED'].map((status) => <option key={status} value={status}>{t(`construction.projects.statuses.${status}`)}</option>)}
        </Select>
        <Select value={publicationFilter} onChange={(e) => { setPublicationFilter(e.target.value); setPage(1) }} style={{ width: 'auto', minWidth: '160px' }}>
          <option value="ALL">{t('construction.projects.filterPublication')}</option>
          {['DRAFT', 'PUBLISHED', 'ARCHIVED'].map((status) => <option key={status} value={status}>{t(`construction.projects.publicationStatuses.${status}`)}</option>)}
        </Select>
      </FilterBar>

      {projectsQuery.isPending ? (
        <LoadingState message={t('construction.projects.loading')} />
      ) : projectsQuery.isError ? (
        <ErrorState
          title={t('construction.projects.loadError')}
          message={t('commonUi.errorMessage')}
          onRetry={() => projectsQuery.refetch()}
        />
      ) : projects.length === 0 ? (
        <EmptyState
          title={t('construction.projects.empty')}
          description={t('construction.projects.noProjectsMatch')}
          icon={HardHat}
          actionLabel={canCreate ? t('construction.projects.new') : undefined}
          onAction={() => navigate('/construction/projects/new')}
          actionIcon={Plus}
        />
      ) : (
        <Card>
          <div className="table-responsive">
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>{t('construction.projects.name')}</th><th>{t('construction.projects.location')}</th><th>{t('construction.projects.status')}</th><th>{t('construction.projects.publicationStatus')}</th><th>{t('construction.projects.budget')}</th><th>{t('construction.projects.modifiedAt')}</th><th style={{ textAlign: 'right' }}>{t('construction.projects.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr
                    key={project.id}
                    style={{ borderBottom: '1px solid #E2E8F0', cursor: 'pointer' }}
                    onClick={() => navigate(`/construction/projects/${project.id}`)}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <MediaThumbnail
                          media={project.gallery}
                          alt={project.title || ''}
                          size={36}
                          rounded={8}
                          fallbackIcon={HardHat}
                        />
                        <div>
                          <strong style={{ fontSize: '0.9rem', color: '#0F172A' }}>
                            {project.title || t('construction.projects.projectWithoutTitle')}
                          </strong>
                          {project.isTemplate && (
                            <span style={{ marginLeft: '6px', fontSize: '0.7rem', backgroundColor: '#EFF6FF', color: '#2563EB', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                              {t('construction.projects.template')}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px', fontSize: '0.84rem', color: '#475569' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={13} color="#64748B" />
                        <span>{project.location || '—'}</span>
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <StatusBadge status={project.status} />
                    </td>
                    <td style={{ padding: '12px 16px' }}><StatusBadge status={project.publicationStatus} /></td>

                    <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '0.9rem', color: '#0F172A' }}>
                      {formatMoney(project.budget, lang)}
                    </td>

                    <td style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#64748B' }}>
                      {formatDate(project.updatedAt, lang)}
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <ActionMenu
                        items={[
                          {
                            label: t('construction.projects.view'),
                            icon: Eye,
                            onClick: () => navigate(`/construction/projects/${project.id}`),
                          },
                          ...(canUpdate
                            ? [
                                {
                                  label: t('construction.projects.edit'),
                                  icon: Edit2,
                                  onClick: () => navigate(`/construction/projects/${project.id}/edit`),
                                },
                              ]
                            : []),
                          ...(canDelete
                            ? [
                                { divider: true },
                                {
                                  label: t('construction.projects.delete'),
                                  icon: Trash2,
                                  variant: 'danger',
                                  onClick: () => setDeletingProject(project),
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

      {!projectsQuery.isPending && !projectsQuery.isError && totalPages > 1 && <nav className="pagination" aria-label={t('construction.projects.paginationLabel')}>
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>{t('construction.projects.previousPage')}</Button>
        <span>{t('construction.projects.pageOf', { page, pages: totalPages })}</span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>{t('construction.projects.nextPage')}</Button>
      </nav>}

      {/* Delete Confirmation Dialog */}
      {deletingProject && (
        <ConfirmDialog
          isOpen={Boolean(deletingProject)}
          onClose={() => setDeletingProject(null)}
          onConfirm={() => deleteMutation.mutate(deletingProject.id)}
          title={t('construction.projects.deleteConfirmTitle')}
          message={t('construction.projects.deleteConfirmMessage', { title: deletingProject.title })}
          confirmText={t('construction.projects.delete')}
          loading={deleteMutation.isPending}
          variant="danger"
        />
      )}
    </div>
  )
}
