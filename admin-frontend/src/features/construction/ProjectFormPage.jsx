import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../services/api'
import { useAuth } from '../auth/authContext'
import { hasPermission } from '../auth/permissions'
import { useLanguage } from '../../i18n/useLanguage'

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
      if (isEditing) {
        return api.put(`/api/construction/projects/${id}`, body)
      }
      return api.post('/api/construction/projects', body)
    },
    onSuccess: (response) => {
      const result = response.data?.data
      const project = result?.project || result || null
      navigate(project?.id ? `/construction/projects/${project.id}` : '/construction/projects')
    },
    onError: (error) => {
      setSubmitError(error?.response?.data?.message || t('construction.projects.submitError'))
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

      <form className="card" onSubmit={handleSubmit}>
        <div className="vehicle-form-grid">
          <label>
            <span>{t('construction.projects.fields.title')}</span>
            <input value={values.title} onChange={(event) => handleFieldChange('title', event.target.value)} />
            {errors.title && <small className="field-error">{t('construction.projects.errors.title')}</small>}
          </label>

          <label>
            <span>{t('construction.projects.fields.location')}</span>
            <input value={values.location} onChange={(event) => handleFieldChange('location', event.target.value)} />
          </label>

          <label>
            <span>{t('construction.projects.fields.budget')}</span>
            <input type="number" min="0" step="0.01" value={values.budget} onChange={(event) => handleFieldChange('budget', event.target.value)} />
            {errors.budget && <small className="field-error">{t('construction.projects.errors.budget')}</small>}
          </label>

          <label>
            <span>{t('construction.projects.fields.status')}</span>
            <select value={values.status} onChange={(event) => handleFieldChange('status', event.target.value)}>
              {PROJECT_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>

          <label>
            <span>{t('construction.projects.fields.publicationStatus')}</span>
            <select value={values.publicationStatus} onChange={(event) => handleFieldChange('publicationStatus', event.target.value)}>
              {PUBLICATION_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>

          <label className="full-width">
            <span>{t('construction.projects.fields.description')}</span>
            <textarea rows="5" value={values.description} onChange={(event) => handleFieldChange('description', event.target.value)} />
          </label>
        </div>

        {submitError && <p className="error">{submitError}</p>}

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
