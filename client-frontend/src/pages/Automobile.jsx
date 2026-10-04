import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Cog, Fuel, Gauge, RotateCcw, Search, SlidersHorizontal } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageProvider'
import { useReveal } from '../hooks/useReveal'
import { api } from '../api/client'
import { LoadingState, ErrorState, EmptyState } from '../components/StateView'
import { MediaImage } from '../components/media/MediaImage'
import { WhatsAppIcon } from '../components/WhatsAppIcon'
import { getPrimaryMedia } from '../utils/media'
import { formatVehiclePrice, getVehicleWhatsAppHref } from '../utils/vehiclePresentation'

const STATUS_LABELS = { AVAILABLE: 'available' }
const PAGE_SIZE = 50

export default function Automobile() {
  const { t, language } = useLanguage()
  const revealRef = useReveal()
  const requestIdRef = useRef(0)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [serverPage, setServerPage] = useState(1)
  const [brand, setBrand] = useState('')
  const [year, setYear] = useState('')
  const [fuelType, setFuelType] = useState('')
  const [transmission, setTransmission] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const timeout = setTimeout(() => {
      const nextQuery = searchInput.trim()
      if (nextQuery !== searchQuery) setServerPage(1)
      setSearchQuery(nextQuery)
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchInput, searchQuery])

  const loadVehicles = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError(null)
    try {
      const result = await api.listVehicles({
        page: serverPage,
        limit: PAGE_SIZE,
        search: searchQuery || undefined,
      })
      if (requestId === requestIdRef.current) setData(result)
    } catch (requestError) {
      if (requestId === requestIdRef.current) setError(requestError)
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }, [searchQuery, serverPage])

  useEffect(() => {
    loadVehicles()
    return () => { requestIdRef.current += 1 }
  }, [loadVehicles])

  const vehicles = useMemo(() => data?.items || data?.vehicles || [], [data])
  const brands = useMemo(() => [...new Set(vehicles.map((vehicle) => vehicle.brand).filter(Boolean))].sort(), [vehicles])
  const years = useMemo(() => [...new Set(vehicles.map((vehicle) => vehicle.year).filter((value) => value != null))].sort((a, b) => b - a), [vehicles])
  const fuelTypes = useMemo(() => [...new Set(vehicles.map((vehicle) => vehicle.fuelType).filter(Boolean))].sort(), [vehicles])
  const transmissions = useMemo(() => [...new Set(vehicles.map((vehicle) => vehicle.transmission).filter(Boolean))].sort(), [vehicles])

  const filtered = useMemo(() => vehicles.filter((vehicle) => {
    if (brand && vehicle.brand !== brand) return false
    if (year && String(vehicle.year) !== year) return false
    if (fuelType && vehicle.fuelType !== fuelType) return false
    if (transmission && vehicle.transmission !== transmission) return false
    const price = Number(vehicle.price)
    if (minPrice !== '' && (!Number.isFinite(price) || price < Number(minPrice))) return false
    if (maxPrice !== '' && (!Number.isFinite(price) || price > Number(maxPrice))) return false
    return true
  }), [vehicles, brand, year, fuelType, transmission, minPrice, maxPrice])

  const filtersActive = Boolean(brand || year || fuelType || transmission || minPrice || maxPrice || searchInput.trim())
  const total = Number(data?.total ?? vehicles.length)
  const canGoPrevious = serverPage > 1
  const canGoNext = serverPage * Number(data?.limit || PAGE_SIZE) < total

  const getStatusLabel = (status) => {
    const key = STATUS_LABELS[status]
    return key ? t(`automobilePage.${key}`) : (status || t('automobilePage.statusUnknown'))
  }

  const resetFilters = () => {
    setSearchInput('')
    setBrand('')
    setYear('')
    setFuelType('')
    setTransmission('')
    setMinPrice('')
    setMaxPrice('')
    setServerPage(1)
  }

  const setFacet = (setter) => (event) => {
    setter(event.target.value)
    setServerPage(1)
  }

  const renderVehicleCard = (vehicle, index) => {
    const title = [vehicle.brand, vehicle.model].filter(Boolean).join(' ')
    return (
      <article key={vehicle.id} className={`vehicle-card card reveal reveal-delay-${(index % 3) + 1}`}>
        <Link to={`/automobile/vehicles/${vehicle.id}`} className="vehicle-card-link" aria-label={`${t('automobilePage.viewDetails')}: ${title}`}>
          <div className="vehicle-card-image">
            <MediaImage media={getPrimaryMedia(vehicle.media)} alt={title || t('automobilePage.availableVehicles')} variant="card" loading="lazy" />
            <span className="badge badge-success vehicle-card-status">{getStatusLabel(vehicle.status)}</span>
          </div>
          <div className="vehicle-card-body">
            <div className="vehicle-card-heading">
              <h2 className="vehicle-card-title">{title || t('automobilePage.availableVehicles')}</h2>
              {vehicle.year != null && <span className="vehicle-card-year">{vehicle.year}</span>}
            </div>
            <div className="vehicle-card-specs">
              {vehicle.mileage != null && <span><Gauge size={15} aria-hidden="true" />{new Intl.NumberFormat(language === 'fr' ? 'fr-FR' : 'en-US').format(vehicle.mileage)} {t('automobilePage.kilometerShort')}</span>}
              {vehicle.fuelType && <span><Fuel size={15} aria-hidden="true" />{vehicle.fuelType}</span>}
              {vehicle.transmission && <span><Cog size={15} aria-hidden="true" />{vehicle.transmission}</span>}
            </div>
            <div className="vehicle-card-footer">
              <span className="vehicle-card-price">{formatVehiclePrice(vehicle.price, vehicle.currency, language, t)}</span>
            </div>
          </div>
        </Link>
        <a className="vehicle-whatsapp" href={getVehicleWhatsAppHref(vehicle, t)} target="_blank" rel="noopener noreferrer">
          <WhatsAppIcon size={19} />
          <span>{t('automobilePage.whatsapp')}</span>
        </a>
      </article>
    )
  }

  return (
    <div ref={revealRef} className="automobile-page">
      <section className="automobile-hero">
        <div className="automobile-hero-image" role="img" aria-label={t('automobilePage.heroTitle')} />
        <div className="automobile-hero-shade" />
        <div className="container automobile-hero-content">
          <span className="automobile-eyebrow">{t('automobilePage.showroomLabel')}</span>
          <h1>{t('automobilePage.availableVehicles')}</h1>
          <p>{t('automobilePage.heroSubtitle')}</p>
        </div>
      </section>

      <section className="section automobile-inventory">
        <div className="container">
          <div className="automobile-toolbar">
            <label className="vehicle-search">
              <Search size={19} aria-hidden="true" />
              <span className="sr-only">{t('automobilePage.searchPlaceholder')}</span>
              <input
                type="search"
                className="form-input"
                placeholder={t('automobilePage.searchPlaceholder')}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                autoComplete="off"
              />
            </label>
            <div className="automobile-results-count" aria-live="polite">{t('automobilePage.resultsCount').replace('{count}', String(filtered.length))}</div>
          </div>

          <div className="vehicle-filter-panel" role="group" aria-label={t('automobilePage.filtersTitle')}>
            <div className="vehicle-filter-heading"><SlidersHorizontal size={18} aria-hidden="true" /><h2>{t('automobilePage.filtersTitle')}</h2></div>
            <div className="vehicle-filter-grid">
              <label className="vehicle-filter-field"><span>{t('automobilePage.allBrands')}</span>
                <select className="form-select" value={brand} onChange={setFacet(setBrand)}>
                  <option value="">{t('automobilePage.allBrands')}</option>
                  {brand && !brands.includes(brand) && <option value={brand}>{brand}</option>}
                  {brands.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className="vehicle-filter-field"><span>{t('automobilePage.allYears')}</span>
                <select className="form-select" value={year} onChange={setFacet(setYear)}>
                  <option value="">{t('automobilePage.allYears')}</option>
                  {year && !years.map(String).includes(year) && <option value={year}>{year}</option>}
                  {years.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className="vehicle-filter-field"><span>{t('automobilePage.allFuelTypes')}</span>
                <select className="form-select" value={fuelType} onChange={setFacet(setFuelType)}>
                  <option value="">{t('automobilePage.allFuelTypes')}</option>
                  {fuelType && !fuelTypes.includes(fuelType) && <option value={fuelType}>{fuelType}</option>}
                  {fuelTypes.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className="vehicle-filter-field"><span>{t('automobilePage.allTransmissions')}</span>
                <select className="form-select" value={transmission} onChange={setFacet(setTransmission)}>
                  <option value="">{t('automobilePage.allTransmissions')}</option>
                  {transmission && !transmissions.includes(transmission) && <option value={transmission}>{transmission}</option>}
                  {transmissions.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className="vehicle-filter-field"><span>{t('automobilePage.minPrice')}</span>
                <input className="form-input" type="number" min="0" step="any" inputMode="decimal" value={minPrice} onChange={setFacet(setMinPrice)} />
              </label>
              <label className="vehicle-filter-field"><span>{t('automobilePage.maxPrice')}</span>
                <input className="form-input" type="number" min="0" step="any" inputMode="decimal" value={maxPrice} onChange={setFacet(setMaxPrice)} />
              </label>
            </div>
            {filtersActive && <button className="btn btn-outline btn-sm vehicle-reset" type="button" onClick={resetFilters}>
              <RotateCcw size={15} aria-hidden="true" />{t('automobilePage.resetFilters')}
            </button>}
          </div>

          {loading && !data && <LoadingState message={t('automobilePage.loadingVehicles')} />}
          {error && <ErrorState message={t('automobilePage.loadError')} onRetry={loadVehicles} />}
          {loading && data && <div className="vehicle-refreshing" role="status" aria-live="polite">{t('automobilePage.loadingVehicles')}</div>}

          {!error && !loading && vehicles.length === 0 && <EmptyState message={t('automobilePage.noVehicles')} />}
          {!error && !loading && vehicles.length > 0 && filtered.length === 0 && (
            <div className="vehicle-filter-empty">
              <EmptyState message={t('automobilePage.noFilterMatches')} />
              <button className="btn btn-outline btn-sm" type="button" onClick={resetFilters}><RotateCcw size={15} aria-hidden="true" />{t('automobilePage.resetFilters')}</button>
            </div>
          )}
          {!error && filtered.length > 0 && <div className="grid grid-3 vehicle-grid" aria-busy={loading}>
            {filtered.map(renderVehicleCard)}
          </div>}

          {(canGoPrevious || canGoNext) && <nav className="vehicle-pagination" aria-label={t('automobilePage.pagination')}>
            <button type="button" className="btn btn-outline btn-sm" disabled={!canGoPrevious || loading} onClick={() => setServerPage((page) => page - 1)}>
              <ChevronLeft size={16} aria-hidden="true" />{t('automobilePage.previousPage')}
            </button>
            <span>{t('automobilePage.pageNumber').replace('{page}', String(serverPage))}</span>
            <button type="button" className="btn btn-outline btn-sm" disabled={!canGoNext || loading} onClick={() => setServerPage((page) => page + 1)}>
              {t('automobilePage.nextPage')}<ChevronRight size={16} aria-hidden="true" />
            </button>
          </nav>}
        </div>
      </section>
    </div>
  )
}
