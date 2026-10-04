import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { api, uploadMedia } from '../../services/api'
import { useAuth } from '../auth/authContext'
import { hasPermission } from '../auth/permissions'
import { useLanguage } from '../../i18n/useLanguage'
import { MediaUploader } from '../../components/media/MediaUploader'
import { syncMediaRelations } from '../../utils/mediaSync'
import { getMediaUrl } from '../../utils/media'

const PROJECT_STATUS_OPTIONS = ['DRAFT', 'PUBLISHED', 'ARCHIVED']
const PUBLICATION_STATUS_OPTIONS = ['DRAFT', 'PUBLISHED', 'ARCHIVED']

const EMPTY_FORM = {
  title: '',
  location: '',
  description: '',
  budget: '',
  status: 'DRAFT',
  publicationStatus: 'DRAFT',
}

const normalize = (value) => typeof value === 'string' ? value.trim() : ''

function validateProjectForm(values) {
  const errors = {}
  if (!normalize(values.title)) errors.title = 'title required'
  if (values.budget !== '' && values.budget !== null && Number(values.budget) < 0) errors.budget = 'invalid budget'
  return errors
}

export function ProjectFormPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = Boolean(id)

  const canCreate = hasPermission(user, 'CREATE_PROJECT') || user?.role === 'SUPER_ADMIN'
  const canUpdate = hasPermission(user, 'UPDATE_PROJECT') || user?.role === 'SUPER_ADMIN'

  const [values, setValues] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [galleryFiles, setGalleryFiles] = useState([])
  const [galleryError, setGalleryError] = useState('')
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [existingGallery, setExistingGallery] = useState([])
  const [deletedGalleryIds, setDeletedGalleryIds] = useState([])
  const [galleryPrimaryId, setGalleryPrimaryId] = useState(null)

  const departmentQuery = useQuery({
    queryKey: ['construction-department'],
    queryFn: async () => {
      const response = await api.get('/api/departments')
      const items = Array.isArray(response.data?.data?.items) ? response.data.data.items : []
      const department = items.find((item) => item.type === 'CONSTRUCTION')
      if (!department) throw new Error('Construction department not found')
      return department
    },
    enabled: Boolean(user),
  })

  const projectQuery = useQuery({
    queryKey: ['construction-project', id],
    queryFn: async () => {
      const response = await api.get(`/api/construction/projects/${id}`)
      return response.data?.data?.project || response.data?.data || {}
    },
    enabled: isEditing,
  })

  const galleryQuery = useQuery({
    queryKey: ['construction-project-gallery', id],
    queryFn: async () => {
      const response = await api.get(`/api/construction/projects/${id}/gallery`)
      const items = response.data?.data?.items || response.data?.data?.gallery || response.data?.data || []
      setExistingGallery(Array.isArray(items) ? items : [])
      setGalleryPrimaryId(Array.isArray(items) ? items.find((item) => item.order === 0)?.id || null : null)
      return Array.isArray(items) ? items : []
    },
    enabled: isEditing,
  })

  useEffect(() => {
    if (!projectQuery.data) return
    setValues({
      title: projectQuery.data.title || '',
      location: projectQuery.data.location || '',
      description: projectQuery.data.description || '',
      budget: projectQuery.data.budget ?? '',
      status: projectQuery.data.status || 'DRAFT',
      publicationStatus: projectQuery.data.publicationStatus || 'DRAFT',
    })
  }, [projectQuery.data])

  const mutation = useMutation({
    mutationFn: async (payload) => {
      const department = departmentQuery.data || (await departmentQuery.refetch()).data
      const body = {
        ...payload,
        departmentId: department.id,
      }
      let response
      if (isEditing) {
        response = await api.put(`/api/construction/projects/${id}`, body)
      } else {
        response = await api.post('/api/construction/projects', body)
      }

      const result = response.data?.data
      const project = result?.project || result || null
      if (isEditing || galleryFiles.length > 0 || deletedGalleryIds.length > 0) {
        setGalleryLoading(true)
        try {
          const targetProjectId = project?.id || id
          if (!targetProjectId) throw new Error('Project ID unavailable for media upload')
          await syncMediaRelations({
            api,
            uploadMedia,
            endpoint: `/api/construction/projects/${targetProjectId}/gallery`,
            relationKey: 'projectId',
            uploadOptions: { department: 'CONSTRUCTION', entityType: 'project' },
            entityId: targetProjectId,
            existingMedia: existingGallery
              .filter((item) => !deletedGalleryIds.includes(item.id))
              .map((item) => ({ ...item, isPrimary: item.id === galleryPrimaryId })),
            pendingMedia: galleryFiles,
            deletedMediaIds: deletedGalleryIds,
            primaryMode: 'set-primary',
          })
        } finally {
          setGalleryLoading(false)
        }
      }
      return response
    },
    onSuccess: (response) => {
      const result = response.data?.data
      const project = result?.project || result || null
      setGalleryFiles([])
      setDeletedGalleryIds([])
      setGalleryPrimaryId(null)
      setGalleryError('')
      navigate(project?.id ? `/construction/projects/${project.id}` : '/construction/projects')
    },
    onError: () => {
      setSubmitError(t('construction.projects.submitError'))
      setGalleryError(t('construction.projects.gallerySubmitError'))
    },
  })

  const canSubmit = isEditing ? canUpdate : canCreate

  if (!canSubmit) {
    return (
      <section className="page">
        <div className="state-container">
          <p>{t('construction.projects.accessDenied')}</p>
        </div>
      </section>
    )
  }

  if (isEditing && projectQuery.isPending) {
    return <section className="page"><div className="state-container">{t('construction.projects.loadingDetail')}</div></section>
  }

  if (isEditing && projectQuery.isError) {
    return <section className="page"><div className="state-container">{t('construction.projects.detailError')}</div></section>
  }

  const handleFieldChange = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setSubmitError('')
  }

  const handleSetPrimaryGallery = (mediaId) => {
    const isPending = galleryFiles.some((item) => item.id === mediaId)
    setGalleryPrimaryId(isPending ? mediaId : mediaId)
    setGalleryFiles((current) => current.map((item) => ({ ...item, isPrimary: isPending && item.id === mediaId })))
  }

  const handleDeleteExistingGallery = (mediaId) => {
    const remaining = existingGallery.filter((item) => item.id !== mediaId && !deletedGalleryIds.includes(item.id))
    const wasPrimary = galleryPrimaryId === mediaId
    setExistingGallery((current) => current.filter((item) => item.id !== mediaId))
    setDeletedGalleryIds((current) => [...new Set([...current, mediaId])])
    if (wasPrimary) {
      const nextPrimary = remaining[0]?.id || galleryFiles[0]?.id || null
      setGalleryPrimaryId(nextPrimary)
      setGalleryFiles((current) => current.map((item) => ({ ...item, isPrimary: item.id === nextPrimary })))
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const validation = validateProjectForm(values)
    setErrors(validation)
    if (Object.keys(validation).length > 0) return

    const payload = {
      title: normalize(values.title),
      location: normalize(values.location) || null,
      description: normalize(values.description) || null,
      budget: values.budget === '' || values.budget === null ? null : Number(values.budget),
      status: values.status,
      publicationStatus: values.publicationStatus,
    }

    mutation.mutate(payload)
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>{isEditing ? t('construction.projects.editTitle') : t('construction.projects.createTitle')}</h1>
          <p>{isEditing ? t('construction.projects.editSubtitle') : t('construction.projects.createSubtitle')}</p>
        </div>
      </div>

      <form className="card construction-project-form" onSubmit={handleSubmit}>
        <section className="construction-project-form__section" aria-labelledby="project-general-heading">
          <h2 id="project-general-heading">{t('construction.projects.sections.general')}</h2>
        <div className="vehicle-form-grid">
          <label>
            <span>{t('construction.projects.fields.title')} *</span>
            <input required value={values.title} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'project-title-error' : undefined} onChange={(event) => handleFieldChange('title', event.target.value)} />
            {errors.title && <small id="project-title-error" className="field-error" role="alert">{t('construction.projects.errors.title')}</small>}
          </label>

          <label>
            <span>{t('construction.projects.fields.location')}</span>
            <input value={values.location} onChange={(event) => handleFieldChange('location', event.target.value)} />
          </label>

          <label className="full-width">
            <span>{t('construction.projects.fields.description')}</span>
            <textarea rows="5" value={values.description} onChange={(event) => handleFieldChange('description', event.target.value)} />
          </label>
        </div>
        </section>

        <section className="construction-project-form__section" aria-labelledby="project-budget-heading">
          <h2 id="project-budget-heading">{t('construction.projects.sections.budget')}</h2>
          <label className="construction-project-form__budget">
            <span>{t('construction.projects.fields.budget')}</span>
            <input type="number" min="0" step="0.01" value={values.budget} aria-invalid={Boolean(errors.budget)} aria-describedby={errors.budget ? 'project-budget-error' : undefined} onChange={(event) => handleFieldChange('budget', event.target.value)} />
            {errors.budget && <small id="project-budget-error" className="field-error" role="alert">{t('construction.projects.errors.budget')}</small>}
          </label>
        </section>

        <section className="construction-project-form__section" aria-labelledby="project-publication-heading">
          <h2 id="project-publication-heading">{t('construction.projects.sections.publication')}</h2>
          <div className="vehicle-form-grid">
            <label><span>{t('construction.projects.fields.status')}</span><select value={values.status} onChange={(event) => handleFieldChange('status', event.target.value)}>{PROJECT_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{t(`construction.projects.statuses.${status}`)}</option>)}</select></label>
            <label><span>{t('construction.projects.fields.publicationStatus')}</span><select value={values.publicationStatus} onChange={(event) => handleFieldChange('publicationStatus', event.target.value)}>{PUBLICATION_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{t(`construction.projects.publicationStatuses.${status}`)}</option>)}</select></label>
          </div>
        </section>

        <section className="construction-project-form__section" aria-labelledby="project-media-heading">
          <h2 id="project-media-heading">{t('construction.projects.sections.media')}</h2>
        <div className="full-width">
          {galleryQuery.isError ? <div className="error-state" role="alert"><p>{t('construction.projects.galleryLoadError')}</p><button type="button" className="button secondary sm" onClick={() => galleryQuery.refetch()}>{t('dashboard.retry')}</button></div> : <MediaUploader
            label={t('construction.projects.galleryLabel')}
            helperText={t('construction.projects.galleryHelper')}
            existingMedia={existingGallery.map((item) => ({
              id: item.id,
              isPrimary: item.id === galleryPrimaryId,
              url: getMediaUrl(item.media, { variant: 'thumbnail' }),
              caption: item.caption,
              order: item.order,
            }))}
            pendingFiles={galleryFiles}
            onPendingChange={setGalleryFiles}
            onSetPrimary={handleSetPrimaryGallery}
            onDeleteExisting={isEditing ? handleDeleteExistingGallery : null}
            disabled={mutation.isPending || galleryLoading}
            isUploading={galleryLoading}
            uploadProgressText={t('construction.projects.uploadingPhoto')}
          />}
          {galleryQuery.isPending && <p role="status">{t('construction.projects.loadingGallery')}</p>}
          {galleryError && <p className="error" role="alert">{galleryError}</p>}
        </div>
        </section>

        {submitError && <p className="error" role="alert">{submitError}</p>}

        <div className="form-actions">
          <button type="submit" className="button" disabled={mutation.isPending}>
            {mutation.isPending ? t('construction.projects.saving') : isEditing ? t('construction.projects.save') : t('construction.projects.create')}
          </button>
          <button type="button" className="button secondary" onClick={() => navigate('/construction/projects')}>
            {t('construction.projects.cancel')}
          </button>
        </div>
      </form>
    </section>
  )
}
