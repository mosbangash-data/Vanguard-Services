import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  CarFront,
  Plus,
  Eye,
  Edit2,
  Trash2,
  Layers,
  Sparkles,
  RefreshCw,
  CheckCircle2,
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

const toList = (data) => data?.items || data?.data?.items || data?.data || data || []

const formatMoney = (amount, currency = 'USD', lang = 'fr') => {
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

export function VehicleTemplatesPage() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [deletingTemplate, setDeletingTemplate] = useState(null)

  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    price: '',
    currency: 'USD',
    fuelType: '',
    transmission: '',
    color: '',
    description: '',
    isTemplate: true,
  })
  const [formError, setFormError] = useState('')

  const canView = hasPermission(user, 'VIEW_VEHICLE') || user?.role === 'SUPER_ADMIN'
  const canManage = hasPermission(user, 'CREATE_VEHICLE') || user?.role === 'SUPER_ADMIN'

  // Fetch templates (with isTemplate=true param or fallback)
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['autosales-vehicle-templates', search],
    queryFn: async () => {
      const params = { page: 1, limit: 50, isTemplate: true }
      if (search.trim()) params.search = search.trim()
      const response = await api.get('/api/vehicles', { params })
      const allVehicles = toList(response.data?.data || response.data)
      // Filter isTemplate in memory as fallback if API doesn't filter
      const templatesOnly = allVehicles.filter((v) => v.isTemplate === true || v.isTemplate === 'true')
      return templatesOnly.length > 0 ? templatesOnly : allVehicles.slice(0, 10)
    },
    enabled: canView,
  })

  const templatesList = data || []

  // Create / Update mutation
  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingTemplate) {
        return api.patch(`/api/vehicles/${editingTemplate.id}`, payload)
      }
      return api.post('/api/vehicles', { ...payload, isTemplate: true })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autosales-vehicle-templates'] })
      queryClient.invalidateQueries({ queryKey: ['autosales-vehicles'] })
      setIsFormOpen(false)
      setEditingTemplate(null)
    },
    onError: (err) => {
      setFormError(err?.response?.data?.message || 'Erreur lors de l’enregistrement du template.')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/api/vehicles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autosales-vehicle-templates'] })
      queryClient.invalidateQueries({ queryKey: ['autosales-vehicles'] })
      setDeletingTemplate(null)
    },
  })

  const handleOpenCreate = () => {
    setFormError('')
    setEditingTemplate(null)
    setFormData({
      brand: '',
      model: '',
      year: new Date().getFullYear(),
      price: '',
      currency: 'USD',
      fuelType: 'Essence',
      transmission: 'Automatique',
      color: '',
      description: '',
      isTemplate: true,
    })
    setIsFormOpen(true)
  }

  const handleOpenEdit = (template) => {
    setFormError('')
    setEditingTemplate(template)
    setFormData({
      brand: template.brand || '',
      model: template.model || '',
      year: template.year || new Date().getFullYear(),
      price: template.price || '',
      currency: template.currency || 'USD',
      fuelType: template.fuelType || '',
      transmission: template.transmission || '',
      color: template.color || '',
      description: template.description || '',
      isTemplate: true,
    })
    setIsFormOpen(true)
  }

  const handleFormSubmit = (e) => {
    e.preventDefault()
    if (!formData.brand || !formData.model || !formData.price) {
      setFormError('La marque, le modèle et le prix indicatif sont obligatoires.')
      return
    }
    saveMutation.mutate(formData)
  }

  if (isPending) {
    return (
      <div className="page vanguard-templates-page">
        <PageHeader
          eyebrow="VANGUARD SERVICES · AUTOMOBILE"
          title="Véhicules Templates"
          subtitle="Chargement du catalogue des modèles de véhicules..."
        />
        <LoadingState type="cards" cardCount={3} />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="page vanguard-templates-page">
        <PageHeader
          eyebrow="VANGUARD SERVICES · AUTOMOBILE"
          title="Véhicules Templates"
          subtitle="Modèles et fiches préconfigurées pour la création rapide d’annonces."
        />
        <ErrorState
          title="Erreur de chargement des templates"
          message={error?.response?.data?.message || 'Impossible de récupérer les templates de véhicules.'}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  return (
    <div className="page vanguard-templates-page">
      <PageHeader
        eyebrow="VANGUARD SERVICES · AUTOMOBILE"
        title="Véhicules Templates"
        subtitle="Catalogue des modèles standards préconfigurés pour faciliter les publications et demandes."
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
            {canManage && (
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={handleOpenCreate}
              >
                Nouveau Template
              </Button>
            )}
          </div>
        }
      />

      <FilterBar onRefresh={() => refetch()} isRefreshing={isFetching}>
        <SearchBar
          value={search}
          onChange={(val) => setSearch(val)}
          placeholder="Rechercher par marque, modèle..."
        />
      </FilterBar>

      {templatesList.length === 0 ? (
        <EmptyState
          title="Aucun template de véhicule"
          description="Créez votre premier modèle de véhicule template pour standardiser vos annonces."
          icon={Layers}
          actionLabel={canManage ? "Créer un template" : undefined}
          onAction={handleOpenCreate}
          actionIcon={Plus}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {templatesList.map((tpl) => {
            const primaryMedia = tpl.media?.find((m) => m.isPrimary)?.media?.url || tpl.imageUrl

            return (
              <Card key={tpl.id} className="vanguard-template-card" hover>
                <div style={{
                  height: '140px',
                  backgroundColor: '#F1F5F9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  {primaryMedia ? (
                    <img
                      src={primaryMedia}
                      alt={`${tpl.brand} ${tpl.model}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: '#94A3B8' }}>
                      <CarFront size={32} />
                      <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Modèle Template</span>
                    </div>
                  )}
                  <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                    <StatusBadge label="Template" variant="primary" dot={false} />
                  </div>
                </div>

                <CardContent style={{ padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px', fontSize: '1.05rem', fontWeight: 700, color: '#0F172A' }}>
                        {tpl.brand} {tpl.model}
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748B' }}>
                        Année {tpl.year} {tpl.fuelType ? `· ${tpl.fuelType}` : ''} {tpl.transmission ? `· ${tpl.transmission}` : ''}
                      </p>
                    </div>

                    <ActionMenu
                      items={[
                        {
                          label: 'Voir les détails',
                          icon: Eye,
                          onClick: () => setSelectedTemplate(tpl),
                        },
                        ...(canManage
                          ? [
                              {
                                label: 'Modifier le template',
                                icon: Edit2,
                                onClick: () => handleOpenEdit(tpl),
                              },
                              { divider: true },
                              {
                                label: 'Supprimer',
                                icon: Trash2,
                                variant: 'danger',
                                onClick: () => setDeletingTemplate(tpl),
                              },
                            ]
                          : []),
                      ]}
                    />
                  </div>

                  <div style={{
                    marginTop: '14px',
                    paddingTop: '12px',
                    borderTop: '1px solid #E2E8F0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>Prix indicatif</span>
                    <strong style={{ fontSize: '1.05rem', color: '#0F172A' }}>
                      {formatMoney(tpl.price, tpl.currency, lang)}
                    </strong>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create / Edit Template Modal */}
      {isFormOpen && (
        <Modal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          title={editingTemplate ? 'Modifier le template de véhicule' : 'Nouveau template de véhicule'}
          subtitle="Configurez les caractéristiques du modèle pour le catalogue standard."
          size="md"
        >
          <form onSubmit={handleFormSubmit}>
            {formError && (
              <div style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#B91C1C',
                padding: '10px 14px',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '0.84rem'
              }}>
                {formError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <FormField label="Marque" required>
                <Input
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  placeholder="Ex: Toyota, Mercedes, Land Cruiser"
                  required
                />
              </FormField>

              <FormField label="Modèle" required>
                <Input
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="Ex: Prado TX, RAV4, Hilux"
                  required
                />
              </FormField>

              <FormField label="Année">
                <Input
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
                  min="1990"
                  max={new Date().getFullYear() + 2}
                />
              </FormField>

              <FormField label="Prix indicatif" required>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="Ex: 35000"
                  required
                />
              </FormField>

              <FormField label="Devise">
                <Select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                >
                  <option value="USD">USD ($)</option>
                  <option value="CDF">CDF (Francs Congolais)</option>
                </Select>
              </FormField>

              <FormField label="Transmission">
                <Select
                  value={formData.transmission}
                  onChange={(e) => setFormData({ ...formData, transmission: e.target.value })}
                >
                  <option value="Automatique">Automatique</option>
                  <option value="Manuelle">Manuelle</option>
                </Select>
              </FormField>

              <FormField label="Carburant">
                <Select
                  value={formData.fuelType}
                  onChange={(e) => setFormData({ ...formData, fuelType: e.target.value })}
                >
                  <option value="Essence">Essence</option>
                  <option value="Diesel">Diesel</option>
                  <option value="Hybride">Hybride</option>
                  <option value="Électrique">Électrique</option>
                </Select>
              </FormField>

              <FormField label="Couleur de référence">
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="Ex: Noir Métallisé, Blanc Perle"
                />
              </FormField>

              <div style={{ gridColumn: 'span 2' }}>
                <FormField label="Description & Spécifications clés">
                  <Textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Description du modèle, finitions, motorisation..."
                  />
                </FormField>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #E2E8F0' }}>
              <Button variant="secondary" onClick={() => setIsFormOpen(false)} disabled={saveMutation.isPending}>
                Annuler
              </Button>
              <Button type="submit" variant="primary" loading={saveMutation.isPending}>
                {editingTemplate ? 'Enregistrer les modifications' : 'Créer le template'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Detail Inspection Modal */}
      {selectedTemplate && (
        <Modal
          isOpen={Boolean(selectedTemplate)}
          onClose={() => setSelectedTemplate(null)}
          title={`${selectedTemplate.brand} ${selectedTemplate.model}`}
          subtitle={`Fiche Template #${selectedTemplate.id}`}
          size="md"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Prix indicatif</span>
                <div style={{ marginTop: '2px', fontWeight: 700, fontSize: '1.1rem', color: '#0F172A' }}>
                  {formatMoney(selectedTemplate.price, selectedTemplate.currency, lang)}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Année</span>
                <div style={{ marginTop: '2px', fontWeight: 600, color: '#0F172A' }}>{selectedTemplate.year}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Carburant</span>
                <div style={{ marginTop: '2px', fontWeight: 600, color: '#0F172A' }}>{selectedTemplate.fuelType || 'Non spécifié'}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Transmission</span>
                <div style={{ marginTop: '2px', fontWeight: 600, color: '#0F172A' }}>{selectedTemplate.transmission || 'Non spécifié'}</div>
              </div>
            </div>

            {selectedTemplate.description && (
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Description</span>
                <p style={{ marginTop: '4px', fontSize: '0.875rem', color: '#334155', lineHeight: 1.5 }}>
                  {selectedTemplate.description}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid #E2E8F0' }}>
              <Button variant="secondary" onClick={() => setSelectedTemplate(null)}>
                Fermer
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {deletingTemplate && (
        <ConfirmDialog
          isOpen={Boolean(deletingTemplate)}
          onClose={() => setDeletingTemplate(null)}
          onConfirm={() => deleteMutation.mutate(deletingTemplate.id)}
          title="Supprimer ce template ?"
          message={`Êtes-vous sûr de vouloir supprimer le modèle template ${deletingTemplate.brand} ${deletingTemplate.model} ?`}
          confirmText="Supprimer définitivement"
          loading={deleteMutation.isPending}
          variant="danger"
        />
      )}
    </div>
  )
}
