import { useQuery } from '@tanstack/react-query'
import { Bell, Building2, CarFront, ClipboardList, Gauge, Landmark, Menu, ShieldCheck, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDashboardOverview } from './dashboardApi'

const navigation = [
  { label: 'Dashboard', icon: Gauge, active: true },
  { label: 'Utilisateurs', icon: Users },
  { label: 'Rôles & permissions', icon: ShieldCheck },
  { label: 'Départements', icon: Building2 },
  { label: 'Audit', icon: ClipboardList },
  { label: 'Notifications', icon: Bell },
]

const serviceCards = [
  { name: 'Vanguard Coach', detail: 'Transport', icon: Landmark },
  { name: 'Construction', detail: 'Construction', icon: Building2 },
  { name: 'Automobile', detail: 'Vente automobile', icon: CarFront },
]

const formatNumber = (value) => new Intl.NumberFormat('fr-FR').format(Number(value || 0))
const formatRevenue = (value) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(value || 0))

function OverviewSkeleton() {
  return <div className="stats-grid" aria-label="Chargement des statistiques">{Array.from({ length: 4 }, (_, index) => <div className="stat-card skeleton-card" key={index}><span /><span /><span /></div>)}</div>
}

export function AdminDashboardPage({ user }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()
  const { data, error, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: getDashboardOverview,
  })
  useEffect(() => {
    if (error?.response?.status === 401) navigate('/login', { replace: true })
  }, [error, navigate])
  const tripTotal = data ? Object.values(data.trips || {}).reduce((sum, count) => sum + Number(count || 0), 0) : 0
  const stats = data ? [
    { label: 'Voyages', value: formatNumber(tripTotal) },
    { label: 'Réservations aujourd’hui', value: formatNumber(data.reservationsToday) },
    { label: 'Réservations totales', value: formatNumber(data.totalReservations) },
    { label: 'Revenus', value: formatRevenue(data.revenue) },
  ] : []

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${mobileMenuOpen ? 'is-open' : ''}`} aria-label="Navigation administration">
        <div className="sidebar-top"><span className="sidebar-brand">VANGUARD SERVICES</span><button className="sidebar-close" type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Fermer le menu"><X size={20} /></button></div>
        <p className="sidebar-context">Administration</p>
        <nav className="sidebar-nav">
          {navigation.map(({ label, icon: Icon, active }) => active ? <span className="nav-item is-active" key={label}><Icon size={18} />{label}</span> : <button className="nav-item" type="button" key={label} disabled title="Fonctionnalité bientôt disponible"><Icon size={18} />{label}</button>)}
        </nav>
      </aside>
      {mobileMenuOpen && <button className="sidebar-overlay" type="button" aria-label="Fermer le menu" onClick={() => setMobileMenuOpen(false)} />}
      <div className="admin-main">
        <header className="admin-header">
          <div className="header-title"><button className="menu-button" type="button" onClick={() => setMobileMenuOpen(true)} aria-label="Ouvrir le menu"><Menu size={20} /></button><div><p className="eyebrow">Administration globale</p><h1>Dashboard</h1></div></div>
          <div className="user-summary"><span className="user-initial" aria-hidden="true">{user.firstName?.slice(0, 1).toUpperCase()}</span><span><strong>{user.firstName} {user.lastName}</strong><small>Super Administrateur</small></span></div>
        </header>
        <main className="dashboard-content">
          <section className="dashboard-intro"><h2>Bienvenue, {user.firstName}</h2><p>Vue d’ensemble de Vanguard Services.</p></section>
          {isPending ? <OverviewSkeleton /> : isError ? <section className="dashboard-error" role="alert"><p>Impossible de charger les statistiques.</p><button type="button" onClick={() => refetch()} disabled={isFetching}>Réessayer</button></section> : <section className="stats-grid" aria-label="Statistiques globales">{stats.map((stat) => <article className="stat-card" key={stat.label}><p>{stat.label}</p><strong>{stat.value}</strong></article>)}</section>}
          <section className="services-section"><div className="section-heading"><div><p className="eyebrow">Services</p><h2>Départements</h2></div></div><div className="services-grid">{serviceCards.map(({ name, detail, icon: Icon }) => <article className="service-card" key={name}><Icon size={20} aria-hidden="true" /><div><h3>{name}</h3><p>{detail}</p></div></article>)}</div></section>
        </main>
      </div>
    </div>
  )
}
