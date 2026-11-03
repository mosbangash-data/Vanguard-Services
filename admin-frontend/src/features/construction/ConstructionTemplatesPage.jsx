import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  HardHat,
  Plus,
  Eye,
  Edit2,
  Trash2,
  Layers,
  RefreshCw,
  MapPin,
} from 'lucide-react'
import { api } from '../../services/api'
import { useAuth } from '../auth/authContext'
import { hasPermission } from '../auth/permissions'
import { useLanguage } from '../../i18n/useLanguage'
import {
  PageHeader,
  Card,
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
  Textarea,
  LoadingState,
  ErrorState,
  EmptyState,
} from '../../components/ui'

const toList = (data) => data?.items || data?.data?.items || data?.data || data || []

const formatMoney = (amount, lang = 'fr') => {
  const num = Number(amount || 0)
  if (!Number.isFinite(num)) return '0'
  return `$ ${new Intl.NumberFormat(lang === 'en' ? 'en-US' : lang === 'sw' ? 'sw-TZ' : 'fr-FR', {
    maximumFractionDigits: 0,
  }).format(num)}`
}

export function ConstructionTemplatesPage() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [deletingTemplate, setDeletingTemplate] = useState(null)

  const [formData, setFormData] = useState({
    title: '',
    location: '',
    budget: '',
    description: '',
    status: 'PUBLISHED',
    publicationStatus: 'PUBLISHED',
    isTemplate: true,
  })
  const [formError, setFormError] = useState('')

  const canView = hasPermission(user, 'VIEW_PROJECT') || user?.role === 'SUPER_ADMIN'
  const canManage = hasPermission(user, 'CREATE_PROJECT') || user?.role === 'SUPER_ADMIN'

  // Fetch templates (with isTemplate=true param or fallback)
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['construction-project-templates', search],
    queryFn: async () => {
      const params = { page: 1, limit: 50, isTemplate: true }
      if (search.trim()) params.search = search.trim()
      const response = await api.get('/api/construction/projects', { params })
      const allProjects = toList(response.data?.data || response.data)
      const templatesOnly = allProjects.filter((p) => p.isTemplate === true || p.isTemplate === 'true')
      return templatesOnly.length > 0 ? templatesOnly : allProjects.slice(0, 5)
    },
    enabled: canView,
  })

  const templatesList = data || []

  // Create / Update mutation
  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingTemplate) {
        return api.put(`/api/construction/projects/${editingTemplate.id}`, payload)
      }
      return api.post('/api/construction/projects', { ...payload, isTemplate: true })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['construction-project-templates'] })
      queryClient.invalidateQueries({ queryKey: ['construction-projects'] })
      setIsFormOpen(false)
      setEditingTemplate(null)
    },
    onError: (err) => {
      setFormError(err?.response?.data?.message || t('construction.projectTemplatesPage.saveFailed'))
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/api/construction/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['construction-project-templates'] })
      queryClient.invalidateQueries({ queryKey: ['construction-projects'] })
      setDeletingTemplate(null)
    },
  })

  const handleOpenCreate = () => {
    setFormError('')
    setEditingTemplate(null)
    setFormData({
      title: '',
      location: 'Kinshasa, RDC',
      budget: '',
      description: '',
      status: 'PUBLISHED',
      publicationStatus: 'PUBLISHED',
      isTemplate: true,
    })
    setIsFormOpen(true)
  }

  const handleOpenEdit = (template) => {
    setFormError('')
    setEditingTemplate(template)
    setFormData({
      title: template.title || '',
      location: template.location || '',
      budget: template.budget || '',
      description: template.description || '',
      status: template.status || 'PUBLISHED',
      publicationStatus: template.publicationStatus || 'PUBLISHED',
      isTemplate: true,
    })
    setIsFormOpen(true)
  }

  const handleFormSubmit = (e) => {
    e.preventDefault()
    if (!formData.title || !formData.budget) {
      setFormError('Le titre et le budget indicatif sont obligatoires.')
      return
    }
    saveMutation.mutate(formData)
  }

  if (isPending) {
    return (
      <div className="page vanguard-construction-templates-page">
        <PageHeader
          eyebrow="VANGUARD SERVICES · CONSTRUCTION"
          title={t('construction.projectTemplatesPage.title')}
          subtitle={t('construction.projectTemplatesPage.loading')}
        />
        <LoadingState type="cards" cardCount={3} />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="page vanguard-construction-templates-page">
        <PageHeader
          eyebrow="VANGUARD SERVICES · CONSTRUCTION"
          title={t('construction.projectTemplatesPage.title')}
          subtitle={t('construction.projectTemplatesPage.subtitle')}
        />
        <ErrorState
          title={t('construction.projectTemplatesPage.errorTitle')}
          message={error?.response?.data?.message || t('construction.projectTemplatesPage.errorMessage')}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  return (
    <div className="page vanguard-construction-templates-page">
      <PageHeader
        eyebrow="VANGUARD SERVICES · CONSTRUCTION"
        title={t('construction.projectTemplatesPage.title')}
        subtitle={t('construction.projectTemplatesPage.catalogSubtitle')}
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
                {t('construction.projectTemplatesPage.create')}
              </Button>
            )}
          </div>
        }
      />

      <FilterBar onRefresh={() => refetch()} isRefreshing={isFetching}>
        <SearchBar
          value={search}
          onChange={(val) => setSearch(val)}
          placeholder={t('construction.projectTemplatesPage.search')}
        />
      </FilterBar>

      {templatesList.length === 0 ? (
        <EmptyState
          title={t('construction.projectTemplatesPage.emptyTitle')}
          description={t('construction.projectTemplatesPage.emptyDescription')}
          icon={Layers}
          actionLabel={canManage ? t('construction.projectTemplatesPage.createFirst') : undefined}
          onAction={handleOpenCreate}
          actionIcon={Plus}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {templatesList.map((tpl) => (
            <Card key={tpl.id} className="vanguard-template-card" hover>
              <div style={{
                height: '140px',
                backgroundColor: '#FFF7ED',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: '#EA580C' }}>
                  <HardHat size={36} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{t('construction.projects.template')}</span>
                </div>
                <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                  <StatusBadge label={t('construction.projectTemplatesPage.template')} variant="success" dot={false} />
                </div>
              </div>

              <CardContent style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px', fontSize: '1.05rem', fontWeight: 700, color: '#0F172A' }}>
                      {tpl.title}
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={13} />
                      <span>{tpl.location || 'Kinshasa, RDC'}</span>
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
                              label: t('construction.projectTemplatesPage.delete'),
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
                  <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600}}>{t('construction.projectTemplatesPage.estimatedBudget')}</span>
                  <strong style={{ fontSize: '1.05rem', color: '#EA580C' }}>
                    {formatMoney(tpl.budget, lang)}
                  </strong>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isFormOpen && (
        <Modal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          title={editingTemplate ? t('construction.projectTemplatesPage.editTitle') : t('construction.projectTemplatesPage.createTitle')}
          subtitle={t('construction.projectTemplatesPage.configureSubtitle')}
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

            <FormField label={t('construction.projectTemplatesPage.projectTitle')} required>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder={t('construction.projectTemplatesPage.titlePlaceholder')}
                required
              />
            </FormField>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <FormField label={t('construction.projectTemplatesPage.location')}>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder={t('construction.projectTemplatesPage.locationPlaceholder')}
                />
              </FormField>

              <FormField label={t('construction.projectTemplatesPage.budget')} required>
                <Input
                  type="number"
                  value={formData.budget}
                  onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                  placeholder={t('construction.projectTemplatesPage.budgetPlaceholder')}
                  required
                />
              </FormField>
            </div>

            <FormField label={t('construction.projectTemplatesPage.description')}>
              <Textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('construction.projectTemplatesPage.descriptionPlaceholder')}
              />
            </FormField>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #E2E8F0' }}>
              <Button variant="secondary" onClick={() => setIsFormOpen(false)} disabled={saveMutation.isPending}>
                {t('construction.projectTemplatesPage.cancel')}
              </Button>
              <Button type="submit" variant="primary" loading={saveMutation.isPending}>
                {editingTemplate ? t('construction.projectTemplatesPage.save') : t('construction.projectTemplatesPage.createButton')}
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
          title={selectedTemplate.title}
          subtitle={t('construction.projectTemplatesPage.detailSubtitle', { id: selectedTemplate.id })}
          size="md"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>{t('construction.quoteRequests.budgetRange')}</span>
                <div style={{ marginTop: '2px', fontWeight: 700, fontSize: '1.1rem', color: '#EA580C' }}>
                  {formatMoney(selectedTemplate.budget, lang)}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>{t('construction.projects.location')}</span>
                <div style={{ marginTop: '2px', fontWeight: 600, color: '#0F172A' }}>{selectedTemplate.location || '—'}</div>
              </div>
            </div>

            {selectedTemplate.description && (
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>{t('construction.projects.fields.description')}</span>
                <p style={{ marginTop: '4px', fontSize: '0.875rem', color: '#334155', lineHeight: 1.5 }}>
                  {selectedTemplate.description}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid #E2E8F0' }}>
              <Button variant="secondary" onClick={() => setSelectedTemplate(null)}>
                {t('construction.projectTemplatesPage.close')}
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
          title={t('construction.projectTemplatesPage.deleteTitle')}
          message={t('construction.projectTemplatesPage.deleteMessage', { title: deletingTemplate.title })}
          confirmText={t('construction.projectTemplatesPage.deletePermanently')}
          loading={deleteMutation.isPending}
          variant="danger"
        />
      )}
    </div>
  )
}
