import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../services/api'

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
  const project = useQuery({ queryKey: ['project', id], queryFn: () => get(`/api/construction/projects/${id}`) })
  const updates = useQuery({ queryKey: ['project-updates', id], queryFn: () => get(`/api/construction/projects/${id}/updates`) })
  const gallery = useQuery({ queryKey: ['project-gallery', id], queryFn: () => get(`/api/construction/projects/${id}/gallery`) })

  const projectData = project.data?.project || project.data || {}
  const updateList = toList(updates.data)
  const galleryList = toList(gallery.data)

  if (project.isPending) return <section className="page"><p>Chargement…</p></section>
  if (project.isError) return <section className="page"><p className="error">Impossible de charger ce projet.</p></section>

  return (
    <section className="page">
      <Link to="/construction/projects">← Projets</Link>
      <h1>{projectData.title || projectData.name || 'Projet'}</h1>

      <div className="card">
        <h2>Informations principales</h2>
        <ul>
          <li><strong>Statut :</strong> {projectData.status || '—'}</li>
          <li><strong>Publication :</strong> {projectData.publicationStatus || '—'}</li>
          <li><strong>Localisation :</strong> {projectData.location || '—'}</li>
          <li><strong>Budget :</strong> {projectData.budget !== undefined && projectData.budget !== null ? `${projectData.budget} USD` : '—'}</li>
        </ul>
        <p><strong>Description :</strong> {projectData.description || 'Aucune description.'}</p>
      </div>

      <div className="card">
        <h2>Mises à jour</h2>
        {updates.isPending ? <p>Chargement…</p> : updateList.length === 0 ? <p className="empty">Aucune mise à jour.</p> : (
          <ul>
            {updateList.map((item) => (
              <li key={item.id || item.title}>
                <strong>{item.title || 'Mise à jour'}</strong>
                <div>{item.description || 'Aucune description.'}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2>Galerie</h2>
        {gallery.isPending ? <p>Chargement…</p> : galleryList.length === 0 ? <p className="empty">Aucune image dans la galerie.</p> : (
          <ul>
            {galleryList.map((item) => (
              <li key={item.id || item.mediaId}>
                <strong>{item.caption || 'Image'}</strong>
                {item.mediaUrl ? <div><img src={item.mediaUrl} alt={item.caption || 'Project media'} style={{ maxWidth: 220, display: 'block', marginTop: 8 }} /></div> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
