import { useEffect, useState } from 'react'
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
  Package,
} from 'lucide-react'
import { useLanguage } from '../i18n/LanguageProvider'
import { useReveal } from '../hooks/useReveal'
import SectionHeader from '../components/SectionHeader'
import { LoadingState } from '../components/StateView'
import { api } from '../api/client'
import { translateError } from '../utils/errors'

const STEPS = ['step1', 'step2', 'step3', 'step4', 'step5', 'step6']

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

  const [step, setStep] = useState(1)
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

  // Agences pour formulaire colis
  const [agencies, setAgencies] = useState([])
  const [agenciesLoading, setAgenciesLoading] = useState(false)
  const [agenciesError, setAgenciesError] = useState(null)

  // Enregistrement colis
  const [parcelData, setParcelData] = useState({
    senderName: '',
    senderPhone: '',
    senderEmail: '',
    recipientName: '',
    recipientPhone: '',
    recipientEmail: '',
    originAgencyId: '',
    destinationAgencyId: '',
    weightKg: '1',
    volumeM3: '0.01',
    category: 'STANDARD',
    declaredValue: '',
    description: '',
  })
  const [parcelSubmitting, setParcelSubmitting] = useState(false)
  const [parcelSubmitError, setParcelSubmitError] = useState(null)
  const [parcelSubmitResult, setParcelSubmitResult] = useState(null)

  // Suivi de colis
  const [parcelTrackingCode, setParcelTrackingCode] = useState('')
  const [parcelTrackingLoading, setParcelTrackingLoading] = useState(false)
  const [parcelTrackingError, setParcelTrackingError] = useState(null)
  const [parcelTrackingResult, setParcelTrackingResult] = useState(null)

  const loadAvailableTrips = async (limit = 20) => {
    setSearching(true)
    setSearchError(null)
    try {
      const result = await api.searchTrips({ limit })
      setTrips(result?.items || [])
      setStep(1)
      return result?.items || []
    } catch (err) {
      setSearchError(translateError(err, t))
      setTrips([])
      setStep(1)
      return []
    } finally {
      setSearching(false)
    }
  }

  const searchTrips = async (filters = {}) => {
    setSearching(true)
    setSearchError(null)
    try {
      const result = await api.searchTrips({
        departure: filters.from || undefined,
        arrival: filters.to || undefined,
        date: filters.date || undefined,
      })
      setTrips(result?.items || [])
      setStep(1)
      return result?.items || []
    } catch (err) {
      setSearchError(translateError(err, t))
      setTrips([])
      setStep(1)
      return []
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    void loadAvailableTrips()
    const loadAgencies = async () => {
      setAgenciesLoading(true)
      setAgenciesError(null)
      try {
        const res = await api.listPublicAgencies()
        setAgencies(res?.items || [])
      } catch (err) {
        setAgenciesError(translateError(err, t))
      } finally {
        setAgenciesLoading(false)
      }
    }
    void loadAgencies()
  }, [])

  const handleParcelSubmit = async (e) => {
    e.preventDefault()
    setParcelSubmitError(null)
    setParcelSubmitResult(null)

    if (parcelData.originAgencyId === parcelData.destinationAgencyId) {
      setParcelSubmitError(t('transportPage.parcelSameAgencyError'))
      return
    }

    setParcelSubmitting(true)
    try {
      const res = await api.createPublicParcel(parcelData)
      setParcelSubmitResult(res?.parcel)
    } catch (err) {
      setParcelSubmitError(translateError(err, t))
    } finally {
      setParcelSubmitting(false)
    }
  }

  const handleParcelTrack = async (e) => {
    e.preventDefault()
    setParcelTrackingError(null)
    setParcelTrackingResult(null)
    if (!parcelTrackingCode.trim()) return

    setParcelTrackingLoading(true)
    try {
      const res = await api.getPublicParcel(parcelTrackingCode.trim())
      setParcelTrackingResult(res?.parcel)
    } catch (err) {
      setParcelTrackingError(translateError(err, t))
    } finally {
      setParcelTrackingLoading(false)
    }
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    await searchTrips({
      from: search.from,
      to: search.to,
      date: search.date,
    })
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
        seatNumber: String(selectedSeat),
        customerName: passenger.name,
        customerPhone: passenger.phone,
        customerEmail: passenger.email || null,
      })
      const resData = result?.reservation || null
      if (resData && result?.payment) {
        resData.payments = [result.payment]
        resData.payment = result.payment
      }
      setBooking(resData)
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
      const resData = result?.reservation || null
      setLookupResult(resData)
    } catch (err) {
      setLookupError(translateError(err, t))
    } finally {
      setLookupLoading(false)
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

                <div className="payment-section">
                  <h4>Montant à payer : {formatAmount(booking?.totalAmount, booking?.payment?.currency || 'USD')}</h4>
                  <p>Mode de paiement : CASH — {booking?.payment?.status === 'VERIFIED' || booking?.payment?.status === 'COMPLETED' ? 'VALIDÉ' : 'EN ATTENTE'}</p>
                  {booking?.payment?.status === 'VERIFIED' || booking?.payment?.status === 'COMPLETED'
                    ? <p>Votre paiement est validé. Votre billet est disponible.</p>
                    : <p>Veuillez payer en espèces à l’agence de départ. Votre paiement sera vérifié par un agent Vanguard Services. Après validation, votre billet sera généré automatiquement.</p>}
                  {booking?.tickets?.[0] && <Link className="btn btn-primary" to={`/ticket/${booking.tickets[0].ticketCode}`}>Voir mon billet</Link>}
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

                <div className="notice notice-info mt-4">
                  <Info size={18} aria-hidden="true" />
                  <span>
                    Paiement : {lookupResult.payments?.some((p) => ['VERIFIED', 'COMPLETED'].includes(p.status)) ? 'VALIDÉ' : 'EN ATTENTE'}
                    {' · '}Mode : CASH
                    {!lookupResult.payments?.some((p) => ['VERIFIED', 'COMPLETED'].includes(p.status)) && ' · Veuillez payer en espèces à l’agence de départ.'}
                  </span>
                </div>
                {lookupResult.tickets?.[0] && (
                  <Link className="btn btn-primary" to={`/tickets/${lookupResult.tickets[0].ticketCode}`}>Voir mon billet</Link>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===== EXPÉDITION & SUIVI DE COLIS ===== */}
      <section className="section bg-surface">
        <div className="container">
          <div className="reveal">
            <SectionHeader
              center
              eyebrow={t('transportPage.parcelTitle')}
              title={t('transportPage.parcelTitle')}
              subtitle={t('transportPage.parcelSubtitle')}
            />
          </div>

          <div className="grid grid-2 reveal reveal-delay-1" style={{ gap: '32px', marginTop: '24px' }}>
            {/* Formulaire d'enregistrement */}
            <div className="lookup-card" style={{ maxWidth: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <Package size={24} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ margin: 0 }}>{t('transportPage.parcelTitle')}</h3>
              </div>

              {parcelSubmitError && (
                <div className="notice notice-error" style={{ marginBottom: '16px' }}>
                  <Info size={18} aria-hidden="true" />
                  <span>{parcelSubmitError}</span>
                </div>
              )}

              {parcelSubmitResult ? (
                <div className="reservation-result" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '20px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a', marginBottom: '12px' }}>
                    <CheckCircle2 size={22} />
                    <h4 style={{ margin: 0 }}>{t('transportPage.parcelSuccess')}</h4>
                  </div>
                  <p style={{ fontSize: '14px', marginBottom: '12px' }}>
                    {t('transportPage.parcelTrackingNotice')}
                  </p>
                  <div style={{ background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                    <div><strong>Code de suivi :</strong> <code style={{ fontSize: '16px', fontWeight: 'bold' }}>{parcelSubmitResult.trackingCode}</code></div>
                    <div><strong>Prix à régler (CASH) :</strong> {parcelSubmitResult.amount} {parcelSubmitResult.currency || 'USD'}</div>
                    <div><strong>Origine :</strong> {parcelSubmitResult.originAgency?.name || parcelSubmitResult.originCity}</div>
                    <div><strong>Destination :</strong> {parcelSubmitResult.destinationAgency?.name || parcelSubmitResult.destinationCity}</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setParcelSubmitResult(null)
                      setParcelData({
                        senderName: '',
                        senderPhone: '',
                        senderEmail: '',
                        recipientName: '',
                        recipientPhone: '',
                        recipientEmail: '',
                        originAgencyId: '',
                        destinationAgencyId: '',
                        weightKg: '1',
                        volumeM3: '0.01',
                        category: 'STANDARD',
                        declaredValue: '',
                        description: '',
                      })
                    }}
                  >
                    Enregistrer un autre colis
                  </button>
                </div>
              ) : (
                <form onSubmit={handleParcelSubmit} className="space-y-4">
                  <div className="grid grid-2" style={{ gap: '12px' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="parcelOriginAgency">
                        {t('transportPage.parcelOriginAgency')} <span className="required">*</span>
                      </label>
                      <select
                        id="parcelOriginAgency"
                        className="form-input"
                        value={parcelData.originAgencyId}
                        onChange={(e) => setParcelData({ ...parcelData, originAgencyId: e.target.value })}
                        required
                        disabled={agenciesLoading}
                      >
                        <option value="">
                          {agenciesLoading
                            ? t('states.loading')
                            : agenciesError
                            ? 'Erreur agences'
                            : !agencies.length
                            ? 'Aucune agence'
                            : t('transportPage.parcelSelectAgency')}
                        </option>
                        {agencies.map((ag) => (
                          <option key={ag.id} value={ag.id}>
                            {ag.name} ({ag.code}) • {ag.city || '—'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="parcelDestinationAgency">
                        {t('transportPage.parcelDestinationAgency')} <span className="required">*</span>
                      </label>
                      <select
                        id="parcelDestinationAgency"
                        className="form-input"
                        value={parcelData.destinationAgencyId}
                        onChange={(e) => setParcelData({ ...parcelData, destinationAgencyId: e.target.value })}
                        required
                        disabled={agenciesLoading}
                      >
                        <option value="">
                          {agenciesLoading
                            ? t('states.loading')
                            : agenciesError
                            ? 'Erreur agences'
                            : !agencies.length
                            ? 'Aucune agence'
                            : t('transportPage.parcelSelectAgency')}
                        </option>
                        {agencies.map((ag) => (
                          <option key={ag.id} value={ag.id}>
                            {ag.name} ({ag.code}) • {ag.city || '—'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-2" style={{ gap: '12px' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="senderName">
                        {t('transportPage.parcelSenderName')} <span className="required">*</span>
                      </label>
                      <input
                        id="senderName"
                        type="text"
                        className="form-input"
                        value={parcelData.senderName}
                        onChange={(e) => setParcelData({ ...parcelData, senderName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="senderPhone">
                        {t('transportPage.parcelSenderPhone')} <span className="required">*</span>
                      </label>
                      <input
                        id="senderPhone"
                        type="tel"
                        className="form-input"
                        value={parcelData.senderPhone}
                        onChange={(e) => setParcelData({ ...parcelData, senderPhone: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-2" style={{ gap: '12px' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="recipientName">
                        {t('transportPage.parcelRecipientName')} <span className="required">*</span>
                      </label>
                      <input
                        id="recipientName"
                        type="text"
                        className="form-input"
                        value={parcelData.recipientName}
                        onChange={(e) => setParcelData({ ...parcelData, recipientName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="recipientPhone">
                        {t('transportPage.parcelRecipientPhone')} <span className="required">*</span>
                      </label>
                      <input
                        id="recipientPhone"
                        type="tel"
                        className="form-input"
                        value={parcelData.recipientPhone}
                        onChange={(e) => setParcelData({ ...parcelData, recipientPhone: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-3" style={{ gap: '12px' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="parcelWeight">
                        {t('transportPage.parcelWeight')} <span className="required">*</span>
                      </label>
                      <input
                        id="parcelWeight"
                        type="number"
                        min="0.1"
                        step="0.1"
                        className="form-input"
                        value={parcelData.weightKg}
                        onChange={(e) => setParcelData({ ...parcelData, weightKg: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="parcelVolume">
                        {t('transportPage.parcelVolume')}
                      </label>
                      <input
                        id="parcelVolume"
                        type="number"
                        min="0.001"
                        step="0.01"
                        className="form-input"
                        value={parcelData.volumeM3}
                        onChange={(e) => setParcelData({ ...parcelData, volumeM3: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="parcelCategory">
                        {t('transportPage.parcelCategory')}
                      </label>
                      <select
                        id="parcelCategory"
                        className="form-input"
                        value={parcelData.category}
                        onChange={(e) => setParcelData({ ...parcelData, category: e.target.value })}
                      >
                        <option value="STANDARD">Standard</option>
                        <option value="DOCUMENT">Document</option>
                        <option value="FRAGILE">Fragile</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="parcelDescription">
                      {t('transportPage.parcelDescription')}
                    </label>
                    <textarea
                      id="parcelDescription"
                      rows={2}
                      className="form-input"
                      value={parcelData.description}
                      onChange={(e) => setParcelData({ ...parcelData, description: e.target.value })}
                      placeholder="Contenu, fragilité..."
                    />
                  </div>

                  <div className="notice" style={{ background: '#f8fafc', fontSize: '13px', padding: '10px 14px', borderRadius: '6px' }}>
                    <strong>Note Vanguard Coach :</strong> Le règlement des colis s’effectue exclusivement en <strong>espèces (CASH)</strong> au guichet de l’agence de départ lors du dépôt physique.
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={parcelSubmitting}>
                    <Package size={18} aria-hidden="true" />
                    {parcelSubmitting ? t('states.loading') : t('transportPage.parcelSubmit')}
                  </button>
                </form>
              )}
            </div>

            {/* Suivi de colis */}
            <div className="lookup-card" style={{ maxWidth: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <Search size={24} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ margin: 0 }}>{t('transportPage.parcelTrackTitle')}</h3>
              </div>

              <form onSubmit={handleParcelTrack} className="lookup-form" style={{ marginBottom: '20px' }}>
                <div className="form-group lookup-input">
                  <label className="form-label" htmlFor="parcelTrackingCode">
                    Code de suivi <span className="required">*</span>
                  </label>
                  <input
                    id="parcelTrackingCode"
                    type="text"
                    className="form-input"
                    placeholder={t('transportPage.parcelTrackPlaceholder')}
                    value={parcelTrackingCode}
                    onChange={(e) => setParcelTrackingCode(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={parcelTrackingLoading}>
                  <Search size={18} aria-hidden="true" />
                  {parcelTrackingLoading ? t('states.loading') : t('transportPage.parcelTrackButton')}
                </button>
              </form>

              {parcelTrackingError && (
                <div className="notice notice-error">
                  <Info size={18} aria-hidden="true" />
                  <span>{parcelTrackingError}</span>
                </div>
              )}

              {parcelTrackingResult && (
                <div className="reservation-result">
                  <h4>Statut du colis</h4>
                  <div className="summary-grid">
                    <div className="summary-item">
                      <span className="summary-label">Code de suivi</span>
                      <span className="summary-value">{parcelTrackingResult.trackingCode}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Statut</span>
                      <span className="summary-value">
                        <span className="badge badge-gold">{parcelTrackingResult.status}</span>
                      </span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Origine</span>
                      <span className="summary-value">{parcelTrackingResult.originAgency?.name || parcelTrackingResult.originCity}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Destination</span>
                      <span className="summary-value">{parcelTrackingResult.destinationAgency?.name || parcelTrackingResult.destinationCity}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Expéditeur</span>
                      <span className="summary-value">{parcelTrackingResult.senderName}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Destinataire</span>
                      <span className="summary-value">{parcelTrackingResult.recipientName}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Poids</span>
                      <span className="summary-value">{parcelTrackingResult.weightKg} kg</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Montant</span>
                      <span className="summary-value">{parcelTrackingResult.amount} {parcelTrackingResult.currency || 'USD'}</span>
                    </div>
                  </div>

                  {parcelTrackingResult.statusHistory && parcelTrackingResult.statusHistory.length > 0 && (
                    <div style={{ marginTop: '20px' }}>
                      <h4 style={{ marginBottom: '10px' }}>Historique du parcours</h4>
                      <div className="payments-list">
                        {parcelTrackingResult.statusHistory.map((h, idx) => (
                          <div key={idx} className="payment-item">
                            <span><strong>{h.newStatus}</strong>{h.reason ? ` — ${h.reason}` : ''}</span>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>{formatDate(h.changedAt)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
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
