import React, { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  HardHat,
  Plus,
  Eye,
  Edit2,
  Trash2,
  RefreshCw,
  Layers,
  MapPin,
  Calendar,
  Building2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../services/api'
import { useAuth } from '../auth/authContext'
import { hasPermission } from '../auth/permissions'
import { useLanguage } from '../../i18n/useLanguage'
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

const PROJECT_STATUS_OPTIONS = ['DRAFT', 'PUBLISHED', 'ARCHIVED']

const toList = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.items)) return payload.data.items
  return []
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
  const [deletingProject, setDeletingProject] = useState(null)

  const canView = hasPermission(user, 'VIEW_PROJECT') || user?.role === 'SUPER_ADMIN'
  const canCreate = hasPermission(user, 'CREATE_PROJECT') || user?.role === 'SUPER_ADMIN'
  const canUpdate = hasPermission(user, 'UPDATE_PROJECT') || user?.role === 'SUPER_ADMIN'
  const canDelete = hasPermission(user, 'DELETE_PROJECT') || user?.role === 'SUPER_ADMIN'

  const projectsQuery = useQuery({
    queryKey: ['construction-projects', search, statusFilter],
    queryFn: async () => {
      const params = { page: 1, limit: 100 }
      if (search.trim()) params.search = search.trim()
      if (statusFilter !== 'ALL') params.status = statusFilter
      const response = await api.get('/api/construction/projects', { params })
      return toList(response.data?.data || response.data)
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

  const projects = useMemo(() => projectsQuery.data || [], [projectsQuery.data])

  const filteredProjects = useMemo(() => {
    if (!search.trim() && statusFilter === 'ALL') return projects
    const query = search.trim().toLowerCase()
    return projects.filter((project) => {
      const matchesSearch =
        !query ||
        [project.title, project.location, project.description].some((val) =>
          String(val || '').toLowerCase().includes(query)
        )
      const matchesStatus = statusFilter === 'ALL' || project.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [projects, search, statusFilter])

  if (!canView) {
    return (
      <div className="page vanguard-projects-page">
        <EmptyState
          title="Accès non autorisé"
          description="Vous ne possédez pas les permissions nécessaires pour consulter la liste des projets de construction."
        />
      </div>
    )
  }

  return (
    <div className="page vanguard-projects-page">
      <PageHeader
        eyebrow="VANGUARD SERVICES · CONSTRUCTION"
        title="Projets & Chantiers"
        subtitle="Suivi de l’ensemble des projets de construction, rénovation et aménagements."
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button
              variant="outline"
              size="sm"
              icon={Layers}
              onClick={() => navigate('/construction/templates')}
            >
              Templates
            </Button>
            {canCreate && (
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => navigate('/construction/projects/new')}
              >
                Nouveau projet
              </Button>
            )}
          </div>
        }
      />

      <FilterBar onRefresh={() => projectsQuery.refetch()} isRefreshing={projectsQuery.isFetching}>
        <SearchBar
          value={search}
          onChange={(val) => setSearch(val)}
          placeholder="Rechercher par titre, localisation..."
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: 'auto', minWidth: '160px' }}
        >
          <option value="ALL">Tous les statuts</option>
          <option value="DRAFT">Brouillon</option>
          <option value="PUBLISHED">Publié</option>
          <option value="ARCHIVED">Archivé</option>
        </Select>
      </FilterBar>

      {projectsQuery.isPending ? (
        <LoadingState message="Chargement des projets de construction..." />
      ) : projectsQuery.isError ? (
        <ErrorState
          title="Erreur de chargement des projets"
          message={projectsQuery.error?.response?.data?.message || 'Impossible de récupérer la liste des projets.'}
          onRetry={() => projectsQuery.refetch()}
        />
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          title="Aucun projet trouvé"
          description="Aucun chantier ou projet ne correspond à vos critères de recherche."
          icon={HardHat}
          actionLabel={canCreate ? "Créer un projet" : undefined}
          onAction={() => navigate('/construction/projects/new')}
          actionIcon={Plus}
        />
      ) : (
        <Card>
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Projet</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Localisation</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Statut</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Budget</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Date de création</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project) => (
                  <tr
                    key={project.id}
                    style={{ borderBottom: '1px solid #E2E8F0', cursor: 'pointer' }}
                    onClick={() => navigate(`/construction/projects/${project.id}`)}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          backgroundColor: '#FFF7ED',
                          color: '#EA580C',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <HardHat size={18} />
                        </div>
                        <div>
                          <strong style={{ fontSize: '0.9rem', color: '#0F172A' }}>
                            {project.title || 'Projet sans titre'}
                          </strong>
                          {project.isTemplate && (
                            <span style={{ marginLeft: '6px', fontSize: '0.7rem', backgroundColor: '#EFF6FF', color: '#2563EB', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                              Template
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

                    <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '0.9rem', color: '#0F172A' }}>
                      {formatMoney(project.budget, lang)}
                    </td>

                    <td style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#64748B' }}>
                      {formatDate(project.createdAt, lang)}
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <ActionMenu
                        items={[
                          {
                            label: 'Consulter le projet',
                            icon: Eye,
                            onClick: () => navigate(`/construction/projects/${project.id}`),
                          },
                          ...(canUpdate
                            ? [
                                {
                                  label: 'Modifier',
                                  icon: Edit2,
                                  onClick: () => navigate(`/construction/projects/${project.id}/edit`),
                                },
                              ]
                            : []),
                          ...(canDelete
                            ? [
                                { divider: true },
                                {
                                  label: 'Supprimer',
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

      {/* Delete Confirmation Dialog */}
      {deletingProject && (
        <ConfirmDialog
          isOpen={Boolean(deletingProject)}
          onClose={() => setDeletingProject(null)}
          onConfirm={() => deleteMutation.mutate(deletingProject.id)}
          title="Supprimer ce projet ?"
          message={`Êtes-vous sûr de vouloir supprimer définitivement le projet "${deletingProject.title}" ?`}
          confirmText="Supprimer"
          loading={deleteMutation.isPending}
          variant="danger"
        />
      )}
    </div>
  )
}
