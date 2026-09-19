import React, { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { api, uploadMedia } from '../../services/api'
import { useAuth } from '../auth/authContext'
import { hasPermission } from '../auth/permissions'
import { MediaUploader } from '../../components/media/MediaUploader'
import { resolveMediaUrl } from '../../utils/media'

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

  const uploadProjectPhoto = async (file, order, shouldSetPrimary) => {
    const media = await uploadMedia(file, {
      department: 'CONSTRUCTION',
      entityType: 'project',
      entityId: id,
    })

    const createRes = await api.post(`/api/construction/projects/${id}/gallery`, {
      mediaId: media.id,
      caption: file.name,
      order,
    })

    if (shouldSetPrimary && createRes.data?.data?.gallery?.id) {
      await api.post(`/api/construction/projects/${id}/gallery/${createRes.data.data.gallery.id}/set-primary`)
    }

    queryClient.invalidateQueries({ queryKey: ['project-gallery', id] })
    queryClient.invalidateQueries({ queryKey: ['project', id] })
  }

  const setPrimaryProjectPhoto = async (galleryId) => {
    try {
      await api.post(`/api/construction/projects/${id}/gallery/${galleryId}/set-primary`)
      queryClient.invalidateQueries({ queryKey: ['project-gallery', id] })
      queryClient.invalidateQueries({ queryKey: ['project', id] })
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur lors de la définition de la photo principale.')
    }
  }

  const deleteProjectPhoto = async (galleryId) => {
    if (!window.confirm('Voulez-vous supprimer cette photo ?')) return
    try {
      await api.delete(`/api/construction/projects/${id}/gallery/${galleryId}`)
      queryClient.invalidateQueries({ queryKey: ['project-gallery', id] })
      queryClient.invalidateQueries({ queryKey: ['project', id] })
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur lors de la suppression de la photo.')
    }
  }

  if (project.isPending) return <section className="page"><p>Chargement…</p></section>
  if (project.isError) return <section className="page"><p className="error">Impossible de charger ce projet.</p></section>

  const existingMedia = galleryList.map((item) => ({
    id: item.id,
    url: resolveMediaUrl(item.media?.secureUrl || item.media?.url),
    isPrimary: item.order === 0,
    caption: item.caption,
    order: item.order,
  }))

  const primaryPhoto = existingMedia.find((m) => m.isPrimary) || existingMedia[0]

  return (
    <section className="page" style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Link to="/construction/projects" style={{ color: '#2563EB', textDecoration: 'none', fontWeight: 600, fontSize: '0.875rem' }}>
          ← Retour aux projets
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#0F172A' }}>
          {projectData.title || projectData.name || 'Projet'}
        </h1>
        {canUpdate && (
          <Link
            to={`/construction/projects/${id}/edit`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              padding: '8px 16px',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            Modifier le projet
          </Link>
        )}
      </div>

      {primaryPhoto && (
        <div style={{ width: '100%', height: '280px', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px', backgroundColor: '#0F172A' }}>
          <img
            src={primaryPhoto.url}
            alt={projectData.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <div className="card" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '20px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '1.1rem', color: '#0F172A' }}>Informations principales</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.875rem' }}>
            <li><strong style={{ color: '#475569' }}>Statut :</strong> <span style={{ fontWeight: 600, color: '#0F172A' }}>{projectData.status || '—'}</span></li>
            <li><strong style={{ color: '#475569' }}>Publication :</strong> <span style={{ fontWeight: 600, color: '#0F172A' }}>{projectData.publicationStatus || '—'}</span></li>
            <li><strong style={{ color: '#475569' }}>Localisation :</strong> <span style={{ color: '#0F172A' }}>{projectData.location || '—'}</span></li>
            <li><strong style={{ color: '#475569' }}>Budget :</strong> <span style={{ fontWeight: 700, color: '#0F172A' }}>{projectData.budget !== undefined && projectData.budget !== null ? `${projectData.budget} USD` : '—'}</span></li>
          </ul>
          <div style={{ marginTop: '16px', borderTop: '1px solid #F1F5F9', paddingTop: '12px' }}>
            <strong style={{ fontSize: '0.8125rem', color: '#64748B' }}>Description :</strong>
            <p style={{ margin: '6px 0 0', fontSize: '0.875rem', color: '#334155', lineHeight: 1.5 }}>
              {projectData.description || 'Aucune description.'}
            </p>
          </div>
        </div>

        <div className="card" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '20px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '1.1rem', color: '#0F172A' }}>Mises à jour ({updateList.length})</h2>
          {updates.isPending ? (
            <p style={{ color: '#64748B', fontSize: '0.875rem' }}>Chargement…</p>
          ) : updateList.length === 0 ? (
            <p style={{ color: '#94A3B8', fontSize: '0.875rem' }}>Aucune mise à jour pour ce projet.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {updateList.map((item) => (
                <li key={item.id || item.title} style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
                  <strong style={{ fontSize: '0.875rem', color: '#0F172A' }}>{item.title || 'Mise à jour'}</strong>
                  <div style={{ fontSize: '0.8125rem', color: '#475569', marginTop: '2px' }}>{item.description || 'Aucune description.'}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Galerie & Photos du projet */}
      <div className="card" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '20px' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '1.1rem', color: '#0F172A' }}>
          Galerie & Photos ({galleryList.length})
        </h2>
        <MediaUploader
          label="Photos du projet"
          helperText="Formats acceptés : JPEG, PNG, WEBP, GIF. Max 10 Mo par photo."
          existingMedia={existingMedia}
          pendingFiles={pendingMedia}
          onSetPrimary={canUpdate ? setPrimaryProjectPhoto : null}
          onDeleteExisting={canUpdate ? deleteProjectPhoto : null}
          isUploading={uploading}
          uploadProgressText="Téléversement de la photo en cours…"
          disabled={!canUpdate}
          onPendingChange={async (newPending) => {
            if (!canUpdate) return
            setPendingMedia(newPending)
            if (newPending.length === 0) return
            setUploading(true)
            try {
              for (const [index, item] of newPending.entries()) {
                if (item.file && !uploadingPendingIds.current.has(item.id)) {
                  uploadingPendingIds.current.add(item.id)
                  try {
                    await uploadProjectPhoto(
                      item.file,
                      galleryList.length + index,
                      galleryList.length === 0 && index === 0,
                    )
                    setPendingMedia((current) => current.filter((pending) => pending.id !== item.id))
                  } finally {
                    uploadingPendingIds.current.delete(item.id)
                  }
                }
              }
            } catch (err) {
              alert(err.response?.data?.message || 'Erreur lors de l’envoi de la photo.')
            } finally {
              setUploading(false)
            }
          }}
        />
      </div>
    </section>
  )
}
