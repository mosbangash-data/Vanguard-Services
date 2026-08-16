import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../services/api'
import {
  Search,
  RefreshCw,
  Eye,
  X,
  AlertTriangle,
} from 'lucide-react'

async function fetchAuditLogs({ page, limit }) {
  const response = await api.get('/api/audit-logs', { params: { page, limit } })
  return response.data?.data || { items: [], total: 0, page: 1, limit: 20 }
}

export function AuditLogsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [viewingLog, setViewingLog] = useState(null)

  const logsQuery = useQuery({
    queryKey: ['admin-audit-logs', page],
    queryFn: () => fetchAuditLogs({ page, limit: 20 }),
  })

  const rawItems = logsQuery.data?.items || []
  const totalLogs = logsQuery.data?.total || 0
  const totalPages = Math.ceil(totalLogs / 20) || 1

  // Filter items in memory if search query present
  const logsList = search
    ? rawItems.filter(
        (log) =>
          log.action?.toLowerCase().includes(search.toLowerCase()) ||
          log.actorId?.toLowerCase().includes(search.toLowerCase()) ||
          JSON.stringify(log.details || {}).toLowerCase().includes(search.toLowerCase())
      )
    : rawItems

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleString('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'medium',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Logs d’Audit</h1>
          <p>Journal d’historique de toutes les opérations sensibles effectuées sur la plateforme</p>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-filters">
          <div className="search-input-wrap">
            <Search />
            <input
              type="text"
              className="search-input"
              placeholder="Filtrer par action, utilisateur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <button type="button" className="button secondary sm" onClick={() => logsQuery.refetch()}>
          <RefreshCw size={14} />
          <span>Actualiser</span>
        </button>
      </div>

      <div className="table-container">
        {logsQuery.isPending ? (
          <div className="state-container">Chargement des logs d’audit...</div>
        ) : logsQuery.isError ? (
          <div className="state-container">
            <AlertTriangle size={32} />
            <p>Erreur lors du chargement des logs d’audit.</p>
            <button type="button" className="button secondary sm" onClick={() => logsQuery.refetch()}>
              Réessayer
            </button>
          </div>
        ) : logsList.length === 0 ? (
          <div className="state-container">Aucun log d’audit disponible.</div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date & Heure</th>
                    <th>Action</th>
                    <th>ID Acteur</th>
                    <th>Aperçu des détails</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {logsList.map((log) => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(log.createdAt)}</td>
                      <td>
                        <span className="badge info">{log.action}</span>
                      </td>
                      <td>
                        <code>{log.actorId ? log.actorId.substring(0, 8) + '...' : 'Système'}</code>
                      </td>
                      <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {JSON.stringify(log.details || {})}
                      </td>
                      <td>
                        <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="action-btn"
                            title="Inspecter"
                            onClick={() => setViewingLog(log)}
                          >
                            <Eye size={14} />
                            <span>Détails</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination-wrap">
              <span>
                Page {page} sur {totalPages} ({totalLogs} événements au total)
              </span>
              <div className="pagination-controls">
                <button
                  type="button"
                  className="button secondary sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Précédent
                </button>
                <button
                  type="button"
                  className="button secondary sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Suivant
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal Detail Inspection */}
      {viewingLog && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">Détails du Log d’Audit</h3>
              <button type="button" className="modal-close" onClick={() => setViewingLog(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p><strong>ID Log :</strong> {viewingLog.id}</p>
              <p><strong>Action :</strong> {viewingLog.action}</p>
              <p><strong>ID Acteur :</strong> {viewingLog.actorId || 'Système'}</p>
              <p><strong>Date & Heure :</strong> {formatDate(viewingLog.createdAt)}</p>
              <div className="form-group" style={{ marginTop: '14px' }}>
                <label className="form-label">Détails JSON :</label>
                <pre
                  style={{
                    background: '#F8FAFC',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.82rem',
                    overflowX: 'auto',
                  }}
                >
                  {JSON.stringify(viewingLog.details || {}, null, 2)}
                </pre>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="button secondary" onClick={() => setViewingLog(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
