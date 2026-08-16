import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  Banknote,
  Building2,
  Bus,
  CalendarCheck,
  CarFront,
  FileText,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useLanguage } from '../../../i18n/useLanguage'
import { api } from '../../../services/api'

async function fetchDashboardOverview() {
  const response = await api.get('/api/dashboard/overview')
  return response.data
}

const formatNumber = (value, lang = 'fr') => {
  const numeric = Number(value || 0)
  if (!Number.isFinite(numeric)) return '0'
  return new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR').format(numeric)
}

const formatMoney = (value, currency, lang = 'fr') => {
  const numeric = Number(value || 0)
  if (!Number.isFinite(numeric)) return 'N/A'

  if (currency === 'CDF') {
    return `${new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(numeric)} CDF`
  }

  return `$ ${new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric)}`
}

const getStatusLabel = (status, t) => {
  const labels = {
    SCHEDULED: t('status.scheduled'),
    IN_PROGRESS: t('status.in_progress'),
    COMPLETED: t('status.completed'),
    CANCELLED: t('status.cancelled'),
    PENDING: t('status.pending'),
    CONFIRMED: t('status.confirmed'),
    VALID: t('status.valid'),
    USED: t('status.used'),
    VERIFIED: t('status.verified'),
    REJECTED: t('status.rejected'),
    AVAILABLE: t('status.available'),
    RESERVED: t('status.reserved'),
    SOLD: t('status.sold'),
    IN_MAINTENANCE: t('status.in_maintenance'),
    NEW: t('status.new'),
    CONTACTED: t('status.contacted'),
    CONVERTED: t('status.converted'),
    CLOSED: t('status.closed'),
    DRAFT: t('dashboard.draft'),
    PUBLISHED: t('dashboard.published'),
    ARCHIVED: t('dashboard.archived'),
    WAITING_FOR_CLIENT: t('dashboard.waitingForClient'),
    WAITING_CLIENT: t('dashboard.waitingForClient'),
    RESOLVED: t('dashboard.resolved'),
    EXPIRED: t('dashboard.expired'),
    OPEN: t('dashboard.open'),
    ACTIVE: t('dashboard.active'),
  }

  return labels[status] || status.replace(/_/g, ' ')
}

const hasAnyData = (value) => {
  if (typeof value === 'number') return value > 0
  if (Array.isArray(value)) return value.length > 0
  if (value && typeof value === 'object') {
    return Object.values(value).some((entry) => hasAnyData(entry))
  }
  return Boolean(value)
}

const summarizeTotals = (group) => {
  if (!group || typeof group !== 'object') return 0
  return Object.entries(group).reduce((sum, [key, value]) => {
    if (key === 'total') return sum
    return sum + Number(value || 0)
  }, 0)
}

function renderMoneyLine(value, currency, lang, t) {
  const label = currency === 'CDF' ? 'CDF' : 'USD'
  const formatted = formatMoney(value || 0, currency, lang)
  return (
    <div className="currency-box" key={currency}>
      <span>{label}</span>
      <strong>{formatted}</strong>
    </div>
  )
}

function StatCard({ label, value, sub, icon: Icon, accent = 'default' }) {
  return (
    <article className={`stat-card stat-card--${accent}`}>
      <div className="stat-header">
        <span>{label}</span>
        <Icon size={18} className="stat-icon" aria-hidden="true" />
      </div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </article>
  )
}

function StatusList({ values, t }) {
  const entries = Object.entries(values || {}).filter(([key]) => key !== 'total')
  if (!entries.length) return null

  return (
    <div className="status-grid">
      {entries.map(([key, count]) => (
        <div key={key} className="status-item">
          <span>{getStatusLabel(key, t)}</span>
          <strong>{formatNumber(count, 'fr')}</strong>
        </div>
      ))}
    </div>
  )
}

function ActivityList({ items, t }) {
  if (!items || !items.length) {
    return <div className="empty-state">{t('dashboard.noActivity')}</div>
  }

  return (
    <div className="activity-list">
      {items.map((item) => {
        const details = item.details && typeof item.details === 'object' ? JSON.stringify(item.details) : item.details
        return (
          <article key={item.id || `${item.action}-${item.createdAt}`} className="activity-item">
            <div className="activity-topline">
              <strong>{item.action || t('dashboard.activity')}</strong>
              <span>{new Date(item.createdAt).toLocaleString()}</span>
            </div>
            <div className="activity-meta">
              {item.actorId ? `${t('dashboard.actor')}: ${item.actorId}` : t('dashboard.system')}
            </div>
            {details ? <div className="activity-details">{details}</div> : null}
          </article>
        )
      })}
    </div>
  )
}

