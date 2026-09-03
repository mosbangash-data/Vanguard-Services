import React, { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CarFront,
  Plus,
  Eye,
  Edit2,
  Trash2,
  RefreshCw,
  Layers,
  ArrowLeft,
  Calendar,
  Fuel,
  Gauge,
  Palette,
  FileSpreadsheet,
  Ticket,
} from 'lucide-react'
import { api } from '../../../services/api'
import { useAuth } from '../../auth/authContext'
import { hasPermission } from '../../auth/permissions'
import { useLanguage } from '../../../i18n/useLanguage'
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  FilterBar,
  SearchBar,
  Button,
  StatusBadge,
  ActionMenu,
  Modal,
  ConfirmDialog,
  FormField,
  Input,
  Select,
  Textarea,
  LoadingState,
  ErrorState,
  EmptyState,
} from '../../../components/ui'

const STATUS_OPTIONS = ['AVAILABLE', 'RESERVED', 'SOLD', 'IN_MAINTENANCE']
const CURRENCY_OPTIONS = ['USD', 'CDF']

const EMPTY_FORM = {
  brand: '',
  model: '',
  year: new Date().getFullYear(),
  price: '',
  currency: 'USD',
  mileage: '',
  fuelType: 'Essence',
  transmission: 'Automatique',
  color: '',
  description: '',
}

const toList = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.items)) return payload.data.items
  return []
}

const formatMoney = (value, currency = 'USD', locale = 'fr') => {
  const num = Number(value || 0)
  if (!Number.isFinite(num)) return '0'
  const normalized = currency === 'CDF' ? 'CDF' : 'USD'
  if (normalized === 'CDF') {
    return `${new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'fr-FR', {
      maximumFractionDigits: 0,
    }).format(num)} CDF`
  }
  return `$ ${new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)}`
}

const formatDate = (value, locale = 'fr') => {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR')
  } catch {
    return '—'
  }
}

