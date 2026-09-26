import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, FileText, HardHat, Image, Plus, RefreshCw, Wrench } from 'lucide-react'
import { useLanguage } from '../../i18n/useLanguage'
import { api } from '../../services/api'
import { PageHeader, StatCard, Card, CardHeader, CardTitle, CardContent, Button, StatusBadge, LoadingState, ErrorState, EmptyState, MediaImage } from '../../components/ui'

const fetchDashboard = async () => (await api.get('/api/construction/dashboard')).data?.data
const number = (value, lang) => new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR').format(value ?? 0)
const date = (value, lang) => value ? new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'fr-FR', { dateStyle: 'medium' }).format(new Date(value)) : '—'
const projectStatusLabel = (status) => ({ DRAFT: 'En préparation', PUBLISHED: 'Publié', ARCHIVED: 'Archivé' }[status] || status)

function SectionLink({ to, children }) { return <Link to={to} style={{ color: '#2563EB', fontSize: '.85rem', fontWeight: 600, textDecoration: 'none' }}>{children} →</Link> }

export function ConstructionDashboardPage() {
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const query = useQuery({ queryKey: ['construction-dashboard'], queryFn: fetchDashboard })
  const data = query.data

  if (query.isPending) return <div className="page"><PageHeader eyebrow="VANGUARD SERVICES · CONSTRUCTION" title="Pilotage Construction" subtitle="Projets, demandes et suivi des chantiers." /><LoadingState type="cards" cardCount={4} /></div>
  if (query.isError) return <div className="page"><PageHeader eyebrow="VANGUARD SERVICES · CONSTRUCTION" title="Pilotage Construction" subtitle="Projets, demandes et suivi des chantiers." /><ErrorState title="Tableau de bord indisponible" message={query.error?.response?.status === 403 ? 'Votre rôle ou vos permissions ne permettent pas d’accéder au tableau de bord Construction.' : query.error?.response?.data?.message || 'Les données Construction n’ont pas pu être chargées.'} onRetry={() => query.refetch()} /></div>

  const projects = data.projects
  const requests = data.customerRequests
  const quotes = data.quoteRequests
  const currency = data.scope?.currency || 'USD'
  const formatMoney = (amount) => new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR', { style: 'currency', currency }).format(Number(amount || 0))
  const recentProjects = projects.recentModified || []

  return (
    <div className="page vanguard-construction-dashboard">
      <PageHeader eyebrow="VANGUARD SERVICES · CONSTRUCTION & BTP" title="Pilotage Construction" subtitle="Suivez les projets, demandes, devis et dernières activités des chantiers."
        actions={<div style={{ display: 'flex', gap: 10 }}><Button variant="secondary" size="sm" icon={RefreshCw} loading={query.isFetching} onClick={() => query.refetch()}>Actualiser</Button><Button variant="primary" size="sm" icon={Plus} onClick={() => navigate('/construction/projects/new')}>Nouveau projet</Button></div>} />

      <div className="vanguard-stats-grid">
        <StatCard title="Projets Construction" value={number(projects.total, lang)} subtitle={`${number(projects.byStatus?.DRAFT, lang)} en préparation`} icon={Building2} accent="construction" onClick={() => navigate('/construction/projects')} />
        <StatCard title="Projets publiés" value={number(projects.published, lang)} subtitle="Statut projet et publication publiés" icon={HardHat} accent="primary" onClick={() => navigate('/construction/projects')} />
        <StatCard title="Demandes clients à traiter" value={requests ? number(requests.needsAction, lang) : '—'} subtitle={requests ? `${number(requests.total, lang)} au total` : 'Permission de consultation absente'} icon={Wrench} accent="warning" onClick={requests ? () => navigate('/construction/customer-requests') : undefined} />
        <StatCard title="Devis à traiter" value={quotes ? number(quotes.needsAction, lang) : '—'} subtitle={quotes ? `${number(quotes.total, lang)} au total` : 'Permission de consultation absente'} icon={FileText} accent="revenue" onClick={quotes ? () => navigate('/construction/quote-requests') : undefined} />
      </div>

      <Card style={{ marginBottom: 20 }}><CardHeader><CardTitle>Actions Construction</CardTitle></CardHeader><CardContent><div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <Button variant="outline" size="sm" icon={Plus} onClick={() => navigate('/construction/projects/new')}>Nouveau projet</Button>
        <Button variant="outline" size="sm" icon={Building2} onClick={() => navigate('/construction/projects')}>Voir les projets</Button>
        <Button variant="outline" size="sm" onClick={() => navigate('/construction/customer-requests')}>Demandes clients</Button>
        <Button variant="outline" size="sm" onClick={() => navigate('/construction/quote-requests')}>Demandes de devis</Button>
        <Button variant="outline" size="sm" onClick={() => navigate('/construction/templates')}>Templates</Button>
      </div><p style={{ color: '#64748B', fontSize: '.82rem', margin: '12px 0 0' }}>Ajoutez les mises à jour de chantier et gérez les médias depuis le détail de chaque projet.</p></CardContent></Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 20 }}>
        <Card><CardHeader><CardTitle>Projets à surveiller</CardTitle><SectionLink to="/construction/projects">Tous les projets</SectionLink></CardHeader><CardContent>
          <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            {['DRAFT', 'PUBLISHED', 'ARCHIVED'].map((status) => <StatusBadge key={status} label={`${projectStatusLabel(status)} · ${number(projects.byStatus?.[status], lang)}`} variant={status === 'ARCHIVED' ? 'neutral' : status === 'PUBLISHED' ? 'success' : 'warning'} />)}
          </div>
          <p style={{ margin: '0 0 12px', color: '#64748B', fontSize: '.82rem' }}>Publication : {Object.entries(projects.byPublicationStatus || {}).map(([status, count]) => `${status} ${number(count, lang)}`).join(' · ') || 'aucune donnée'}</p>
          <p style={{ margin: '0 0 14px', color: '#475569', fontSize: '.9rem' }}>Budget cumulé : <strong>{formatMoney(projects.budgetTotal)}</strong> · Sans budget : <strong>{number(projects.withoutBudget, lang)}</strong></p>
          {!recentProjects.length ? <EmptyState title="Aucun projet" description="Les projets Construction apparaîtront ici." actionLabel="Créer un projet" onAction={() => navigate('/construction/projects/new')} icon={Building2} /> : <div style={{ display: 'grid', gap: 10 }}>{recentProjects.map((project) => <Link key={project.id} to={`/construction/projects/${project.id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 12, background: '#F8FAFC', borderRadius: 8, color: 'inherit', textDecoration: 'none' }}><span><strong>{project.title}</strong><small style={{ display: 'block', color: '#64748B', marginTop: 4 }}>Modifié {date(project.updatedAt, lang)} · {project._count?.updates || 0} mise(s) à jour · {project._count?.gallery || 0} média(s)</small></span><StatusBadge label={projectStatusLabel(project.status)} /></Link>)}</div>}
          {!!projects.recentCreated?.length && <div style={{ marginTop: 18 }}><strong style={{ display: 'block', marginBottom: 8 }}>Récemment créés</strong>{projects.recentCreated.slice(0, 4).map((project) => <Link key={project.id} to={`/construction/projects/${project.id}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', color: '#475569', textDecoration: 'none' }}><span>{project.title}</span><small>{date(project.createdAt, lang)}</small></Link>)}</div>}
        </CardContent></Card>

        <Card><CardHeader><CardTitle>Demandes et devis nécessitant une action</CardTitle></CardHeader><CardContent>
          {requests && <section style={{ marginBottom: 18 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><strong>Demandes clients</strong><SectionLink to="/construction/customer-requests">Ouvrir</SectionLink></div>{['NEW', 'CONTACTED', 'IN_PROGRESS', 'WAITING_CLIENT', 'CONVERTED', 'RESOLVED', 'CLOSED'].map((status) => <div key={status} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', color: '#475569' }}><span>{status.replaceAll('_', ' ')}</span><strong>{number(requests.byStatus?.[status], lang)}</strong></div>)}</section>}
          {quotes && <section><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><strong>Demandes de devis</strong><SectionLink to="/construction/quote-requests">Ouvrir</SectionLink></div>{['NEW', 'IN_PROGRESS', 'WAITING_FOR_CLIENT', 'CLOSED'].map((status) => <div key={status} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', color: '#475569' }}><span>{status.replaceAll('_', ' ')}</span><strong>{number(quotes.byStatus?.[status], lang)}</strong></div>)}</section>}
          {!requests && !quotes && <EmptyState title="Données non accessibles" description="Les permissions de consultation des demandes et devis ne sont pas attribuées à votre rôle." />}
        </CardContent></Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        <Card><CardHeader><CardTitle>Dernières mises à jour des chantiers</CardTitle></CardHeader><CardContent>{data.recentUpdates === null ? <p>Permission de consultation des projets absente.</p> : !data.recentUpdates?.length ? <EmptyState title="Aucune mise à jour" description="Les mises à jour publiées sur les projets s’afficheront ici." icon={Wrench} /> : <div style={{ display: 'grid', gap: 10 }}>{data.recentUpdates.map((item) => <Link key={item.id} to={`/construction/projects/${item.project.id}`} style={{ padding: 12, background: '#F8FAFC', borderRadius: 8, color: 'inherit', textDecoration: 'none' }}><strong>{item.title}</strong><span style={{ display: 'block', color: '#475569', fontSize: '.85rem', marginTop: 4 }}>{item.project.title} · {date(item.createdAt, lang)}</span></Link>)}</div>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Derniers médias de chantier</CardTitle><Image size={18} color="#64748B" /></CardHeader><CardContent>{data.recentMedia === null ? <p>Permission de consultation des projets absente.</p> : !data.recentMedia?.length ? <EmptyState title="Aucun média" description="Les photos et preuves visuelles associées aux projets apparaîtront ici." icon={Image} /> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(125px,1fr))', gap: 12 }}>{data.recentMedia.map((item) => <Link key={item.id} to={`/construction/projects/${item.project.id}`} style={{ color: 'inherit', textDecoration: 'none' }}><div style={{ height: 100, overflow: 'hidden', borderRadius: 8, background: '#F1F5F9' }}><MediaImage media={item.media} variant="thumbnail" alt={item.caption || item.project.title} /></div><strong style={{ display: 'block', fontSize: '.85rem', marginTop: 6 }}>{item.project.title}</strong><small style={{ color: '#64748B' }}>{date(item.createdAt, lang)}</small></Link>)}</div>}</CardContent></Card>
      </div>
    </div>
  )
}