function DashboardSection({ title, icon: Icon, children, empty, hasData }) {
  return (
    <section className="dashboard-panel">
      <div className="panel-header">
        <div className="panel-title-wrap">
          <Icon size={18} className="panel-icon" aria-hidden="true" />
          <h2>{title}</h2>
        </div>
      </div>
      {hasData ? children : <div className="empty-state">{empty}</div>}
    </section>
  )
}

export function AdminDashboardPage() {
  const { lang, t } = useLanguage()
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['admin-dashboard-overview'],
    queryFn: fetchDashboardOverview,
  })

  if (isPending) {
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <h1>{t('dashboard.globalTitle')}</h1>
            <p>{t('dashboard.globalSubtitle')}</p>
          </div>
        </div>
        <div className="dashboard-stats-grid">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="stat-card skeleton-pulse">
              <div className="stat-header">
                <div className="skeleton-line" style={{ width: '60%', height: '16px' }} />
                <div className="skeleton-line" style={{ width: '18px', height: '18px', borderRadius: '50%' }} />
              </div>
              <div className="stat-value" style={{ margin: '16px 0 8px' }}>
                <div className="skeleton-line" style={{ width: '40%', height: '36px' }} />
              </div>
              <div className="stat-sub">
                <div className="skeleton-line" style={{ width: '80%', height: '14px' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (isError) {
    const errorMsg = error?.response?.data?.message || t('dashboard.errorState')
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <h1>{t('dashboard.globalTitle')}</h1>
            <p>{t('dashboard.globalSubtitle')}</p>
          </div>
        </div>
        <div className="state-container">
          <AlertTriangle size={36} style={{ color: 'var(--color-danger)' }} />
          <h3 style={{ margin: '12px 0 6px', color: 'var(--color-dark)' }}>{t('dashboard.errorTitle')}</h3>
          <p style={{ color: 'var(--color-medium-gray)', marginBottom: '16px' }}>{errorMsg}</p>
          <button type="button" className="button secondary" onClick={() => refetch()}>
            <RefreshCw size={16} />
            <span>{t('dashboard.retry')}</span>
          </button>
        </div>
      </div>
    )
  }

  const overview = data?.data || data || {}
  const global = overview.global || {}
  const transport = overview.transport || {}
  const construction = overview.construction || {}
  const autoSales = overview.autoSales || {}
  const revenue = overview.revenue || { USD: 0, CDF: 0 }
  const recentActivity = overview.recentActivity || []

  const globalCards = [
    {
      label: t('dashboard.activeAgents'),
      value: formatNumber(global.activeAgents, lang),
      sub: t('dashboard.globalAgentsSub'),
      icon: Users,
      accent: 'primary',
    },
    {
      label: t('dashboard.activeAdmins'),
      value: formatNumber(global.activeAdmins, lang),
      sub: t('dashboard.globalAdminsSub'),
      icon: ShieldCheck,
      accent: 'primary',
    },
    {
      label: t('dashboard.activeUsers'),
      value: formatNumber(global.activeUsers, lang),
      sub: t('dashboard.globalUsersSub'),
      icon: Users,
      accent: 'default',
    },
    {
      label: t('dashboard.revenueTotal'),
      value: formatMoney(revenue.USD || 0, 'USD', lang),
      sub: formatMoney(revenue.CDF || 0, 'CDF', lang),
      icon: Banknote,
      accent: 'revenue',
    },
  ]

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{t('dashboard.globalTitle')}</h1>
          <p>{t('dashboard.globalSubtitle')}</p>
        </div>
        <button type="button" className="button secondary sm" onClick={() => refetch()}>
          <RefreshCw size={14} />
          <span>{t('dashboard.refresh')}</span>
        </button>
      </div>

      <div className="dashboard-stats-grid">
        {globalCards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            sub={card.sub}
            icon={card.icon}
            accent={card.accent}
          />
        ))}
      </div>

      <DashboardSection
        title={t('dashboard.transportTitle')}
        icon={Bus}
        empty={t('dashboard.emptyState')}
        hasData={hasAnyData(transport)}
      >
        <div className="panel-grid">
          <div className="metric-card">
            <h3>{t('dashboard.trips')}</h3>
            <div className="metric-value">{formatNumber(transport.trips?.total || 0, lang)}</div>
            <StatusList values={transport.trips} t={t} />
          </div>
          <div className="metric-card">
            <h3>{t('dashboard.reservations')}</h3>
            <div className="metric-value">{formatNumber(transport.reservations?.total || 0, lang)}</div>
            <StatusList values={transport.reservations} t={t} />
          </div>
          <div className="metric-card">
            <h3>{t('dashboard.tickets')}</h3>
            <div className="metric-value">{formatNumber(transport.tickets?.total || 0, lang)}</div>
            <StatusList values={transport.tickets} t={t} />
          </div>
          <div className="metric-card">
            <h3>{t('dashboard.payments')}</h3>
            <div className="metric-value">{formatNumber(summarizeTotals(transport.payments), lang)}</div>
            <StatusList values={transport.payments} t={t} />
          </div>
        </div>
        <div className="revenue-boxes">
          {['USD', 'CDF'].map((currency) => renderMoneyLine(transport.revenue?.[currency], currency, lang, t))}
        </div>
      </DashboardSection>

      <DashboardSection
        title={t('dashboard.constructionTitle')}
        icon={Building2}
        empty={t('dashboard.emptyState')}
        hasData={hasAnyData(construction)}
      >
        <div className="panel-grid">
          <div className="metric-card">
            <h3>{t('dashboard.projects')}</h3>
            <div className="metric-value">{formatNumber(construction.projects?.total || 0, lang)}</div>
            <StatusList values={construction.projects} t={t} />
          </div>
          <div className="metric-card">
            <h3>{t('dashboard.quoteRequests')}</h3>
            <div className="metric-value">{formatNumber(construction.quoteRequests?.total || 0, lang)}</div>
            <StatusList values={construction.quoteRequests} t={t} />
          </div>
        </div>
      </DashboardSection>

      <DashboardSection
        title={t('dashboard.autoSalesTitle')}
        icon={CarFront}
        empty={t('dashboard.emptyState')}
        hasData={hasAnyData(autoSales)}
      >
        <div className="panel-grid">
          <div className="metric-card">
            <h3>{t('dashboard.vehicles')}</h3>
            <div className="metric-value">{formatNumber(autoSales.vehicles?.total || 0, lang)}</div>
            <StatusList values={autoSales.vehicles} t={t} />
          </div>
          <div className="metric-card">
            <h3>{t('dashboard.inquiries')}</h3>
            <div className="metric-value">{formatNumber(autoSales.inquiries?.total || 0, lang)}</div>
            <StatusList values={autoSales.inquiries} t={t} />
          </div>
          <div className="metric-card">
            <h3>{t('dashboard.reservations')}</h3>
            <div className="metric-value">{formatNumber(autoSales.reservations?.total || 0, lang)}</div>
            <StatusList values={autoSales.reservations} t={t} />
          </div>
          <div className="metric-card">
            <h3>{t('dashboard.payments')}</h3>
            <div className="metric-value">{formatNumber(summarizeTotals(autoSales.payments), lang)}</div>
            <StatusList values={autoSales.payments} t={t} />
          </div>
        </div>
        <div className="revenue-boxes">
          {['USD', 'CDF'].map((currency) => renderMoneyLine(autoSales.revenue?.[currency], currency, lang, t))}
        </div>
      </DashboardSection>

      <DashboardSection
        title={t('dashboard.revenueTitle')}
        icon={Banknote}
        empty={t('dashboard.emptyState')}
        hasData={hasAnyData(revenue)}
      >
        <div className="revenue-boxes">
          {['USD', 'CDF'].map((currency) => renderMoneyLine(revenue?.[currency], currency, lang, t))}
        </div>
      </DashboardSection>

      <DashboardSection
        title={t('dashboard.recentActivityTitle')}
        icon={Activity}
        empty={t('dashboard.noActivity')}
        hasData={recentActivity.length > 0}
      >
        <ActivityList items={recentActivity} t={t} />
      </DashboardSection>
    </div>
  )
}
