import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../services/api'
import {
  Plus,
  RefreshCw,
  CheckCircle,
  X,
  AlertTriangle,
} from 'lucide-react'

async function fetchNotifications() {
  const response = await api.get('/api/notifications')
  return response.data?.data?.items || response.data?.items || response.data || []
}

async function fetchUsersList() {
  const response = await api.get('/api/users?limit=100')
  return response.data?.data?.items || []
}

export function NotificationsPage() {
  const queryClient = useQueryClient()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [filterRead, setFilterRead] = useState('')

  const [createForm, setCreateForm] = useState({
    userId: '',
    title: '',
    message: '',
    channel: 'IN_APP',
    recipientEmail: '',
    recipientPhone: '',
  })
  const [formError, setFormError] = useState('')

  const notificationsQuery = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: fetchNotifications,
  })

  const usersQuery = useQuery({
    queryKey: ['admin-users-select'],
    queryFn: fetchUsersList,
    enabled: isCreateOpen,
  })

  const markReadMutation = useMutation({
    mutationFn: async (id) => {
      const response = await api.put(`/api/notifications/${id}/read`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] })
    },
    onError: (err) => {
      alert(err?.response?.data?.message || 'Échec du marquage comme lue.')
    },
  })

  const createNotificationMutation = useMutation({
    mutationFn: async (data) => {
      const payload = { ...data }
      if (!payload.userId) delete payload.userId
      const response = await api.post('/api/notifications', payload)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] })
      setIsCreateOpen(false)
      setCreateForm({
        userId: '',
        title: '',
        message: '',
        channel: 'IN_APP',
        recipientEmail: '',
        recipientPhone: '',
      })
      setFormError('')
    },
    onError: (err) => {
      setFormError(err?.response?.data?.message || 'Échec de l’envoi de la notification.')
    },
  })

  const rawNotifications = notificationsQuery.data || []
  const notificationsList = filterRead === ''
    ? rawNotifications
    : filterRead === 'unread'
    ? rawNotifications.filter((n) => !n.isRead)
    : rawNotifications.filter((n) => n.isRead)

  const usersList = usersQuery.data || []

  const handleCreateSubmit = (e) => {
    e.preventDefault()
    setFormError('')
    if (!createForm.title || !createForm.message) {
      setFormError('Le titre et le message sont obligatoires.')
      return
    }
    createNotificationMutation.mutate(createForm)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleString('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Notifications</h1>
          <p>Centre d’alertes et diffusion de notifications système</p>
        </div>
        <button type="button" className="button" onClick={() => { setIsCreateOpen(true); setFormError('') }}>
          <Plus size={16} />
          <span>Envoyer une notification</span>
        </button>
      </div>

      <div className="toolbar">
        <div className="toolbar-filters">
          <select
            className="select-filter"
            value={filterRead}
            onChange={(e) => setFilterRead(e.target.value)}
          >
            <option value="">Toutes les notifications</option>
            <option value="unread">Non lues uniquement</option>
            <option value="read">Lues uniquement</option>
          </select>
        </div>
        <button type="button" className="button secondary sm" onClick={() => notificationsQuery.refetch()}>
          <RefreshCw size={14} />
          <span>Actualiser</span>
        </button>
      </div>

      <div className="table-container">
        {notificationsQuery.isPending ? (
          <div className="state-container">Chargement des notifications...</div>
        ) : notificationsQuery.isError ? (
          <div className="state-container">
            <AlertTriangle size={32} />
            <p>Erreur lors du chargement des notifications.</p>
            <button type="button" className="button secondary sm" onClick={() => notificationsQuery.refetch()}>
              Réessayer
            </button>
          </div>
        ) : notificationsList.length === 0 ? (
          <div className="state-container">Aucune notification disponible.</div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Titre & Message</th>
                  <th>Canal</th>
                  <th>Statut</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {notificationsList.map((n) => (
                  <tr key={n.id}>
                    <td>
                      <div>
                        <strong>{n.title}</strong>
                        <div style={{ fontSize: '0.84rem', color: 'var(--color-medium-gray)', marginTop: '2px' }}>
                          {n.message}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge info">{n.channel || 'IN_APP'}</span>
                    </td>
                    <td>
                      <span className={`badge ${n.isRead ? 'gray' : 'warning'}`}>
                        {n.isRead ? 'Lue' : 'Non lue'}
                      </span>
                    </td>
                    <td>{formatDate(n.createdAt)}</td>
                    <td>
                      <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                        {!n.isRead && (
                          <button
                            type="button"
                            className="action-btn"
                            title="Marquer comme lue"
                            onClick={() => markReadMutation.mutate(n.id)}
                            disabled={markReadMutation.isPending}
                          >
                            <CheckCircle size={14} />
                            <span>Marquer comme lue</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Create Notification */}
      {isCreateOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">Envoyer une Notification</h3>
              <button type="button" className="modal-close" onClick={() => setIsCreateOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                {formError && <div className="alert alert-danger">{formError}</div>}
                
                <div className="form-group">
                  <label className="form-label">Destinataire (optionnel)</label>
                  <select
                    className="form-control"
                    value={createForm.userId}
                    onChange={(e) => setCreateForm({ ...createForm, userId: e.target.value })}
                  >
                    <option value="">Moi-même / Tous les admins</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Canal de diffusion</label>
                  <select
                    className="form-control"
                    value={createForm.channel}
                    onChange={(e) => setCreateForm({ ...createForm, channel: e.target.value })}
                  >
                    <option value="IN_APP">En application (IN_APP)</option>
                    <option value="EMAIL">Email</option>
                    <option value="SMS">SMS</option>
                    <option value="WHATSAPP">WhatsApp</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Titre *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Message *</label>
                  <textarea
                    className="form-control"
                    rows="4"
                    required
                    value={createForm.message}
                    onChange={(e) => setCreateForm({ ...createForm, message: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="button secondary" onClick={() => setIsCreateOpen(false)}>
                  Annuler
                </button>
                <button type="submit" className="button" disabled={createNotificationMutation.isPending}>
                  {createNotificationMutation.isPending ? 'Envoi...' : 'Envoyer la notification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
