import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  HelpCircle,
  ImageIcon,
  Info,
  Pencil,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../services/api'
import { useAuth } from '../auth/authContext'
import { hasPermission } from '../auth/permissions'
import { useLanguage } from '../../i18n/useLanguage'

const toList = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.projectUpdates)) return payload.projectUpdates
  if (Array.isArray(payload?.gallery)) return payload.gallery
  return []
}

const money = (value, locale = 'fr') => {
  const numeric = Number(value || 0)
  if (!Number.isFinite(numeric) || value === null || value === undefined) return '—'
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'fr-FR', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(numeric)
}

const formatDate = (value, locale) => {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

const formatDateTime = (value, locale) => {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString(locale === 'en' ? 'en-US' : 'fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export function ConstructionEngineerProjectDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { lang, t } = useLanguage()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState('overview')
  const [showAddUpdateModal, setShowAddUpdateModal] = useState(false)
  const [editingUpdate, setEditingUpdate] = useState(null)
  const [updateFormData, setUpdateFormData] = useState({ title: '', description: '' })
  const [updateFormError, setUpdateFormError] = useState('')

  const [showEditProjectModal, setShowEditProjectModal] = useState(false)
  const [projectFormData, setProjectFormData] = useState({
    title: '',
    location: '',
    description: '',
    status: 'PUBLISHED',
  })
  const [projectFormError, setProjectFormError] = useState('')

  const canUpdate = hasPermission(user, 'UPDATE_PROJECT') || user?.role === 'SUPER_ADMIN'

  // Fetch project details
  const projectQuery = useQuery({
    queryKey: ['construction-engineer-project', id],
    queryFn: async () => {
      const response = await api.get(`/api/construction/projects/${id}`)
      return response.data?.data?.project || response.data?.data || response.data
    },
    retry: 1,
  })

  // Fetch updates
  const updatesQuery = useQuery({
    queryKey: ['construction-engineer-project-updates', id],
    queryFn: async () => {
      const response = await api.get(`/api/construction/projects/${id}/updates`, { params: { limit: 100 } })
      return toList(response.data?.data || response.data)
    },
    enabled: Boolean(projectQuery.data),
    retry: 1,
  })

  // Fetch gallery
  const galleryQuery = useQuery({
    queryKey: ['construction-engineer-project-gallery', id],
    queryFn: async () => {
      const response = await api.get(`/api/construction/projects/${id}/gallery`, { params: { limit: 100 } })
      return toList(response.data?.data || response.data)
    },
    enabled: Boolean(projectQuery.data),
    retry: 1,
  })

  // Create update mutation
  const createUpdateMutation = useMutation({
    mutationFn: async (data) => {
      return api.post(`/api/construction/projects/${id}/updates`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['construction-engineer-project-updates', id] })
      setShowAddUpdateModal(false)
      setUpdateFormData({ title: '', description: '' })
      setUpdateFormError('')
    },
    onError: (err) => {
      setUpdateFormError(err?.response?.data?.message || t('construction.engineer.detail.updateSaveError'))
    },
  })

  // Edit update mutation
  const editUpdateMutation = useMutation({
    mutationFn: async ({ updateId, data }) => {
      return api.put(`/api/construction/projects/${id}/updates/${updateId}`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['construction-engineer-project-updates', id] })
      setEditingUpdate(null)
      setUpdateFormData({ title: '', description: '' })
      setUpdateFormError('')
    },
    onError: (err) => {
      setUpdateFormError(err?.response?.data?.message || t('construction.engineer.detail.updateSaveError'))
    },
  })

  // Edit project info mutation
  const editProjectMutation = useMutation({
    mutationFn: async (data) => {
      return api.put(`/api/construction/projects/${id}`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['construction-engineer-project', id] })
      queryClient.invalidateQueries({ queryKey: ['construction-engineer-projects'] })
      setShowEditProjectModal(false)
      setProjectFormError('')
    },
    onError: (err) => {
      setProjectFormError(err?.response?.data?.message || t('construction.engineer.detail.projectSaveError'))
    },
  })

  const handleOpenAddUpdate = () => {
    setEditingUpdate(null)
    setUpdateFormData({ title: '', description: '' })
    setUpdateFormError('')
    setShowAddUpdateModal(true)
  }

  const handleOpenEditUpdate = (item) => {
    setEditingUpdate(item)
    setUpdateFormData({ title: item.title || '', description: item.description || '' })
    setUpdateFormError('')
    setShowAddUpdateModal(true)
  }

  const handleSaveUpdate = (e) => {
    e.preventDefault()
    if (!updateFormData.title.trim()) {
      setUpdateFormError(t('construction.engineer.detail.updateTitleRequired'))
      return
    }
    if (editingUpdate) {
      editUpdateMutation.mutate({ updateId: editingUpdate.id, data: updateFormData })
    } else {
      createUpdateMutation.mutate(updateFormData)
    }
  }

  const handleOpenEditProject = (project) => {
    setProjectFormData({
      title: project.title || '',
      location: project.location || '',
      description: project.description || '',
      status: project.status || 'PUBLISHED',
    })
    setProjectFormError('')
    setShowEditProjectModal(true)
  }

  const handleSaveProject = (e) => {
    e.preventDefault()
    if (!projectFormData.title.trim()) {
      setProjectFormError(t('construction.engineer.detail.projectTitleRequired'))
      return
    }
    editProjectMutation.mutate(projectFormData)
  }

  // Handle error states cleanly (403, 404, generic)
  if (projectQuery.isPending) {
    return (
      <section className="page">
        <div className="state-container">
          <Clock size={28} className="spin" />
          <p>{t('construction.engineer.detail.loading')}</p>
        </div>
      </section>
    )
  }

  if (projectQuery.isError) {
    const statusCode = projectQuery.error?.response?.status
    const is403 = statusCode === 403
    const is404 = statusCode === 404

    return (
      <section className="page">
        <div className="page-head">
          <Link to="/construction/engineer/projects" className="button secondary">
            <ArrowLeft size={16} />
            <span>{t('construction.engineer.detail.backToProjects')}</span>
          </Link>
        </div>

        <div className="state-container" style={{ padding: '48px 24px', textAlign: 'center' }}>
          {is403 ? (
            <>
              <AlertCircle size={44} style={{ color: 'var(--color-danger)', marginBottom: '12px' }} />
              <h2 style={{ color: 'var(--color-dark)', marginBottom: '8px' }}>
                {t('construction.engineer.detail.forbiddenTitle')}
              </h2>
              <p style={{ color: 'var(--color-medium-gray)', maxWidth: '460px', margin: '0 auto 20px' }}>
                {t('construction.engineer.detail.forbiddenMessage')}
              </p>
            </>
          ) : is404 ? (
            <>
              <HelpCircle size={44} style={{ color: 'var(--color-warning)', marginBottom: '12px' }} />
              <h2 style={{ color: 'var(--color-dark)', marginBottom: '8px' }}>
                {t('construction.engineer.detail.notFoundTitle')}
              </h2>
              <p style={{ color: 'var(--color-medium-gray)', maxWidth: '460px', margin: '0 auto 20px' }}>
                {t('construction.engineer.detail.notFoundMessage')}
              </p>
            </>
          ) : (
            <>
              <AlertTriangle size={44} style={{ color: 'var(--color-danger)', marginBottom: '12px' }} />
              <h2 style={{ color: 'var(--color-dark)', marginBottom: '8px' }}>
                {t('dashboard.errorTitle')}
              </h2>
              <p style={{ color: 'var(--color-medium-gray)', maxWidth: '460px', margin: '0 auto 20px' }}>
                {projectQuery.error?.response?.data?.message || t('construction.engineer.detail.genericError')}
              </p>
            </>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              type="button"
              className="button secondary"
              onClick={() => projectQuery.refetch()}
            >
              <RefreshCw size={14} />
              <span>{t('dashboard.retry')}</span>
            </button>
            <button
              type="button"
              className="button"
              onClick={() => navigate('/construction/engineer/projects')}
            >
              {t('construction.engineer.detail.returnToMyProjects')}
            </button>
          </div>
        </div>
      </section>
    )
  }

  const project = projectQuery.data || {}
  const updates = updatesQuery.data || []
  const gallery = galleryQuery.data || []

  return (
    <section className="page">
      {/* Header & Breadcrumb */}
      <div className="page-head">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Link to="/construction/engineer/projects" style={{ color: 'var(--color-medium-gray)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.875rem' }}>
              <ArrowLeft size={14} />
              <span>{t('construction.engineer.detail.breadcrumbProjects')}</span>
            </Link>
            <span style={{ color: 'var(--color-border)' }}>/</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{project.title}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ margin: 0 }}>{project.title}</h1>
            <span className={`badge ${project.status === 'PUBLISHED' ? 'success' : project.status === 'ARCHIVED' ? 'secondary' : 'info'}`}>
              {project.status === 'PUBLISHED'
                ? t('status.published')
                : project.status === 'ARCHIVED'
                ? t('status.archived')
                : t('status.draft')}
            </span>
          </div>
          <p style={{ marginTop: '4px', color: 'var(--color-medium-gray)' }}>
            {project.location ? `📍 ${project.location}` : t('construction.engineer.dashboard.noLocation')} · {t('construction.engineer.detail.createdOn')} {formatDate(project.createdAt, lang)}
          </p>
        </div>

        <div className="page-actions">
          {canUpdate && (
            <button
              type="button"
              className="button secondary"
              onClick={() => handleOpenEditProject(project)}
            >
              <Pencil size={14} />
              <span>{t('construction.engineer.detail.editProjectInfo')}</span>
            </button>
          )}
          <button
            type="button"
            className="button"
            onClick={handleOpenAddUpdate}
          >
            <Plus size={16} />
            <span>{t('construction.engineer.detail.addUpdateBtn')}</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="toolbar" style={{ marginBottom: '20px', borderBottom: '1px solid var(--color-border)', paddingBottom: '0' }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '10px 16px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'overview' ? '2px solid var(--color-dark)' : '2px solid transparent',
              fontWeight: activeTab === 'overview' ? 600 : 500,
              color: activeTab === 'overview' ? 'var(--color-dark)' : 'var(--color-medium-gray)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Info size={16} />
            <span>{t('construction.engineer.detail.tabOverview')}</span>
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === 'updates' ? 'active' : ''}`}
            onClick={() => setActiveTab('updates')}
            style={{
              padding: '10px 16px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'updates' ? '2px solid var(--color-dark)' : '2px solid transparent',
              fontWeight: activeTab === 'updates' ? 600 : 500,
              color: activeTab === 'updates' ? 'var(--color-dark)' : 'var(--color-medium-gray)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Clock size={16} />
            <span>{t('construction.engineer.detail.tabUpdates')} ({updates.length})</span>
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === 'gallery' ? 'active' : ''}`}
            onClick={() => setActiveTab('gallery')}
            style={{
              padding: '10px 16px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'gallery' ? '2px solid var(--color-dark)' : '2px solid transparent',
              fontWeight: activeTab === 'gallery' ? 600 : 500,
              color: activeTab === 'gallery' ? 'var(--color-dark)' : 'var(--color-medium-gray)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ImageIcon size={16} />
            <span>{t('construction.engineer.detail.tabGallery')} ({gallery.length})</span>
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === 'roadmap' ? 'active' : ''}`}
            onClick={() => setActiveTab('roadmap')}
            style={{
              padding: '10px 16px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'roadmap' ? '2px solid var(--color-dark)' : '2px solid transparent',
              fontWeight: activeTab === 'roadmap' ? 600 : 500,
              color: activeTab === 'roadmap' ? 'var(--color-dark)' : 'var(--color-medium-gray)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Calendar size={16} />
            <span>{t('construction.engineer.detail.tabRoadmap')}</span>
          </button>
        </div>
      </div>

      {/* Tab Content 1: Overview */}
      {activeTab === 'overview' && (
        <div className="panel-grid two-column">
          <section className="dashboard-panel">
            <div className="panel-header">
              <div className="panel-title-wrap">
                <Building2 size={18} className="panel-icon" aria-hidden="true" />
                <h2>{t('construction.engineer.detail.mainInfoTitle')}</h2>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div>
                <small style={{ color: 'var(--color-medium-gray)', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 600 }}>
                  {t('construction.engineer.detail.statusLabel')}
                </small>
                <div style={{ marginTop: '4px' }}>
                  <span className={`badge ${project.status === 'PUBLISHED' ? 'success' : project.status === 'ARCHIVED' ? 'secondary' : 'info'}`}>
                    {project.status}
                  </span>
                </div>
              </div>

              <div>
                <small style={{ color: 'var(--color-medium-gray)', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 600 }}>
                  {t('construction.engineer.detail.publicationLabel')}
                </small>
                <div style={{ marginTop: '4px', fontWeight: 600 }}>{project.publicationStatus || 'DRAFT'}</div>
              </div>

              <div>
                <small style={{ color: 'var(--color-medium-gray)', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 600 }}>
                  {t('construction.engineer.detail.budgetLabel')}
                </small>
                <div style={{ marginTop: '4px', fontWeight: 600 }}>{money(project.budget, lang)}</div>
              </div>

              <div>
                <small style={{ color: 'var(--color-medium-gray)', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 600 }}>
                  {t('construction.engineer.detail.locationLabel')}
                </small>
                <div style={{ marginTop: '4px', fontWeight: 600 }}>{project.location || '—'}</div>
              </div>
            </div>

            <div>
              <small style={{ color: 'var(--color-medium-gray)', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 600 }}>
                {t('construction.engineer.detail.descriptionLabel')}
              </small>
              <p style={{ marginTop: '6px', whiteSpace: 'pre-wrap', lineHeight: 1.6, color: 'var(--color-dark)' }}>
                {project.description || t('construction.engineer.detail.noDescription')}
              </p>
            </div>
          </section>

          {/* Quick updates summary on overview */}
          <section className="dashboard-panel">
            <div className="panel-header">
              <div className="panel-title-wrap">
                <Clock size={18} className="panel-icon" aria-hidden="true" />
                <h2>{t('construction.engineer.detail.recentUpdatesTitle')}</h2>
              </div>
              <button
                type="button"
                className="button secondary sm"
                onClick={handleOpenAddUpdate}
              >
                <Plus size={14} />
                <span>{t('construction.engineer.detail.addUpdateShort')}</span>
              </button>
            </div>

            {updates.length === 0 ? (
              <div className="empty-state">
                <p>{t('construction.engineer.detail.noUpdatesYet')}</p>
                <button
                  type="button"
                  className="button secondary sm"
                  style={{ marginTop: '10px' }}
                  onClick={handleOpenAddUpdate}
                >
                  <Plus size={14} />
                  <span>{t('construction.engineer.detail.createFirstUpdate')}</span>
                </button>
              </div>
            ) : (
              <div className="activity-list">
                {updates.slice(0, 4).map((item) => (
                  <article key={item.id} className="activity-item">
                    <div className="activity-topline">
                      <strong>{item.title}</strong>
                      <span>{formatDateTime(item.createdAt, lang)}</span>
                    </div>
                    {item.description && (
                      <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--color-dark)' }}>
                        {item.description}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Tab Content 2: Updates (Full Management) */}
      {activeTab === 'updates' && (
        <section className="dashboard-panel">
          <div className="panel-header">
            <div className="panel-title-wrap">
              <Clock size={18} className="panel-icon" aria-hidden="true" />
              <h2>{t('construction.engineer.detail.allSiteUpdatesTitle')}</h2>
            </div>
            <button
              type="button"
              className="button"
              onClick={handleOpenAddUpdate}
            >
              <Plus size={16} />
              <span>{t('construction.engineer.detail.addUpdateBtn')}</span>
            </button>
          </div>

          {updates.length === 0 ? (
            <div className="state-container">
              <FileText size={36} style={{ color: 'var(--color-medium-gray)', marginBottom: '8px' }} />
              <h3>{t('construction.engineer.detail.noUpdatesTitle')}</h3>
              <p>{t('construction.engineer.detail.noUpdatesDesc')}</p>
              <button
                type="button"
                className="button"
                onClick={handleOpenAddUpdate}
                style={{ marginTop: '12px' }}
              >
                <Plus size={16} />
                <span>{t('construction.engineer.detail.addUpdateBtn')}</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {updates.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: '16px 20px',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-white)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px', fontSize: '1.05rem', color: 'var(--color-dark)' }}>
                        {item.title}
                      </h3>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-medium-gray)' }}>
                        {t('construction.engineer.detail.recordedOn')} {formatDateTime(item.createdAt, lang)}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="button secondary sm"
                      onClick={() => handleOpenEditUpdate(item)}
                      title={t('construction.engineer.detail.editUpdateTitle')}
                    >
                      <Pencil size={14} />
                      <span>{t('construction.engineer.detail.edit')}</span>
                    </button>
                  </div>

                  <p style={{ margin: '12px 0 0', whiteSpace: 'pre-wrap', lineHeight: 1.6, color: 'var(--color-dark)', fontSize: '0.9rem' }}>
                    {item.description || t('construction.engineer.detail.noDescription')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Tab Content 3: Gallery */}
      {activeTab === 'gallery' && (
        <section className="dashboard-panel">
          <div className="panel-header">
            <div className="panel-title-wrap">
              <ImageIcon size={18} className="panel-icon" aria-hidden="true" />
              <h2>{t('construction.engineer.detail.galleryTitle')}</h2>
            </div>
          </div>

          {/* Audit info notice: Media upload is admin-only */}
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--color-info-bg)',
              border: '1px solid #BFDBFE',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '20px',
              fontSize: '0.875rem',
              color: '#1E40AF',
            }}
          >
            <Info size={20} style={{ flexShrink: 0 }} />
            <span>{t('construction.engineer.detail.galleryUploadNotice')}</span>
          </div>

          {gallery.length === 0 ? (
            <div className="state-container">
              <ImageIcon size={36} style={{ color: 'var(--color-medium-gray)', marginBottom: '8px' }} />
              <h3>{t('construction.engineer.detail.noMediaTitle')}</h3>
              <p>{t('construction.engineer.detail.noMediaDesc')}</p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: '16px',
              }}
            >
              {gallery.map((item) => (
                <div
                  key={item.id}
                  style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    backgroundColor: 'var(--color-white)',
                  }}
                >
                  <div style={{ height: '180px', backgroundColor: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {item.media?.url ? (
                      <img
                        src={item.media.url}
                        alt={item.caption || item.media?.originalName || 'Project visual'}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <ImageIcon size={40} style={{ color: '#94A3B8' }} />
                    )}
                  </div>
                  <div style={{ padding: '12px' }}>
                    <strong style={{ fontSize: '0.9rem', display: 'block', marginBottom: '4px' }}>
                      {item.caption || item.media?.originalName || t('construction.engineer.detail.untitledVisual')}
                    </strong>
                    <small style={{ color: 'var(--color-medium-gray)' }}>
                      {formatDate(item.createdAt, lang)}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Tab Content 4: Roadmap Modules */}
      {activeTab === 'roadmap' && (
        <section className="dashboard-panel">
          <div className="panel-header">
            <div className="panel-title-wrap">
              <Calendar size={18} className="panel-icon" aria-hidden="true" />
              <h2>{t('construction.engineer.roadmap.title')}</h2>
            </div>
            <span className="badge info">{t('construction.engineer.roadmap.badge')}</span>
          </div>

          <p style={{ color: 'var(--color-medium-gray)', fontSize: '0.9rem', marginBottom: '20px', lineHeight: 1.6 }}>
            {t('construction.engineer.roadmap.projectTabDesc')}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            <div style={{ padding: '20px', border: '1px solid var(--color-border)', borderRadius: '8px', backgroundColor: 'var(--color-bg-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <Calendar size={20} style={{ color: 'var(--color-dark)' }} />
                <h3 style={{ margin: 0, fontSize: '1rem' }}>{t('construction.engineer.roadmap.planningTitle')}</h3>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-medium-gray)', margin: '0 0 12px', lineHeight: 1.5 }}>
                {t('construction.engineer.roadmap.planningDetail')}
              </p>
              <span className="badge secondary">{t('construction.engineer.roadmap.inDevelopment')}</span>
            </div>

            <div style={{ padding: '20px', border: '1px solid var(--color-border)', borderRadius: '8px', backgroundColor: 'var(--color-bg-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <CheckCircle2 size={20} style={{ color: 'var(--color-dark)' }} />
                <h3 style={{ margin: 0, fontSize: '1rem' }}>{t('construction.engineer.roadmap.reportsTitle')}</h3>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-medium-gray)', margin: '0 0 12px', lineHeight: 1.5 }}>
                {t('construction.engineer.roadmap.reportsDetail')}
              </p>
              <span className="badge secondary">{t('construction.engineer.roadmap.inDevelopment')}</span>
            </div>
          </div>
        </section>
      )}

      {/* Modal: Add/Edit Update */}
      {showAddUpdateModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="modal-content card" style={{ maxWidth: '520px', width: '100%', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>
                {editingUpdate ? t('construction.engineer.detail.modalEditUpdateTitle') : t('construction.engineer.detail.modalAddUpdateTitle')}
              </h2>
              <button
                type="button"
                onClick={() => setShowAddUpdateModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-medium-gray)' }}
              >
                <X size={20} />
              </button>
            </div>

            {updateFormError && (
              <div style={{ padding: '10px 14px', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem' }}>
                {updateFormError}
              </div>
            )}

            <form onSubmit={handleSaveUpdate}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                  {t('construction.engineer.detail.updateTitleLabel')} *
                </label>
                <input
                  type="text"
                  value={updateFormData.title}
                  onChange={(e) => setUpdateFormData({ ...updateFormData, title: e.target.value })}
                  placeholder={t('construction.engineer.detail.updateTitlePlaceholder')}
                  required
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                  {t('construction.engineer.detail.updateDescLabel')}
                </label>
                <textarea
                  rows={5}
                  value={updateFormData.description}
                  onChange={(e) => setUpdateFormData({ ...updateFormData, description: e.target.value })}
                  placeholder={t('construction.engineer.detail.updateDescPlaceholder')}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setShowAddUpdateModal(false)}
                >
                  {t('construction.projects.cancel')}
                </button>
                <button
                  type="submit"
                  className="button"
                  disabled={createUpdateMutation.isPending || editUpdateMutation.isPending}
                >
                  {createUpdateMutation.isPending || editUpdateMutation.isPending
                    ? t('construction.projects.saving')
                    : editingUpdate
                    ? t('construction.projects.save')
                    : t('construction.projects.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Project Info */}
      {showEditProjectModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="modal-content card" style={{ maxWidth: '520px', width: '100%', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>
                {t('construction.engineer.detail.editProjectInfoTitle')}
              </h2>
              <button
                type="button"
                onClick={() => setShowEditProjectModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-medium-gray)' }}
              >
                <X size={20} />
              </button>
            </div>

            {projectFormError && (
              <div style={{ padding: '10px 14px', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem' }}>
                {projectFormError}
              </div>
            )}

            <form onSubmit={handleSaveProject}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                  {t('construction.projects.fields.title')} *
                </label>
                <input
                  type="text"
                  value={projectFormData.title}
                  onChange={(e) => setProjectFormData({ ...projectFormData, title: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                  {t('construction.projects.fields.location')}
                </label>
                <input
                  type="text"
                  value={projectFormData.location}
                  onChange={(e) => setProjectFormData({ ...projectFormData, location: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                  {t('construction.projects.fields.status')}
                </label>
                <select
                  value={projectFormData.status}
                  onChange={(e) => setProjectFormData({ ...projectFormData, status: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                >
                  <option value="DRAFT">{t('status.draft')}</option>
                  <option value="PUBLISHED">{t('status.published')}</option>
                  <option value="ARCHIVED">{t('status.archived')}</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                  {t('construction.projects.fields.description')}
                </label>
                <textarea
                  rows={4}
                  value={projectFormData.description}
                  onChange={(e) => setProjectFormData({ ...projectFormData, description: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setShowEditProjectModal(false)}
                >
                  {t('construction.projects.cancel')}
                </button>
                <button
                  type="submit"
                  className="button"
                  disabled={editProjectMutation.isPending}
                >
                  {editProjectMutation.isPending ? t('construction.projects.saving') : t('construction.projects.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
