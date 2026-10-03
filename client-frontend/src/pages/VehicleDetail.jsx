import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Gauge, Fuel, Cog, Palette, Calendar, Send, CheckCircle2, MessageSquareText } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageProvider'
import { api } from '../api/client'
import { useFetch } from '../hooks/useFetch'
import { LoadingState, ErrorState } from '../components/StateView'
import { translateError } from '../utils/errors'
import { MediaGallery } from '../components/media/MediaGallery'
import { WhatsAppIcon } from '../components/WhatsAppIcon'
import { formatVehiclePrice, getVehicleWhatsAppHref } from '../utils/vehiclePresentation'

const STATUS_LABELS = {
  AVAILABLE: 'available',
  RESERVED: 'reserved',
  SOLD: 'sold',
  IN_MAINTENANCE: 'maintenance',
}

export default function VehicleDetail() {
  const { id } = useParams()
  const { t, language } = useLanguage()
  const { data, loading, error, execute } = useFetch(() => api.getVehicle(id), { deps: [id] })

  const [form, setForm] = useState({ name: '', email: '', phone: '', inquiryType: 'INFORMATION', contactPreference: 'PHONE', message: '' })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const vehicle = data?.vehicle

  const getStatusLabel = (s) => (STATUS_LABELS[s] ? t(`automobilePage.${STATUS_LABELS[s]}`) : (s || t('automobilePage.statusUnknown')))
  const getStatusClass = (s) => {
    if (s === 'AVAILABLE') return 'badge-success'
    if (s === 'RESERVED') return 'badge-gold'
    if (s === 'SOLD') return 'badge-neutral'
    return 'badge-neutral'
  }
  const formatPrice = (price, currency) => formatVehiclePrice(price, currency, language, t)
  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)
    try {
      await api.createVehicleInquiry({
        vehicleId: id,
        customerName: form.name,
        customerEmail: form.email || null,
        customerPhone: form.phone || null,
        inquiryType: form.inquiryType,
        contactPreference: form.contactPreference || null,
        message: form.message,
      })
      setSuccess(true)
    } catch (err) {
      setSubmitError(translateError(err, t))
    } finally {
      setSubmitting(false)
    }
  }

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={t('automobilePage.vehicleLoadError')} onRetry={execute} />
  if (!vehicle) return <ErrorState message={t('states.error')} onRetry={execute} />

  return (
    <div className="vehicle-detail">
      <section className="section">
        <div className="container">
          <Link to="/automobile" className="vehicle-detail-back">
            <ArrowLeft size={16} aria-hidden="true" />
            {t('automobilePage.backToVehicles')}
          </Link>

          <div className="vehicle-detail-grid">
            <div className="vehicle-gallery">
              <MediaGallery
                items={vehicle.media}
                altPrefix={`${vehicle.brand} ${vehicle.model}`}
                objectFit="cover"
                className="vehicle-gallery-wrapper"
              />
            </div>

            <div className="vehicle-info">
              <div className="vehicle-detail-heading">
                <span className={`badge ${getStatusClass(vehicle.status)}`}>{getStatusLabel(vehicle.status)}</span>
                <h1 className="vehicle-info-title">{[vehicle.brand, vehicle.model].filter(Boolean).join(' ')}</h1>
                {vehicle.id && <p className="vehicle-detail-reference">{t('automobilePage.reference')}: {vehicle.id}</p>}
                <div className="vehicle-info-price">{formatPrice(vehicle.price, vehicle.currency)}</div>
              </div>

              <div className="vehicle-detail-actions">
                <a className="btn btn-whatsapp" href={getVehicleWhatsAppHref(vehicle, t)} target="_blank" rel="noopener noreferrer">
                  <WhatsAppIcon size={19} />{t('automobilePage.whatsapp')}
                </a>
                <a className="btn btn-outline" href="#vehicle-inquiry"><MessageSquareText size={17} aria-hidden="true" />{t('automobilePage.contact')}</a>
              </div>

              <div className="vehicle-specs-grid">
                {vehicle.year != null && <div className="vehicle-spec">
                  <Calendar size={18} aria-hidden="true" />
                  <span><strong>{t('automobilePage.year')}</strong>{vehicle.year}</span>
                </div>}
                {vehicle.mileage != null && (
                  <div className="vehicle-spec">
                    <Gauge size={18} aria-hidden="true" />
                    <span><strong>{t('automobilePage.mileage')}</strong>{new Intl.NumberFormat('fr-FR').format(vehicle.mileage)} km</span>
                  </div>
                )}
                {vehicle.fuelType && (
                  <div className="vehicle-spec">
                    <Fuel size={18} aria-hidden="true" />
                    <span><strong>{t('automobilePage.fuel')}</strong>{vehicle.fuelType}</span>
                  </div>
                )}
                {vehicle.transmission && (
                  <div className="vehicle-spec">
                    <Cog size={18} aria-hidden="true" />
                    <span><strong>{t('automobilePage.transmission')}</strong>{vehicle.transmission}</span>
                  </div>
                )}
                {vehicle.color && (
                  <div className="vehicle-spec">
                    <Palette size={18} aria-hidden="true" />
                    <span><strong>{t('automobilePage.color')}</strong>{vehicle.color}</span>
                  </div>
                )}
              </div>

              {vehicle.description && <section className="vehicle-detail-description" aria-labelledby="vehicle-description-title">
                <h2 id="vehicle-description-title">{t('automobilePage.description')}</h2>
                <p className="vehicle-info-desc">{vehicle.description}</p>
              </section>}

              <div className="vehicle-inquiry" id="vehicle-inquiry">
                <h3>{t('automobilePage.requestInfo')}</h3>
                {success ? (
                  <div className="form-success">
                    <div className="confirmation-icon"><CheckCircle2 size={40} aria-hidden="true" /></div>
                    <p>{t('automobilePage.inquirySuccess')}</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="iname">{t('automobilePage.inquiryName')} <span className="required">*</span></label>
                      <input id="iname" name="name" type="text" className="form-input" value={form.name} onChange={handleChange} required minLength={2} maxLength={120} />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label" htmlFor="iemail">{t('automobilePage.inquiryEmail')}</label>
                        <input id="iemail" name="email" type="email" className="form-input" value={form.email} onChange={handleChange} maxLength={160} />
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="iphone">{t('automobilePage.inquiryPhone')}</label>
                        <input id="iphone" name="phone" type="tel" className="form-input" value={form.phone} onChange={handleChange} maxLength={30} />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label" htmlFor="itype">{t('automobilePage.inquiryType')}</label>
                        <select id="itype" name="inquiryType" className="form-select" value={form.inquiryType} onChange={handleChange}>
                          <option value="INFORMATION">{t('automobilePage.inquiryTypeInfo')}</option>
                          <option value="PRICE_REQUEST">{t('automobilePage.inquiryTypePrice')}</option>
                          <option value="CONTACT">{t('automobilePage.inquiryTypeContact')}</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="ipref">{t('automobilePage.inquiryContactPreference')}</label>
                        <select id="ipref" name="contactPreference" className="form-select" value={form.contactPreference} onChange={handleChange}>
                          <option value="PHONE">{t('automobilePage.inquiryContactPreferencePhone')}</option>
                          <option value="EMAIL">{t('automobilePage.inquiryContactPreferenceEmail')}</option>
                          <option value="WHATSAPP">{t('automobilePage.inquiryContactPreferenceWhatsapp')}</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="imessage">{t('automobilePage.inquiryMessage')} <span className="required">*</span></label>
                      <textarea id="imessage" name="message" className="form-textarea" value={form.message} onChange={handleChange} required minLength={10} maxLength={2000} />
                    </div>
                    {submitError && <div className="notice notice-error">{submitError}</div>}
                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                      <Send size={18} aria-hidden="true" />
                      {submitting ? t('states.loading') : t('automobilePage.inquirySubmit')}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
