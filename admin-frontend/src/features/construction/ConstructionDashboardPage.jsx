import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, FileText, HardHat, Image, Plus, RefreshCw, Wrench } from 'lucide-react'
import { useLanguage } from '../../i18n/useLanguage'
import { useAuth } from '../auth/authContext'
import { hasPermission } from '../auth/permissions'
import { api } from '../../services/api'
import { PageHeader, StatCard, Card, CardHeader, CardTitle, CardContent, Button, StatusBadge, LoadingState, ErrorState, EmptyState, MediaImage } from '../../components/ui'
import { ChartCard } from '../../components/dashboard/ChartCard'

const fetchDashboard = async () => (await api.get('/api/construction/dashboard')).data?.data
const number = (value, lang) => new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR').format(value ?? 0)
const date = (value, lang) => value ? new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'fr-FR', { dateStyle: 'medium' }).format(new Date(value)) : '—'
const projectStatusLabel = (status, t) => t(`construction.projects.statuses.${status}`)

function SectionLink({ to, children }) { return <Link to={to} style={{ color: '#2563EB', fontSize: '.85rem', fontWeight: 600, textDecoration: 'none' }}>{children} →</Link> }

export function ConstructionDashboardPage() {
  const { lang, t } = useLanguage()
  const d = (key, params) => t(`construction.workspace.${key}`, params)
  const { user } = useAuth()
  const navigate = useNavigate()
  const canCreateProject = hasPermission(user, 'CREATE_PROJECT') || user?.role === 'SUPER_ADMIN'
  const canViewRequests = hasPermission(user, 'VIEW_CUSTOMER_REQUEST') || user?.role === 'SUPER_ADMIN'
  const canViewQuotes = hasPermission(user, 'VIEW_QUOTE_REQUEST') || user?.role === 'SUPER_ADMIN'
  const query = useQuery({ queryKey: ['construction-dashboard'], queryFn: fetchDashboard })
  const data = query.data

  if (query.isPending) return <div className="page"><PageHeader eyebrow={d('eyebrow')} title={d('title')} subtitle={d('subtitle')} /><LoadingState type="cards" cardCount={4} message={d('loading')} /></div>
  if (query.isError) return <div className="page"><PageHeader eyebrow={d('eyebrow')} title={d('title')} subtitle={d('subtitle')} /><ErrorState title={d('unavailable')} message={query.error?.response?.status === 403 ? d('error403') : t('commonUi.errorMessage')} onRetry={() => query.refetch()} /></div>

  const projects = data.projects
  const requests = data.customerRequests
  const quotes = data.quoteRequests
  const currency = data.scope?.currency || 'USD'
  const formatMoney = (amount) => new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR', { style: 'currency', currency }).format(Number(amount || 0))
  const recentProjects = projects.recentModified || []

  return (
    <div className="page vanguard-construction-dashboard">
      <PageHeader eyebrow={d('eyebrow')} title={d('title')} subtitle={d('subtitle')}
        actions={<div style={{ display: 'flex', gap: 10 }}><Button variant="secondary" size="sm" icon={RefreshCw} loading={query.isFetching} onClick={() => query.refetch()}>{d('refresh')}</Button>{canCreateProject && <Button variant="primary" size="sm" icon={Plus} onClick={() => navigate('/construction/projects/new')}>{d('newProject')}</Button>}</div>} />

      <div className="vanguard-stats-grid">
        <StatCard title={d('projects')} value={number(projects.total, lang)} subtitle={d('preparationCount', { count: number(projects.byStatus?.DRAFT, lang) })} icon={Building2} accent="construction" onClick={() => navigate('/construction/projects')} />
        <StatCard title={d('published')} value={number(projects.published, lang)} subtitle={d('publishedSubtitle')} icon={HardHat} accent="primary" onClick={() => navigate('/construction/projects')} />
        {canViewRequests && <StatCard title={d('requests')} value={requests ? number(requests.needsAction, lang) : '—'} subtitle={requests ? d('totalCount', { count: number(requests.total, lang) }) : d('permissionMissing')} icon={Wrench} accent="warning" onClick={requests ? () => navigate('/construction/customer-requests') : undefined} />}
        {canViewQuotes && <StatCard title={d('quotes')} value={quotes ? number(quotes.needsAction, lang) : '—'} subtitle={quotes ? d('totalCount', { count: number(quotes.total, lang) }) : d('permissionMissing')} icon={FileText} accent="revenue" onClick={quotes ? () => navigate('/construction/quote-requests') : undefined} />}
      </div>

      <div className="vanguard-dashboard-charts">
        <ChartCard title={t('construction.projectStatusDistribution')} description={t('construction.title')} data={Object.entries(projects.byStatus || {}).map(([status, count]) => {
          const translated = t(`status.${status.toLowerCase()}`)
          return { key: status, label: translated.startsWith('status.') ? status.replaceAll('_', ' ') : translated, value: count }
        })} />
        {canViewRequests && requests && <ChartCard title={t('construction.requestStatusDistribution')} description={t('construction.title')} data={Object.entries(requests.byStatus || {}).map(([status, count]) => {
          const translated = t(`status.${status.toLowerCase()}`)
          return { key: status, label: translated.startsWith('status.') ? status.replaceAll('_', ' ') : translated, value: count }
        })} />}
        {canViewQuotes && quotes && <ChartCard title={t('construction.quoteStatusDistribution')} description={t('construction.title')} data={Object.entries(quotes.byStatus || {}).map(([status, count]) => {
          const translated = t(`status.${status.toLowerCase()}`)
          return { key: status, label: translated.startsWith('status.') ? status.replaceAll('_', ' ') : translated, value: count }
        })} />}
      </div>

      <Card style={{ marginBottom: 20 }}><CardHeader><CardTitle>{d('actions')}</CardTitle></CardHeader><CardContent><div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {canCreateProject && <Button variant="outline" size="sm" icon={Plus} onClick={() => navigate('/construction/projects/new')}>{d('newProject')}</Button>}
        <Button variant="outline" size="sm" icon={Building2} onClick={() => navigate('/construction/projects')}>{d('viewProjects')}</Button>
        {canViewRequests && <Button variant="outline" size="sm" onClick={() => navigate('/construction/customer-requests')}>{d('requestsAction')}</Button>}
        {canViewQuotes && <Button variant="outline" size="sm" onClick={() => navigate('/construction/quote-requests')}>{d('quotesAction')}</Button>}
        {canCreateProject && <Button variant="outline" size="sm" onClick={() => navigate('/construction/templates')}>{d('templates')}</Button>}
      </div><p style={{ color: '#64748B', fontSize: '.82rem', margin: '12px 0 0' }}>{d('projectActionsHint')}</p></CardContent></Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 20 }}>
        <Card><CardHeader><CardTitle>{d('projectsToWatch')}</CardTitle><SectionLink to="/construction/projects">{d('allProjects')}</SectionLink></CardHeader><CardContent>
          <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            {['DRAFT', 'PUBLISHED', 'ARCHIVED'].map((status) => <StatusBadge key={status} label={`${projectStatusLabel(status, t)} · ${number(projects.byStatus?.[status], lang)}`} variant={status === 'ARCHIVED' ? 'neutral' : status === 'PUBLISHED' ? 'success' : 'warning'} />)}
          </div>
          <p style={{ margin: '0 0 12px', color: '#64748B', fontSize: '.82rem' }}>{d('publication')}: {Object.entries(projects.byPublicationStatus || {}).map(([status, count]) => `${t(`construction.projects.publicationStatuses.${status}`)} ${number(count, lang)}`).join(' · ') || d('noPublicationData')}</p>
          <p style={{ margin: '0 0 14px', color: '#475569', fontSize: '.9rem' }}>{d('budgetTotal')}: <strong>{formatMoney(projects.budgetTotal)}</strong> · {d('withoutBudget')}: <strong>{number(projects.withoutBudget, lang)}</strong></p>
          {!recentProjects.length ? <EmptyState title={d('noProjects')} description={d('projectsAppear')} actionLabel={canCreateProject ? d('createProject') : undefined} onAction={canCreateProject ? () => navigate('/construction/projects/new') : undefined} icon={Building2} /> : <div style={{ display: 'grid', gap: 10 }}>{recentProjects.map((project) => <Link key={project.id} to={`/construction/projects/${project.id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 12, background: '#F8FAFC', borderRadius: 8, color: 'inherit', textDecoration: 'none' }}><span><strong>{project.title}</strong><small style={{ display: 'block', color: '#64748B', marginTop: 4 }}>{d('modified', { date: date(project.updatedAt, lang) })} · {d('updateCount', { count: project._count?.updates || 0 })} · {d('mediaCount', { count: project._count?.gallery || 0 })}</small></span><StatusBadge label={projectStatusLabel(project.status, t)} /></Link>)}</div>}
          {!!projects.recentCreated?.length && <div style={{ marginTop: 18 }}><strong style={{ display: 'block', marginBottom: 8 }}>{d('recentlyCreated')}</strong>{projects.recentCreated.slice(0, 4).map((project) => <Link key={project.id} to={`/construction/projects/${project.id}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', color: '#475569', textDecoration: 'none' }}><span>{project.title}</span><small>{date(project.createdAt, lang)}</small></Link>)}</div>}
        </CardContent></Card>

        <Card><CardHeader><CardTitle>{d('workNeedingAction')}</CardTitle></CardHeader><CardContent>
          {canViewRequests && requests && <section style={{ marginBottom: 18 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><strong>{d('requestsAction')}</strong><SectionLink to="/construction/customer-requests">{d('open')}</SectionLink></div>{['NEW', 'CONTACTED', 'IN_PROGRESS', 'WAITING_CLIENT', 'CONVERTED', 'RESOLVED', 'CLOSED'].map((status) => <div key={status} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', color: '#475569' }}><span>{t(`construction.workspace.statuses.${status}`)}</span><strong>{number(requests.byStatus?.[status], lang)}</strong></div>)}</section>}
          {canViewQuotes && quotes && <section><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><strong>{d('quotesAction')}</strong><SectionLink to="/construction/quote-requests">{d('open')}</SectionLink></div>{['NEW', 'IN_PROGRESS', 'WAITING_FOR_CLIENT', 'CLOSED'].map((status) => <div key={status} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', color: '#475569' }}><span>{t(`construction.workspace.statuses.${status}`)}</span><strong>{number(quotes.byStatus?.[status], lang)}</strong></div>)}</section>}
          {(!canViewRequests || !requests) && (!canViewQuotes || !quotes) && <EmptyState title={d('noAccessibleRequests')} description={d('noAccessibleRequestsText')} />}
        </CardContent></Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        <Card><CardHeader><CardTitle>{d('recentUpdates')}</CardTitle></CardHeader><CardContent>{data.recentUpdates === null ? <p>{d('noPermissionProjects')}</p> : !data.recentUpdates?.length ? <EmptyState title={d('noUpdates')} description={d('publishedUpdatesAppear')} icon={Wrench} /> : <div style={{ display: 'grid', gap: 10 }}>{data.recentUpdates.map((item) => <Link key={item.id} to={`/construction/projects/${item.project.id}`} style={{ padding: 12, background: '#F8FAFC', borderRadius: 8, color: 'inherit', textDecoration: 'none' }}><strong>{item.title}</strong><span style={{ display: 'block', color: '#475569', fontSize: '.85rem', marginTop: 4 }}>{item.project.title} · {date(item.createdAt, lang)}</span></Link>)}</div>}</CardContent></Card>
        <Card><CardHeader><CardTitle>{d('recentMedia')}</CardTitle><Image size={18} color="#64748B" /></CardHeader><CardContent>{data.recentMedia === null ? <p>{d('noPermissionProjects')}</p> : !data.recentMedia?.length ? <EmptyState title={d('noMedia')} description={d('projectMediaAppear')} icon={Image} /> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(125px,1fr))', gap: 12 }}>{data.recentMedia.map((item) => <Link key={item.id} to={`/construction/projects/${item.project.id}`} style={{ color: 'inherit', textDecoration: 'none' }}><div style={{ height: 100, overflow: 'hidden', borderRadius: 8, background: '#F1F5F9' }}><MediaImage media={item.media} variant="thumbnail" alt={item.caption || item.project.title} /></div><strong style={{ display: 'block', fontSize: '.85rem', marginTop: 6 }}>{item.project.title}</strong><small style={{ color: '#64748B' }}>{date(item.createdAt, lang)}</small></Link>)}</div>}</CardContent></Card>
      </div>
    </div>
  )
}
