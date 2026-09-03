import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import {
  HardHat,
  Building2,
  FileSpreadsheet,
  FileText,
  Plus,
  RefreshCw,
  Layers,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { useLanguage } from '../../i18n/useLanguage'
import { api } from '../../services/api'
import {
  PageHeader,
  StatCard,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  StatusBadge,
  LoadingState,
  ErrorState,
} from '../../components/ui'

async function fetchConstructionOverview() {
  const response = await api.get('/api/dashboard/overview')
  return response.data?.data || response.data || {}
}

const formatNumber = (value, lang = 'fr') => {
  const numeric = Number(value || 0)
  if (!Number.isFinite(numeric)) return '0'
  return new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR').format(numeric)
}

export function ConstructionDashboardPage() {
  const { lang, t } = useLanguage()
  const navigate = useNavigate()

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['construction-dashboard-overview'],
    queryFn: fetchConstructionOverview,
  })

  if (isPending) {
    return (
      <div className="page vanguard-construction-dashboard">
        <PageHeader
          eyebrow="VANGUARD SERVICES · CONSTRUCTION"
          title="Dashboard Construction"
          subtitle="Chargement des indicateurs chantiers & devis..."
        />
        <LoadingState type="cards" cardCount={4} />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="page vanguard-construction-dashboard">
        <PageHeader
          eyebrow="VANGUARD SERVICES · CONSTRUCTION"
          title="Dashboard Construction"
          subtitle="Supervision des chantiers, demandes clients et devis."
        />
        <ErrorState
          title="Impossible de charger le tableau de bord Construction"
          message={error?.response?.data?.message || 'Une erreur est survenue lors de la récupération des données de construction.'}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  const overview = data || {}
  const construction = overview.construction || {}

  const totalProjects = construction.projects?.total || 0
  const inProgressProjects = construction.projects?.IN_PROGRESS || construction.projects?.PUBLISHED || 0
  const completedProjects = construction.projects?.COMPLETED || construction.projects?.ARCHIVED || 0
  const quoteRequestsCount = construction.quoteRequests?.total || construction.quoteRequests?.NEW || 0

  return (
    <div className="page vanguard-construction-dashboard">
      <PageHeader
        eyebrow="VANGUARD SERVICES · CONSTRUCTION & BTP"
        title="Dashboard Construction"
        subtitle="Pilotage opérationnel des chantiers, ingénieurs, demandes clients et devis."
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              loading={isFetching}
              onClick={() => refetch()}
            >
              Actualiser
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => navigate('/construction/projects/new')}
            >
              Nouveau Projet
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="vanguard-stats-grid">
        <StatCard
          title="Total Projets"
          value={formatNumber(totalProjects, lang)}
          subtitle="Tous chantiers confondus"
          icon={Building2}
          accent="construction"
          onClick={() => navigate('/construction/projects')}
        />
        <StatCard
          title="Chantiers en Cours"
          value={formatNumber(inProgressProjects, lang)}
          subtitle="Projets actifs sur le terrain"
          icon={TrendingUp}
          accent="primary"
          onClick={() => navigate('/construction/projects')}
        />
        <StatCard
          title="Projets Livrés"
          value={formatNumber(completedProjects, lang)}
          subtitle="Chantiers finalisés"
          icon={CheckCircle2}
          accent="revenue"
          onClick={() => navigate('/construction/projects')}
        />
        <StatCard
          title="Demandes de Devis"
          value={formatNumber(quoteRequestsCount, lang)}
          subtitle="Nouvelles demandes à chiffrer"
          icon={FileText}
          accent="warning"
          onClick={() => navigate('/construction/quote-requests')}
        />
      </div>

      {/* Quick Actions Card */}
      <Card style={{ marginBottom: '24px' }}>
        <CardHeader style={{ padding: '14px 20px' }}>
          <CardTitle style={{ fontSize: '0.95rem' }}>Gestion & Chantiers</CardTitle>
        </CardHeader>
        <CardContent style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <Button
              variant="outline"
              size="sm"
              icon={Building2}
              onClick={() => navigate('/construction/projects')}
            >
              Liste des projets
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={Layers}
              onClick={() => navigate('/construction/templates')}
            >
              Projets Templates
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={FileSpreadsheet}
              onClick={() => navigate('/construction/customer-requests')}
            >
              Demandes clients
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={FileText}
              onClick={() => navigate('/construction/quote-requests')}
            >
              Devis & Estimations
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Status Breakdown Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Projects Breakdown */}
        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HardHat size={18} color="#EA580C" />
                <CardTitle>État des Chantiers</CardTitle>
              </div>
              <Link to="/construction/projects" style={{ fontSize: '0.8125rem', color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}>
                Gérer →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.84rem', color: '#475569' }}>En cours de réalisation</span>
                <StatusBadge label={`${inProgressProjects} chantier(s)`} variant="primary" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.84rem', color: '#475569' }}>Chantiers terminés / livrés</span>
                <StatusBadge label={`${completedProjects} projet(s)`} variant="success" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.84rem', color: '#475569' }}>Brouillons / En préparation</span>
                <StatusBadge label={`${construction.projects?.DRAFT || 0} projet(s)`} variant="neutral" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quotes & Customer Requests */}
        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="#2563EB" />
                <CardTitle>Demandes & Devis</CardTitle>
              </div>
              <Link to="/construction/quote-requests" style={{ fontSize: '0.8125rem', color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}>
                Consulter →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.84rem', color: '#475569' }}>Nouvelles demandes de devis</span>
                <StatusBadge label={`${quoteRequestsCount} nouvelle(s)`} variant="warning" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.84rem', color: '#475569' }}>Demandes clients en attente</span>
                <StatusBadge label="Suivi actif" variant="info" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
