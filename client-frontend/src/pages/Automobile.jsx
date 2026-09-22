import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ArrowRight, Calendar, Fuel, Cog, MessageCircle } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageProvider'
import { useReveal } from '../hooks/useReveal'
import SectionHeader from '../components/SectionHeader'
import { api } from '../api/client'
import { useFetch } from '../hooks/useFetch'
import { LoadingState, ErrorState, EmptyState } from '../components/StateView'
import { translateError } from '../utils/errors'
import { AUTOMOBILE_WHATSAPP } from '../config/contact'
import { getMediaUrl, getPrimaryMedia } from '../utils/media'

const STATUS_LABELS = {
  AVAILABLE: 'available',
  RESERVED: 'reserved',
  SOLD: 'sold',
  IN_MAINTENANCE: 'maintenance',
}

export default function Automobile() {
  const { t } = useLanguage()
  const revealRef = useReveal()
  const [search, setSearch] = useState('')
  const [brand, setBrand] = useState('')
  const [status, setStatus] = useState('')

  const { data, loading, error, execute } = useFetch(
    () => api.listVehicles({ page: 1, limit: 50, search: search || undefined }),
    { deps: [search] }
  )

  const vehicles = data?.items || data?.vehicles || []

  const brands = useMemo(() => {
    const set = new Set(vehicles.map((v) => v.brand).filter(Boolean))
    return Array.from(set).sort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const filtered = useMemo(() => {
    return vehicles.filter((v) => {
      if (brand && v.brand !== brand) return false
      if (status && v.status !== status) return false
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, brand, status])

  const getStatusLabel = (statusValue) => {
    const key = STATUS_LABELS[statusValue]
    return key ? t(`automobilePage.${key}`) : statusValue
  }

  const getStatusClass = (statusValue) => {
    if (statusValue === 'AVAILABLE') return 'badge-success'
    if (statusValue === 'RESERVED') return 'badge-gold'
    if (statusValue === 'SOLD') return 'badge-neutral'
    return 'badge-danger'
  }

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-FR').format(Number(price))
  }

  const getVehicleImage = (vehicle) => {
    const primary = getPrimaryMedia(vehicle?.media)
    const url = getMediaUrl(primary, { variant: 'card' })
    return url || '/assets/automobile/automobile-card.jpg'
  }

  const getWhatsAppUrl = (vehicle) => {
    const details = [
      'Bonjour Vanguard Automobile, je suis intéressé par ce véhicule :',
      '',
      vehicle.brand && `Marque : ${vehicle.brand}`,
      vehicle.model && `Modèle : ${vehicle.model}`,
      vehicle.year != null && `Année : ${vehicle.year}`,
      vehicle.price != null && `Prix : ${formatPrice(vehicle.price)} ${vehicle.currency || t('common.currency')}`,
      vehicle.id && `Référence : ${vehicle.id}`,
      '',
      "Je souhaiterais avoir plus d'informations sur ce véhicule.",
    ].filter(Boolean).join('\n')
    return `https://wa.me/${AUTOMOBILE_WHATSAPP}?text=${encodeURIComponent(details)}`
  }

  return (
    <div ref={revealRef}>
      {/* ===== HERO ===== */}
      <section className="page-hero">
        <div
          className="page-hero-bg"
          style={{ backgroundImage: 'url(/assets/automobile/automobile-hero.jpg)' }}
          role="img"
          aria-label={t('automobilePage.heroTitle')}
        />
        <div className="page-hero-overlay" />
        <div className="container page-hero-content">
          <h1 className="page-hero-title display-title reveal">{t('automobilePage.heroTitle')}</h1>
          <p className="page-hero-subtitle reveal reveal-delay-1">{t('automobilePage.heroSubtitle')}</p>
        </div>
      </section>

      {/* ===== VITRINE ===== */}
      <section className="section">
        <div className="container">
          <div className="reveal">
            <SectionHeader
              center
              eyebrow={t('automobile.eyebrow')}
              title={t('automobile.title')}
              subtitle={t('automobile.subtitle')}
            />
          </div>

          {/* Filtres */}
          <div className="vehicle-filters reveal">
            <div className="vehicle-search">
              <Search size={18} aria-hidden="true" />
              <input
                type="text"
                className="form-input"
                placeholder={t('automobilePage.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label={t('automobilePage.searchPlaceholder')}
              />
            </div>
            <select
              className="form-select vehicle-filter-select"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              aria-label={t('automobilePage.allBrands')}
            >
              <option value="">{t('automobilePage.allBrands')}</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <select
              className="form-select vehicle-filter-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label={t('automobilePage.allStatus')}
            >
              <option value="">{t('automobilePage.allStatus')}</option>
              <option value="AVAILABLE">{t('automobilePage.available')}</option>
              <option value="RESERVED">{t('automobilePage.reserved')}</option>
              <option value="SOLD">{t('automobilePage.sold')}</option>
              <option value="IN_MAINTENANCE">{t('automobilePage.maintenance')}</option>
            </select>
          </div>

          {/* États */}
          {loading && <LoadingState />}
          {error && <ErrorState message={translateError(error, t)} onRetry={execute} />}
          {!loading && !error && filtered.length === 0 && (
            <EmptyState message={t('automobilePage.noVehicles')} />
          )}

          {/* Grille véhicules */}
          {!loading && !error && filtered.length > 0 && (
            <div className="grid grid-3 vehicle-grid">
              {filtered.map((vehicle, index) => (
                <div
                  key={vehicle.id}
                  className={`vehicle-card card reveal reveal-delay-${(index % 3) + 1}`}
                >
                  <Link to={`/automobile/vehicles/${vehicle.id}`}>
                    <div className="vehicle-card-image">
                      <img
                        src={getVehicleImage(vehicle)}
                        alt={`${vehicle.brand} ${vehicle.model}`}
                        loading="lazy"
                        width="800"
                        height="500"
                      />
                      <span className={`badge ${getStatusClass(vehicle.status)} vehicle-card-status`}>
                        {getStatusLabel(vehicle.status)}
                      </span>
                    </div>
                    <div className="vehicle-card-body">
                      <h3 className="vehicle-card-title">{vehicle.brand} {vehicle.model}</h3>
                      <div className="vehicle-card-specs">
                        {vehicle.year != null && <span><Calendar size={14} aria-hidden="true" />{vehicle.year}</span>}
                        {vehicle.mileage != null && <span><Cog size={14} aria-hidden="true" />{new Intl.NumberFormat('fr-FR').format(vehicle.mileage)} km</span>}
                        {vehicle.fuelType && <span><Fuel size={14} aria-hidden="true" />{vehicle.fuelType}</span>}
                      </div>
                      <div className="vehicle-card-footer">
                        <span className="vehicle-card-price">{formatPrice(vehicle.price)} {vehicle.currency || t('common.currency')}</span>
                        <span className="vehicle-card-cta">{t('automobilePage.viewDetails')}<ArrowRight size={16} aria-hidden="true" /></span>
                      </div>
                    </div>
                  </Link>
                  <a
                    className="vehicle-whatsapp"
                    href={getWhatsAppUrl(vehicle)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <MessageCircle size={16} aria-hidden="true" />
                    {t('automobilePage.whatsapp')}
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}