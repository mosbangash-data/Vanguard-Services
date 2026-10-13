import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Pencil, Plus, Search, UserRound } from 'lucide-react'
import { api } from '../../../services/api'
import { useAuth } from '../../auth/authContext'
import { useLanguage } from '../../../i18n/useLanguage'
import { Modal } from '../../../components/ui/Modal'
import { StatusBadge } from '../../../components/ui/StatusBadge'

const emptyForm = {
  fullName: '', jobTitle: '', phone: '', hireDate: '', compensation: '', currency: 'USD', payFrequency: 'MONTHLY',
}
const payFrequencies = ['DAILY', 'WEEKLY', 'MONTHLY']
const attendanceStatuses = ['PRESENT', 'ABSENT', 'LEAVE']

const businessDateToday = () => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kinshasa', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).map(({ type, value }) => [type, value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

const displayDate = (value, lang) => value
  ? new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'fr-FR', { dateStyle: 'medium', timeZone: 'Africa/Kinshasa' }).format(new Date(`${String(value).slice(0, 10)}T12:00:00Z`))
  : '—'

const amountDisplay = (value, currency, lang) => {
  try {
    return new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value))
  } catch {
    return `${value} ${currency}`
  }
}

const staffItems = (response) => response.data?.data?.items || []
const errorMessage = (error, fallback) => error?.response?.data?.message || fallback

