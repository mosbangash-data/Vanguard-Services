import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Building2,
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  Clock,
  UserCheck,
  Shield,
  Bus,
  Ticket,
  CreditCard,
  Layers,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { api } from '../../../services/api'
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  StatusBadge,
  LoadingState,
  ErrorState,
} from '../../../components/ui'

export function AgencyDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'buses' | 'reservations' | 'tickets' | 'payments'

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['coach-agency-detail', id],
    queryFn: async () => {
      const response = await api.get(`/api/agencies/${id}`)
      return response.data?.data?.agency || response.data?.data || response.data
    },
  })

  if (isPending) {
    return (
      <div className="page vanguard-agency-detail-page">
        <LoadingState message="Chargement des informations de l’agence..." />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="page vanguard-agency-detail-page">
        <ErrorState
          title="Agence introuvable"
          message={error?.response?.data?.message || 'Impossible de récupérer la fiche de l’agence.'}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  const agency = data

  return (
    <div className="page vanguard-agency-detail-page">
      <div style={{ marginBottom: '16px' }}>
        <Button
          variant="ghost"
          size="sm"
          icon={ArrowLeft}
          onClick={() => navigate('/transport/agencies')}
        >
          Retour aux agences
        </Button>
      </div>

      <PageHeader
        eyebrow="VANGUARD SERVICES · AGENCE COACH"
        title={agency.name}
        subtitle={`Code: ${agency.code} · ${agency.city || 'Kinshasa'}`}
        badge={
          <StatusBadge
            status={agency.isActive ? 'ACTIVE' : 'INACTIVE'}
            label={agency.isActive ? 'Active' : 'Inactive'}
            variant={agency.isActive ? 'success' : 'neutral'}
          />
        }
      />

      {/* Detail Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        {/* Informations Générales */}
        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={18} color="#2563EB" />
              <CardTitle>Informations Générales</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Nom officiel</span>
                <div style={{ fontWeight: 700, color: '#0F172A', marginTop: '2px', fontSize: '0.95rem' }}>{agency.name}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Code Agence</span>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563EB', marginTop: '2px' }}>{agency.code}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Ville d’implantation</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>
                  <MapPin size={14} color="#64748B" />
                  <span>{agency.city || 'Kinshasa'}</span>
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Adresse physique</span>
                <div style={{ color: '#334155', marginTop: '2px', fontSize: '0.875rem' }}>{agency.address || 'Non renseignée'}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact & Responsable */}
        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserCheck size={18} color="#2563EB" />
              <CardTitle>Contact & Responsable</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Responsable / Gérant</span>
                <div style={{ fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                  {agency.managerName || <span style={{ color: '#94A3B8' }}>Aucun responsable assigné</span>}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Téléphone professionnel</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0F172A', marginTop: '2px' }}>
                  <Phone size={14} color="#64748B" />
                  <span>{agency.phone || 'Non renseigné'}</span>
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Adresse e-mail</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0F172A', marginTop: '2px' }}>
                  <Mail size={14} color="#64748B" />
                  <span>{agency.email || 'Non renseigné'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fonctionnement & Horaires */}
        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} color="#D97706" />
              <CardTitle>Fonctionnement & Horaires</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Horaires d’ouverture</span>
                <div style={{ fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>
                  {agency.openingHours || '06:00 - 20:00'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Statut opérationnel</span>
                <div style={{ marginTop: '4px' }}>
                  <StatusBadge
                    status={agency.isActive ? 'ACTIVE' : 'INACTIVE'}
                    label={agency.isActive ? 'Opérationnelle' : 'Fermée'}
                    variant={agency.isActive ? 'success' : 'neutral'}
                  />
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Identifiant technique</span>
                <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>
                  {agency.id}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Sections (Tabs) */}
      <Card>
        <CardHeader style={{ padding: '0 20px', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button
              type="button"
              style={{
                padding: '14px 4px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'overview' ? '2px solid #2563EB' : '2px solid transparent',
                color: activeTab === 'overview' ? '#2563EB' : '#64748B',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}
              onClick={() => setActiveTab('overview')}
            >
              Vue synthétique
            </button>
            <button
              type="button"
              style={{
                padding: '14px 4px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'buses' ? '2px solid #2563EB' : '2px solid transparent',
                color: activeTab === 'buses' ? '#2563EB' : '#64748B',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}
              onClick={() => setActiveTab('buses')}
            >
              Flotte & Bus
            </button>
            <button
              type="button"
              style={{
                padding: '14px 4px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'reservations' ? '2px solid #2563EB' : '2px solid transparent',
                color: activeTab === 'reservations' ? '#2563EB' : '#64748B',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}
              onClick={() => setActiveTab('reservations')}
            >
              Réservations
            </button>
            <button
              type="button"
              style={{
                padding: '14px 4px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'tickets' ? '2px solid #2563EB' : '2px solid transparent',
                color: activeTab === 'tickets' ? '#2563EB' : '#64748B',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}
              onClick={() => setActiveTab('tickets')}
            >
              Billets émis
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {activeTab === 'overview' && (
            <div style={{ padding: '12px 0' }}>
              <p style={{ fontSize: '0.875rem', color: '#475569', margin: '0 0 14px' }}>
                L’agence <strong>{agency.name}</strong> dessert les lignes et départs au départ ou à destination de <strong>{agency.city}</strong>.
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <Button variant="outline" size="sm" icon={Ticket} onClick={() => navigate('/transport/reservations')}>
                  Voir les réservations Coach
                </Button>
                <Button variant="outline" size="sm" icon={Bus} onClick={() => navigate('/transport/buses')}>
                  Voir la flotte de bus
                </Button>
                <Button variant="outline" size="sm" icon={CreditCard} onClick={() => navigate('/transport/payments')}>
                  Consulter les paiements
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'buses' && (
            <div style={{ padding: '12px 0', color: '#64748B', fontSize: '0.875rem' }}>
              Consultez la flotte de bus assignée et les voyages programmés depuis le module <Link to="/transport/buses" style={{ color: '#2563EB', fontWeight: 600 }}>Flotte de Bus</Link>.
            </div>
          )}

          {activeTab === 'reservations' && (
            <div style={{ padding: '12px 0', color: '#64748B', fontSize: '0.875rem' }}>
              Accédez aux réservations associées via le menu <Link to="/transport/reservations" style={{ color: '#2563EB', fontWeight: 600 }}>Réservations Coach</Link>.
            </div>
          )}

          {activeTab === 'tickets' && (
            <div style={{ padding: '12px 0', color: '#64748B', fontSize: '0.875rem' }}>
              Accédez à la billetterie et aux impressions de tickets via le menu <Link to="/transport/tickets" style={{ color: '#2563EB', fontWeight: 600 }}>Billets</Link>.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
