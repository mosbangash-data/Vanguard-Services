import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, Images, Calendar } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageProvider'
import { api } from '../api/client'
import { useFetch } from '../hooks/useFetch'
import { LoadingState, ErrorState } from '../components/StateView'
import { translateError } from '../utils/errors'
import { MediaGallery } from '../components/media/MediaGallery'

const formatBudget = (budget) => {
  if (budget == null) return null
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD' }).format(Number(budget))
}

export default function ProjectDetail() {
  const { id } = useParams()
  const { t } = useLanguage()
  const { data, loading, error, execute } = useFetch(() => api.getPublicProject(id), { deps: [id] })

  const project = data?.project

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={translateError(error, t)} onRetry={execute} />
  if (!project) return <ErrorState message={t('constructionPage.projectNotFoundMessage')} onRetry={execute} />

  const gallery = project.gallery || []

  return (
    <div className="project-detail">
      <section className="section">
        <div className="container">
          <Link to="/construction" className="vehicle-detail-back">
            <ArrowLeft size={16} aria-hidden="true" />
            {t('constructionPage.projectBack')}
          </Link>

          <div className="project-detail-header">
            <h1 className="project-detail-title display-title">{project.title}</h1>
            <span className="badge badge-success">{t('constructionPage.statusPublished')}</span>
          </div>

          <div className="project-detail-meta">
            {project.location && (
              <span className="project-detail-meta-item">
                <MapPin size={16} aria-hidden="true" />
                {project.location}
              </span>
            )}
            {project.createdAt && (
              <span className="project-detail-meta-item">
                <Calendar size={16} aria-hidden="true" />
                {new Date(project.createdAt).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            )}
            {formatBudget(project.budget) && (
              <span className="project-detail-meta-item">
                <span className="project-detail-budget">{formatBudget(project.budget)}</span>
              </span>
            )}
          </div>

          {project.description && <p className="project-detail-desc">{project.description}</p>}

          {gallery.length > 0 && (
            <div className="project-gallery">
              <h2 className="project-gallery-title">{t('constructionPage.galleryTitle')}</h2>
              <MediaGallery
                items={gallery}
                altPrefix={project.title}
                fallback={
                  <div className="project-gallery-empty" style={{ width: '100%', minHeight: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F1F5F9', color: '#64748B', borderRadius: '12px' }}>
                    <Images size={40} aria-hidden="true" />
                    <span style={{ marginLeft: '8px' }}>{t('constructionPage.noProjects')}</span>
                  </div>
                }
                objectFit="cover"
                className="project-gallery-wrapper"
              />
            </div>
          )}

          {gallery.length === 0 && (
            <div className="project-detail-empty">
              <Images size={48} aria-hidden="true" />
              <p>{t('constructionPage.noProjects')}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}