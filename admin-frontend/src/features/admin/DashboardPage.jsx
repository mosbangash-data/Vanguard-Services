import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/authContext'
import { useLanguage } from '../../i18n/useLanguage'
import { getDashboardOverview } from './dashboardApi'

export function DashboardPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const { data, isPending, isError } = useQuery({ queryKey: ['dashboard-overview'], queryFn: getDashboardOverview })
  if (isPending) return <section className="page"><p>{t('dashboard.loading')}</p></section>
  if (isError) return <section className="page"><p className="error">{t('dashboard.errorState')}</p></section>
  const stats = [
    [t('dashboard.trips'), Object.values(data.trips || {}).reduce((a, b) => a + Number(b || 0), 0)],
    [t('dashboard.todayReservations'), data.reservationsToday],
    [t('dashboard.totalReservations'), data.totalReservations],
    [t('dashboard.revenueTotal'), data.revenue],
  ]
  return <section className="page"><h1>{t('dashboard.globalTitle')}</h1><p>{t('agent.greeting').replace('{name}', user?.firstName || '')}</p><div className="stats">{stats.map(([label, value]) => <article key={label}><small>{label}</small><strong>{value ?? 0}</strong></article>)}</div></section>
}
