import React, { useState, useEffect, useMemo } from 'react'
import { Modal, Button } from '../../../components/ui'
import { useAuth } from '../../auth/authContext'
import { useLanguage } from '../../../i18n/useLanguage'
import { api } from '../../../services/api'
import { useNavigate } from 'react-router-dom'
import {
  User,
  Package,
  MapPin,
  Calculator,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Scale,
  Box,
} from 'lucide-react'

export function AgentParcelModal({ isOpen, onClose, onSuccess }) {
  const { user } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()

  // Form states
  const [senderName, setSenderName] = useState('')
  const [senderPhone, setSenderPhone] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [category, setCategory] = useState('STANDARD')
  const [pricingBasis, setPricingBasis] = useState('WEIGHT') // 'WEIGHT' | 'VOLUME'
  const [weightKg, setWeightKg] = useState('')
  const [volumeM3, setVolumeM3] = useState('')
  const [destinationAgencyId, setDestinationAgencyId] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [paymentTiming, setPaymentTiming] = useState('AT_DEPOSIT')
  const [cashCollected, setCashCollected] = useState(false)
  const paymentMethod = 'CASH'

  // API states
  const [agencies, setAgencies] = useState([])
  const [loadingAgencies, setLoadingAgencies] = useState(false)
  const [agencyLoadError, setAgencyLoadError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [successResult, setSuccessResult] = useState(null)
  const [receiptData, setReceiptData] = useState(null)
  const [receiptError, setReceiptError] = useState(false)
  const [receiptVisible, setReceiptVisible] = useState(true)

  // Agent origin agency info
  const agentAgency = user?.agency || agencies.find((agency) => agency.id === user?.agencyId) || null
  const originAgencyName = agentAgency?.name || (user?.agencyId ? `Agence (${user.agencyId})` : '')
  const originCity = agentAgency?.city || ''

  // Load agencies
  useEffect(() => {
    if (!isOpen) return
    let isMounted = true
    setLoadingAgencies(true)
    setAgencyLoadError(false)
    api.get('/api/agencies?limit=100')
      .then((res) => {
        if (!isMounted) return
        const list = res?.data?.data?.items || res?.data?.items || res?.items || (Array.isArray(res?.data) ? res.data : [])
        const activeList = list.filter((a) => a.isActive !== false)
        setAgencies(activeList)
      })
      .catch((err) => {
        console.error('Failed to load agencies', err)
        if (isMounted) setAgencyLoadError(true)
      })
      .finally(() => {
        if (isMounted) setLoadingAgencies(false)
      })
    return () => {
      isMounted = false
    }
  }, [isOpen])

  // Destination agencies (exclude agent's current agency)
  const destinationAgencies = useMemo(() => {
    return agencies.filter((a) => a.id !== user?.agencyId)
  }, [agencies, user?.agencyId])

  const selectedDestinationAgency = useMemo(() => {
    return agencies.find((a) => a.id === destinationAgencyId) || null
  }, [agencies, destinationAgencyId])

  // Reset modal state on open
  useEffect(() => {
    if (isOpen) {
      setSenderName('')
      setSenderPhone('')
      setRecipientName('')
      setRecipientPhone('')
      setCategory('STANDARD')
      setPricingBasis('WEIGHT')
      setWeightKg('')
      setVolumeM3('')
      setDestinationAgencyId('')
      setAmount('')
      setCurrency('USD')
      setPaymentTiming('AT_DEPOSIT')
      setCashCollected(false)
      setSubmitError('')
      setSuccessResult(null)
      setReceiptData(null)
      setReceiptError(false)
      setReceiptVisible(true)
    }
  }, [isOpen])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError('')

    if (!senderName.trim() || !senderPhone.trim()) {
      setSubmitError(t('agentParcel.senderSection') + ' : ' + t('resourceUi.required'))
      return
    }
    if (!recipientName.trim() || !recipientPhone.trim()) {
      setSubmitError(t('agentParcel.recipientSection') + ' : ' + t('resourceUi.required'))
      return
    }
    if (!destinationAgencyId) {
      setSubmitError(t('agentParcel.selectDestination'))
      return
    }
    if (paymentTiming === 'AT_DEPOSIT' && !cashCollected) {
      setSubmitError(t('agentParcel.cashCollectedConfirm'))
      return
    }

    const numericWeight = pricingBasis === 'WEIGHT' ? parseFloat(weightKg) : 0
    const numericVolume = pricingBasis === 'VOLUME' ? parseFloat(volumeM3) : 0

    if (pricingBasis === 'WEIGHT' && (!numericWeight || numericWeight <= 0)) {
      setSubmitError(t('agentParcel.weightKg') + ' : ' + t('resourceUi.required'))
      return
    }
    if (pricingBasis === 'VOLUME' && (!numericVolume || numericVolume <= 0)) {
      setSubmitError(t('agentParcel.volumeM3') + ' : ' + t('resourceUi.required'))
      return
    }
    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || !/^\d+(?:\.\d{1,2})?$/.test(amount.trim())) {
      setSubmitError(t('agentParcel.priceRequired'))
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        senderName: senderName.trim(),
        senderPhone: senderPhone.trim(),
        recipientName: recipientName.trim(),
        recipientPhone: recipientPhone.trim(),
        category,
        pricingBasis,
        weightKg: numericWeight,
        volumeM3: numericVolume,
        amount: numericAmount,
        currency: currency.trim().toUpperCase(),
        originAgencyId: user?.agencyId || undefined,
        originCity: originCity || agentAgency?.city || undefined,
        destinationAgencyId,
        destinationCity: selectedDestinationAgency?.city,
        paymentMethod,
        paymentTiming,
        cashCollected: paymentTiming === 'AT_DEPOSIT' ? cashCollected : false,
      }

      const res = await api.post('/api/parcels', payload)
      const parcel = res?.data?.data?.parcel || res?.data?.parcel || res?.parcel || res?.data
      if (!parcel?.id || !parcel?.trackingCode) throw new Error(t('resourceUi.operationFailed'))
      setSuccessResult(parcel)
      try {
        const receipt = await api.get(`/api/parcels/${encodeURIComponent(parcel.id)}/receipt`)
        setReceiptData(receipt?.data?.data)
      } catch {
        setReceiptError(true)
      }
      if (onSuccess) {
        onSuccess(parcel)
      }
    } catch (err) {
      setSubmitError(err?.response?.data?.message || err?.message || t('resourceUi.operationFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const printReceipt = () => {
    if (!receiptData) return
    const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
    const paid = ['PAID', 'VERIFIED', 'COMPLETED'].includes(receiptData.paymentStatus)
    const windowRef = window.open('', '_blank')
    if (!windowRef) return
    windowRef.opener = null
    windowRef.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escape(receiptData.trackingCode)}</title><style>@page{size:80mm auto;margin:4mm}*{box-sizing:border-box}body{font:14px Arial,sans-serif;color:#111;margin:0}.receipt{max-width:720px;margin:auto;padding:14px}.brand{text-align:center;border-bottom:1px dashed #777;padding-bottom:10px}.brand img{width:42px;height:42px}.row{display:flex;justify-content:space-between;gap:12px;margin:9px 0}.code{text-align:center;font-size:18px;font-weight:bold;margin:14px 0}.total{font-size:18px;font-weight:bold;border-top:1px solid #333;padding-top:12px}.muted{color:#555;font-size:12px}.no-print{display:none}@media print{body{width:100%}}</style></head><body><article class="receipt"><header class="brand"><img src="${escape(`${window.location.origin}/assets/logos/vanguard-admin-logo.svg`)}"><h2>VANGUARD SERVICES</h2><p>${escape(receiptData.origin || '')} → ${escape(receiptData.destination || '')}</p></header><p class="code">${escape(receiptData.trackingCode)}</p><div class="row"><span>Enregistré</span><strong>${escape(new Date(receiptData.receivedAt).toLocaleString())}</strong></div><div class="row"><span>Expéditeur</span><strong>${escape(receiptData.senderName)}</strong></div><div class="row"><span>Destinataire</span><strong>${escape(receiptData.recipientName)}</strong></div><div class="row total"><span>Total</span><strong>${escape(receiptData.amount)} ${escape(receiptData.currency)}</strong></div><div class="row"><span>Espèces</span><strong>${paid ? escape(t('agentParcel.paymentPaid')) : escape(t('agentParcel.paymentDueAtPickup'))}</strong></div><p class="muted">${escape(receiptData.senderPhone)} · ${escape(receiptData.recipientPhone)}</p></article><script>window.onload=()=>window.print()</script></body></html>`)
    windowRef.document.close()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('agentParcel.modalTitle')}
      subtitle={t('agentParcel.modalSubtitle')}
      size="lg"
    >
      {successResult ? (
        <div className="agent-parcel-success" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', marginBottom: '1rem' }}>
            <CheckCircle2 size={48} />
          </div>
          <h4 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            {t('agentParcel.successTitle')}
          </h4>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            {t('agentParcel.trackingCodeLabel')} : <strong style={{ color: 'var(--primary)', fontSize: '1.1rem', letterSpacing: '0.05em' }}>{successResult.trackingCode}</strong>
          </p>
          {receiptError && <p className="alert alert-danger" role="alert">{t('agentParcel.receiptLoadFailed')}</p>}
          {receiptData && <>
            {receiptVisible && <div className="receipt-printable" style={{ background: '#fff', color: '#111827', border: '1px solid #d1d5db', borderRadius: 8, padding: '1rem', textAlign: 'left', marginBottom: '1rem' }}>
              <strong>VANGUARD SERVICES</strong>
              <p>{receiptData.trackingCode}</p>
              <p>{receiptData.origin} → {receiptData.destination}</p>
              <p>{receiptData.senderName} → {receiptData.recipientName}</p>
              <strong>{receiptData.amount} {receiptData.currency}</strong>
              <p>{receiptData.paymentStatus === 'PAID' ? t('agentParcel.paymentPaid') : t('agentParcel.paymentDueAtPickup')}</p>
            </div>}
            <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button type="button" variant="secondary" onClick={() => setReceiptVisible((visible) => !visible)}>{t('agentParcel.receiptView')}</Button>
              <Button type="button" variant="primary" onClick={printReceipt}>{t('agentParcel.receiptPrint')}</Button>
            </div>
          </>}
          <div style={{ background: 'var(--surface-raised, #f9fafb)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', textAlign: 'left', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>{t('agentParcel.senderName')} :</span>
              <strong>{successResult.senderName}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>{t('agentParcel.recipientName')} :</span>
              <strong>{successResult.recipientName}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>{t('agentParcel.totalToPay')} :</span>
              <strong style={{ color: '#10b981' }}>{successResult.amount} {successResult.currency}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{t('agentParcel.paymentMethod')} :</span>
              <span>{t('agentParcel.cash')}</span>
            </div>
          </div>
          <Button variant="primary" onClick={() => navigate('/transport/parcels')}>
            {t('agentParcel.parcelList')}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="agent-parcel-form" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {submitError && (
            <div className="alert alert-danger" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '0.9rem' }}>
              <AlertCircle size={18} />
              <span>{submitError}</span>
            </div>
          )}

          {/* Section 1: Expéditeur */}
          <div className="form-section-card" style={{ border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '8px', padding: '1rem' }}>
            <h5 style={{ margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', fontWeight: 600 }}>
              <User size={16} /> {t('agentParcel.senderSection')}
            </h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.85rem' }}>{t('agentParcel.senderName')} *</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  placeholder="Ex: Jean Mukendi"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.85rem' }}>{t('agentParcel.senderPhone')} *</label>
                <input
                  type="tel"
                  className="form-control"
                  required
                  placeholder="Ex: +243 812 345 678"
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Destinataire */}
          <div className="form-section-card" style={{ border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '8px', padding: '1rem' }}>
            <h5 style={{ margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', fontWeight: 600 }}>
              <User size={16} /> {t('agentParcel.recipientSection')}
            </h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.85rem' }}>{t('agentParcel.recipientName')} *</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  placeholder="Ex: Marie Kabila"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.85rem' }}>{t('agentParcel.recipientPhone')} *</label>
                <input
                  type="tel"
                  className="form-control"
                  required
                  placeholder="Ex: +243 999 123 456"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Colis & Critère de tarification */}
          <div className="form-section-card" style={{ border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '8px', padding: '1rem' }}>
            <h5 style={{ margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', fontWeight: 600 }}>
              <Package size={16} /> {t('agentParcel.parcelSection')}
            </h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.85rem' }}>{t('agentParcel.parcelType')}</label>
                <select
                  className="form-control"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="STANDARD">Standard</option>
                  <option value="DOCUMENT">Document</option>
                  <option value="FRAGILE">Fragile</option>
                </select>
              </div>
              <div className="form-group">
              </div>
            </div>

            {/* Mutually exclusive pricing criterion toggle */}
            <div style={{ marginTop: '0.5rem' }}>
              <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
                {t('agentParcel.pricingCriterion')} *
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <button
                  type="button"
                  className={`btn ${pricingBasis === 'WEIGHT' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                  onClick={() => {
                    setPricingBasis('WEIGHT')
                    setVolumeM3('')
                  }}
                >
                  <Scale size={16} /> {t('agentParcel.criterionWeight')}
                </button>
                <button
                  type="button"
                  className={`btn ${pricingBasis === 'VOLUME' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                  onClick={() => {
                    setPricingBasis('VOLUME')
                    setWeightKg('')
                  }}
                >
                  <Box size={16} /> {t('agentParcel.criterionVolume')}
                </button>
              </div>

              {pricingBasis === 'WEIGHT' ? (
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.85rem' }}>{t('agentParcel.weightKg')} *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    className="form-control"
                    required
                    placeholder="Ex: 5.5"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.85rem' }}>{t('agentParcel.volumeM3')} *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-control"
                    required
                    placeholder="Ex: 0.15"
                    value={volumeM3}
                    onChange={(e) => setVolumeM3(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Trajet / Agence */}
          <div className="form-section-card" style={{ border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '8px', padding: '1rem' }}>
            <h5 style={{ margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', fontWeight: 600 }}>
              <MapPin size={16} /> {t('agentParcel.routeSection')}
            </h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.85rem' }}>{t('agentParcel.originAgency')}</label>
                <input
                  type="text"
                  className="form-control"
                  disabled
                  readOnly
                  value={originAgencyName ? `${originAgencyName}${originCity ? ` • ${originCity}` : ''}` : 'Agence connectée'}
                  style={{ background: 'var(--surface-raised, #f3f4f6)', cursor: 'not-allowed', color: 'var(--text-muted)' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.85rem' }}>{t('agentParcel.destinationAgency')} *</label>
                <select
                  className="form-control"
                  required
                  value={destinationAgencyId}
                  onChange={(e) => setDestinationAgencyId(e.target.value)}
                  disabled={loadingAgencies}
                >
                  <option value="">{t('agentParcel.selectDestination')}</option>
                  {destinationAgencies.map((agency) => (
                    <option key={agency.id} value={agency.id}>
                      {agency.name} ({agency.city})
                    </option>
                  ))}
                </select>
                {agencyLoadError && <small className="form-error" role="alert">{t('agentParcel.agenciesLoadError')}</small>}
                {!loadingAgencies && !agencyLoadError && destinationAgencies.length === 0 && <small>{t('agentParcel.noDestinationAgencies')}</small>}
              </div>
            </div>
          </div>

          {/* Section 5: Agent-entered parcel price */}
          <div className="form-section-card" style={{ border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '8px', padding: '1rem', background: 'var(--surface-raised, #f9fafb)' }}>
            <h5 style={{ margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', fontWeight: 600 }}>
              <Calculator size={16} /> {t('agentParcel.pricingSection')}
            </h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 2fr) minmax(120px, 1fr)', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="agent-parcel-price">{t('agentParcel.manualPrice')} *</label>
                <input id="agent-parcel-price" className="form-control" type="number" min="0.01" max="99999999.99" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="25.00" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="agent-parcel-currency">{t('agentParcel.currency')} *</label>
                <input id="agent-parcel-currency" className="form-control" type="text" required minLength="3" maxLength="3" pattern="[A-Za-z]{3}" value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} />
              </div>
            </div>
          </div>

          {/* Section 6: Paiement colis */}
          <div className="form-section-card" style={{ border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '8px', padding: '1rem' }}>
            <h5 style={{ margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', fontWeight: 600 }}>
              <CreditCard size={16} /> {t('agentParcel.paymentSection')}
            </h5>
            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label className="form-label" style={{ fontSize: '0.85rem' }}>{t('agentParcel.paymentMethod')} *</label>
              <div className="form-control vanguard-fixed-payment-method" aria-label={t('agentParcel.paymentMethod')}>
                {t('agentParcel.cash')}
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: '.75rem' }}>
              <label className="form-label" htmlFor="parcel-payment-timing">{t('agentParcel.paymentTiming')}</label>
              <select id="parcel-payment-timing" className="form-control" value={paymentTiming} onChange={(event) => { setPaymentTiming(event.target.value); setCashCollected(false) }}>
                <option value="AT_DEPOSIT">{t('agentParcel.payAtDeposit')}</option>
                <option value="AT_PICKUP">{t('agentParcel.payAtPickup')}</option>
              </select>
            </div>
            {paymentTiming === 'AT_DEPOSIT' && <label style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-start', marginBottom: '.75rem' }}>
              <input type="checkbox" checked={cashCollected} onChange={(event) => setCashCollected(event.target.checked)} />
              <span>{t('agentParcel.cashCollectedConfirm')}</span>
            </label>}
            {paymentTiming === 'AT_PICKUP' && <p role="status">{t('agentParcel.paymentDueAtPickup')}</p>}
            {paymentMethod === 'CASH' && (
              <div style={{ fontSize: '0.85rem', color: '#b45309', background: 'rgba(245, 158, 11, 0.1)', padding: '0.6rem 0.8rem', borderRadius: '6px', borderLeft: '3px solid #f59e0b' }}>
              {t('agentParcel.cashNotice')}
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              {t('resourceUi.cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? t('agentParcel.submitting') : t('agentParcel.submit')}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