export function VehicleManagementPage() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [currencyFilter, setCurrencyFilter] = useState('ALL')

  const [formState, setFormState] = useState(null) // null | { mode: 'create' | 'edit', values, id }
  const [serverError, setServerError] = useState('')
  const [deletingVehicle, setDeletingVehicle] = useState(null)
  const [statusChangingVehicle, setStatusChangingVehicle] = useState(null)

  const canView = hasPermission(user, 'VIEW_VEHICLE') || user?.role === 'SUPER_ADMIN'
  const canCreate = hasPermission(user, 'CREATE_VEHICLE') || user?.role === 'SUPER_ADMIN'
  const canUpdate = hasPermission(user, 'UPDATE_VEHICLE') || user?.role === 'SUPER_ADMIN'
  const canDelete = hasPermission(user, 'DELETE_VEHICLE') || user?.role === 'SUPER_ADMIN'

  const vehiclesQuery = useQuery({
    queryKey: ['autosales-vehicles', search, statusFilter],
    queryFn: async () => {
      const params = { page: 1, limit: 100 }
      if (search.trim()) params.search = search.trim()
      if (statusFilter !== 'ALL') params.status = statusFilter
      const response = await api.get('/api/vehicles', { params })
      return toList(response.data?.data || response.data)
    },
    enabled: canView,
  })

  const vehicles = vehiclesQuery.data || []

  const filteredVehicles = useMemo(() => {
    let list = [...vehicles]
    if (currencyFilter !== 'ALL') {
      list = list.filter((v) => String(v.currency || 'USD').toUpperCase() === currencyFilter)
    }
    return list
  }, [vehicles, currencyFilter])

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (formState.mode === 'create') {
        return api.post('/api/vehicles', payload)
      }
      return api.patch(`/api/vehicles/${formState.id}`, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autosales-vehicles'] })
      queryClient.invalidateQueries({ queryKey: ['autosales-dashboard-vehicles'] })
      setFormState(null)
    },
    onError: (err) => {
      setServerError(err?.response?.data?.message || 'Erreur lors de l’enregistrement du véhicule.')
    },
  })

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/api/vehicles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autosales-vehicles'] })
      queryClient.invalidateQueries({ queryKey: ['autosales-dashboard-vehicles'] })
      setDeletingVehicle(null)
    },
    onError: (err) => {
      setServerError(err?.response?.data?.message || 'Impossible de supprimer ce véhicule.')
    },
  })

  // Status Mutation
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }) => api.patch(`/api/vehicles/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autosales-vehicles'] })
      queryClient.invalidateQueries({ queryKey: ['autosales-dashboard-vehicles'] })
      setStatusChangingVehicle(null)
    },
    onError: (err) => {
      setServerError(err?.response?.data?.message || 'Impossible de changer le statut.')
    },
  })

  const openCreateForm = () => {
    setServerError('')
    setFormState({ mode: 'create', values: { ...EMPTY_FORM } })
  }

  const openEditForm = (vehicle) => {
    setServerError('')
    setFormState({
      mode: 'edit',
      id: vehicle.id,
      values: {
        brand: vehicle.brand || '',
        model: vehicle.model || '',
        year: vehicle.year || new Date().getFullYear(),
        price: vehicle.price ?? '',
        currency: String(vehicle.currency || 'USD').toUpperCase(),
        mileage: vehicle.mileage ?? '',
        fuelType: vehicle.fuelType || 'Essence',
        transmission: vehicle.transmission || 'Automatique',
        color: vehicle.color || '',
        description: vehicle.description || '',
      },
    })
  }

  const handleFormSubmit = (e) => {
    e.preventDefault()
    if (!formState.values.brand || !formState.values.model || !formState.values.price) {
      setServerError('La marque, le modèle et le prix sont obligatoires.')
      return
    }

    const payload = {
      brand: String(formState.values.brand || '').trim(),
      model: String(formState.values.model || '').trim(),
      year: Number(formState.values.year),
      price: String(formState.values.price).trim(),
      currency: String(formState.values.currency || 'USD').toUpperCase(),
      mileage: formState.values.mileage ? Number(formState.values.mileage) : null,
      fuelType: formState.values.fuelType || null,
      transmission: formState.values.transmission || null,
      color: formState.values.color || null,
      description: formState.values.description || null,
    }

    saveMutation.mutate(payload)
  }

  if (!canView) {
    return (
      <div className="page vanguard-vehicles-page">
        <EmptyState
          title="Accès non autorisé"
          description="Vous ne possédez pas les autorisations requises pour consulter le catalogue automobile."
        />
      </div>
    )
  }

  return (
    <div className="page vanguard-vehicles-page">
      <PageHeader
        eyebrow="VANGUARD SERVICES · AUTOMOBILE"
        title="Gestion des Véhicules"
        subtitle="Catalogue complet des véhicules en stock, réservés et vendus."
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button
              variant="outline"
              size="sm"
              icon={Layers}
              onClick={() => navigate('/automobile/templates')}
            >
              Templates
            </Button>
            {canCreate && (
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={openCreateForm}
              >
                Ajouter un véhicule
              </Button>
            )}
          </div>
        }
      />

      <FilterBar onRefresh={() => vehiclesQuery.refetch()} isRefreshing={vehiclesQuery.isFetching}>
        <SearchBar
          value={search}
          onChange={(val) => setSearch(val)}
          placeholder="Rechercher par marque, modèle, couleur..."
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: 'auto', minWidth: '160px' }}
        >
          <option value="ALL">Tous les statuts</option>
          {STATUS_OPTIONS.map((st) => (
            <option key={st} value={st}>
              {st === 'AVAILABLE' ? 'Disponible' : st === 'RESERVED' ? 'Réservé' : st === 'SOLD' ? 'Vendu' : 'En maintenance'}
            </option>
          ))}
        </Select>
        <Select
          value={currencyFilter}
          onChange={(e) => setCurrencyFilter(e.target.value)}
          style={{ width: 'auto', minWidth: '140px' }}
        >
          <option value="ALL">Toutes devises</option>
          <option value="USD">USD ($)</option>
          <option value="CDF">CDF</option>
        </Select>
      </FilterBar>

      {serverError && (
        <div style={{
          backgroundColor: '#FEF2F2',
          border: '1px solid #FECACA',
          color: '#B91C1C',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
          fontSize: '0.84rem'
        }}>
          {serverError}
        </div>
      )}

      {vehiclesQuery.isPending ? (
        <LoadingState message="Chargement des véhicules..." />
      ) : vehiclesQuery.isError ? (
        <ErrorState
          title="Erreur de chargement du catalogue"
          message={vehiclesQuery.error?.response?.data?.message || 'Impossible de récupérer les véhicules.'}
          onRetry={() => vehiclesQuery.refetch()}
        />
      ) : filteredVehicles.length === 0 ? (
        <EmptyState
          title="Aucun véhicule trouvé"
          description="Aucun véhicule ne correspond à vos critères de recherche."
          icon={CarFront}
          actionLabel={canCreate ? "Ajouter un véhicule" : undefined}
          onAction={openCreateForm}
          actionIcon={Plus}
        />
      ) : (
        <Card>
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Véhicule</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Année</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Prix</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Transmission / Carburant</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Statut</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVehicles.map((vehicle) => {
                  const primaryMedia = vehicle.media?.find((m) => m.isPrimary)?.media?.url

                  return (
                    <tr
                      key={vehicle.id}
                      style={{ borderBottom: '1px solid #E2E8F0', cursor: 'pointer' }}
                      onClick={() => navigate(`/automobile/vehicles/${vehicle.id}`)}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '8px',
                            backgroundColor: '#F1F5F9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            flexShrink: 0
                          }}>
                            {primaryMedia ? (
                              <img src={primaryMedia} alt={vehicle.brand} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <CarFront size={20} color="#64748B" />
                            )}
                          </div>
                          <div>
                            <strong style={{ fontSize: '0.9rem', color: '#0F172A' }}>
                              {vehicle.brand} {vehicle.model}
                            </strong>
                            <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                              {vehicle.color ? `${vehicle.color} · ` : ''}{vehicle.mileage ? `${vehicle.mileage.toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR')} km` : '0 km'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '12px 16px', fontSize: '0.84rem', color: '#334155' }}>
                        {vehicle.year || '—'}
                      </td>

                      <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '0.92rem', color: '#0F172A' }}>
                        {formatMoney(vehicle.price, vehicle.currency, lang)}
                      </td>

                      <td style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#64748B' }}>
                        {vehicle.transmission || 'Auto'} / {vehicle.fuelType || 'Essence'}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <StatusBadge status={vehicle.status} />
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <ActionMenu
                          items={[
                            {
                              label: 'Voir la fiche complète',
                              icon: Eye,
                              onClick: () => navigate(`/automobile/vehicles/${vehicle.id}`),
                            },
                            ...(canUpdate
                              ? [
                                  {
                                    label: 'Modifier les informations',
                                    icon: Edit2,
                                    onClick: () => openEditForm(vehicle),
                                  },
                                  {
                                    label: 'Changer de statut',
                                    icon: RefreshCw,
                                    onClick: () => setStatusChangingVehicle(vehicle),
                                  },
                                ]
                              : []),
                            ...(canDelete
                              ? [
                                  { divider: true },
                                  {
                                    label: 'Supprimer ce véhicule',
                                    icon: Trash2,
                                    variant: 'danger',
                                    onClick: () => setDeletingVehicle(vehicle),
                                  },
                                ]
                              : []),
                          ]}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal Form for Create / Edit */}
      {formState && (
        <Modal
          isOpen={Boolean(formState)}
          onClose={() => setFormState(null)}
          title={formState.mode === 'create' ? 'Ajouter un véhicule' : 'Modifier le véhicule'}
          subtitle="Renseignez les détails techniques, tarifs et options du véhicule."
          size="lg"
        >
          <form onSubmit={handleFormSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <FormField label="Marque" required>
                <Input
                  value={formState.values.brand}
                  onChange={(e) => setFormState({ ...formState, values: { ...formState.values, brand: e.target.value } })}
                  placeholder="Ex: Toyota"
                  required
                />
              </FormField>

              <FormField label="Modèle" required>
                <Input
                  value={formState.values.model}
                  onChange={(e) => setFormState({ ...formState, values: { ...formState.values, model: e.target.value } })}
                  placeholder="Ex: Land Cruiser Prado"
                  required
                />
              </FormField>

              <FormField label="Année">
                <Input
                  type="number"
                  value={formState.values.year}
                  onChange={(e) => setFormState({ ...formState, values: { ...formState.values, year: e.target.value } })}
                  min="1990"
                  max={new Date().getFullYear() + 2}
                />
              </FormField>

              <FormField label="Prix" required>
                <Input
                  type="number"
                  step="0.01"
                  value={formState.values.price}
                  onChange={(e) => setFormState({ ...formState, values: { ...formState.values, price: e.target.value } })}
                  placeholder="Ex: 45000"
                  required
                />
              </FormField>

              <FormField label="Devise">
                <Select
                  value={formState.values.currency}
                  onChange={(e) => setFormState({ ...formState, values: { ...formState.values, currency: e.target.value } })}
                >
                  <option value="USD">USD ($)</option>
                  <option value="CDF">CDF (Francs Congolais)</option>
                </Select>
              </FormField>

              <FormField label="Kilométrage (km)">
                <Input
                  type="number"
                  value={formState.values.mileage}
                  onChange={(e) => setFormState({ ...formState, values: { ...formState.values, mileage: e.target.value } })}
                  placeholder="Ex: 25000"
                />
              </FormField>

              <FormField label="Transmission">
                <Select
                  value={formState.values.transmission}
                  onChange={(e) => setFormState({ ...formState, values: { ...formState.values, transmission: e.target.value } })}
                >
                  <option value="Automatique">Automatique</option>
                  <option value="Manuelle">Manuelle</option>
                </Select>
              </FormField>

              <FormField label="Carburant">
                <Select
                  value={formState.values.fuelType}
                  onChange={(e) => setFormState({ ...formState, values: { ...formState.values, fuelType: e.target.value } })}
                >
                  <option value="Essence">Essence</option>
                  <option value="Diesel">Diesel</option>
                  <option value="Hybride">Hybride</option>
                  <option value="Électrique">Électrique</option>
                </Select>
              </FormField>

              <FormField label="Couleur">
                <Input
                  value={formState.values.color}
                  onChange={(e) => setFormState({ ...formState, values: { ...formState.values, color: e.target.value } })}
                  placeholder="Ex: Noir Métallisé"
                />
              </FormField>

              <div style={{ gridColumn: 'span 2' }}>
                <FormField label="Description">
                  <Textarea
                    rows={3}
                    value={formState.values.description}
                    onChange={(e) => setFormState({ ...formState, values: { ...formState.values, description: e.target.value } })}
                    placeholder="Historique, état général, équipements supplémentaires..."
                  />
                </FormField>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #E2E8F0' }}>
              <Button variant="secondary" onClick={() => setFormState(null)} disabled={saveMutation.isPending}>
                Annuler
              </Button>
              <Button type="submit" variant="primary" loading={saveMutation.isPending}>
                {formState.mode === 'create' ? 'Ajouter au catalogue' : 'Enregistrer les modifications'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Change Status Modal */}
      {statusChangingVehicle && (
        <Modal
          isOpen={Boolean(statusChangingVehicle)}
          onClose={() => setStatusChangingVehicle(null)}
          title="Modifier le statut du véhicule"
          subtitle={`${statusChangingVehicle.brand} ${statusChangingVehicle.model}`}
          size="sm"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <FormField label="Nouveau statut">
              <Select
                defaultValue={statusChangingVehicle.status}
                onChange={(e) => statusMutation.mutate({ id: statusChangingVehicle.id, status: e.target.value })}
              >
                {STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {st === 'AVAILABLE' ? 'Disponible' : st === 'RESERVED' ? 'Réservé' : st === 'SOLD' ? 'Vendu' : 'En maintenance'}
                  </option>
                ))}
              </Select>
            </FormField>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid #E2E8F0' }}>
              <Button variant="secondary" onClick={() => setStatusChangingVehicle(null)}>
                Fermer
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {deletingVehicle && (
        <ConfirmDialog
          isOpen={Boolean(deletingVehicle)}
          onClose={() => setDeletingVehicle(null)}
          onConfirm={() => deleteMutation.mutate(deletingVehicle.id)}
          title="Supprimer ce véhicule ?"
          message={`Êtes-vous sûr de vouloir supprimer ${deletingVehicle.brand} ${deletingVehicle.model} du stock ?`}
          confirmText="Supprimer définitivement"
          loading={deleteMutation.isPending}
          variant="danger"
        />
      )}
    </div>
  )
}

export function VehicleDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { lang, t } = useLanguage()
  const navigate = useNavigate()

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['autosales-vehicle-detail', id],
    queryFn: async () => {
      const response = await api.get(`/api/vehicles/${id}`)
      return response.data?.data?.vehicle || response.data?.data || response.data
    },
  })

  if (isPending) {
    return (
      <div className="page vanguard-vehicle-detail-page">
        <LoadingState message="Chargement des détails du véhicule..." />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="page vanguard-vehicle-detail-page">
        <ErrorState
          title="Véhicule introuvable"
          message={error?.response?.data?.message || 'Impossible de charger la fiche du véhicule.'}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  const vehicle = data
  const primaryMedia = vehicle.media?.find((m) => m.isPrimary)?.media?.url || vehicle.imageUrl

  return (
    <div className="page vanguard-vehicle-detail-page">
      <div style={{ marginBottom: '16px' }}>
        <Button
          variant="ghost"
          size="sm"
          icon={ArrowLeft}
          onClick={() => navigate('/automobile/vehicles')}
        >
          Retour au catalogue
        </Button>
      </div>

      <PageHeader
        eyebrow="VANGUARD SERVICES · FICHE VÉHICULE"
        title={`${vehicle.brand} ${vehicle.model}`}
        subtitle={`Réf: ${vehicle.id}`}
        badge={<StatusBadge status={vehicle.status} />}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* Gallery / Image Preview */}
        <Card>
          <div style={{
            height: '240px',
            backgroundColor: '#0F172A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}>
            {primaryMedia ? (
              <img src={primaryMedia} alt={vehicle.brand} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ color: '#94A3B8', textAlign: 'center' }}>
                <CarFront size={48} />
                <p style={{ margin: '8px 0 0', fontSize: '0.84rem' }}>Aucune photo principale</p>
              </div>
            )}
          </div>
          <CardContent>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 600 }}>Prix de vente</span>
              <strong style={{ fontSize: '1.4rem', color: '#0F172A', fontWeight: 800 }}>
                {formatMoney(vehicle.price, vehicle.currency, lang)}
              </strong>
            </div>
          </CardContent>
        </Card>

        {/* Technical Specs */}
        <Card>
          <CardHeader>
            <CardTitle>Caractéristiques Techniques</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Année</span>
                <div style={{ fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>{vehicle.year || '—'}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Kilométrage</span>
                <div style={{ fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>
                  {vehicle.mileage != null ? `${vehicle.mileage.toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR')} km` : '—'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Transmission</span>
                <div style={{ fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>{vehicle.transmission || '—'}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Carburant</span>
                <div style={{ fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>{vehicle.fuelType || '—'}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Couleur</span>
                <div style={{ fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>{vehicle.color || '—'}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Enregistré le</span>
                <div style={{ fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>{formatDate(vehicle.createdAt, lang)}</div>
              </div>
            </div>

            {vehicle.description && (
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Description</span>
                <p style={{ margin: '6px 0 0', fontSize: '0.875rem', color: '#334155', lineHeight: 1.5 }}>
                  {vehicle.description}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
