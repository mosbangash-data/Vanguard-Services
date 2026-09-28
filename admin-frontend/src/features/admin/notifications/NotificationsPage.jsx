import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../services/api'
import { useLanguage } from '../../../i18n/useLanguage'
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
  const { t, lang } = useLanguage()
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
      alert(err?.response?.data?.message || t('notificationUi.markReadFailed'))
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
      setFormError(err?.response?.data?.message || t('notificationUi.sendFailed'))
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
      setFormError(t('notificationUi.requiredFields'))
      return
    }
    createNotificationMutation.mutate(createForm)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR', {
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
          <h1>{t('notificationUi.title')}</h1>
          <p>{t('notificationUi.subtitle')}</p>
        </div>
        <button type="button" className="button" onClick={() => { setIsCreateOpen(true); setFormError('') }}>
          <Plus size={16} />
          <span>{t('notificationUi.send')}</span>
        </button>
      </div>

      <div className="toolbar">
        <div className="toolbar-filters">
          <select
            className="select-filter"
            value={filterRead}
            onChange={(e) => setFilterRead(e.target.value)}
          >
            <option value="">{t('notificationUi.all')}</option>
            <option value="unread">{t('notificationUi.unreadOnly')}</option>
            <option value="read">{t('notificationUi.readOnly')}</option>
          </select>
        </div>
        <button type="button" className="button secondary sm" onClick={() => notificationsQuery.refetch()}>
          <RefreshCw size={14} />
          <span>{t('commonUi.refresh')}</span>
        </button>
      </div>

      <div className="table-container">
        {notificationsQuery.isPending ? (
          <div className="state-container">{t('notificationUi.loading')}</div>
        ) : notificationsQuery.isError ? (
          <div className="state-container">
            <AlertTriangle size={32} />
            <p>{t('notificationUi.loadError')}</p>
            <button type="button" className="button secondary sm" onClick={() => notificationsQuery.refetch()}>
              {t('commonUi.retry')}
            </button>
          </div>
        ) : notificationsList.length === 0 ? (
          <div className="state-container">{t('notificationUi.empty')}</div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('notificationUi.titleAndMessage')}</th>
                  <th>{t('notificationUi.channel')}</th>
                  <th>{t('notificationUi.status')}</th>
                  <th>{t('notificationUi.date')}</th>
                  <th style={{ textAlign: 'right' }}>{t('notificationUi.actions')}</th>
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
                        {n.isRead ? t('notificationUi.read') : t('notificationUi.unread')}
                      </span>
                    </td>
                    <td>{formatDate(n.createdAt)}</td>
                    <td>
                      <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                        {!n.isRead && (
                          <button
                            type="button"
                            className="action-btn"
                            title={t('notificationUi.markRead')}
                            onClick={() => markReadMutation.mutate(n.id)}
                            disabled={markReadMutation.isPending}
                          >
                            <CheckCircle size={14} />
                            <span>{t('notificationUi.markRead')}</span>
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
              <h3 className="modal-title">{t('notificationUi.sendTitle')}</h3>
              <button type="button" className="modal-close" onClick={() => setIsCreateOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                {formError && <div className="alert alert-danger">{formError}</div>}
                
                <div className="form-group">
                  <label className="form-label">{t('notificationUi.recipientOptional')}</label>
                  <select
                    className="form-control"
                    value={createForm.userId}
                    onChange={(e) => setCreateForm({ ...createForm, userId: e.target.value })}
                  >
                    <option value="">{t('notificationUi.defaultRecipient')}</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">{t('notificationUi.channel')}</label>
                  <select
                    className="form-control"
                    value={createForm.channel}
                    onChange={(e) => setCreateForm({ ...createForm, channel: e.target.value })}
                  >
                    <option value="IN_APP">{t('notificationUi.inApp')}</option>
                    <option value="EMAIL">Email</option>
                    <option value="SMS">SMS</option>
                    <option value="WHATSAPP">WhatsApp</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">{t('notificationUi.titleLabel')} *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">{t('notificationUi.message')} *</label>
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
                  {t('commonUi.cancel')}
                </button>
                <button type="submit" className="button" disabled={createNotificationMutation.isPending}>
                  {createNotificationMutation.isPending ? t('notificationUi.sending') : t('notificationUi.send')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
