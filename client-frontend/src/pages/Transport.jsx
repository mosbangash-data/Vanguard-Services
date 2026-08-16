import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Search,
  Bus,
  ArrowRight,
  ArrowLeft,
  Calendar,
  MapPin,
  User,
  CheckCircle2,
  Info,
  Armchair,
  CreditCard,
} from 'lucide-react'
import { useLanguage } from '../i18n/LanguageProvider'
import { useReveal } from '../hooks/useReveal'
import SectionHeader from '../components/SectionHeader'
import { LoadingState } from '../components/StateView'
import { api } from '../api/client'
import { translateError } from '../utils/errors'

const STEPS = ['step1', 'step2', 'step3', 'step4', 'step5', 'step6']

const PAYMENT_METHODS = ['CASH', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CARD', 'OTHER']

const formatDate = (date) => {
  if (!date) return '—'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

const formatTime = (time) => time || '—'

const formatAmount = (amount, currency = 'USD') =>
  `${new Intl.NumberFormat('fr-FR').format(Number(amount))} ${currency}`

export default function Transport() {
  const { t } = useLanguage()
  const revealRef = useReveal()

  const [step, setStep] = useState(0)
  const [search, setSearch] = useState({ from: '', to: '', date: '' })
  const [trips, setTrips] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [selectedTrip, setSelectedTrip] = useState(null)
  const [seats, setSeats] = useState([])
  const [seatsLoading, setSeatsLoading] = useState(false)
  const [seatsError, setSeatsError] = useState(null)
  const [selectedSeat, setSelectedSeat] = useState(null)
  const [passenger, setPassenger] = useState({ name: '', phone: '', email: '' })
  const [booking, setBooking] = useState(null)
  const [bookingError, setBookingError] = useState(null)
  const [bookingLoading, setBookingLoading] = useState(false)

  // Consultation réservation
  const [lookupCode, setLookupCode] = useState('')
  const [lookupResult, setLookupResult] = useState(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState(null)

  // Paiement
  const [payment, setPayment] = useState({ amount: '', method: 'CASH', reference: '', comment: '' })
  const [paymentResult, setPaymentResult] = useState(null)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentError, setPaymentError] = useState(null)

  const handleSearch = async (e) => {
    e.preventDefault()
    setSearching(true)
    setSearchError(null)
    try {
      const result = await api.searchTrips({
        departure: search.from,
        arrival: search.to,
        date: search.date || undefined,
      })
      setTrips(result?.items || [])
      setStep(1)
    } catch (err) {
      setSearchError(translateError(err, t))
      setTrips([])
      setStep(1)
    } finally {
      setSearching(false)
    }
  }

  const handleSelectTrip = async (trip) => {
    setSelectedTrip(trip)
    setSelectedSeat(null)
    setSeats([])
    setSeatsError(null)
    setSeatsLoading(true)
    try {
      const result = await api.getTripSeats(trip.id)
      setSeats(result?.seats || [])
      setStep(2)
    } catch (err) {
      setSeatsError(translateError(err, t))
      setStep(2)
    } finally {
      setSeatsLoading(false)
    }
  }

  const handleSelectSeat = (seat) => {
    if (!seat.available) return
    setSelectedSeat(seat.number)
    setStep(3)
  }

  const handlePassengerSubmit = (e) => {
    e.preventDefault()
    setStep(4)
  }

  const handleConfirm = async () => {
    setBookingLoading(true)
    setBookingError(null)
    try {
      const result = await api.createReservation({
        tripId: selectedTrip.id,
        seatNumber: selectedSeat,
        customerName: passenger.name,
        customerPhone: passenger.phone,
        customerEmail: passenger.email || null,
      })
      setBooking(result?.reservation || null)
      setStep(5)
    } catch (err) {
      setBookingError(translateError(err, t))
    } finally {
      setBookingLoading(false)
    }
  }

  const handleLookup = async (e) => {
    e.preventDefault()
    setLookupLoading(true)
    setLookupError(null)
    setLookupResult(null)
    try {
      const result = await api.getReservationByCode(lookupCode.trim())
      setLookupResult(result?.reservation || null)
    } catch (err) {
      setLookupError(translateError(err, t))
    } finally {
      setLookupLoading(false)
    }
  }

  const handlePayment = async (e) => {
    e.preventDefault()
    if (!booking && !lookupResult) return
    const reservationId = booking?.id || lookupResult?.id
    setPaymentLoading(true)
    setPaymentError(null)
    setPaymentResult(null)
    try {
      const result = await api.createReservationPayment(reservationId, {
        amount: payment.amount,
        method: payment.method,
        reference: payment.reference || null,
        comment: payment.comment || null,
      })
      setPaymentResult(result)
    } catch (err) {
      setPaymentError(translateError(err, t))
    } finally {
      setPaymentLoading(false)
    }
  }

  const goBack = () => {
    if (step > 0) setStep(step - 1)
  }

  const stepLabels = STEPS.map((key) => t(`transportPage.${key}`))

  const getTripPrice = (trip) => {
    const price = trip.schedule?.price ?? trip.price
    const currency = trip.schedule?.currency ?? trip.currency
    return price != null ? formatAmount(price, currency) : '—'
  }

  const getTripDepartureTime = (trip) =>
    trip.schedule?.departureTime || (trip.departureAt ? formatTime(new Date(trip.departureAt).toLocaleTimeString()) : '—')

  const getTripArrivalTime = (trip) =>
    trip.schedule?.returnTime || (trip.arrivalAt ? formatTime(new Date(trip.arrivalAt).toLocaleTimeString()) : '—')

  return (
    <div ref={revealRef}>
      {/* ===== HERO ===== */}
      <section className="page-hero">
        <div
          className="page-hero-bg"
          style={{ backgroundImage: 'url(/assets/transport/transport-hero.jpg)' }}
          role="img"
          aria-label={t('transportPage.heroTitle')}
        />
        <div className="page-hero-overlay" />
        <div className="container page-hero-content">
          <h1 className="page-hero-title display-title reveal">{t('transportPage.heroTitle')}</h1>
          <p className="page-hero-subtitle reveal reveal-delay-1">{t('transportPage.heroSubtitle')}</p>
        </div>
      </section>

      {/* ===== RECHERCHE / RÉSERVATION ===== */}
      <section className="section">
        <div className="container">
          <div className="booking-card reveal">
            <div className="booking-steps">
              {stepLabels.map((label, index) => (
                <div
                  key={label}
                  className={`booking-step${index === step ? ' booking-step-active' : ''}${index < step ? ' booking-step-done' : ''}`}
                >
                  <span className="booking-step-num">
                    {index < step ? <CheckCircle2 size={16} aria-hidden="true" /> : index + 1}
                  </span>
                  <span className="booking-step-label">{label}</span>
                </div>
              ))}
            </div>

            {/* ÉTAPE 0 : Recherche */}
            {step === 0 && (
              <form onSubmit={handleSearch} className="booking-form">
                <div className="booking-form-grid">
                  <div className="form-group">
                    <label className="form-label" htmlFor="from">
                      {t('transportPage.from')} <span className="required">*</span>
                    </label>
                    <div className="input-with-icon">
                      <MapPin size={18} aria-hidden="true" />
                      <input
                        id="from"
                        type="text"
                        className="form-input"
                        placeholder={t('transportPage.fromPlaceholder')}
                        value={search.from}
                        onChange={(e) => setSearch({ ...search, from: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="to">
                      {t('transportPage.to')} <span className="required">*</span>
                    </label>
                    <div className="input-with-icon">
                      <MapPin size={18} aria-hidden="true" />
                      <input
                        id="to"
                        type="text"
                        className="form-input"
                        placeholder={t('transportPage.toPlaceholder')}
                        value={search.to}
                        onChange={(e) => setSearch({ ...search, to: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="date">
                      {t('transportPage.date')} <span className="required">*</span>
                    </label>
                    <div className="input-with-icon">
                      <Calendar size={18} aria-hidden="true" />
                      <input
                        id="date"
                        type="date"
                        className="form-input"
                        value={search.date}
                        onChange={(e) => setSearch({ ...search, date: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="form-group booking-submit">
                    <button type="submit" className="btn btn-primary btn-lg" disabled={searching}>
                      <Search size={18} aria-hidden="true" />
                      {searching ? t('states.loading') : t('transportPage.search')}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* ÉTAPE 1 : Résultats */}
            {step === 1 && (
              <div className="booking-results">
                <div className="booking-results-header">
                  <h3>{t('transportPage.resultsTitle')}</h3>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={goBack}>
                    <ArrowLeft size={16} aria-hidden="true" />
                    {t('transportPage.back')}
                  </button>
                </div>

                {searchError && (
                  <div className="notice notice-error">
                    <Info size={18} aria-hidden="true" />
                    <span>{searchError}</span>
                  </div>
                )}

                {!searchError && trips.length === 0 && (
                  <div className="notice notice-info">
                    <Info size={18} aria-hidden="true" />
                    <span>{t('transportPage.noResults')}</span>
                  </div>
                )}

                {!searchError && trips.length > 0 && (
                  <div className="trip-list">
                    {trips.map((trip) => (
                      <div key={trip.id} className="trip-card">
                        <div className="trip-card-route">
                          <div className="trip-card-city">
                            <span className="trip-card-city-name">{trip.route?.departureCity || '—'}</span>
                            <span className="trip-card-time">{getTripDepartureTime(trip)}</span>
                          </div>
                          <div className="trip-card-line">
                            <span className="trip-card-dot" />
                            <span className="trip-card-line-bar" />
                            <span className="trip-card-dot" />
                          </div>
                          <div className="trip-card-city">
                            <span className="trip-card-city-name">{trip.route?.arrivalCity || '—'}</span>
                            <span className="trip-card-time">{getTripArrivalTime(trip)}</span>
                          </div>
                        </div>
                        <div className="trip-card-meta">
                          <span className="trip-card-price">{getTripPrice(trip)}</span>
                          <span className="trip-card-seats">
                            <Bus size={14} aria-hidden="true" />
                            {trip.availableSeats ?? '—'} {t('transportPage.available')}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleSelectTrip(trip)}
                        >
                          {t('transportPage.selectTrip')}
                          <ArrowRight size={16} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ÉTAPE 2 : Siège */}
            {step === 2 && selectedTrip && (
              <div className="booking-seats">
                <div className="booking-results-header">
                  <h3>{t('transportPage.seatSelectTitle')}</h3>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={goBack}>
                    <ArrowLeft size={16} aria-hidden="true" />
                    {t('transportPage.back')}
                  </button>
                </div>

                <div className="trip-card seat-trip-summary">
                  <div className="trip-card-route">
                    <div className="trip-card-city">
                      <span className="trip-card-city-name">{selectedTrip.route?.departureCity || '—'}</span>
                      <span className="trip-card-time">{getTripDepartureTime(selectedTrip)}</span>
                    </div>
                    <div className="trip-card-line">
                      <span className="trip-card-dot" />
                      <span className="trip-card-line-bar" />
                      <span className="trip-card-dot" />
                    </div>
                    <div className="trip-card-city">
                      <span className="trip-card-city-name">{selectedTrip.route?.arrivalCity || '—'}</span>
                      <span className="trip-card-time">{getTripArrivalTime(selectedTrip)}</span>
                    </div>
                  </div>
                  <div className="trip-card-meta">
                    <span className="trip-card-price">
                      {selectedTrip.schedule?.price != null
                        ? formatAmount(selectedTrip.schedule.price, selectedTrip.schedule?.currency)
                        : formatAmount(selectedTrip.price, selectedTrip.currency)}
                    </span>
                    <span className="trip-card-date">
                      <Calendar size={14} aria-hidden="true" />
                      {formatDate(selectedTrip.departureAt)}
                    </span>
                  </div>
                </div>

                {seatsLoading && <LoadingState message={t('transportPage.seatLoading')} />}

                {!seatsLoading && seatsError && (
                  <div className="notice notice-error">
                    <Info size={18} aria-hidden="true" />
                    <span>{seatsError}</span>
                  </div>
                )}

                {!seatsLoading && !seatsError && seats.length === 0 && (
                  <div className="notice notice-info">
                    <Info size={18} aria-hidden="true" />
                    <span>{t('transportPage.noResults')}</span>
                  </div>
                )}

                {!seatsLoading && !seatsError && seats.length > 0 && (
                  <>
                    <div className="seat-grid" role="group" aria-label={t('transportPage.seatSelectTitle')}>
                      {seats.map((seat) => (
                        <button
                          key={seat.number}
                          type="button"
                          className={`seat${seat.available ? ' seat-available' : ' seat-occupied'}${selectedSeat === seat.number ? ' seat-selected' : ''}`}
                          disabled={!seat.available}
                          onClick={() => handleSelectSeat(seat)}
                          aria-label={`${t('transportPage.seatNumber')} ${seat.number} — ${
                            seat.available ? t('transportPage.seatAvailable') : t('transportPage.seatOccupied')
                          }`}
                          aria-pressed={selectedSeat === seat.number}
                        >
                          <Armchair size={18} aria-hidden="true" />
                          <span>{seat.number}</span>
                        </button>
                      ))}
                    </div>

                    <div className="seat-legend">
                      <span className="seat-legend-item">
                        <span className="seat seat-available seat-legend-box" aria-hidden="true" />
                        {t('transportPage.seatAvailable')}
                      </span>
                      <span className="seat-legend-item">
                        <span className="seat seat-occupied seat-legend-box" aria-hidden="true" />
                        {t('transportPage.seatOccupied')}
                      </span>
                      <span className="seat-legend-item">
                        <span className="seat seat-selected seat-legend-box" aria-hidden="true" />
                        {t('transportPage.seatSelected')}
                      </span>
                    </div>

                    {selectedSeat && (
                      <button type="button" className="btn btn-primary" onClick={() => setStep(3)}>
                        {t('transportPage.continue')}
                        <ArrowRight size={18} aria-hidden="true" />
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ÉTAPE 3 : Passager */}
            {step === 3 && (
              <form onSubmit={handlePassengerSubmit} className="booking-form">
                <div className="booking-results-header">
                  <h3>{t('transportPage.passengerInfo')}</h3>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={goBack}>
                    <ArrowLeft size={16} aria-hidden="true" />
                    {t('transportPage.back')}
                  </button>
                </div>
                <div className="booking-form-grid">
                  <div className="form-group">
                    <label className="form-label" htmlFor="pname">
                      {t('transportPage.passengerName')} <span className="required">*</span>
                    </label>
                    <div className="input-with-icon">
                      <User size={18} aria-hidden="true" />
                      <input
                        id="pname"
                        type="text"
                        className="form-input"
                        value={passenger.name}
                        onChange={(e) => setPassenger({ ...passenger, name: e.target.value })}
                        required
                        minLength={2}
                        maxLength={120}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="pphone">
                      {t('transportPage.passengerPhone')} <span className="required">*</span>
                    </label>
                    <input
                      id="pphone"
                      type="tel"
                      className="form-input"
                      value={passenger.phone}
                      onChange={(e) => setPassenger({ ...passenger, phone: e.target.value })}
                      required
                      minLength={7}
                      maxLength={30}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="pemail">
                      {t('transportPage.passengerEmail')}
                    </label>
                    <input
                      id="pemail"
                      type="email"
                      className="form-input"
                      value={passenger.email}
                      onChange={(e) => setPassenger({ ...passenger, email: e.target.value })}
                      maxLength={160}
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary">
                  {t('transportPage.continue')}
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
              </form>
            )}

            {/* ÉTAPE 4 : Récapitulatif */}
            {step === 4 && selectedTrip && (
              <div className="booking-summary">
                <div className="booking-results-header">
                  <h3>{t('transportPage.summary')}</h3>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={goBack}>
                    <ArrowLeft size={16} aria-hidden="true" />
                    {t('transportPage.back')}
                  </button>
                </div>
                <div className="summary-grid">
                  <div className="summary-item">
                    <span className="summary-label">{t('transportPage.departure')}</span>
                    <span className="summary-value">{selectedTrip.route?.departureCity || '—'}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">{t('transportPage.arrival')}</span>
                    <span className="summary-value">{selectedTrip.route?.arrivalCity || '—'}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">{t('transportPage.date')}</span>
                    <span className="summary-value">{formatDate(selectedTrip.departureAt)}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">{t('transportPage.departureTime')}</span>
                    <span className="summary-value">{getTripDepartureTime(selectedTrip)}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">{t('ticket.seat')}</span>
                    <span className="summary-value">{selectedSeat || '—'}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">{t('transportPage.passengerName')}</span>
                    <span className="summary-value">{passenger.name}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">{t('transportPage.price')}</span>
                    <span className="summary-value summary-price">
                      {selectedTrip.schedule?.price != null
                        ? formatAmount(selectedTrip.schedule.price, selectedTrip.schedule?.currency)
                        : formatAmount(selectedTrip.price, selectedTrip.currency)}
                    </span>
                  </div>
                </div>
                {bookingError && <div className="notice notice-error">{bookingError}</div>}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleConfirm}
                  disabled={bookingLoading}
                >
                  {bookingLoading ? t('transportPage.bookingSending') : t('transportPage.confirm')}
                </button>
              </div>
            )}

            {/* ÉTAPE 5 : Confirmation */}
            {step === 5 && (
              <div className="booking-confirmation">
                <div className="confirmation-icon">
                  <CheckCircle2 size={48} aria-hidden="true" />
                </div>
                <h3>{t('transportPage.confirmTitle')}</h3>
                <p>{t('transportPage.confirmMessage')}</p>
                {booking?.reservationCode && (
                  <div className="confirmation-code">{booking.reservationCode}</div>
                )}

                {/* Déclaration de paiement */}
                <div className="payment-section">
                  <h4>{t('transportPage.paymentTitle')}</h4>
                  <p className="payment-note">{t('transportPage.paymentSubtitle')}</p>

                  {paymentResult?.payment ? (
                    <div className="form-success">
                      <div className="confirmation-icon">
                        <CheckCircle2 size={40} aria-hidden="true" />
                      </div>
                      <h4>{t('transportPage.paymentDeclared')}</h4>
                      <div className="notice notice-info">
                        <Info size={18} aria-hidden="true" />
                        <span>{t('transportPage.paymentPendingNote')}</span>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handlePayment} className="payment-form">
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label" htmlFor="payAmount">
                            {t('transportPage.paymentAmount')} <span className="required">*</span>
                          </label>
                          <input
                            id="payAmount"
                            type="number"
                            step="0.01"
                            min="0.01"
                            className="form-input"
                            value={payment.amount}
                            onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="payMethod">
                            {t('transportPage.paymentMethod')} <span className="required">*</span>
                          </label>
                          <select
                            id="payMethod"
                            className="form-select"
                            value={payment.method}
                            onChange={(e) => setPayment({ ...payment, method: e.target.value })}
                            required
                          >
                            {PAYMENT_METHODS.map((method) => (
                              <option key={method} value={method}>
                                {t(`transportPage.paymentMethod${method[0]}${method.slice(1).toLowerCase()}`)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="payRef">
                          {t('transportPage.paymentReference')}
                        </label>
                        <input
                          id="payRef"
                          type="text"
                          className="form-input"
                          value={payment.reference}
                          onChange={(e) => setPayment({ ...payment, reference: e.target.value })}
                          maxLength={120}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="payComment">
                          {t('transportPage.paymentComment')}
                        </label>
                        <textarea
                          id="payComment"
                          className="form-textarea"
                          value={payment.comment}
                          onChange={(e) => setPayment({ ...payment, comment: e.target.value })}
                          maxLength={500}
                          rows={2}
                        />
                      </div>
                      {paymentError && <div className="notice notice-error">{paymentError}</div>}
                      <button type="submit" className="btn btn-outline" disabled={paymentLoading}>
                        <CreditCard size={18} aria-hidden="true" />
                        {paymentLoading ? t('transportPage.paymentSending') : t('transportPage.paymentSubmit')}
                      </button>
                      <div className="notice notice-info mt-4">
                        <Info size={18} aria-hidden="true" />
                        <span>{t('transportPage.paymentAlreadyNote')}</span>
                      </div>
                    </form>
                  )}
                </div>

                <Link to="/" className="btn btn-outline">
                  {t('ticket.backHome')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===== CONSULTATION RÉSERVATION ===== */}
      <section className="section section-alt">
        <div className="container">
          <div className="reveal">
            <SectionHeader
              center
              eyebrow={t('transportPage.reservationLookup')}
              title={t('transportPage.reservationLookup')}
              subtitle={t('transportPage.reservationLookupSubtitle')}
            />
          </div>

          <div className="lookup-card reveal reveal-delay-1">
            <form onSubmit={handleLookup} className="lookup-form">
              <div className="form-group lookup-input">
                <label className="form-label" htmlFor="lookupCode">
                  {t('transportPage.reservationCodeLabel')} <span className="required">*</span>
                </label>
                <input
                  id="lookupCode"
                  type="text"
                  className="form-input"
                  placeholder={t('transportPage.lookupPlaceholder')}
                  value={lookupCode}
                  onChange={(e) => setLookupCode(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={lookupLoading}>
                <Search size={18} aria-hidden="true" />
                {lookupLoading ? t('states.loading') : t('transportPage.lookupButton')}
              </button>
            </form>

            {lookupError && (
              <div className="notice notice-error">
                <Info size={18} aria-hidden="true" />
                <span>{lookupError}</span>
              </div>
            )}

            {lookupResult && (
              <div className="reservation-result">
                <h3>{t('transportPage.reservationFound')}</h3>
                <div className="summary-grid">
                  <div className="summary-item">
                    <span className="summary-label">{t('transportPage.reservationCodeLabel')}</span>
                    <span className="summary-value">{lookupResult.reservationCode}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">{t('transportPage.reservationStatus')}</span>
                    <span className="summary-value">{lookupResult.status}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">{t('transportPage.reservationTotal')}</span>
                    <span className="summary-value">{formatAmount(lookupResult.totalAmount)}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">{t('transportPage.reservationCreatedAt')}</span>
                    <span className="summary-value">{formatDate(lookupResult.createdAt)}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">{t('transportPage.reservationPassenger')}</span>
                    <span className="summary-value">{lookupResult.customerName}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">{t('transportPage.reservationSeat')}</span>
                    <span className="summary-value">{lookupResult.seatNumber}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">{t('transportPage.reservationTripInfo')}</span>
                    <span className="summary-value">
                      {lookupResult.trip?.route?.departureCity || '—'} → {lookupResult.trip?.route?.arrivalCity || '—'}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">{t('transportPage.date')}</span>
                    <span className="summary-value">{formatDate(lookupResult.trip?.departureAt)}</span>
                  </div>
                </div>

                {/* Paiements existants */}
                {lookupResult.payments && lookupResult.payments.length > 0 && (
                  <div className="payments-list">
                    <h4>{t('transportPage.reservationPayment')}</h4>
                    {lookupResult.payments.map((p) => (
                      <div key={p.id} className="payment-item">
                        <span>{p.method}</span>
                        <span>{formatAmount(p.amount)}</span>
                        <span className={`badge ${p.status === 'VERIFIED' || p.status === 'COMPLETED' ? 'badge-success' : 'badge-gold'}`}>
                          {p.status === 'VERIFIED' || p.status === 'COMPLETED'
                            ? p.status
                            : t('transportPage.reservationPaymentPending')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===== INFO ===== */}
      <section className="section">
        <div className="container">
          <div className="reveal">
            <SectionHeader
              center
              eyebrow={t('transport.eyebrow')}
              title={t('transport.title')}
              subtitle={t('transport.subtitle')}
            />
          </div>
          <div className="grid grid-3">
            {[
              { title: t('transport.feature1Title'), desc: t('transport.feature1Desc') },
              { title: t('transport.feature2Title'), desc: t('transport.feature2Desc') },
              { title: t('transport.feature3Title'), desc: t('transport.feature3Desc') },
            ].map((feature, index) => (
              <div key={feature.title} className={`why-card reveal reveal-delay-${index + 1}`}>
                <div className="why-card-icon">
                  <Bus size={26} aria-hidden="true" />
                </div>
                <h3 className="why-card-title">{feature.title}</h3>
                <p className="why-card-desc">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
