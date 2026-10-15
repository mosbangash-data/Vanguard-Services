import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../services/api'
import { useAuth } from '../../auth/authContext'
import { hasPermission } from '../../auth/permissions'
import { useLanguage } from '../../../i18n/useLanguage'

const formatMoney = (value, currency, lang) => new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0))

function CashClosureReviewPanel() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const client = useQueryClient()
  const [reviewId, setReviewId] = useState('')
  const [reason, setReason] = useState('')
  const text = (key) => t('managerWorkspace.' + key)
  const review = useQuery({
    queryKey: ['cash-closure-review', reviewId],
    queryFn: async () => (await api.get('/api/manager/cash-closures/' + encodeURIComponent(reviewId.trim()))).data.data,
    enabled: Boolean(reviewId.trim()),
    retry: false,
  })
  const reviewAction = useMutation({
    mutationFn: async ({ id, action, reason: actionReason }) => (await api.post('/api/manager/cash-closures/' + id + '/' + action, actionReason ? { reason: actionReason } : {})).data.data,
    onSuccess: () => client.invalidateQueries({ queryKey: ['cash-closure-review', reviewId] }),
  })
  const correctionReview = useMutation({
    mutationFn: async ({ id, correctionId, action }) => (await api.post('/api/manager/cash-closures/' + id + '/corrections/' + correctionId + '/' + action, action === 'reject' ? { reason } : {})).data.data,
    onSuccess: () => client.invalidateQueries({ queryKey: ['cash-closure-review', reviewId] }),
  })
  const closure = review.data?.closure
  if (!hasPermission(user, 'APPROVE_DAILY_CASH_CLOSURE')) return <section className="page"><p role="alert">{text('loadError')}</p></section>

  return <section className="page manager-workspace">
    <header className="section-heading"><div><h1>{text('cashClosureTitle')}</h1><p>{text('reviewClosure')}</p></div></header>
    <section className="dashboard-panel manager-panel">
      <h2>{text('reviewClosure')}</h2>
      <label>{text('closureId')} <input value={reviewId} onChange={(event) => setReviewId(event.target.value)} /></label>
      {review.isError && <p role="alert">{text('loadError')}</p>}
      {closure && <div>
        <p>{new Date(closure.businessDate).toLocaleDateString()} · {closure.agencyId} · {closure.status}</p>
        <p>{text('theoreticalUsd')}: {closure.theoreticalUsd} USD · {text('theoreticalCdf')}: {closure.theoreticalCdf} CDF</p>
        <p>{text('varianceUsd')}: {closure.varianceUsd ?? '—'} USD · {text('varianceCdf')}: {closure.varianceCdf ?? '—'} CDF</p>
        {closure.status === 'SUBMITTED' && closure.agencyId !== (user?.agencyId || user?.agency?.id) && <>
          <label>{text('rejectionReason')} <input value={reason} onChange={(event) => setReason(event.target.value)} /></label>
          <div className="agent-inline-actions">
            <button className="button" disabled={reviewAction.isPending} onClick={() => reviewAction.mutate({ id: closure.id, action: 'approve' })}>{text('approve')}</button>
            <button className="button secondary" disabled={reviewAction.isPending || !reason.trim()} onClick={() => reviewAction.mutate({ id: closure.id, action: 'reject', reason })}>{text('reject')}</button>
          </div>
        </>}
        {closure.corrections?.filter((item) => item.status === 'SUBMITTED').map((item) => <p key={item.id}>
          {text('correction')}: {item.amountUsd} USD · {item.amountCdf} CDF · {item.reason}
          <button className="button sm" disabled={correctionReview.isPending} onClick={() => correctionReview.mutate({ id: closure.id, correctionId: item.id, action: 'approve' })}>{text('approve')}</button>
          <button className="button secondary sm" disabled={correctionReview.isPending || !reason.trim()} onClick={() => correctionReview.mutate({ id: closure.id, correctionId: item.id, action: 'reject' })}>{text('reject')}</button>
        </p>)}
      </div>}
      {(reviewAction.isError || correctionReview.isError) && <p role="alert">{text('actionError')}</p>}
    </section>
  </section>
}

