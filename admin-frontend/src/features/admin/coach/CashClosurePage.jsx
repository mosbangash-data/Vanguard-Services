import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../services/api'
import { useAuth } from '../../auth/authContext'
import { hasPermission } from '../../auth/permissions'
import { useLanguage } from '../../../i18n/useLanguage'

const formatMoney = (value, currency, lang) => new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0))

export function CashClosurePage() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()
  const client = useQueryClient()
  const [businessDate, setBusinessDate] = useState('')
  const [declaredUsd, setDeclaredUsd] = useState('')
  const [declaredCdf, setDeclaredCdf] = useState('')
  const [justification, setJustification] = useState('')
  const [reviewId, setReviewId] = useState('')
  const [reason, setReason] = useState('')
  const [correctionUsd, setCorrectionUsd] = useState('')
  const [correctionCdf, setCorrectionCdf] = useState('')
  const [correctionReason, setCorrectionReason] = useState('')
  const text = (key) => t('managerWorkspace.' + key)
  const manager = user?.role === 'MANAGER'
  const canApprove = hasPermission(user, 'APPROVE_DAILY_CASH_CLOSURE')

  const day = useQuery({
    queryKey: ['cash-closure-day', user?.id, businessDate],
    queryFn: async () => (await api.get('/api/manager/cash-closures', { params: businessDate ? { businessDate } : {} })).data.data,
    enabled: manager,
  })
  useEffect(() => {
    if (day.data?.preview?.businessDate && !businessDate) setBusinessDate(day.data.preview.businessDate)
  }, [day.data?.preview?.businessDate, businessDate])
  useEffect(() => {
    const close = day.data?.closure
    if (close) {
      setDeclaredUsd(close.declaredUsd ?? '')
      setDeclaredCdf(close.declaredCdf ?? '')
      setJustification(close.justification || '')
    } else {
      setDeclaredUsd('')
      setDeclaredCdf('')
      setJustification('')
    }
  }, [day.data?.closure?.id, day.data?.closure?.status])

  const reload = () => {
    client.invalidateQueries({ queryKey: ['cash-closure-day'] })
    client.invalidateQueries({ queryKey: ['cash-closure-review'] })
  }
  const save = useMutation({
    mutationFn: async () => (await api.post('/api/manager/cash-closures', { businessDate, declaredUsd, declaredCdf, justification })).data.data,
    onSuccess: reload,
  })
  const submit = useMutation({
    mutationFn: async (id) => (await api.post('/api/manager/cash-closures/' + id + '/submit')).data.data,
    onSuccess: reload,
  })
  const review = useQuery({
    queryKey: ['cash-closure-review', reviewId],
    queryFn: async () => (await api.get('/api/manager/cash-closures/' + encodeURIComponent(reviewId.trim()))).data.data,
    enabled: Boolean(reviewId.trim() && canApprove),
    retry: false,
  })
  const reviewAction = useMutation({
    mutationFn: async ({ id, action, reason: actionReason }) => (await api.post('/api/manager/cash-closures/' + id + '/' + action, actionReason ? { reason: actionReason } : {})).data.data,
    onSuccess: reload,
  })
  const correction = useMutation({
    mutationFn: async (id) => (await api.post('/api/manager/cash-closures/' + id + '/corrections', { amountUsd: correctionUsd || '0', amountCdf: correctionCdf || '0', reason: correctionReason })).data.data,
    onSuccess: () => { setCorrectionUsd(''); setCorrectionCdf(''); setCorrectionReason(''); reload() },
  })
  const correctionReview = useMutation({
    mutationFn: async ({ id, correctionId, action }) => (await api.post('/api/manager/cash-closures/' + id + '/corrections/' + correctionId + '/' + action, action === 'reject' ? { reason } : {})).data.data,
    onSuccess: reload,
  })

  if (manager && day.isPending) return <section className="page"><p>{text('loading')}</p></section>
  if (manager && day.isError) return <section className="page"><p role="alert">{text('loadError')}</p></section>
  const payload = day.data
  const closure = payload?.closure
  const preview = payload?.preview
  const editable = !closure || ['DRAFT', 'REJECTED'].includes(closure.status)
  return <section className="page manager-workspace">
    <header className="section-heading"><div><h1>{text('cashClosureTitle')}</h1><p>{text('cashClosureDescription')}</p></div></header>
    {manager && <section className="dashboard-panel manager-panel">
      <div className="section-heading"><div><h2>{text('preparation')}</h2><p>{preview?.timeZone || ''}</p>{closure?.id && <small>{text('closureId')}: {closure.id}</small>}</div></div>
      <label>{text('businessDate')} <input type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} /></label>
      <div className="manager-staff-form">
        <label>{text('theoreticalUsd')} <strong>{formatMoney(preview?.theoreticalUsd, 'USD', lang)}</strong></label>
        <label>{text('theoreticalCdf')} <strong>{formatMoney(preview?.theoreticalCdf, 'CDF', lang)}</strong></label>
        <label>{text('declaredUsd')} <input type="number" min="0" step="0.01" value={declaredUsd} disabled={!editable} onChange={(event) => setDeclaredUsd(event.target.value)} /></label>
        <label>{text('declaredCdf')} <input type="number" min="0" step="0.01" value={declaredCdf} disabled={!editable} onChange={(event) => setDeclaredCdf(event.target.value)} /></label>
      </div>
      <label>{text('justification')} <textarea value={justification} disabled={!editable} onChange={(event) => setJustification(event.target.value)} /></label>
      {!!preview?.anomalies?.length && <div className="alert alert-warning" role="status">{text('anomalies')}: {preview.anomalies.length}</div>}
      {closure?.status && <p>{text('status')}: <strong>{closure.status}</strong> · {text('varianceUsd')}: {closure.varianceUsd ?? '—'} USD · {text('varianceCdf')}: {closure.varianceCdf ?? '—'} CDF</p>}
      {editable && <div className="agent-inline-actions"><button className="button secondary" disabled={save.isPending || !businessDate} onClick={() => save.mutate()}>{text('saveDraft')}</button>{closure && <button className="button" disabled={submit.isPending} onClick={() => submit.mutate(closure.id)}>{text('submit')}</button>}</div>}
      {(save.isError || submit.isError) && <p role="alert">{text('actionError')}</p>}
      {closure?.status === 'APPROVED' && <div><h3>{text('correction')}</h3><div className="manager-staff-form">
        <label>{text('correctionUsd')} <input type="number" step="0.01" value={correctionUsd} onChange={(event) => setCorrectionUsd(event.target.value)} /></label>
        <label>{text('correctionCdf')} <input type="number" step="0.01" value={correctionCdf} onChange={(event) => setCorrectionCdf(event.target.value)} /></label>
      </div><label>{text('correctionReason')} <textarea value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} /></label>
        <button className="button secondary" disabled={correction.isPending} onClick={() => correction.mutate(closure.id)}>{text('submitCorrection')}</button>
      </div>}
    </section>}
    {canApprove && <section className="dashboard-panel manager-panel">
      <h2>{text('reviewClosure')}</h2>
      <label>{text('closureId')} <input value={reviewId} onChange={(event) => setReviewId(event.target.value)} /></label>
      {review.isError && <p role="alert">{text('loadError')}</p>}
      {review.data?.closure && <div>
        <p>{review.data.closure.businessDate} · {review.data.closure.agencyId} · {review.data.closure.status}</p>
        <p>{text('theoreticalUsd')}: {review.data.closure.theoreticalUsd} USD · {text('theoreticalCdf')}: {review.data.closure.theoreticalCdf} CDF</p>
        <p>{text('varianceUsd')}: {review.data.closure.varianceUsd ?? '—'} USD · {text('varianceCdf')}: {review.data.closure.varianceCdf ?? '—'} CDF</p>
        {review.data.closure.status === 'SUBMITTED' && review.data.closure.agencyId !== (user?.agencyId || user?.agency?.id) && <>
          <label>{text('rejectionReason')} <input value={reason} onChange={(event) => setReason(event.target.value)} /></label>
          <div className="agent-inline-actions"><button className="button" disabled={reviewAction.isPending} onClick={() => reviewAction.mutate({ id: review.data.closure.id, action: 'approve' })}>{text('approve')}</button><button className="button secondary" disabled={reviewAction.isPending || !reason.trim()} onClick={() => reviewAction.mutate({ id: review.data.closure.id, action: 'reject', reason })}>{text('reject')}</button></div>
        </>}
        {review.data.closure.corrections?.filter((item) => item.status === 'SUBMITTED').map((item) => <p key={item.id}>{text('correction')}: {item.amountUsd} USD · {item.amountCdf} CDF · {item.reason}
          <button className="button sm" onClick={() => correctionReview.mutate({ id: review.data.closure.id, correctionId: item.id, action: 'approve' })}>{text('approve')}</button><button className="button secondary sm" onClick={() => correctionReview.mutate({ id: review.data.closure.id, correctionId: item.id, action: 'reject' })}>{text('reject')}</button></p>)}
      </div>}
    </section>}
  </section>
}