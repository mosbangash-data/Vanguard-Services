import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, RefreshCw, Eye, X, ShieldAlert, FileCode2, Clock, User, Layers } from 'lucide-react'
import { api } from '../../../services/api'
import {
  PageHeader,
  Card,
  CardContent,
  FilterBar,
  SearchBar,
  Button,
  StatusBadge,
  Modal,
  LoadingState,
  ErrorState,
  EmptyState,
} from '../../../components/ui'

async function fetchAuditLogs({ page, limit, search, action }) {
  const params = { page, limit }
  if (search) params.search = search
  if (action && action !== 'ALL') params.action = action
  const response = await api.get('/api/audit-logs', { params })
  return response.data?.data || { items: [], total: 0, page: 1, limit: 20 }
}

export function AuditLogsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('ALL')
  const [viewingLog, setViewingLog] = useState(null)

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-audit-logs', page, search, actionFilter],
    queryFn: () => fetchAuditLogs({ page, limit: 20, search, action: actionFilter }),
  })

  const rawItems = data?.items || []
  const totalLogs = data?.total || 0
  const totalPages = Math.ceil(totalLogs / 20) || 1

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    try {
      return new Date(dateStr).toLocaleString('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'medium',
      })
    } catch {
      return dateStr
    }
  }

  const ACTION_LABELS = {
    login: 'Connexion',
    logout: 'Déconnexion',
    create_user: 'Création d’un utilisateur',
    update_user: 'Modification d’un utilisateur',
    delete_user: 'Suppression d’un utilisateur',
    create_project: 'Création d’un projet',
    update_project: 'Modification d’un projet',
    delete_project: 'Suppression d’un projet',
    create_agency: 'Création d’une agence',
    update_agency: 'Modification d’une agence',
    delete_agency: 'Suppression d’une agence',
    create_vehicle: 'Ajout d’un véhicule',
    update_vehicle: 'Modification d’un véhicule',
    delete_vehicle: 'Suppression d’un véhicule',
    create_customer_request: 'Création d’une demande client',
    update_customer_request: 'Modification d’une demande client',
    create_quote_request: 'Création d’une demande de devis',
    update_quote_request: 'Modification d’une demande de devis',
    create_reservation: 'Création d’une réservation',
    update_reservation: 'Modification d’une réservation',
    create_vehicle_inquiry: 'Création d’une demande véhicule',
    update_vehicle_inquiry: 'Modification d’une demande véhicule',
    assign_vehicle_inquiry: 'Attribution d’une demande véhicule',
    create_vehicle_reservation: 'Création d’une réservation véhicule',
    create_vehicle_payment: 'Création d’un paiement véhicule',
    update_role_permissions: 'Mise à jour des accès',
    forgot_password_requested: 'Demande de réinitialisation du mot de passe',
    reset_password_completed: 'Réinitialisation du mot de passe',
  }

  const getActionLabel = (action) => {
    const normalized = String(action || '').toLowerCase()
    if (ACTION_LABELS[normalized]) return ACTION_LABELS[normalized]
    if (normalized.startsWith('create_')) return 'Création d’une opération'
    if (normalized.startsWith('update_')) return 'Modification d’une opération'
    if (normalized.startsWith('delete_')) return 'Suppression d’une opération'
    if (normalized.includes('login') || normalized.includes('auth')) return 'Événement de connexion'
    return 'Action système'
  }

  const ROLE_LABELS = {
    SUPER_ADMIN: 'Administrateur système',
    ADMIN: 'Administrateur',
    SERVICE_ADMIN: 'Administrateur de service',
    MANAGER: 'Responsable',
    ENGINEER: 'Ingénieur',
    AGENT: 'Agent',
  }

  const getRoleLabel = (role) => ROLE_LABELS[String(role || '').toUpperCase()] || 'Rôle système'

  const getActionBadgeVariant = (action) => {
    const act = String(action || '').toLowerCase()
    if (act.includes('delete') || act.includes('remove') || act.includes('suspend')) return 'danger'
    if (act.includes('create') || act.includes('add') || act.includes('register')) return 'success'
    if (act.includes('update') || act.includes('edit') || act.includes('patch')) return 'primary'
    if (act.includes('login') || act.includes('auth')) return 'info'
    return 'neutral'
  }

  const DETAIL_LABELS = {
    role: 'Rôle',
    department: 'Service',
    departmentType: 'Service',
    status: 'Résultat',
    resultStatus: 'Résultat',
    description: 'Description',
    email: 'E-mail',
    firstName: 'Prénom',
    lastName: 'Nom',
    amount: 'Montant',
    currency: 'Devise',
  }
  const HIDDEN_DETAIL_KEYS = new Set(['userid', 'targetuserid', 'roleid', 'departmentid', 'permissionids', 'permissions', 'ipaddress', 'providertransactionid', 'providerreference'])
  const formatDetailLabel = (key) => DETAIL_LABELS[key] || 'Information'
  const getReadableDetails = (details) => {
    if (!details || typeof details !== 'object') return []
    return Object.entries(details)
      .filter(([key, value]) => !HIDDEN_DETAIL_KEYS.has(String(key).toLowerCase()) && value !== null && value !== undefined && typeof value !== 'object')
      .slice(0, 4)
      .map(([key, value]) => `${formatDetailLabel(key)} : ${key.toLowerCase() === 'role' ? getRoleLabel(value) : String(value)}`)
  }

  return (
    <div className="page vanguard-audit-page">
      <PageHeader
        eyebrow="VANGUARD SERVICES · SÉCURITÉ & AUDIT"
        title="Journal d’Audit Système"
        subtitle="Historique détaillé de toutes les actions, connexions et modifications sensibles."
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            loading={isFetching}
            onClick={() => refetch()}
          >
            Actualiser
          </Button>
        }
      />

      <FilterBar onRefresh={() => refetch()} isRefreshing={isFetching}>
        <SearchBar
          value={search}
          onChange={(val) => {
            setSearch(val)
            setPage(1)
          }}
          placeholder="Rechercher par action, utilisateur, ID..."
        />
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value)
            setPage(1)
          }}
          className="vanguard-select"
          style={{ width: 'auto', minWidth: '180px' }}
        >
          <option value="ALL">Toutes les actions</option>
          <option value="login">Connexions</option>
          <option value="create_user">Création utilisateur</option>
          <option value="update_user">Modification utilisateur</option>
          <option value="create_agency">Création agence</option>
          <option value="update_agency">Modification agence</option>
          <option value="delete_agency">Suppression agence</option>
          <option value="create_vehicle">Création véhicule</option>
          <option value="create_project">Création projet</option>
        </select>
      </FilterBar>

      {isPending ? (
        <LoadingState message="Chargement des événements d’audit..." />
      ) : isError ? (
        <ErrorState
          title="Erreur de chargement de l’audit"
          message={error?.response?.data?.message || 'Impossible de récupérer les journaux d’audit.'}
          onRetry={() => refetch()}
        />
      ) : rawItems.length === 0 ? (
        <EmptyState
          title="Aucun événement d’audit trouvé"
          description="Aucune opération ne correspond à vos critères de recherche ou de filtre."
          icon={ShieldAlert}
        />
      ) : (
        <Card>
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Date & Heure</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Action</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Acteur</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Aperçu des détails</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Détails</th>
                </tr>
              </thead>
              <tbody>
                {rawItems.map((log) => {
                  const detailsPreview = getReadableDetails(log.details)

                  return (
                    <tr
                      key={log.id}
                      style={{ borderBottom: '1px solid #E2E8F0', cursor: 'pointer' }}
                      onClick={() => setViewingLog(log)}
                    >
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', fontSize: '0.84rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
                          <Clock size={13} />
                          <span>{formatDate(log.createdAt)}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <StatusBadge
                          label={getActionLabel(log.action)}
                          variant={getActionBadgeVariant(log.action)}
                          dot={false}
                        />
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.84rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <User size={13} color="#64748B" />
                          <span>{log.actorId ? 'Utilisateur de la plateforme' : 'Système'}</span>
                        </div>
                      </td>
                      <td style={{
                        padding: '12px 16px',
                        maxWidth: '320px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: '0.8125rem',
                        color: '#64748B'
                      }}>
                        {detailsPreview.length > 0 ? detailsPreview.join(' · ') : 'Aucun détail complémentaire'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Eye}
                          onClick={(e) => {
                            e.stopPropagation()
                            setViewingLog(log)
                          }}
                        >
                          Inspecter
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div style={{
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid #E2E8F0',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <span style={{ fontSize: '0.8125rem', color: '#64748B' }}>
              Page <strong>{page}</strong> sur <strong>{totalPages}</strong> ({totalLogs} événements au total)
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Précédent
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Suivant
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Inspection Modal */}
      {viewingLog && (
        <Modal
          isOpen={Boolean(viewingLog)}
          onClose={() => setViewingLog(null)}
          title="Détails de l’événement d’audit"
          subtitle="Événement enregistré dans le journal de sécurité"
          size="lg"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Action</span>
                <div style={{ marginTop: '4px' }}>
                  <StatusBadge label={getActionLabel(viewingLog.action)} variant={getActionBadgeVariant(viewingLog.action)} />
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Date & Heure</span>
                <div style={{ marginTop: '4px', fontWeight: 600, color: '#0F172A', fontSize: '0.88rem' }}>
                  {formatDate(viewingLog.createdAt)}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Utilisateur</span>
                <div style={{ marginTop: '4px', fontWeight: 600, color: '#0F172A', fontSize: '0.88rem' }}>
                  {viewingLog.actorId ? 'Utilisateur de la plateforme' : 'Système (automatique)'}
                </div>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Informations complémentaires</span>
              <div style={{ marginTop: '6px', display: 'grid', gap: '8px' }}>
                {getReadableDetails(viewingLog.details).length > 0 ? getReadableDetails(viewingLog.details).map((detail) => (
                  <div key={detail} style={{ padding: '10px 12px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '0.84rem' }}>
                    {detail}
                  </div>
                )) : <p style={{ margin: 0, color: '#64748B' }}>Aucune information complémentaire disponible.</p>}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid #E2E8F0' }}>
              <Button variant="secondary" onClick={() => setViewingLog(null)}>
                Fermer
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