export function CashClosurePage() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()
  const client = useQueryClient()
  const [businessDate, setBusinessDate] = useState('')
  const [declaredUsd, setDeclaredUsd] = useState('')
  const [declaredCdf, setDeclaredCdf] = useState('')
  const [justification, setJustification] = useState('')
  const [feedback, setFeedback] = useState(null)
  const text = (key) => t('managerWorkspace.' + key)
  const manager = user?.role === 'MANAGER'
  const canApprove = hasPermission(user, 'APPROVE_DAILY_CASH_CLOSURE')

  const day = useQuery({
    queryKey: ['cash-closure-day', user?.id, businessDate],
    queryFn: async () => (await api.get('/api/manager/cash-closures', { params: businessDate ? { businessDate } : {} })).data.data,
    enabled: manager,
  })
  const closureData = day.data?.closure

  useEffect(() => {
    if (day.data?.preview?.businessDate && !businessDate) setBusinessDate(day.data.preview.businessDate)
  }, [day.data?.preview?.businessDate, businessDate])

  useEffect(() => {
    setDeclaredUsd(closureData?.declaredUsd ?? '')
    setDeclaredCdf(closureData?.declaredCdf ?? '')
    setJustification(closureData?.justification || '')
  }, [closureData])

  const reload = () => {
    client.invalidateQueries({ queryKey: ['cash-closure-day'] })
  }
  const save = useMutation({
    mutationFn: async (values) => (await api.post('/api/manager/cash-closures', values)).data.data,
    onSuccess: reload,
  })
  const submit = useMutation({
    mutationFn: async (id) => (await api.post('/api/manager/cash-closures/' + id + '/submit')).data.data,
    onSuccess: reload,
  })

  if (!manager) return canApprove ? <CashClosureReviewPanel /> : <section className="page"><p role="alert">{text('loadError')}</p></section>
  if (manager && day.isPending) return <section className="page"><p role="status">{text('loading')}</p></section>
  if (manager && day.isError) return <section className="page"><p role="alert">{text('loadError')}</p></section>

  const closure = closureData
  const preview = day.data?.preview
  const immutable = ['SUBMITTED', 'APPROVED'].includes(closure?.status)
  const isOpen = Boolean(closure && ['DRAFT', 'REJECTED'].includes(closure.status))
  const expectedUsd = Number(preview?.theoreticalUsd ?? 0)
  const expectedCdf = Number(preview?.theoreticalCdf ?? 0)
  const hasVariance = Number(declaredUsd) !== expectedUsd || Number(declaredCdf) !== expectedCdf
  const busy = save.isPending || submit.isPending

  const handleAction = async (event) => {
    event.preventDefault()
    setFeedback(null)

    if (isOpen && !window.confirm(text('closeCashConfirm'))) return

    const values = { businessDate, declaredUsd, declaredCdf, justification }
    try {
      const saved = await save.mutateAsync(values)
      if (isOpen) {
        await submit.mutateAsync(saved.closure.id)
        setFeedback({ type: 'success', message: text('cashCloseSuccess') })
      } else {
        setFeedback({ type: 'success', message: text('cashOpenSuccess') })
      }
    } catch {
      setFeedback({ type: 'error', message: text('actionError') })
    }
  }

  return <section className="page manager-workspace">
    <header className="section-heading">
      <div><h1>{text('cashClosureTitle')}</h1><p>{text('cashClosureDescription')}</p></div>
    </header>

    <section className="dashboard-panel manager-cash-panel" aria-labelledby="cash-register-title">
      <div className={`manager-cash-status ${isOpen ? 'manager-cash-status--open' : ''}`} aria-live="polite">
        <span className="manager-cash-status-dot" aria-hidden="true" />
        <strong id="cash-register-title">{isOpen ? text('cashStateOpen') : text('cashStateClosed')}</strong>
        {immutable && <span className="manager-cash-note">{text(closure.status === 'APPROVED' ? 'cashApproved' : 'cashSubmitted')}</span>}
      </div>

      <form onSubmit={handleAction}>
        <div className="manager-cash-form">
          <label>{text('businessDate')}
            <input type="date" required disabled={isOpen} value={businessDate} onChange={(event) => { setFeedback(null); setBusinessDate(event.target.value) }} />
          </label>
          {!immutable && <>
            <label>{text('declaredUsd')}
              <input type="number" min="0" step="0.01" required value={declaredUsd} onChange={(event) => setDeclaredUsd(event.target.value)} />
            </label>
            <label>{text('declaredCdf')}
              <input type="number" min="0" step="0.01" required value={declaredCdf} onChange={(event) => setDeclaredCdf(event.target.value)} />
            </label>
            {isOpen && hasVariance && <label>{text('justification')} *
              <textarea required value={justification} onChange={(event) => setJustification(event.target.value)} />
            </label>}
          </>}
        </div>

        {!immutable && <>
          <div className="manager-cash-expected">
            <span>{text('theoreticalUsd')}: <strong>{formatMoney(preview?.theoreticalUsd, 'USD', lang)}</strong></span>
            <span>{text('theoreticalCdf')}: <strong>{formatMoney(preview?.theoreticalCdf, 'CDF', lang)}</strong></span>
          </div>

          <div className="manager-cash-actions">
            <button className="button" type="submit" disabled={busy || !businessDate}>
              {isOpen ? text('cashCloseAction') : text('cashOpenAction')}
            </button>
          </div>
        </>}
      </form>

      {feedback && <p className={`manager-cash-feedback manager-cash-feedback--${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.message}</p>}
      {immutable && <p className="manager-cash-note">{text('cashImmutableHint')}</p>}
    </section>
  </section>
}
