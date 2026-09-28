import { useQuery } from '@tanstack/react-query'
import { Bell, Building2, CarFront, ClipboardList, Gauge, Landmark, Menu, ShieldCheck, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDashboardOverview } from './dashboardApi'
import { useLanguage } from '../../i18n/useLanguage'

const navigation = [
  { key: 'dashboard', icon: Gauge, active: true },
  { key: 'users', icon: Users },
  { key: 'roles', icon: ShieldCheck },
  { key: 'departments', icon: Building2 },
  { key: 'audit', icon: ClipboardList },
  { key: 'notifications', icon: Bell },
]

const serviceCards = [
  { key: 'coach', detailKey: 'transport', icon: Landmark },
  { key: 'construction', detailKey: 'construction', icon: Building2 },
  { key: 'automobile', detailKey: 'automobile', icon: CarFront },
]

const formatNumber = (value, lang) => new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR').format(Number(value || 0))
const formatRevenue = (value, lang) => new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR', { maximumFractionDigits: 2 }).format(Number(value || 0))

function OverviewSkeleton() {
  return <div className="stats-grid" aria-label="Chargement des statistiques">{Array.from({ length: 4 }, (_, index) => <div className="stat-card skeleton-card" key={index}><span /><span /><span /></div>)}</div>
}

export function AdminDashboardPage({ user }) {
  const { t, lang } = useLanguage()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()
  const { data, error, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: getDashboardOverview,
  })
  useEffect(() => {
    if (error?.response?.status === 401) navigate('/admin/login', { replace: true })
  }, [error, navigate])
  const tripTotal = data ? Object.values(data.trips || {}).reduce((sum, count) => sum + Number(count || 0), 0) : 0
  const stats = data ? [
    { label: t('adminHome.trips'), value: formatNumber(tripTotal, lang) },
    { label: t('adminHome.todayReservations'), value: formatNumber(data.reservationsToday, lang) },
    { label: t('adminHome.totalReservations'), value: formatNumber(data.totalReservations, lang) },
    { label: t('adminHome.revenue'), value: formatRevenue(data.revenue, lang) },
  ] : []

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${mobileMenuOpen ? 'is-open' : ''}`} aria-label={t('adminHome.navigation')}>
        <div className="sidebar-top"><span className="sidebar-brand">VANGUARD SERVICES</span><button className="sidebar-close" type="button" onClick={() => setMobileMenuOpen(false)} aria-label={t('layout.closeMenu')}><X size={20} /></button></div>
        <p className="sidebar-context">{t('navigation.sections.admin')}</p>
        <nav className="sidebar-nav">
          {navigation.map(({ key, icon: Icon, active }) => active ? <span className="nav-item is-active" key={key}><Icon size={18} />{t(`adminHome.navigationItems.${key}`)}</span> : <button className="nav-item" type="button" key={key} disabled title={t('adminHome.comingSoon')}><Icon size={18} />{t(`adminHome.navigationItems.${key}`)}</button>)}
        </nav>
      </aside>
      {mobileMenuOpen && <button className="sidebar-overlay" type="button" aria-label={t('layout.closeMenu')} onClick={() => setMobileMenuOpen(false)} />}
      <div className="admin-main">
        <header className="admin-header">
          <div className="header-title"><button className="menu-button" type="button" onClick={() => setMobileMenuOpen(true)} aria-label={t('layout.openMenu')}><Menu size={20} /></button><div><p className="eyebrow">{t('adminHome.globalAdministration')}</p><h1>{t('adminHome.title')}</h1></div></div>
          <div className="user-summary"><span className="user-initial" aria-hidden="true">{user.firstName?.slice(0, 1).toUpperCase()}</span><span><strong>{user.firstName} {user.lastName}</strong><small>{t('adminHome.superAdmin')}</small></span></div>
        </header>
        <main className="dashboard-content">
          <section className="dashboard-intro"><h2>{t('adminHome.welcome').replace('{name}', user.firstName)}</h2><p>{t('adminHome.subtitle')}</p></section>
          {isPending ? <OverviewSkeleton /> : isError ? <section className="dashboard-error" role="alert"><p>{t('adminHome.loadError')}</p><button type="button" onClick={() => refetch()} disabled={isFetching}>{t('dashboard.retry')}</button></section> : <section className="stats-grid" aria-label={t('adminHome.statsLabel')}>{stats.map((stat) => <article className="stat-card" key={stat.label}><p>{stat.label}</p><strong>{stat.value}</strong></article>)}</section>}
          <section className="services-section"><div className="section-heading"><div><p className="eyebrow">{t('adminHome.services')}</p><h2>{t('adminHome.departments')}</h2></div></div><div className="services-grid">{serviceCards.map(({ key, detailKey, icon: Icon }) => <article className="service-card" key={key}><Icon size={20} aria-hidden="true" /><div><h3>{t(`adminHome.servicesItems.${key}`)}</h3><p>{t(`adminHome.serviceDetails.${detailKey}`)}</p></div></article>)}</div></section>
        </main>
      </div>
    </div>
  )
}
