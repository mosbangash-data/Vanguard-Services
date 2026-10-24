import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Download, Printer, RotateCcw, Search, Wallet } from 'lucide-react'
import { api } from '../../../services/api'
import { useLanguage } from '../../../i18n/useLanguage'
import { useAuth } from '../../auth/authContext'
import { LoadingState } from '../../../components/ui/LoadingState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { hasPermission } from '../../auth/permissions'

const localDate = (date, timeZone = 'Africa/Kinshasa') => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
const blankFilters = () => { const today = localDate(new Date()); return { startDate: today, endDate: today, currency: 'ALL', status: 'ALL', activity: 'ALL' } }
const safeText = (value) => { const text = String(value ?? ''); return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text }
const csvCell = (value) => `"${safeText(value).replace(/"/g, '""')}"`

export function CoachFinancialReportsPage() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()
  const [draft, setDraft] = useState(blankFilters)
  const [applied, setApplied] = useState(blankFilters)
  const [formError, setFormError] = useState('')
  const canView = hasPermission(user, 'VIEW_PAYMENT')
  const query = useQuery({
    queryKey: ['coach-financial-report', user?.id, applied],
    queryFn: async () => {
      const response = await api.get('/api/coach/financial-reports', { params: applied })
      if (!response.data?.success || !response.data?.data?.totals || !response.data?.data?.filters) throw new Error('Invalid report response')
      return response.data.data
    }, enabled: Boolean(canView && user?.id), retry: false,
  })
  const report = query.data
  const tx = (key) => t(`coachFinance.${key}`)
  const validate = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(draft.endDate) || draft.startDate > draft.endDate) return tx('invalidDates')
    const span = (Date.parse(`${draft.endDate}T00:00:00Z`) - Date.parse(`${draft.startDate}T00:00:00Z`)) / 86400000 + 1
    if (span > 366) return tx('rangeTooLong')
    return ''
  }
  const fmtMoney = (amount, currency) => new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount || 0))
  const formats = { USD: (value) => fmtMoney(value, 'USD'), CDF: (value) => fmtMoney(value, 'CDF') }
  const apply = (event) => { event.preventDefault(); const error = validate(); setFormError(error); if (!error) setApplied({ ...draft }) }
  const reset = () => { const initial = blankFilters(); setDraft(initial); setApplied(initial); setFormError('') }
  const csvRows = report ? [
    [tx('report'), tx('aggregatedOnly')], [tx('period'), `${report.filters.startDate} – ${report.filters.endDate}`], [tx('timezone'), report.filters.timeZone], [tx('scope'), report.filters.agencyId || tx('departmentScope')],
    [tx('activity'), report.filters.activity], [tx('currency'), report.filters.currency], [tx('status'), report.filters.status], [],
    [tx('metric'), 'USD', 'CDF'], [tx('transport'), report.totals.transportCollected.USD, report.totals.transportCollected.CDF], [tx('parcels'), report.totals.parcelCollected.USD, report.totals.parcelCollected.CDF], [tx('totalCollected'), report.totals.totalCollected.USD, report.totals.totalCollected.CDF], [tx('pending'), report.totals.pendingAmount.USD, report.totals.pendingAmount.CDF], [tx('mobileMoneyTransport'), report.totals.mobileMoney.transportCollected.USD, report.totals.mobileMoney.transportCollected.CDF], [tx('mobileMoneyParcels'), report.totals.mobileMoney.parcelCollected.USD, report.totals.mobileMoney.parcelCollected.CDF], [tx('mobileMoneyTotal'), report.totals.mobileMoney.totalCollected.USD, report.totals.mobileMoney.totalCollected.CDF], [tx('mobileMoneyPending'), report.totals.mobileMoney.pendingAmount.USD, report.totals.mobileMoney.pendingAmount.CDF], [tx('validatedCount'), report.totals.validatedPaymentCount, ''], [tx('tickets'), report.totals.issuedTicketCount, ''], [tx('generated'), new Date().toISOString()], [tx('refundWarning'), report.anomalies.refundReconciliation],
  ] : []
  const exportCsv = () => {
    const content = `\uFEFF${csvRows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'vanguard-coach-financial-report.csv'; link.click(); URL.revokeObjectURL(url)
  }
  const exportPdf = () => window.print()
  if (!canView) return <section className="page"><p role="alert">{tx('forbidden')}</p></section>
  return <section className="page coach-finance-page">
    <header className="manager-header"><div><p className="eyebrow">VANGUARD COACH · {tx('eyebrow')}</p><h1>{tx('title')}</h1><p>{tx('description')}</p></div><div className="coach-finance-actions"><button className="button secondary" onClick={() => query.refetch()} disabled={query.isFetching}><RotateCcw size={16}/>{tx('refresh')}</button><button className="button secondary" onClick={exportCsv} disabled={!report}><Download size={16}/>CSV</button><button className="button" onClick={exportPdf} disabled={!report}><Printer size={16}/>{tx('pdf')}</button></div></header>
    <form className="coach-finance-filters dashboard-panel" onSubmit={apply}>
      <label>{tx('startDate')}<input type="date" value={draft.startDate} onChange={(e) => setDraft((v) => ({ ...v, startDate: e.target.value }))}/></label><label>{tx('endDate')}<input type="date" value={draft.endDate} onChange={(e) => setDraft((v) => ({ ...v, endDate: e.target.value }))}/></label>
      <label>{tx('currency')}<select value={draft.currency} onChange={(e) => setDraft((v) => ({ ...v, currency: e.target.value }))}><option value="ALL">{tx('all')}</option><option>USD</option><option>CDF</option></select></label><label>{tx('activity')}<select value={draft.activity} onChange={(e) => setDraft((v) => ({ ...v, activity: e.target.value }))}><option value="ALL">{tx('all')}</option><option value="TRANSPORT">{tx('transport')}</option><option value="PARCEL">{tx('parcels')}</option></select></label>
      <label>{tx('status')}<select value={draft.status} onChange={(e) => setDraft((v) => ({ ...v, status: e.target.value }))}>{['ALL','PENDING','PROCESSING','VERIFIED','COMPLETED','FAILED','CANCELLED','REFUNDED','REJECTED'].map((s) => <option key={s} value={s}>{s === 'ALL' ? tx('all') : s}</option>)}</select></label><div className="coach-finance-filter-actions"><button className="button" type="submit"><Search size={15}/>{tx('apply')}</button><button className="button secondary" type="button" onClick={reset}>{tx('reset')}</button></div>
      {formError && <p className="error" role="alert">{formError}</p>}
    </form>
    {query.isPending && <LoadingState message={tx('loading')} />}
    {query.isError && <ErrorState title={tx('loadError')} message={tx('loadErrorDescription')} onRetry={query.refetch}/>}
    {report && <div className="coach-finance-report" aria-live="polite">
      <p className="coach-finance-period">{tx('appliedPeriod')}: <strong>{report.filters.startDate} – {report.filters.endDate}</strong> · {report.filters.timeZone} · {report.filters.agencyId || tx('departmentScope')}{query.isFetching && <span> · {tx('refreshing')}</span>}</p>
      <div className="coach-finance-cards">
        {[[tx('transport'), report.totals.transportCollected], [tx('parcels'), report.totals.parcelCollected], [tx('totalCollected'), report.totals.totalCollected], [tx('pending'), report.totals.pendingAmount], [tx('mobileMoneyTransport'), report.totals.mobileMoney.transportCollected], [tx('mobileMoneyParcels'), report.totals.mobileMoney.parcelCollected], [tx('mobileMoneyTotal'), report.totals.mobileMoney.totalCollected], [tx('mobileMoneyPending'), report.totals.mobileMoney.pendingAmount]].map(([label, amounts]) => <article className="dashboard-panel coach-finance-card" key={label}><span><Wallet size={17}/>{label}</span><strong>{formats.USD(amounts.USD)}</strong><strong>{formats.CDF(amounts.CDF)}</strong></article>)}
        <article className="dashboard-panel coach-finance-card"><span>{tx('validatedCount')}</span><strong>{report.totals.validatedPaymentCount}</strong><small>{tx('pendingCount')}: {report.totals.pendingPaymentCount}</small></article><article className="dashboard-panel coach-finance-card"><span>{tx('tickets')}</span><strong>{report.totals.issuedTicketCount}</strong></article>
      </div>
      {Object.entries(report.anomalies).filter(([key]) => key !== 'refundReconciliation').some(([, value]) => Number(value) > 0) && <section className="coach-finance-warning"><AlertTriangle/><div><strong>{tx('anomalies')}</strong><p>{Object.entries(report.anomalies).filter(([key]) => key !== 'refundReconciliation' && Number(report.anomalies[key]) > 0).map(([key, value]) => `${tx(key)}: ${value}`).join(' · ')}</p></div></section>}
      <section className="coach-finance-warning"><AlertTriangle/><div><strong>{tx('refundsTitle')}</strong><p>{report.anomalies.refundReconciliation}</p><small>{tx('refundCount')}: {report.anomalies.refundCount}</small></div></section>
      <section className="dashboard-panel coach-finance-history"><h2>{tx('historyTitle')}</h2><p>{tx('historyUnavailable')}</p><p>{tx('aggregatedOnly')}</p></section>
      <footer className="coach-finance-generated">{tx('generated')}: {new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())} · {tx('notCertified')}</footer>
    </div>}
  </section>
}
