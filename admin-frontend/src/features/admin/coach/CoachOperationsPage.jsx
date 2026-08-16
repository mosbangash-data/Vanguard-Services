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
  const canManagePayments = hasPermission(user, 'MANAGE_RESERVATION_PAYMENT')
  const canScan = hasPermission(user, 'SCAN_TICKET')

  const tickets = useQuery({ queryKey: ['coach-tickets', search], queryFn: async () => (await api.get('/api/tickets', { params: { search } })).data.data, enabled: hasPermission(user, 'VIEW_RESERVATION') })
  const payments = useQuery({ queryKey: ['coach-pending-payments'], queryFn: async () => (await api.get('/api/reservation-payments', { params: { status: 'PENDING' } })).data.data, enabled: hasPermission(user, 'VIEW_PAYMENT') })
  const scans = useQuery({ queryKey: ['coach-scans'], queryFn: async () => (await api.get('/api/tickets/scans')).data.data, enabled: hasPermission(user, 'VIEW_TICKET_SCAN') })
  const settle = useMutation({
    mutationFn: ({ id, action }) => api.post(`/api/reservation-payments/${id}/${action}`),
    onSuccess: () => client.invalidateQueries({ queryKey: ['coach-pending-payments'] }),
  })
  const printTicket = async (ticketCode) => {
    const response = await api.get(`/api/tickets/${ticketCode}/print`, { responseType: 'blob' })
    window.open(URL.createObjectURL(response.data), '_blank', 'noopener,noreferrer')
  }

  if (!user) return null
  return <section className="page">
    <div className="agent-header"><h1>{t('operations.title')}</h1><p>{t('operations.subtitle')}</p></div>
    {canScan && <button type="button" className="button" onClick={() => setScannerOpen(true)}>{t('agent.scanTicket')}</button>}
    {settle.isError && <p className="error">{settle.error.response?.data?.message || t('operations.actionError')}</p>}

    {hasPermission(user, 'VIEW_PAYMENT') && <section><h2>{t('operations.pendingPayments')}</h2>{payments.isPending ? <p>{t('dashboard.loading')}</p> : <div className="table-responsive"><table><thead><tr><th>{t('reservation')}</th><th>{t('passenger')}</th><th>{t('amount')}</th><th>{t('statusLabel')}</th>{canManagePayments && <th>{t('operations.actions')}</th>}</tr></thead><tbody>{(payments.data?.payments || []).map((payment) => <tr key={payment.id}><td>{payment.reservation?.reservationCode}</td><td>{payment.reservation?.customerName}</td><td>{money(payment.amount, payments.data?.currency, lang)}</td><td>{t(`status.${payment.status.toLowerCase()}`)}</td>{canManagePayments && <td><button className="button" disabled={settle.isPending} onClick={() => settle.mutate({ id: payment.id, action: 'validate' })}>{t('operations.validate')}</button> <button className="button secondary" disabled={settle.isPending} onClick={() => settle.mutate({ id: payment.id, action: 'reject' })}>{t('operations.reject')}</button></td>}</tr>)}</tbody></table></div>}</section>}

    {hasPermission(user, 'VIEW_RESERVATION') && <section><h2>{t('operations.tickets')}</h2><input className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('operations.ticketSearch')} /><div className="table-responsive"><table><thead><tr><th>{t('ticket.title')}</th><th>{t('ticket.passenger')}</th><th>{t('ticket.route')}</th><th>{t('ticket.price')}</th><th>{t('ticket.status')}</th><th>{t('operations.actions')}</th></tr></thead><tbody>{(tickets.data?.tickets || []).map((ticket) => <tr key={ticket.id}><td><code>{ticket.ticketCode}</code><br /><small>{ticket.qrCode}</small></td><td>{ticket.reservation.customerName}<br />{t('ticket.seat')}: {ticket.reservation.seatNumber}</td><td>{ticket.reservation.trip.schedule.route.departureCity} → {ticket.reservation.trip.schedule.route.arrivalCity}</td><td>{money(ticket.reservation.totalAmount, tickets.data?.currency, lang)}</td><td>{t(`status.${ticket.status.toLowerCase()}`)}</td><td><button className="button secondary" onClick={() => printTicket(ticket.ticketCode)}>{t('ticket.print')}</button></td></tr>)}</tbody></table></div></section>}

    {hasPermission(user, 'VIEW_TICKET_SCAN') && <section><h2>{t('operations.scanHistory')}</h2><div className="table-responsive"><table><thead><tr><th>{t('ticket.title')}</th><th>{t('operations.agent')}</th><th>{t('operations.result')}</th><th>{t('date')}</th></tr></thead><tbody>{(scans.data?.scans || []).map((scan) => <tr key={scan.id}><td>{scan.ticket.ticketCode}</td><td>{scan.scannedBy.firstName} {scan.scannedBy.lastName}</td><td>{scan.result}</td><td>{new Date(scan.scannedAt).toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR')}</td></tr>)}</tbody></table></div></section>}
    {scannerOpen && <TicketScanner onClose={() => { setScannerOpen(false); client.invalidateQueries({ queryKey: ['coach-scans'] }); client.invalidateQueries({ queryKey: ['coach-tickets'] }) }} />}
  </section>
}
