import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
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
  ArrowRight,
  RefreshCw,
  Sparkles,
  Settings,
  BarChart3,
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
import { ChartCard } from '../../../components/dashboard/ChartCard'
import { apiErrorMessage } from '../../../utils/apiErrorMessage.mjs'

async function fetchDashboardOverview() {
  const response = await api.get('/api/dashboard/overview')
  return response.data?.data || response.data
}

const formatNumber = (value, lang = 'fr') => {
  const numeric = Number(value || 0)
  if (!Number.isFinite(numeric)) return '0'
  return new Intl.NumberFormat(lang === 'en' ? 'en-US' : lang === 'sw' ? 'sw-TZ' : 'fr-FR').format(numeric)
}

const formatMoney = (value, currency, lang = 'fr') => {
  const numeric = Number(value || 0)
  if (!Number.isFinite(numeric)) return '0'

  if (currency === 'CDF') {
    return `${new Intl.NumberFormat(lang === 'en' ? 'en-US' : lang === 'sw' ? 'sw-TZ' : 'fr-FR', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(numeric)} CDF`
  }

  return `$ ${new Intl.NumberFormat(lang === 'en' ? 'en-US' : lang === 'sw' ? 'sw-TZ' : 'fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric)}`
}

export function AdminDashboardPage() {
  const { lang, t } = useLanguage()
  const navigate = useNavigate()
  const [reportPeriod, setReportPeriod] = useState('month')
  const [reportStartDate, setReportStartDate] = useState('')
  const [reportEndDate, setReportEndDate] = useState('')

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-dashboard-overview'],
    queryFn: fetchDashboardOverview,
  })

  const salesReportQuery = useQuery({
    queryKey: ['vanguard-coach-sales-report', reportPeriod, reportStartDate, reportEndDate],
    queryFn: async () => {
      const params = { period: reportPeriod }
      if (reportPeriod === 'custom') {
        params.startDate = reportStartDate
        params.endDate = reportEndDate
      }
      const response = await api.get('/api/dashboard/vanguard-coach-sales', { params })
      return response.data?.data || response.data
    },
    enabled: reportPeriod !== 'custom' || Boolean(reportStartDate && reportEndDate),
  })

  if (isPending) {
    return (
      <div className="page vanguard-dashboard-page">
        <PageHeader
          eyebrow="VANGUARD SERVICES · SUPER ADMIN"
          title={t('adminDashboardUi.loadingTitle')}
          subtitle={t('adminDashboardUi.loadingSubtitle')}
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
          title={t('adminDashboardUi.title')}
          subtitle={t('adminDashboardUi.consolidatedSubtitle')}
        />
        <ErrorState
          title={t('dashboard.errorTitle')}
          message={apiErrorMessage(error, t)}
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
        title={t('adminDashboardUi.title')}
        subtitle={t('adminDashboardUi.subtitle')}
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            loading={isFetching}
            onClick={() => refetch()}
          >
            {t('adminDashboardUi.refresh')}
          </Button>
        }
      />

      {/* 1. Global Performance Metrics (Essential KPIs) */}
      <div className="vanguard-stats-grid">
        <StatCard
          title={t('adminDashboardUi.activeAgents')}
          value={formatNumber(global.activeAgents, lang)}
          subtitle={t('adminDashboardUi.allDepartments')}
          icon={Users}
          accent="primary"
          onClick={() => navigate('/admin/users')}
        />
        <StatCard
          title={t('adminDashboardUi.administrators')}
          value={formatNumber(global.activeAdmins, lang)}
          subtitle={t('adminDashboardUi.adminsScope')}
          icon={ShieldCheck}
          accent="primary"
          onClick={() => navigate('/admin/users')}
        />
        <StatCard
          title={t('adminDashboardUi.revenueUsd')}
          value={formatMoney(revenue.USD || 0, 'USD', lang)}
          subtitle={t('adminDashboardUi.globalRevenue')}
          icon={Banknote}
          accent="revenue"
        />
        <StatCard
          title={t('adminDashboardUi.revenueCdf')}
          value={formatMoney(revenue.CDF || 0, 'CDF', lang)}
          subtitle={t('adminDashboardUi.cdfRevenue')}
          icon={Banknote}
          accent="revenue"
        />
      </div>

      {/* 2. Quick Actions Bar */}
      <Card style={{ marginBottom: '24px' }}>
        <CardHeader style={{ padding: '14px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} color="#D97706" />
            <CardTitle style={{ fontSize: '0.95rem' }}>{t('adminDashboardUi.quickActions')}</CardTitle>
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
              {t('adminDashboardUi.newUser')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={Building2}
              onClick={() => navigate('/transport/agencies')}
            >
              {t('adminDashboardUi.newAgency')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={CarFront}
              onClick={() => navigate('/automobile/vehicles')}
            >
              {t('adminDashboardUi.newVehicle')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={HardHat}
              onClick={() => navigate('/construction/projects')}
            >
              {t('adminDashboardUi.newProject')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={Settings}
              onClick={() => navigate('/admin/account')}
            >
              {t('adminDashboardUi.myAccount')}
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
        {t('adminDashboardUi.departmentsSummary')}
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
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B' }}>{t('adminDashboardUi.coachDescription')}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
              <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>{t('adminDashboardUi.reservations')}</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
                  {formatNumber(transport.reservations?.total || 0, lang)}
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>{t('adminDashboardUi.tickets')}</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
                  {formatNumber(transport.tickets?.total || 0, lang)}
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>{t('adminDashboardUi.scheduledTrips')}</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
                  {formatNumber(transport.trips?.total || 0, lang)}
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>{t('adminDashboardUi.coachRevenue')}</span>
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
              <span>{t('adminDashboardUi.openCoach')}</span>
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
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B' }}>{t('adminDashboardUi.automobileDescription')}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
              <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>{t('adminDashboardUi.vehiclesInStock')}</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
                  {formatNumber(autoSales.vehicles?.total || 0, lang)}
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>{t('adminDashboardUi.customerInquiries')}</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
                  {formatNumber(autoSales.inquiries?.total || 0, lang)}
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>{t('adminDashboardUi.reservations')}</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
                  {formatNumber(autoSales.reservations?.total || 0, lang)}
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>{t('adminDashboardUi.autoRevenue')}</span>
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
              <span>{t('adminDashboardUi.openAutomobile')}</span>
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
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B' }}>{t('adminDashboardUi.constructionDescription')}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
              <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>{t('adminDashboardUi.totalProjects')}</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
                  {formatNumber(construction.projects?.total || 0, lang)}
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>{t('adminDashboardUi.inProgress')}</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#EA580C' }}>
                  {formatNumber(construction.projects?.IN_PROGRESS || 0, lang)}
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>{t('adminDashboardUi.quotes')}</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
                  {formatNumber(construction.quoteRequests?.total || 0, lang)}
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>{t('adminDashboardUi.completed')}</span>
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
              <span>{t('adminDashboardUi.openConstruction')}</span>
              <ArrowRight size={15} />
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card style={{ marginBottom: '28px' }}>
        <CardHeader>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart3 size={19} color="#2563EB" />
            <div>
              <CardTitle>{t('adminDashboardUi.coachSalesReport')}</CardTitle>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748B' }}>
                {t('adminDashboardUi.realData')}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'end', marginBottom: '20px' }}>
            <label style={{ display: 'grid', gap: '6px', fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>
              {t('adminDashboardUi.period')}
              <select value={reportPeriod} onChange={(event) => setReportPeriod(event.target.value)} style={{ minWidth: '150px', padding: '9px 10px', border: '1px solid #CBD5E1', borderRadius: '6px' }}>
                <option value="day">{t('adminDashboardUi.day')}</option>
                <option value="week">{t('adminDashboardUi.week')}</option>
                <option value="month">{t('adminDashboardUi.month')}</option>
                <option value="custom">{t('adminDashboardUi.custom')}</option>
              </select>
            </label>
            {reportPeriod === 'custom' && (
              <>
                <label style={{ display: 'grid', gap: '6px', fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>
                  {t('adminDashboardUi.from')}
                  <input type="date" value={reportStartDate} onChange={(event) => setReportStartDate(event.target.value)} style={{ padding: '8px 10px', border: '1px solid #CBD5E1', borderRadius: '6px' }} />
                </label>
                <label style={{ display: 'grid', gap: '6px', fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>
                  {t('adminDashboardUi.to')}
                  <input type="date" value={reportEndDate} onChange={(event) => setReportEndDate(event.target.value)} style={{ padding: '8px 10px', border: '1px solid #CBD5E1', borderRadius: '6px' }} />
                </label>
              </>
            )}
          </div>

          {salesReportQuery.isPending ? (
            <LoadingState message={t('adminDashboardUi.loadingReport')} />
          ) : salesReportQuery.isError ? (
            <ErrorState
              title={t('adminDashboardUi.reportLoadError')}
              message={apiErrorMessage(salesReportQuery.error, t)}
              onRetry={() => salesReportQuery.refetch()}
            />
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                {[
                  [t('adminDashboardUi.ticketsSold'), salesReportQuery.data?.totals?.tickets || 0],
                  [t('adminDashboardUi.passengers'), salesReportQuery.data?.totals?.passengers || 0],
                  [t('adminDashboardUi.parcelsRegistered'), salesReportQuery.data?.totals?.parcels || 0],
                  [t('adminDashboardUi.paymentsPaid'), salesReportQuery.data?.totals?.paidPayments || 0],
                ].map(([label, value]) => (
                  <div key={label} style={{ padding: '12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>{label}</div>
                    <div style={{ marginTop: '4px', fontSize: '1.35rem', fontWeight: 800, color: '#0F172A' }}>{formatNumber(value, lang)}</div>
                  </div>
                ))}
              </div>
              <div className="vanguard-dashboard-charts">
                <ChartCard
                  title={t('dashboard.paidPaymentsByRoute')}
                  description={t('dashboard.reportPeriodDescription')}
                  emptyMessage={t('dashboard.chartEmpty')}
                  data={(salesReportQuery.data?.byRoute || []).map((route) => ({ key: route.id, label: route.label, value: route.payments }))}
                />
                <ChartCard
                  title={t('dashboard.paymentStatuses')}
                  description={t('dashboard.reportPeriodDescription')}
                  emptyMessage={t('dashboard.chartEmpty')}
                  data={Object.entries(salesReportQuery.data?.statuses?.payments || {}).map(([status, count]) => {
                    const labelKey = `status.${status.toLowerCase()}`
                    const translated = t(labelKey)
                    return { key: status, label: translated.startsWith('status.') ? status.replaceAll('_', ' ') : translated, value: count }
                  })}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                <div style={{ padding: '14px', border: '1px solid #DBEAFE', borderRadius: '8px', background: '#EFF6FF' }}>
                  <div style={{ fontSize: '0.78rem', color: '#1D4ED8', fontWeight: 700 }}>{t('adminDashboardUi.ticketRevenue')}</div>
                  <strong>{formatMoney(salesReportQuery.data?.revenue?.tickets?.USD || 0, 'USD', lang)} · {formatMoney(salesReportQuery.data?.revenue?.tickets?.CDF || 0, 'CDF', lang)}</strong>
                </div>
                <div style={{ padding: '14px', border: '1px solid #D1FAE5', borderRadius: '8px', background: '#ECFDF5' }}>
                  <div style={{ fontSize: '0.78rem', color: '#047857', fontWeight: 700 }}>{t('adminDashboardUi.parcelRevenue')}</div>
                  <strong>{formatMoney(salesReportQuery.data?.revenue?.parcels?.USD || 0, 'USD', lang)} · {formatMoney(salesReportQuery.data?.revenue?.parcels?.CDF || 0, 'CDF', lang)}</strong>
                </div>
                <div style={{ padding: '14px', border: '1px solid #FED7AA', borderRadius: '8px', background: '#FFF7ED' }}>
                  <div style={{ fontSize: '0.78rem', color: '#C2410C', fontWeight: 700 }}>{t('adminDashboardUi.totalSales')}</div>
                  <strong>{formatMoney(salesReportQuery.data?.revenue?.total?.USD || 0, 'USD', lang)} · {formatMoney(salesReportQuery.data?.revenue?.total?.CDF || 0, 'CDF', lang)}</strong>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                <div>
                  <h3 style={{ margin: '0 0 10px', fontSize: '0.95rem' }}>{t('adminDashboardUi.salesByRoute')}</h3>
                  {(salesReportQuery.data?.byRoute || []).length === 0 ? <p style={{ color: '#64748B', fontSize: '0.85rem' }}>{t('adminDashboardUi.noSalesPeriod')}</p> : (salesReportQuery.data.byRoute || []).map((route) => (
                    <div key={route.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '8px 0', borderBottom: '1px solid #F1F5F9', fontSize: '0.84rem' }}>
                      <span>{route.code} · {route.label}</span><strong>{route.payments}</strong>
                    </div>
                  ))}
                </div>
                <div>
                  <h3 style={{ margin: '0 0 10px', fontSize: '0.95rem' }}>{t('adminDashboardUi.salesByAgency')}</h3>
                  {(salesReportQuery.data?.byAgency || []).length === 0 ? <p style={{ color: '#64748B', fontSize: '0.85rem' }}>{t('adminDashboardUi.noSalesPeriod')}</p> : (salesReportQuery.data.byAgency || []).map((agency) => (
                    <div key={agency.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '8px 0', borderBottom: '1px solid #F1F5F9', fontSize: '0.84rem' }}>
                      <span>{agency.code} · {agency.name}</span><strong>{agency.payments}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

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
                  {t('adminDashboardUi.auditActivity')}
                </h3>
                <p style={{ margin: 0, fontSize: '0.84rem', color: '#94A3B8' }}>
                  {t('adminDashboardUi.auditDescription')}
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
