import React, { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, MapPin, Pencil, Wallet } from 'lucide-react'
import { api, uploadMedia } from '../../services/api'
import { useAuth } from '../auth/authContext'
import { hasPermission } from '../auth/permissions'
import { useLanguage } from '../../i18n/useLanguage'
import { MediaUploader } from '../../components/media/MediaUploader'
import { getMediaUrl } from '../../utils/media'
import { Card, CardContent, CardHeader, CardTitle, EmptyState, ErrorState, LoadingState, StatusBadge } from '../../components/ui'

const get = async (path) => (await api.get(path)).data?.data
const toList = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.projectUpdates)) return payload.projectUpdates
  if (Array.isArray(payload?.gallery)) return payload.gallery
  return []
}

export function ProjectDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { lang, t } = useLanguage()
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [pendingMedia, setPendingMedia] = useState([])
  const uploadingPendingIds = useRef(new Set())
  const canUpdate = hasPermission(user, 'UPDATE_PROJECT') || user?.role === 'SUPER_ADMIN'

  const project = useQuery({ queryKey: ['project', id], queryFn: () => get(`/api/construction/projects/${id}`) })
  const updates = useQuery({ queryKey: ['project-updates', id], queryFn: () => get(`/api/construction/projects/${id}/updates`) })
  const gallery = useQuery({ queryKey: ['project-gallery', id], queryFn: () => get(`/api/construction/projects/${id}/gallery`) })
  const projectData = project.data?.project || project.data || {}
  const updateList = toList(updates.data)
  const galleryList = toList(gallery.data)
  const formatDate = (value) => value ? new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'fr-FR', { dateStyle: 'medium' }).format(new Date(value)) : '—'
  const formatMoney = (value) => new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR', { style: 'currency', currency: 'USD' }).format(Number(value || 0))
  const statusLabel = (value) => {
    const key = `status.${String(value || '').toLowerCase()}`
    const translated = t(key)
    return translated === key ? (value || '—') : translated
  }
  const refreshProjectMedia = () => {
    queryClient.invalidateQueries({ queryKey: ['project-gallery', id] })
    queryClient.invalidateQueries({ queryKey: ['project', id] })
  }

  const uploadProjectPhoto = async (file, order, shouldSetPrimary) => {
    const media = await uploadMedia(file, { department: 'CONSTRUCTION', entityType: 'project', entityId: id })
    const createRes = await api.post(`/api/construction/projects/${id}/gallery`, { mediaId: media.id, caption: file.name, order })
    if (shouldSetPrimary && createRes.data?.data?.gallery?.id) {
      await api.post(`/api/construction/projects/${id}/gallery/${createRes.data.data.gallery.id}/set-primary`)
    }
    refreshProjectMedia()
  }

  const setPrimaryProjectPhoto = async (galleryId) => {
    try {
      await api.post(`/api/construction/projects/${id}/gallery/${galleryId}/set-primary`)
      refreshProjectMedia()
    } catch {
      alert(t('construction.projects.setPrimaryError'))
    }
  }

  const deleteProjectPhoto = async (galleryId) => {
    if (!window.confirm(t('construction.projects.deletePhotoConfirm'))) return
    try {
      await api.delete(`/api/construction/projects/${id}/gallery/${galleryId}`)
      refreshProjectMedia()
    } catch {
      alert(t('construction.projects.deletePhotoError'))
    }
  }

  if (project.isPending) return <section className="page"><LoadingState message={t('construction.projects.loadingDetail')} /></section>
  if (project.isError) return <section className="page"><ErrorState title={t('construction.projects.detailError')} message={t('commonUi.errorMessage')} onRetry={() => project.refetch()} /></section>

  const existingMedia = galleryList.map((item) => ({
    id: item.id,
    url: getMediaUrl(item.media, { variant: 'detail' }),
    isPrimary: item.order === 0,
    caption: item.caption,
    order: item.order,
  }))
  const primaryPhoto = existingMedia.find((media) => media.isPrimary) || existingMedia[0]
  const statusKey = `construction.projects.statuses.${projectData.status}`
  const publicationKey = `construction.projects.publicationStatuses.${projectData.publicationStatus}`
  const projectStatus = t(statusKey) === statusKey ? statusLabel(projectData.status) : t(statusKey)
  const publicationStatus = t(publicationKey) === publicationKey ? statusLabel(projectData.publicationStatus) : t(publicationKey)

  return (
    <section className="page construction-project-detail">
      <div className="construction-project-detail__topline">
        <Link className="button secondary sm" to="/construction/projects"><ArrowLeft size={16} aria-hidden="true" />{t('construction.projects.backToList')}</Link>
        {canUpdate && <Link className="button sm" to={`/construction/projects/${id}/edit`}><Pencil size={15} aria-hidden="true" />{t('construction.projects.editProject')}</Link>}
      </div>

      <header className="construction-project-detail__header">
        <div>
          <p className="eyebrow">{t('construction.title')}</p>
          <h1>{projectData.title || projectData.name || t('construction.projects.title')}</h1>
          <p className="construction-project-detail__location"><MapPin size={16} aria-hidden="true" />{projectData.location || '—'}</p>
        </div>
        <div className="construction-project-detail__badges"><StatusBadge status={projectData.status} label={projectStatus} /><StatusBadge status={projectData.publicationStatus} label={publicationStatus} /></div>
      </header>

      {primaryPhoto && <div className="construction-project-detail__hero-media"><img src={primaryPhoto.url} alt={t('construction.projects.primaryPhotoAlt', { title: projectData.title || projectData.name || '' })} /></div>}

      <div className="construction-project-detail__grid">
        <Card>
          <CardHeader><CardTitle>{t('construction.projects.overview')}</CardTitle></CardHeader>
          <CardContent>
            <dl className="construction-project-detail__facts">
              {projectData.budget !== undefined && projectData.budget !== null && <div><dt><Wallet size={15} aria-hidden="true" />{t('construction.projects.budgetLabel')}</dt><dd>{formatMoney(projectData.budget)}</dd></div>}
              <div><dt><CalendarDays size={15} aria-hidden="true" />{t('construction.projects.modifiedAt')}</dt><dd>{formatDate(projectData.updatedAt || projectData.createdAt)}</dd></div>
              <div><dt><MapPin size={15} aria-hidden="true" />{t('construction.projects.fields.location')}</dt><dd>{projectData.location || '—'}</dd></div>
            </dl>
            <div className="construction-project-detail__description"><h3>{t('construction.projects.fields.description')}</h3><p>{projectData.description || t('construction.projects.noDescription')}</p></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t('construction.projects.updatesTitle', { count: updateList.length })}</CardTitle></CardHeader>
          <CardContent>
            {updates.isPending ? <LoadingState message={t('construction.projects.loadingDetail')} /> : updates.isError ? <ErrorState title={t('construction.projects.detailError')} message={t('commonUi.errorMessage')} onRetry={() => updates.refetch()} /> : !updateList.length ? <EmptyState title={t('construction.projects.noUpdates')} /> : <ul className="construction-project-detail__updates">{updateList.map((item) => <li key={item.id || item.title}><strong>{item.title || t('construction.projects.updatesLabel')}</strong><p>{item.description || t('construction.projects.noDescription')}</p><time>{formatDate(item.createdAt)}</time></li>)}</ul>}
          </CardContent>
        </Card>
      </div>

      <Card className="construction-project-detail__gallery">
        <CardHeader><CardTitle>{t('construction.projects.galleryTitle', { count: galleryList.length })}</CardTitle></CardHeader>
        <CardContent>
          {gallery.isError ? <ErrorState title={t('construction.projects.galleryLoadError')} message={t('construction.projects.galleryLoadErrorMessage')} onRetry={() => gallery.refetch()} /> : <MediaUploader
            label={t('construction.projects.galleryLabel')}
            helperText={t('construction.projects.galleryHelper')}
            existingMedia={existingMedia}
            pendingFiles={pendingMedia}
            onSetPrimary={canUpdate ? setPrimaryProjectPhoto : null}
            onDeleteExisting={canUpdate ? deleteProjectPhoto : null}
            isUploading={uploading}
            uploadProgressText={t('construction.projects.uploadingPhoto')}
            disabled={!canUpdate}
            onPendingChange={async (newPending) => {
              if (!canUpdate) return
              setPendingMedia(newPending)
              if (!newPending.length) return
              setUploading(true)
              try {
                for (const [index, item] of newPending.entries()) {
                  if (!item.file || uploadingPendingIds.current.has(item.id)) continue
                  uploadingPendingIds.current.add(item.id)
                  try {
                    await uploadProjectPhoto(item.file, galleryList.length + index, galleryList.length === 0 && index === 0)
                    setPendingMedia((current) => current.filter((pending) => pending.id !== item.id))
                  } finally {
                    uploadingPendingIds.current.delete(item.id)
                  }
                }
              } catch {
                alert(t('construction.projects.uploadPhotoError'))
              } finally {
                setUploading(false)
              }
            }}
          />}
        </CardContent>
      </Card>
    </section>
  )
}
