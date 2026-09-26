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
  const [scannerOpen, setScannerOpen] = useState(false)
  const [receiptData, setReceiptData] = useState(null)
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [validatedTicket, setValidatedTicket] = useState(null)
  const [validationNotice, setValidationNotice] = useState('')
  const canManagePayments = hasPermission(user, 'MANAGE_RESERVATION_PAYMENT')
  const canScan = hasPermission(user, 'SCAN_TICKET')

  const tickets = useQuery({ queryKey: ['coach-tickets', search], queryFn: async () => (await api.get('/api/tickets', { params: { search } })).data.data, enabled: hasPermission(user, 'VIEW_RESERVATION') })
  const payments = useQuery({ queryKey: ['coach-pending-payments'], queryFn: async () => (await api.get('/api/reservation-payments', { params: { status: 'PENDING' } })).data.data, enabled: hasPermission(user, 'VIEW_PAYMENT') })
  const scans = useQuery({ queryKey: ['coach-scans'], queryFn: async () => (await api.get('/api/tickets/scans')).data.data, enabled: hasPermission(user, 'VIEW_TICKET_SCAN') })
  const settle = useMutation({
    mutationFn: ({ id, action }) => api.post(`/api/reservation-payments/${id}/${action}`),
    onSuccess: (response, variables) => {
      client.invalidateQueries({ queryKey: ['coach-pending-payments'] })
      client.invalidateQueries({ queryKey: ['coach-tickets'] })
      client.invalidateQueries({ queryKey: ['agent-dashboard'] })
      if (variables.action === 'validate') {
        setValidatedTicket(response.data?.data?.ticket || null)
        setValidationNotice(response.data?.data?.ticket ? 'Paiement validé et billet généré.' : 'Paiement validé. La réservation reste en attente du solde dû.')
        viewReceipt(variables.id)
      }
    },
  })
  const printTicket = async (ticketCode) => {
    const response = await api.get(`/api/tickets/${ticketCode}/print`, { responseType: 'blob' })
    window.open(URL.createObjectURL(response.data), '_blank', 'noopener,noreferrer')
  }

  const viewReceipt = async (paymentId) => {
    setReceiptLoading(true)
    try {
      const res = await api.get(`/api/reservation-payments/${paymentId}/receipt`)
      setReceiptData(res.data.data)
    } catch (err) {
      alert(err.response?.data?.message || t('operations.actionError'))
    } finally {
      setReceiptLoading(false)
    }
  }

  if (!user) return null
  return <section className="page">
    <div className="agent-header"><h1>{t('operations.title')}</h1><p>{t('operations.subtitle')}</p></div>
    {canScan && <button type="button" className="button" onClick={() => setScannerOpen(true)}>{t('agent.scanTicket')}</button>}
    {settle.isError && <p className="error">{settle.error.response?.data?.message || t('operations.actionError')}</p>}
    {validationNotice && <div className="agent-validation-success" role="status"><div><strong>{validationNotice}</strong>{validatedTicket && <span>{validatedTicket.ticketCode}</span>}</div>{validatedTicket && <button type="button" className="button secondary" onClick={() => printTicket(validatedTicket.ticketCode)}>{t('ticket.print')}</button>}</div>}

    {hasPermission(user, 'VIEW_PAYMENT') && <section className="coach-operations-section"><h2>{t('operations.pendingPayments')}</h2>{payments.isPending ? <p>{t('dashboard.loading')}</p> : payments.isError ? <p className="error" role="alert">{payments.error.response?.data?.message || t('operations.actionError')}</p> : !(payments.data?.payments || []).length ? <p className="agent-empty-state">Aucun paiement en espèces en attente dans votre périmètre.</p> : <div className="table-responsive"><table><thead><tr><th>{t('reservation')}</th><th>{t('passenger')}</th><th>{t('amount')}</th><th>{t('statusLabel')}</th><th>{t('operations.actions')}</th></tr></thead><tbody>{(payments.data?.payments || []).map((payment) => <tr key={payment.id}><td>{payment.reservation?.reservationCode}</td><td>{payment.reservation?.customerName}</td><td>{money(payment.amount, payments.data?.currency, lang)}</td><td>{t(`status.${payment.status.toLowerCase()}`)}</td><td>{canManagePayments && <><button className="button" disabled={settle.isPending} onClick={() => settle.mutate({ id: payment.id, action: 'validate' })}>{t('operations.validate')}</button>{' '}<button className="button secondary" disabled={settle.isPending} onClick={() => settle.mutate({ id: payment.id, action: 'reject' })}>{t('operations.reject')}</button>{' '}</>}<button className="button secondary" disabled={receiptLoading} onClick={() => viewReceipt(payment.id)}>{t('operations.receipt')}</button></td></tr>)}</tbody></table></div>}</section>}

    {hasPermission(user, 'VIEW_RESERVATION') && <section className="coach-operations-section"><h2>{t('operations.tickets')}</h2><input className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('operations.ticketSearch')} />{tickets.isPending ? <p>{t('dashboard.loading')}</p> : tickets.isError ? <p className="error" role="alert">{tickets.error.response?.data?.message || t('operations.actionError')}</p> : <div className="table-responsive"><table><thead><tr><th>{t('ticket.title')}</th><th>{t('ticket.passenger')}</th><th>{t('ticket.route')}</th><th>{t('ticket.price')}</th><th>{t('ticket.status')}</th><th>{t('operations.actions')}</th></tr></thead><tbody>{(tickets.data?.tickets || []).map((ticket) => <tr key={ticket.id}><td><code>{ticket.ticketCode}</code></td><td>{ticket.reservation.customerName}<br />{t('ticket.seat')}: {ticket.reservation.seatNumber}</td><td>{ticket.reservation.trip.schedule.route.departureCity} → {ticket.reservation.trip.schedule.route.arrivalCity}</td><td>{money(ticket.reservation.totalAmount, tickets.data?.currency, lang)}</td><td>{t(`status.${ticket.status.toLowerCase()}`)}</td><td><button className="button secondary" onClick={() => printTicket(ticket.ticketCode)}>{t('ticket.print')}</button></td></tr>)}</tbody></table></div>}</section>}

    {hasPermission(user, 'VIEW_TICKET_SCAN') && <section><h2>{t('operations.scanHistory')}</h2><div className="table-responsive"><table><thead><tr><th>{t('ticket.title')}</th><th>{t('operations.agent')}</th><th>{t('operations.result')}</th><th>{t('date')}</th></tr></thead><tbody>{(scans.data?.scans || []).map((scan) => <tr key={scan.id}><td>{scan.ticket.ticketCode}</td><td>{scan.scannedBy.firstName} {scan.scannedBy.lastName}</td><td>{scan.result}</td><td>{new Date(scan.scannedAt).toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR')}</td></tr>)}</tbody></table></div></section>}
    {scannerOpen && <TicketScanner onClose={() => { setScannerOpen(false); client.invalidateQueries({ queryKey: ['coach-scans'] }); client.invalidateQueries({ queryKey: ['coach-tickets'] }) }} />}

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
