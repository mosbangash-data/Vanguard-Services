import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../services/api'
import { useAuth } from '../../auth/authContext'
import { hasPermission } from '../../auth/permissions'
import { useLanguage } from '../../../i18n/useLanguage'
import { TicketScanner } from './TicketScanner'

const money = (value, currency, language) => new Intl.NumberFormat(language === 'en' ? 'en-US' : 'fr-FR', { style: 'currency', currency: currency || 'USD' }).format(Number(value || 0))

export function CoachOperationsPage() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()
  const client = useQueryClient()
  const [search, setSearch] = useState('')
  const [printFormat, setPrintFormat] = useState('80mm')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('payments')
  const [receiptData, setReceiptData] = useState(null)
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [validatedTicket, setValidatedTicket] = useState(null)
  const [validatedPaymentId, setValidatedPaymentId] = useState(null)
  const [validatedPayment, setValidatedPayment] = useState(null)
  const [validationNotice, setValidationNotice] = useState('')
  const canManagePayments = hasPermission(user, 'MANAGE_RESERVATION_PAYMENT')
  const canScan = hasPermission(user, 'SCAN_TICKET')

  const tickets = useQuery({ queryKey: ['coach-tickets', search], queryFn: async () => (await api.get('/api/tickets', { params: { search } })).data.data, enabled: hasPermission(user, 'VIEW_RESERVATION') })
  const payments = useQuery({ queryKey: ['coach-pending-payments'], queryFn: async () => (await api.get('/api/reservation-payments', { params: { status: 'PENDING' } })).data.data, enabled: hasPermission(user, 'VIEW_PAYMENT') })
  const scans = useQuery({ queryKey: ['coach-scans'], queryFn: async () => (await api.get('/api/tickets/scans')).data.data, enabled: hasPermission(user, 'VIEW_TICKET_SCAN') })
  const settle = useMutation({
    mutationFn: ({ id, action, reason }) => api.post(`/api/reservation-payments/${id}/${action}`, reason ? { reason } : {}),
    onSuccess: (response, variables) => {
      client.invalidateQueries({ queryKey: ['coach-pending-payments'] })
      client.invalidateQueries({ queryKey: ['coach-tickets'] })
      client.invalidateQueries({ queryKey: ['agent-dashboard'] })
      if (variables.action === 'validate') {
        setValidatedPaymentId(variables.id)
        setValidatedPayment(response.data?.data?.payment || null)
        setValidatedTicket(response.data?.data?.ticket || null)
        setValidationNotice(response.data?.data?.ticket ? t('operations.paymentValidated') : t('operations.paymentPartiallyValidated'))
      }
    },
  })
  const printTicket = async (ticketCode) => {
    const printWindow = window.open('about:blank', '_blank')
    if (!printWindow) return alert(lang === 'en' ? 'Allow pop-ups to print this ticket.' : 'Autorisez les fenêtres contextuelles pour imprimer ce billet.')
    printWindow.opener = null
    try {
      const response = await api.get(`/api/tickets/${ticketCode}/print`, { params: { format: printFormat }, responseType: 'text' })
      const origin = window.location.origin
      const html = String(response.data).replace(/(href|src)="\/([^"]*)"/g, `$1="${origin}/$2"`)
      const objectUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
      printWindow.location.replace(objectUrl)
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } catch {
      printWindow.close()
      alert(t('operations.actionError'))
    }
  }

  const viewReceipt = async (paymentId) => {
    setReceiptLoading(true)
    try {
      const res = await api.get(`/api/reservation-payments/${paymentId}/receipt`)
      setReceiptData(res.data.data)
    } catch {
      alert(t('operations.actionError'))
    } finally {
      setReceiptLoading(false)
    }
  }

  if (!user) return null
  const tabs = [
    hasPermission(user, 'VIEW_PAYMENT') && { id: 'payments', label: t('operations.pendingPayments') },
    hasPermission(user, 'VIEW_RESERVATION') && { id: 'tickets', label: t('operations.tickets') },
    canScan && { id: 'scanner', label: t('operations.scan') },
    hasPermission(user, 'VIEW_TICKET_SCAN') && { id: 'history', label: t('operations.scanHistory') },
  ].filter(Boolean)
  const selectedTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : tabs[0]?.id
  return <section className="page">
    <div className="coach-ticket-print-settings"><label>{t('operations.printFormat')} <select value={printFormat} onChange={(event) => setPrintFormat(event.target.value)}><option value="58mm">58 mm</option><option value="80mm">80 mm</option><option value="110mm">110 mm</option><option value="a4">A4</option></select></label><p>{lang === 'en' ? 'Bluetooth and built-in printers use the device print service.' : 'Les imprimantes Bluetooth ou intégrées utilisent le service d’impression du terminal.'}</p></div>
    <div className="agent-header"><h1>{t('operations.title')}</h1><p>{t('operations.subtitle')}</p></div>
    {!tabs.length ? <p className="agent-empty-state" role="status">{t('agent.noAuthorizedActions')}</p> : <nav className="coach-operations-tabs" role="tablist" aria-label={t('operations.title')}>
      {tabs.map((tab) => <button key={tab.id} id={`coach-tab-${tab.id}`} type="button" role="tab" aria-selected={selectedTab === tab.id} aria-controls={`coach-panel-${tab.id}`} className={`coach-operations-tab${selectedTab === tab.id ? ' is-active' : ''}`} onClick={() => { setActiveTab(tab.id); if (tab.id === 'scanner') setScannerOpen(true) }}>{tab.label}</button>)}
    </nav>}
    {settle.isError && <p className="error" role="alert">{t('operations.actionError')}</p>}
    {validationNotice && <div className="agent-validation-success" role="status"><div><strong>{validationNotice}</strong>{validatedTicket ? <><span>{t('reservation')}: {validatedTicket.reservation?.reservationCode || '—'}</span><span>{t('passenger')}: {validatedTicket.reservation?.customerName || '—'}</span><span>{t('amount')}: {money(validatedPayment?.amount, validatedPayment?.currency, lang)} · {validatedPayment?.method || 'CASH'}</span><span>{t('ticket.title')}: {validatedTicket.ticketCode}</span></> : <span>{t('operations.ticketWaiting')}</span>}</div><div className="agent-validation-actions">{validatedTicket && <><button type="button" className="button" onClick={() => printTicket(validatedTicket.ticketCode)}>{t('ticket.print')}</button><a className="button secondary" href={`/tickets/${encodeURIComponent(validatedTicket.ticketCode)}`} target="_blank" rel="noreferrer">{t('operations.viewTicket')}</a></>}{validatedPaymentId && <button type="button" className="button secondary" onClick={() => viewReceipt(validatedPaymentId)}>{t('operations.receipt')}</button>}<button type="button" className="button secondary" onClick={() => { setValidationNotice(''); setValidatedTicket(null); setValidatedPayment(null); setValidatedPaymentId(null) }}>{t('operations.closeTicket')}</button></div></div>}

    {selectedTab === 'payments' && <section id="coach-panel-payments" role="tabpanel" aria-labelledby="coach-tab-payments" className="coach-operations-section"><h2>{t('operations.pendingPayments')}</h2>{payments.isPending ? <p>{t('dashboard.loading')}</p> : payments.isError ? <p className="error" role="alert">{t('operations.actionError')}</p> : !(payments.data?.payments || []).length ? <p className="agent-empty-state">{t('operations.noPendingCash')}</p> : <div className="table-responsive"><table><thead><tr><th>{t('reservation')}</th><th>{t('passenger')}</th><th>{t('amount')}</th><th>{t('statusLabel')}</th><th>{t('operations.actions')}</th></tr></thead><tbody>{(payments.data?.payments || []).map((payment) => <tr key={payment.id}><td>{payment.reservation?.reservationCode}</td><td>{payment.reservation?.customerName}</td><td>{money(payment.amount, payments.data?.currency, lang)}</td><td>{t(`status.${payment.status.toLowerCase()}`)}</td><td>{canManagePayments && <><button className="button" disabled={settle.isPending} onClick={() => settle.mutate({ id: payment.id, action: 'validate' })}>{t('operations.validate')}</button>{' '}<button className="button secondary" disabled={settle.isPending} onClick={() => { const reason = window.prompt(t('operations.rejectReason')); if (reason?.trim()) settle.mutate({ id: payment.id, action: 'reject', reason: reason.trim() }) }}>{t('operations.reject')}</button>{' '}</>}<button className="button secondary" disabled={receiptLoading} onClick={() => viewReceipt(payment.id)}>{t('operations.receipt')}</button></td></tr>)}</tbody></table></div>}</section>}

    {selectedTab === 'tickets' && <section id="coach-panel-tickets" role="tabpanel" aria-labelledby="coach-tab-tickets" className="coach-operations-section"><h2>{t('operations.tickets')}</h2><input className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('operations.ticketSearch')} aria-label={t('operations.ticketSearch')} />{tickets.isPending ? <p>{t('dashboard.loading')}</p> : tickets.isError ? <p className="error" role="alert">{t('operations.actionError')}</p> : <div className="table-responsive"><table><thead><tr><th>{t('ticket.title')}</th><th>{t('ticket.passenger')}</th><th>{t('ticket.route')}</th><th>{t('ticket.price')}</th><th>{t('ticket.status')}</th><th>{t('operations.actions')}</th></tr></thead><tbody>{(tickets.data?.tickets || []).map((ticket) => <tr key={ticket.id}><td><code>{ticket.ticketCode}</code></td><td>{ticket.reservation?.customerName}<br />{t('ticket.seat')}: {ticket.reservation?.seatNumber}</td><td>{ticket.reservation?.trip?.schedule?.route?.departureCity || '—'} → {ticket.reservation?.trip?.schedule?.route?.arrivalCity || '—'}</td><td>{money(ticket.reservation?.totalAmount, tickets.data?.currency, lang)}</td><td>{t(`status.${ticket.status.toLowerCase()}`)}</td><td><button className="button secondary" onClick={() => printTicket(ticket.ticketCode)}>{t('ticket.print')}</button></td></tr>)}</tbody></table></div>}</section>}

    {selectedTab === 'scanner' && scannerOpen && <div id="coach-panel-scanner" role="tabpanel" aria-labelledby="coach-tab-scanner"><TicketScanner onClose={() => { setScannerOpen(false); setActiveTab(tabs[0]?.id || 'payments'); client.invalidateQueries({ queryKey: ['coach-scans'] }); client.invalidateQueries({ queryKey: ['coach-tickets'] }) }} /></div>}
    {selectedTab === 'history' && <section id="coach-panel-history" role="tabpanel" aria-labelledby="coach-tab-history" className="coach-operations-section"><h2>{t('operations.scanHistory')}</h2>{scans.isPending ? <p>{t('dashboard.loading')}</p> : scans.isError ? <p className="error" role="alert">{t('operations.actionError')}</p> : !(scans.data?.scans || []).length ? <p className="agent-empty-state">{t('agent.noRecentScans')}</p> : <div className="table-responsive"><table><thead><tr><th>{t('ticket.title')}</th><th>{t('operations.agent')}</th><th>{t('operations.result')}</th><th>{t('date')}</th></tr></thead><tbody>{(scans.data?.scans || []).map((scan) => <tr key={scan.id}><td>{scan.ticket?.ticketCode || '—'}</td><td>{scan.scannedBy ? `${scan.scannedBy.firstName} ${scan.scannedBy.lastName}` : '—'}</td><td>{scan.result}</td><td>{new Date(scan.scannedAt).toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR')}</td></tr>)}</tbody></table></div>}</section>}

    {receiptData && (
      <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div className="modal-content receipt-printable" style={{ background: '#fff', borderRadius: '8px', padding: '24px', maxWidth: '520px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
          <div style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>{t('operations.receipt')} — Vanguard Coach</h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>{receiptData.receiptNumber}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '14px', marginBottom: '16px' }}>
            <div><strong>{t('reservation')}:</strong> {receiptData.reservationCode}</div>
            <div><strong>{t('passenger')}:</strong> {receiptData.customerName}</div>
            {receiptData.customerPhone && <div><strong>Téléphone:</strong> {receiptData.customerPhone}</div>}
            {receiptData.route && <div style={{ gridColumn: 'span 2' }}><strong>Trajet:</strong> {receiptData.route}</div>}
            <div><strong>{t('amount')}:</strong> {money(receiptData.amount, receiptData.currency, lang)}</div>
            <div><strong>Méthode:</strong> {receiptData.method} ({receiptData.channel})</div>
            <div><strong>Statut:</strong> {receiptData.status}</div>
            <div><strong>Date:</strong> {new Date(receiptData.validatedAt).toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR')}</div>
          </div>

          {receiptData.agency && (
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
              <div><strong>Agence d'encaissement:</strong> {receiptData.agency.name} ({receiptData.agency.code})</div>
              {receiptData.agency.city && <div><strong>Ville:</strong> {receiptData.agency.city} {receiptData.agency.address ? `— ${receiptData.agency.address}` : ''}</div>}
              {receiptData.agency.phone && <div><strong>Tél Agence:</strong> {receiptData.agency.phone}</div>}
              <div><strong>Agent:</strong> {receiptData.validatedBy}</div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="button" onClick={() => window.print()}>{t('operations.printReceipt')}</button>
            <button type="button" className="button secondary" onClick={() => setReceiptData(null)}>{t('operations.closeReceipt')}</button>
          </div>
        </div>
      </div>
    )}
  </section>
}
