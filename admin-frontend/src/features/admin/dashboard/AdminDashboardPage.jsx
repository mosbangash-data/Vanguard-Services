import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import {
  Users,
  ShieldCheck,
  Building2,
  Bus,
  CarFront,
  HardHat,
  Banknote,
  FileText,
  UserPlus,
  Plus,
  ArrowRight,
  RefreshCw,
  Clock,
  Sparkles,
  Layers,
  Settings,
} from 'lucide-react'
import { useLanguage } from '../../../i18n/useLanguage'
import { api } from '../../../services/api'
import {
  PageHeader,
  StatCard,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  LoadingState,
  ErrorState,
} from '../../../components/ui'

async function fetchDashboardOverview() {
  const response = await api.get('/api/dashboard/overview')
  return response.data?.data || response.data
}

const formatNumber = (value, lang = 'fr') => {
  const numeric = Number(value || 0)
  if (!Number.isFinite(numeric)) return '0'
  return new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR').format(numeric)
}

const formatMoney = (value, currency, lang = 'fr') => {
  const numeric = Number(value || 0)
  if (!Number.isFinite(numeric)) return '0'

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

export function AdminDashboardPage() {
  const { lang, t } = useLanguage()
  const navigate = useNavigate()

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-dashboard-overview'],
    queryFn: fetchDashboardOverview,
  })

  if (isPending) {
    return (
      <div className="page vanguard-dashboard-page">
        <PageHeader
          eyebrow="VANGUARD SERVICES · SUPER ADMIN"
          title="Tableau de bord Global"
          subtitle="Chargement des indicateurs de performance de la plateforme..."
        />
        <LoadingState type="cards" cardCount={4} />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="page vanguard-dashboard-page">
        <PageHeader
          eyebrow="VANGUARD SERVICES · SUPER ADMIN"
          title="Tableau de bord Global"
          subtitle="Supervision consolidée de l’ensemble des départements Vanguard Services."
        />
        <ErrorState
          title="Impossible de charger le tableau de bord"
          message={error?.response?.data?.message || 'Une erreur est survenue lors de la récupération des statistiques globales.'}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  const overview = data || {}
  const global = overview.global || {}
  const transport = overview.transport || {}
  const construction = overview.construction || {}
  const autoSales = overview.autoSales || {}
  const revenue = overview.revenue || { USD: 0, CDF: 0 }

  return (
    <div className="page vanguard-dashboard-page">
      <PageHeader
        eyebrow="VANGUARD SERVICES · SUPER ADMIN"
        title="Tableau de bord Global"
        subtitle="Supervision consolidée et indicateurs clés de tous les départements Vanguard."
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

      {/* 1. Global Performance Metrics (Essential KPIs) */}
      <div className="vanguard-stats-grid">
        <StatCard
          title="Agents Actifs"
          value={formatNumber(global.activeAgents, lang)}
          subtitle="Tous départements"
          icon={Users}
          accent="primary"
          onClick={() => navigate('/admin/users')}
        />
        <StatCard
          title="Administrateurs"
          value={formatNumber(global.activeAdmins, lang)}
          subtitle="Super Admins & Modules"
          icon={ShieldCheck}
          accent="primary"
          onClick={() => navigate('/admin/users')}
        />
        <StatCard
          title="Revenus (USD)"
          value={formatMoney(revenue.USD || 0, 'USD', lang)}
          subtitle="Chiffre d’affaires global"
          icon={Banknote}
          accent="revenue"
        />
        <StatCard
          title="Revenus (CDF)"
          value={formatMoney(revenue.CDF || 0, 'CDF', lang)}
          subtitle="Chiffre d’affaires en Francs Congolais"
          icon={Banknote}
          accent="revenue"
        />
      </div>

      {/* 2. Quick Actions Bar */}
      <Card style={{ marginBottom: '24px' }}>
        <CardHeader style={{ padding: '14px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} color="#D97706" />
            <CardTitle style={{ fontSize: '0.95rem' }}>Actions Rapides</CardTitle>
          </div>
        </CardHeader>
        <CardContent style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <Button
              variant="outline"
              size="sm"
              icon={UserPlus}
              onClick={() => navigate('/admin/users')}
            >
              + Nouvel Utilisateur
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={Building2}
              onClick={() => navigate('/transport/agencies')}
            >
              + Nouvelle Agence
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={CarFront}
              onClick={() => navigate('/automobile/vehicles')}
            >
              + Nouveau Véhicule
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={HardHat}
              onClick={() => navigate('/construction/projects')}
            >
              + Nouveau Projet
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={Settings}
              onClick={() => navigate('/admin/account')}
            >
              Mon Compte
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 3. Department Synthesis Cards */}
      <h2 style={{
        fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
        fontSize: '1.15rem',
        fontWeight: 800,
        color: '#0F172A',
        margin: '0 0 16px',
        letterSpacing: '-0.02em'
      }}>
        Synthèse des Départements
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        {/* Vanguard Coach Synthesis */}
        <Card className="vanguard-dept-card vanguard-dept-card--coach">
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: '#EFF6FF',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Bus size={18} />
              </div>
              <div>
                <CardTitle>Vanguard Coach</CardTitle>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B' }}>Transport interurbain & réservations</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
              <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Réservations</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
                  {formatNumber(transport.reservations?.total || 0, lang)}
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Billets</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
                  {formatNumber(transport.tickets?.total || 0, lang)}
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Voyages planifiés</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
                  {formatNumber(transport.trips?.total || 0, lang)}
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Recettes Coach</span>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>
                  {formatMoney(transport.revenue?.USD || 0, 'USD', lang)}
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              style={{ width: '100%', justifyContent: 'space-between' }}
              onClick={() => navigate('/transport')}
            >
              <span>Accéder au module Coach</span>
              <ArrowRight size={15} />
            </Button>
          </CardContent>
        </Card>

        {/* Vanguard Automobile Synthesis */}
        <Card className="vanguard-dept-card vanguard-dept-card--auto">
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: '#F0FDF4',
                color: '#16A34A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <CarFront size={18} />
              </div>
              <div>
                <CardTitle>Vanguard Automobile</CardTitle>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B' }}>Vente de véhicules & réservations</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
              <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Véhicules en stock</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
                  {formatNumber(autoSales.vehicles?.total || 0, lang)}
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Demandes clients</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
                  {formatNumber(autoSales.inquiries?.total || 0, lang)}
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Réservations</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
                  {formatNumber(autoSales.reservations?.total || 0, lang)}
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Recettes Auto</span>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>
                  {formatMoney(autoSales.revenue?.USD || 0, 'USD', lang)}
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              style={{ width: '100%', justifyContent: 'space-between' }}
              onClick={() => navigate('/automobile')}
            >
              <span>Accéder au module Automobile</span>
              <ArrowRight size={15} />
            </Button>
          </CardContent>
        </Card>

        {/* Vanguard Construction Synthesis */}
        <Card className="vanguard-dept-card vanguard-dept-card--construction">
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: '#FFF7ED',
                color: '#EA580C',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <HardHat size={18} />
              </div>
              <div>
                <CardTitle>Vanguard Construction</CardTitle>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B' }}>Chantiers, projets & devis</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
              <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Total Projets</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
                  {formatNumber(construction.projects?.total || 0, lang)}
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>En cours</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#EA580C' }}>
                  {formatNumber(construction.projects?.IN_PROGRESS || 0, lang)}
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Demandes de devis</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
                  {formatNumber(construction.quoteRequests?.total || 0, lang)}
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Terminés</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
                  {formatNumber(construction.projects?.COMPLETED || 0, lang)}
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              style={{ width: '100%', justifyContent: 'space-between' }}
              onClick={() => navigate('/construction')}
            >
              <span>Accéder au module Construction</span>
              <ArrowRight size={15} />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 4. Discrete Audit & Activity Callout (Requirement: Do NOT clutter dashboard with a massive log table) */}
      <Card style={{
        background: 'linear-gradient(135deg, #0B132B 0%, #1E293B 100%)',
        color: '#FFFFFF',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <CardContent style={{ padding: '22px 26px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '20px',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#F59E0B'
              }}>
                <FileText size={22} />
              </div>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '1.05rem', fontWeight: 700, color: '#FFFFFF' }}>
                  Audit & Activité Système
                </h3>
                <p style={{ margin: 0, fontSize: '0.84rem', color: '#94A3B8' }}>
                  Consultez le journal complet des événements, connexions et opérations sensibles effectuées sur la plateforme.
                </p>
              </div>
            </div>

            <Button
              variant="secondary"
              size="md"
              icon={ArrowRight}
              onClick={() => navigate('/admin/audit')}
              style={{
                backgroundColor: '#FFFFFF',
                color: '#0F172A',
                fontWeight: 700
              }}
            >
              Accéder à l’Audit
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
