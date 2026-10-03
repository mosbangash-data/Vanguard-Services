import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw, Eye, ShieldAlert, Clock, User } from 'lucide-react'
import { api } from '../../../services/api'
import { useLanguage } from '../../../i18n/useLanguage'
import {
  PageHeader,
  Card,
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
  const { t, lang } = useLanguage()
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
      return new Date(dateStr).toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR', {
        dateStyle: 'short',
        timeStyle: 'medium',
      })
    } catch {
      return dateStr
    }
  }

  const getActionLabel = (action) => {
    const normalized = String(action || '').toLowerCase()
    const key = `auditUi.actions.${normalized}`
    const translated = t(key)
    if (translated !== key) return translated
    if (normalized.startsWith('create_')) return t('auditUi.actionCreated')
    if (normalized.startsWith('update_')) return t('auditUi.actionUpdated')
    if (normalized.startsWith('delete_')) return t('auditUi.actionDeleted')
    if (normalized.includes('login') || normalized.includes('auth')) return t('auditUi.actionLogin')
    return t('auditUi.actionSystem')
  }

  const getRoleLabel = (role) => {
    const key = `auditUi.roles.${String(role || '').toUpperCase()}`
    const translated = t(key)
    return translated === key ? t('auditUi.systemRole') : translated
  }

  const getActionBadgeVariant = (action) => {
    const act = String(action || '').toLowerCase()
    if (act.includes('delete') || act.includes('remove') || act.includes('suspend')) return 'danger'
    if (act.includes('create') || act.includes('add') || act.includes('register')) return 'success'
    if (act.includes('update') || act.includes('edit') || act.includes('patch')) return 'primary'
    if (act.includes('login') || act.includes('auth')) return 'info'
    return 'neutral'
  }

  const HIDDEN_DETAIL_KEYS = new Set(['userid', 'targetuserid', 'roleid', 'departmentid', 'permissionids', 'permissions', 'ipaddress', 'providertransactionid', 'providerreference'])
  const formatDetailLabel = (key) => {
    const normalized = key[0]?.toUpperCase() + key.slice(1)
    const label = t(`auditUi.detailFields.${normalized}`)
    return label === `auditUi.detailFields.${normalized}` ? t('auditUi.information') : label
  }
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
        eyebrow={t('auditUi.eyebrow')}
        title={t('auditUi.title')}
        subtitle={t('auditUi.subtitle')}
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            loading={isFetching}
            onClick={() => refetch()}
          >
            {t('commonUi.refresh')}
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
          placeholder={t('auditUi.searchPlaceholder')}
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
          <option value="ALL">{t('auditUi.allActions')}</option>
          <option value="login">{t('auditUi.logins')}</option>
          <option value="create_user">{t('auditUi.actions.create_user')}</option>
          <option value="update_user">{t('auditUi.actions.update_user')}</option>
          <option value="create_agency">{t('auditUi.actions.create_agency')}</option>
          <option value="update_agency">{t('auditUi.actions.update_agency')}</option>
          <option value="delete_agency">{t('auditUi.actions.delete_agency')}</option>
          <option value="create_vehicle">{t('auditUi.actions.create_vehicle')}</option>
          <option value="create_project">{t('auditUi.actions.create_project')}</option>
        </select>
      </FilterBar>

      {isPending ? (
        <LoadingState message={t('auditUi.loading')} />
      ) : isError ? (
        <ErrorState
          title={t('auditUi.loadError')}
          message={error?.response?.data?.message || t('auditUi.loadMessage')}
          onRetry={() => refetch()}
        />
      ) : rawItems.length === 0 ? (
        <EmptyState
          title={t('auditUi.emptyTitle')}
          description={t('auditUi.emptyDescription')}
          icon={ShieldAlert}
        />
      ) : (
        <Card>
          <div className="table-responsive">
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>{t('auditUi.dateTime')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>{t('auditUi.action')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>{t('auditUi.actor')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>{t('auditUi.detailsPreview')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>{t('auditUi.details')}</th>
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
                          <span>{log.actorId ? t('auditUi.platformUser') : t('auditUi.system')}</span>
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
                        {detailsPreview.length > 0 ? detailsPreview.join(' · ') : t('auditUi.noDetails')}
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
                          {t('auditUi.inspect')}
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
              {t('auditUi.pageSummary', { page, totalPages, total: totalLogs })}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t('commonUi.previous')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('commonUi.next')}
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
          title={t('auditUi.modalTitle')}
          subtitle={t('auditUi.modalSubtitle')}
          size="lg"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>{t('auditUi.action')}</span>
                <div style={{ marginTop: '4px' }}>
                  <StatusBadge label={getActionLabel(viewingLog.action)} variant={getActionBadgeVariant(viewingLog.action)} />
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>{t('auditUi.dateTime')}</span>
                <div style={{ marginTop: '4px', fontWeight: 600, color: '#0F172A', fontSize: '0.88rem' }}>
                  {formatDate(viewingLog.createdAt)}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>{t('auditUi.user')}</span>
                <div style={{ marginTop: '4px', fontWeight: 600, color: '#0F172A', fontSize: '0.88rem' }}>
                  {viewingLog.actorId ? t('auditUi.platformUser') : t('auditUi.automaticSystem')}
                </div>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>{t('auditUi.additionalInformation')}</span>
              <div style={{ marginTop: '6px', display: 'grid', gap: '8px' }}>
                {getReadableDetails(viewingLog.details).length > 0 ? getReadableDetails(viewingLog.details).map((detail) => (
                  <div key={detail} style={{ padding: '10px 12px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '0.84rem' }}>
                    {detail}
                  </div>
                )) : <p style={{ margin: 0, color: '#64748B' }}>{t('auditUi.noAdditionalInformation')}</p>}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid #E2E8F0' }}>
              <Button variant="secondary" onClick={() => setViewingLog(null)}>
                {t('commonUi.close')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
