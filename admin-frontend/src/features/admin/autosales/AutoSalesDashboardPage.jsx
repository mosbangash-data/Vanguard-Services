import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  CarFront,
  FileSpreadsheet,
  Ticket,
  CreditCard,
  Plus,
  ArrowRight,
  Layers,
  CheckCircle2,
  Clock,
  RefreshCw,
} from 'lucide-react'
import { api } from '../../../services/api'
import { useAuth } from '../../auth/authContext'
import { hasPermission } from '../../auth/permissions'
import { useLanguage } from '../../../i18n/useLanguage'
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
} from '../../../components/ui'

const toList = (data) => data?.items || data?.data?.items || data?.data || data || []

const formatMoney = (amount, currency, lang = 'fr') => {
  const num = Number(amount || 0)
  if (!Number.isFinite(num)) return '0'
  const normalized = currency === 'CDF' ? 'CDF' : 'USD'
  if (normalized === 'CDF') {
    return `${new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR', {
      maximumFractionDigits: 0,
    }).format(num)} CDF`
  }
  return `$ ${new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)}`
}

export function AutoSalesDashboardPage() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()
  const navigate = useNavigate()

  const canViewVehicles = hasPermission(user, 'VIEW_VEHICLE') || user?.role === 'SUPER_ADMIN'
  const canCreateVehicle = hasPermission(user, 'CREATE_VEHICLE') || user?.role === 'SUPER_ADMIN'
  const canViewInquiries = hasPermission(user, 'VIEW_VEHICLE_INQUIRY') || user?.role === 'SUPER_ADMIN'
  const canViewReservations = hasPermission(user, 'VIEW_RESERVATION') || user?.role === 'SUPER_ADMIN'

  const vehiclesQuery = useQuery({
    queryKey: ['autosales-dashboard-vehicles'],
    queryFn: async () => {
      const response = await api.get('/api/vehicles', { params: { page: 1, limit: 100 } })
      return response.data?.data || response.data
    },
    enabled: canViewVehicles,
  })

  const inquiriesQuery = useQuery({
    queryKey: ['autosales-dashboard-inquiries'],
    queryFn: async () => {
      const response = await api.get('/api/vehicle-inquiries', { params: { page: 1, limit: 20 } })
      return response.data?.data || response.data
    },
    enabled: canViewInquiries,
  })

  const reservationsQuery = useQuery({
    queryKey: ['autosales-dashboard-reservations'],
    queryFn: async () => {
      const response = await api.get('/api/vehicle-reservations', { params: { page: 1, limit: 100 } })
      return response.data?.data || response.data
    },
    enabled: canViewReservations,
  })

  const vehicleList = toList(vehiclesQuery.data)
  const inquiryList = toList(inquiriesQuery.data)
  const reservationList = toList(reservationsQuery.data)

  const availableCount = vehicleList.filter((v) => String(v.status).toUpperCase() === 'AVAILABLE').length
  const reservedCount = vehicleList.filter((v) => String(v.status).toUpperCase() === 'RESERVED').length
  const soldCount = vehicleList.filter((v) => String(v.status).toUpperCase() === 'SOLD').length
  const pendingInquiriesCount = inquiryList.filter((i) => ['NEW', 'IN_PROGRESS'].includes(String(i.status).toUpperCase())).length

  const isPending = (canViewVehicles && vehiclesQuery.isPending) || (canViewInquiries && inquiriesQuery.isPending)
  const isError = vehiclesQuery.isError || inquiriesQuery.isError

  const handleRefreshAll = () => {
    if (canViewVehicles) vehiclesQuery.refetch()
    if (canViewInquiries) inquiriesQuery.refetch()
    if (canViewReservations) reservationsQuery.refetch()
  }

  if (isPending) {
    return (
      <div className="page vanguard-autosales-dashboard">
        <PageHeader
          eyebrow="VANGUARD SERVICES · AUTOMOBILE"
          title="Dashboard Automobile"
          subtitle="Chargement des indicateurs du parc automobile…"
        />
        <LoadingState type="cards" cardCount={4} />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="page vanguard-autosales-dashboard">
        <PageHeader
          eyebrow="VANGUARD SERVICES · AUTOMOBILE"
          title="Dashboard Automobile"
          subtitle="Supervision du stock automobile, des demandes et des réservations."
        />
        <ErrorState
          title="Impossible de charger le tableau de bord Automobile"
          message="Une erreur est survenue lors de la récupération des données de vente automobile."
          onRetry={handleRefreshAll}
        />
      </div>
    )
  }

  return (
    <div className="page vanguard-autosales-dashboard">
      <PageHeader
        eyebrow="VANGUARD SERVICES · AUTOMOBILE"
        title="Dashboard Automobile"
        subtitle="Supervision du catalogue de véhicules, des demandes d'achat et des réservations."
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={handleRefreshAll}
            >
              Actualiser
            </Button>
            {canCreateVehicle && (
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => navigate('/automobile/vehicles')}
              >
                Nouveau Véhicule
              </Button>
            )}
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="vanguard-stats-grid">
        <StatCard
          title="Véhicules Disponibles"
          value={availableCount}
          subtitle={`Sur un total de ${vehicleList.length} véhicules`}
          icon={CarFront}
          accent="auto"
          onClick={() => navigate('/automobile/vehicles')}
        />
        <StatCard
          title="Demandes Clients"
          value={pendingInquiriesCount}
          subtitle="Demandes en attente de traitement"
          icon={FileSpreadsheet}
          accent="primary"
          onClick={() => navigate('/automobile/inquiries')}
        />
        <StatCard
          title="Réservations Actives"
          value={reservedCount}
          subtitle="Véhicules actuellement réservés"
          icon={Ticket}
          accent="warning"
          onClick={() => navigate('/automobile/reservations')}
        />
        <StatCard
          title="Véhicules Vendus"
          value={soldCount}
          subtitle="Ventes conclues avec succès"
          icon={CheckCircle2}
          accent="revenue"
          onClick={() => navigate('/automobile/sales')}
        />
      </div>

      {/* Quick Links & Actions */}
      <Card style={{ marginBottom: '24px' }}>
        <CardHeader style={{ padding: '14px 20px' }}>
          <CardTitle style={{ fontSize: '0.95rem' }}>Gestion du Catalogue</CardTitle>
        </CardHeader>
        <CardContent style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <Button
              variant="outline"
              size="sm"
              icon={CarFront}
              onClick={() => navigate('/automobile/vehicles')}
            >
              Consulter le stock
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={Layers}
              onClick={() => navigate('/automobile/templates')}
            >
              Véhicules Templates
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={FileSpreadsheet}
              onClick={() => navigate('/automobile/inquiries')}
            >
              Demandes d’achat
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={CreditCard}
              onClick={() => navigate('/automobile/payments')}
            >
              Paiements & Versements
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Vehicles & Recent Inquiries Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {/* Recent Vehicles */}
        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CarFront size={18} color="#16A34A" />
                <CardTitle>Véhicules Récents</CardTitle>
              </div>
              <Link to="/automobile/vehicles" style={{ fontSize: '0.8125rem', color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}>
                Tout voir →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {vehicleList.length === 0 ? (
              <p style={{ margin: 0, color: '#64748B', fontSize: '0.84rem' }}>Aucun véhicule enregistré.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {vehicleList.slice(0, 5).map((vehicle) => (
                  <div
                    key={vehicle.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      background: '#F8FAFC',
                      cursor: 'pointer'
                    }}
                    onClick={() => navigate(`/automobile/vehicles/${vehicle.id}`)}
                  >
                    <div>
                      <strong style={{ fontSize: '0.88rem', color: '#0F172A' }}>
                        {vehicle.brand} {vehicle.model}
                      </strong>
                      <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>
                        Année {vehicle.year} · {formatMoney(vehicle.price, vehicle.currency, lang)}
                      </div>
                    </div>
                    <StatusBadge status={vehicle.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Inquiries */}
        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileSpreadsheet size={18} color="#2563EB" />
                <CardTitle>Dernières Demandes Clients</CardTitle>
              </div>
              <Link to="/automobile/inquiries" style={{ fontSize: '0.8125rem', color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}>
                Tout voir →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {inquiryList.length === 0 ? (
              <p style={{ margin: 0, color: '#64748B', fontSize: '0.84rem' }}>Aucune demande récente.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {inquiryList.slice(0, 5).map((inquiry) => (
                  <div
                    key={inquiry.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      background: '#F8FAFC'
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.88rem', color: '#0F172A' }}>
                        {inquiry.customerName || 'Client'}
                      </strong>
                      <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>
                        {inquiry.vehicle ? `${inquiry.vehicle.brand} ${inquiry.vehicle.model}` : 'Véhicule non spécifié'}
                      </div>
                    </div>
                    <StatusBadge status={inquiry.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