export function ManagerPersonnelPage() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()
  const queryClient = useQueryClient()
  const tx = (key) => t(`staffRegistry.${key}`)
  const [search, setSearch] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [activeFilter, setActiveFilter] = useState('ALL')
  const [formOpen, setFormOpen] = useState(false)
  const [editingWorker, setEditingWorker] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [selectedId, setSelectedId] = useState(null)
  const [attendanceDate, setAttendanceDate] = useState(businessDateToday)
  const [attendanceStatus, setAttendanceStatus] = useState('PRESENT')
  const [attendanceNote, setAttendanceNote] = useState('')
  const [pageError, setPageError] = useState('')

  const canUseRegistry = user?.role === 'MANAGER' && user?.department?.type === 'VANGUARD_COACH'
  const staffQuery = useQuery({
    queryKey: ['manager-staff', search, jobTitle, activeFilter],
    queryFn: async () => api.get('/api/manager/staff', { params: {
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(jobTitle.trim() ? { jobTitle: jobTitle.trim() } : {}),
      ...(activeFilter === 'ALL' ? {} : { isActive: activeFilter === 'ACTIVE' }),
    } }).then(staffItems),
    enabled: canUseRegistry,
  })
  const workerQuery = useQuery({
    queryKey: ['manager-staff-member', selectedId],
    queryFn: () => api.get(`/api/manager/staff/${selectedId}`).then((response) => response.data?.data?.staffMember),
    enabled: Boolean(canUseRegistry && selectedId),
  })
  const attendanceQuery = useQuery({
    queryKey: ['manager-staff-attendance', selectedId],
    queryFn: () => api.get(`/api/manager/staff/${selectedId}/attendance`, { params: { limit: 90 } }).then((response) => response.data?.data?.attendance || []),
    enabled: Boolean(canUseRegistry && selectedId),
  })

  const saveWorker = useMutation({
    mutationFn: () => editingWorker
      ? api.patch(`/api/manager/staff/${editingWorker.id}`, form)
      : api.post('/api/manager/staff', form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-staff'] })
      if (editingWorker) queryClient.invalidateQueries({ queryKey: ['manager-staff-member', editingWorker.id] })
      setFormOpen(false)
      setEditingWorker(null)
      setForm(emptyForm)
      setPageError('')
    },
    onError: (error) => setPageError(errorMessage(error, tx('saveError'))),
  })
  const changeStatus = useMutation({
    mutationFn: ({ id, isActive }) => api.patch(`/api/manager/staff/${id}/status`, { isActive }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['manager-staff'] })
      queryClient.invalidateQueries({ queryKey: ['manager-staff-member', variables.id] })
    },
    onError: (error) => setPageError(errorMessage(error, tx('saveError'))),
  })
  const saveAttendance = useMutation({
    mutationFn: () => api.put(`/api/manager/staff/${selectedId}/attendance`, { date: attendanceDate, status: attendanceStatus, note: attendanceNote }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-staff-attendance', selectedId] })
      setAttendanceNote('')
      setPageError('')
    },
    onError: (error) => setPageError(errorMessage(error, tx('saveError'))),
  })

  const rows = useMemo(() => staffQuery.data || [], [staffQuery.data])
  const openCreate = () => {
    setPageError('')
    setEditingWorker(null)
    setForm(emptyForm)
    setFormOpen(true)
  }
  const openEdit = (worker) => {
    setPageError('')
    setEditingWorker(worker)
    setForm({
      fullName: worker.fullName, jobTitle: worker.jobTitle, phone: worker.phone,
      hireDate: String(worker.hireDate).slice(0, 10), compensation: worker.compensation,
      currency: worker.currency, payFrequency: worker.payFrequency,
    })
    setFormOpen(true)
  }

  if (!canUseRegistry) return <section className="page"><div className="card"><h1>{tx('title')}</h1><p>{tx('saveError')}</p></div></section>

  return (
    <section className="page manager-staff-page">
      <header className="page-head">
        <div><p className="eyebrow">VANGUARD COACH · {tx('title')}</p><h1>{tx('title')}</h1><p>{tx('subtitle')}</p></div>
        <button type="button" className="button" onClick={openCreate}><Plus size={16} /> {tx('add')}</button>
      </header>

      {pageError && <p className="error" role="alert">{pageError}</p>}

      <div className="card">
        <div className="manager-staff-filters">
          <label><span>{tx('search')}</span><span className="manager-staff-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} /></span></label>
          <label><span>{tx('jobFilter')}</span><input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} /></label>
          <label><span>{tx('statusFilter')}</span><select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}><option value="ALL">{tx('all')}</option><option value="ACTIVE">{tx('active')}</option><option value="INACTIVE">{tx('inactive')}</option></select></label>
        </div>
        {staffQuery.isPending && <p role="status">{tx('loading')}</p>}
        {staffQuery.isError && <p className="error">{tx('loadError')}</p>}
        {!staffQuery.isPending && !staffQuery.isError && rows.length === 0 && <p className="empty">{tx('empty')}</p>}
        {rows.length > 0 && <div className="table-wrap"><table className="data-table"><thead><tr><th>{tx('fullName')}</th><th>{tx('jobTitle')}</th><th>{tx('phone')}</th><th>{tx('compensation')}</th><th>{tx('statusFilter')}</th><th>{tx('actions')}</th></tr></thead><tbody>
          {rows.map((worker) => <tr key={worker.id}>
            <td><button type="button" className="manager-staff-link" onClick={() => { setPageError(''); setSelectedId(worker.id) }}>{worker.fullName}</button></td>
            <td>{worker.jobTitle}</td><td>{worker.phone}</td>
            <td>{amountDisplay(worker.compensation, worker.currency, lang)} · {tx(worker.payFrequency.toLowerCase())}</td>
            <td><StatusBadge status={worker.isActive ? 'ACTIVE' : 'INACTIVE'} label={tx(worker.isActive ? 'active' : 'inactive')} /></td>
            <td className="manager-staff-actions"><button type="button" className="button secondary sm" onClick={() => openEdit(worker)}><Pencil size={14} /> {tx('edit')}</button>
              <button type="button" className="button secondary sm" disabled={changeStatus.isPending} onClick={() => {
                if (worker.isActive && !window.confirm(tx('confirmDeactivate'))) return
                changeStatus.mutate({ id: worker.id, isActive: !worker.isActive })
              }}>{worker.isActive ? tx('deactivate') : tx('activate')}</button></td>
          </tr>)}
        </tbody></table></div>}
      </div>

      <Modal isOpen={formOpen} onClose={() => !saveWorker.isPending && setFormOpen(false)} title={editingWorker ? tx('edit') : tx('add')} subtitle={tx('subtitle')} size="lg" showClose={!saveWorker.isPending}>
        <form onSubmit={(event) => { event.preventDefault(); saveWorker.mutate() }}>
          <h4>{tx('personalSection')}</h4>
          <div className="manager-staff-form-grid">
            <label>{tx('fullName')}<input required maxLength={120} value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} /></label>
            <label>{tx('phone')}<input required type="tel" maxLength={30} value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></label>
            <label>{tx('hireDate')}<input required type="date" value={form.hireDate} onChange={(event) => setForm((current) => ({ ...current, hireDate: event.target.value }))} /></label>
          </div>
          <h4>{tx('workSection')}</h4>
          <div className="manager-staff-form-grid">
            <label>{tx('jobTitle')}<input required maxLength={100} value={form.jobTitle} onChange={(event) => setForm((current) => ({ ...current, jobTitle: event.target.value }))} /></label>
            <label>{tx('compensation')}<input required type="number" min="0.01" step="0.01" value={form.compensation} onChange={(event) => setForm((current) => ({ ...current, compensation: event.target.value }))} /></label>
            <label>{tx('currency')}<select value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}><option value="USD">USD</option><option value="CDF">CDF</option></select></label>
            <label>{tx('payFrequency')}<select required value={form.payFrequency} onChange={(event) => setForm((current) => ({ ...current, payFrequency: event.target.value }))}><option value="">{tx('selectFrequency')}</option>{payFrequencies.map((frequency) => <option key={frequency} value={frequency}>{tx(frequency.toLowerCase())}</option>)}</select></label>
          </div>
          {pageError && <p className="error" role="alert">{pageError}</p>}
          <div className="manager-staff-modal-actions"><button type="button" className="button secondary" onClick={() => setFormOpen(false)} disabled={saveWorker.isPending}>{tx('cancel')}</button><button type="submit" className="button" disabled={saveWorker.isPending}>{saveWorker.isPending ? tx('loading') : tx('create')}</button></div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(selectedId)} onClose={() => setSelectedId(null)} title={workerQuery.data?.fullName || tx('details')} size="lg">
        {workerQuery.isPending && <p role="status">{tx('loading')}</p>}
        {workerQuery.isError && <p className="error">{tx('loadError')}</p>}
        {workerQuery.data && <>
          <div className="manager-staff-detail"><p><UserRound size={16} /> <strong>{tx('jobTitle')} :</strong> {workerQuery.data.jobTitle}</p><p><strong>{tx('phone')} :</strong> {workerQuery.data.phone}</p><p><strong>{tx('hireDate')} :</strong> {displayDate(workerQuery.data.hireDate, lang)}</p><p><strong>{tx('compensation')} :</strong> {amountDisplay(workerQuery.data.compensation, workerQuery.data.currency, lang)} · {tx(workerQuery.data.payFrequency.toLowerCase())}</p></div>
          <div className="manager-staff-modal-actions"><button type="button" className="button secondary" onClick={() => { const worker = workerQuery.data; setSelectedId(null); openEdit(worker) }}><Pencil size={14} /> {tx('edit')}</button><button type="button" className="button secondary" onClick={() => { if (window.confirm(tx('confirmDeactivate'))) changeStatus.mutate({ id: workerQuery.data.id, isActive: false }) }} disabled={!workerQuery.data.isActive || changeStatus.isPending}>{tx('deactivate')}</button></div>
          <h3><CalendarDays size={17} /> {tx('attendance')}</h3>
          <form className="manager-staff-attendance-form" onSubmit={(event) => { event.preventDefault(); saveAttendance.mutate() }}>
            <label>{tx('attendanceDate')}<input required type="date" value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} /></label>
            <label>{tx('attendanceStatus')}<select value={attendanceStatus} onChange={(event) => setAttendanceStatus(event.target.value)}>{attendanceStatuses.map((status) => <option key={status} value={status}>{tx(status.toLowerCase())}</option>)}</select></label>
            <label>{tx('note')}<input maxLength={500} value={attendanceNote} onChange={(event) => setAttendanceNote(event.target.value)} /></label>
            <button className="button" type="submit" disabled={saveAttendance.isPending}>{tx('saveAttendance')}</button>
          </form>
          {pageError && <p className="error" role="alert">{pageError}</p>}
          {attendanceQuery.isError && <p className="error">{tx('loadError')}</p>}
          {(attendanceQuery.data || []).length === 0 && !attendanceQuery.isPending && <p className="empty">{tx('noAttendance')}</p>}
          {(attendanceQuery.data || []).length > 0 && <div className="table-wrap"><table className="data-table"><thead><tr><th>{tx('attendanceDate')}</th><th>{tx('attendanceStatus')}</th><th>{tx('note')}</th></tr></thead><tbody>{attendanceQuery.data.map((entry) => <tr key={entry.id}><td>{displayDate(entry.attendanceDate, lang)}</td><td>{tx(entry.status.toLowerCase())}</td><td>{entry.note || '—'}</td></tr>)}</tbody></table></div>}
        </>}
      </Modal>
    </section>
  )
}
