import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bus,
  HardHat,
  Car,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Clock,
  ThumbsUp,
  Headphones,
  Phone,
  Mail,
  MapPin,
  Compass,
} from 'lucide-react'
import { useLanguage } from '../i18n/LanguageProvider'
import { useReveal } from '../hooks/useReveal'
import { api } from '../api/client'

export default function Home() {
  const { t } = useLanguage()
  const revealRef = useReveal()
  const [settings, setSettings] = useState(null)
  const [popularTrips, setPopularTrips] = useState([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const result = await api.getWebsiteSettings()
        if (!cancelled) setSettings(result?.settings || null)
      } catch {
        if (!cancelled) setSettings(null)
      }

      try {
        const tripsRes = await api.searchTrips({ limit: 4 })
        if (!cancelled && tripsRes?.items?.length) {
          setPopularTrips(tripsRes.items.slice(0, 3))
        }
      } catch {
        // Fallback statique
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div ref={revealRef}>
      {/* ===== HERO ===== */}
      <section className="hero">
        <div
          className="hero-bg"
          style={{ backgroundImage: 'url(/assets/hero/hero-main.jpg)' }}
          role="img"
          aria-label="Vanguard Services — Transport, Construction et Vente automobile"
        />
        <div className="hero-overlay" />
        <div className="container hero-content">
          <div className="hero-eyebrow reveal">
            <Compass size={16} aria-hidden="true" />
            <span>{t('hero.eyebrow')}</span>
          </div>
          <h1 className="hero-title display-title reveal reveal-delay-1">
            {t('hero.titlePart1')}<br />
            <span className="text-primary">{t('hero.titlePart2')}</span>
          </h1>
          <p className="hero-subtitle reveal reveal-delay-2">
            {t('hero.subtitle')}
          </p>
          <div className="hero-actions reveal reveal-delay-3">
            <a href="#services" className="btn btn-primary btn-lg">
              {t('hero.ctaPrimary')}
              <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a href="#how-it-works" className="btn btn-outline btn-lg">
              {t('hero.ctaSecondary')}
            </a>
          </div>
        </div>

        {/* Bandeau Trajets Flottant */}
        <div className="hero-routes-bar-wrapper">
          <div className="hero-routes-bar reveal reveal-delay-4">
            <div className="hero-routes-label">
              <MapPin size={18} aria-hidden="true" />
              <span>{t('hero.routesTitle')}</span>
            </div>
            <div className="hero-routes-list">
              {popularTrips.length > 0 ? (
                popularTrips.map((trip, idx) => (
                  <span key={trip.id || idx} className="hero-route-item">
                    <span>
                      {trip.route?.departureCity || 'Goma'} ↔ {trip.route?.arrivalCity || 'Dar es Salaam'}
                    </span>
                    {idx < popularTrips.length - 1 && <span className="hero-route-sep">|</span>}
                  </span>
                ))
              ) : (
                <>
                  <span className="hero-route-item">{t('hero.route1')}</span>
                  <span className="hero-route-sep">|</span>
                  <span className="hero-route-item">{t('hero.route2')}</span>
                  <span className="hero-route-sep">|</span>
                  <span className="hero-route-item">{t('hero.route3')}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===== SERVICES ===== */}
      <section id="services" className="section services-section">
        <div className="container">
          <div className="services-header-row reveal">
            <div>
              <div className="section-eyebrow">{t('services.eyebrow')}</div>
              <h2 className="section-title">{t('services.title')}</h2>
            </div>
            <p className="services-header-desc">{t('services.subtitle')}</p>
          </div>

          <div className="services-grid">
            {/* Carte Transport */}
            <Link to="/transport" className="service-card reveal reveal-delay-1">
              <div className="service-card-image">
                <img
                  src="/assets/transport/transport-card.jpg"
                  alt={t('services.transportTitle')}
                  loading="lazy"
                  width="600"
                  height="400"
                />
                <div className="service-card-badge badge-transport-icon">
                  <Bus size={24} aria-hidden="true" />
                </div>
              </div>
              <div className="service-card-body">
                <h3 className="service-card-title">{t('services.transportTitle')}</h3>
                <p className="service-card-desc">{t('services.transportDesc')}</p>
                <div className="service-card-checklist">
                  <div className="service-card-check-item check-transport">
                    <CheckCircle2 size={18} aria-hidden="true" />
                    <span>{t('services.transportP1')}</span>
                  </div>
                  <div className="service-card-check-item check-transport">
                    <CheckCircle2 size={18} aria-hidden="true" />
                    <span>{t('services.transportP2')}</span>
                  </div>
                  <div className="service-card-check-item check-transport">
                    <CheckCircle2 size={18} aria-hidden="true" />
                    <span>{t('services.transportP3')}</span>
                  </div>
                </div>
                <span className="service-card-cta cta-transport">
                  {t('services.transportCta')}
                  <ArrowRight size={16} aria-hidden="true" />
                </span>
              </div>
            </Link>

            {/* Carte Construction */}
            <Link to="/construction" className="service-card reveal reveal-delay-2">
              <div className="service-card-image">
                <img
                  src="/assets/construction/construction-card.jpg"
                  alt={t('services.constructionTitle')}
                  loading="lazy"
                  width="600"
                  height="400"
                />
                <div className="service-card-badge badge-construction-icon">
                  <HardHat size={24} aria-hidden="true" />
                </div>
              </div>
              <div className="service-card-body">
                <h3 className="service-card-title">{t('services.constructionTitle')}</h3>
                <p className="service-card-desc">{t('services.constructionDesc')}</p>
                <div className="service-card-checklist">
                  <div className="service-card-check-item check-construction">
                    <CheckCircle2 size={18} aria-hidden="true" />
                    <span>{t('services.constructionP1')}</span>
                  </div>
                  <div className="service-card-check-item check-construction">
                    <CheckCircle2 size={18} aria-hidden="true" />
                    <span>{t('services.constructionP2')}</span>
                  </div>
                  <div className="service-card-check-item check-construction">
                    <CheckCircle2 size={18} aria-hidden="true" />
                    <span>{t('services.constructionP3')}</span>
                  </div>
                </div>
                <span className="service-card-cta cta-construction">
                  {t('services.constructionCta')}
                  <ArrowRight size={16} aria-hidden="true" />
                </span>
              </div>
            </Link>

            {/* Carte Automobile */}
            <Link to="/automobile" className="service-card reveal reveal-delay-3">
              <div className="service-card-image">
                <img
                  src="/assets/automobile/automobile-card.jpg"
                  alt={t('services.automobileTitle')}
                  loading="lazy"
                  width="600"
                  height="400"
                />
                <div className="service-card-badge badge-auto-icon">
                  <Car size={24} aria-hidden="true" />
                </div>
              </div>
              <div className="service-card-body">
                <h3 className="service-card-title">{t('services.automobileTitle')}</h3>
                <p className="service-card-desc">{t('services.automobileDesc')}</p>
                <div className="service-card-checklist">
                  <div className="service-card-check-item check-auto">
                    <CheckCircle2 size={18} aria-hidden="true" />
                    <span>{t('services.automobileP1')}</span>
                  </div>
                  <div className="service-card-check-item check-auto">
                    <CheckCircle2 size={18} aria-hidden="true" />
                    <span>{t('services.automobileP2')}</span>
                  </div>
                  <div className="service-card-check-item check-auto">
                    <CheckCircle2 size={18} aria-hidden="true" />
                    <span>{t('services.automobileP3')}</span>
                  </div>
                </div>
                <span className="service-card-cta cta-auto">
                  {t('services.automobileCta')}
                  <ArrowRight size={16} aria-hidden="true" />
                </span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ===== SECTION CONFIANCE & STATISTIQUES ===== */}
      <section id="about" className="section trust-stats-section">
        <div className="container">
          <div className="trust-stats-grid">
            {/* Atouts Confiance */}
            <div className="trust-grid reveal">
              <div className="trust-item">
                <div className="trust-item-icon">
                  <ShieldCheck size={24} aria-hidden="true" />
                </div>
                <h3 className="trust-item-title">{t('trust.item1Title')}</h3>
                <p className="trust-item-desc">{t('trust.item1Desc')}</p>
              </div>

              <div className="trust-item">
                <div className="trust-item-icon">
                  <Clock size={24} aria-hidden="true" />
                </div>
                <h3 className="trust-item-title">{t('trust.item2Title')}</h3>
                <p className="trust-item-desc">{t('trust.item2Desc')}</p>
              </div>

              <div className="trust-item">
                <div className="trust-item-icon">
                  <ThumbsUp size={24} aria-hidden="true" />
                </div>
                <h3 className="trust-item-title">{t('trust.item3Title')}</h3>
                <p className="trust-item-desc">{t('trust.item3Desc')}</p>
              </div>

              <div className="trust-item">
                <div className="trust-item-icon">
                  <Headphones size={24} aria-hidden="true" />
                </div>
                <h3 className="trust-item-title">{t('trust.item4Title')}</h3>
                <p className="trust-item-desc">{t('trust.item4Desc')}</p>
              </div>
            </div>

            {/* Bloc Statistiques Bleu Nuit */}
            <div className="stats-card reveal reveal-delay-2">
              <div>
                <h3 className="stats-card-title">{t('stats.title')}</h3>
                <div className="stats-numbers-grid">
                  <div className="stat-item">
                    <span className="stat-value">{t('stats.stat1Val')}</span>
                    <span className="stat-label">{t('stats.stat1Label')}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{t('stats.stat2Val')}</span>
                    <span className="stat-label">{t('stats.stat2Label')}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{t('stats.stat3Val')}</span>
                    <span className="stat-label">{t('stats.stat3Label')}</span>
                  </div>
                </div>
              </div>
              <a href="/contact" className="stats-card-btn">
                {t('stats.cta')}
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ===== COMMENT ÇA MARCHE ===== */}
      <section id="how-it-works" className="section how-section">
        <div className="container">
          <div className="section-header section-header-center reveal">
            <div className="section-eyebrow">{t('howItWorks.eyebrow')}</div>
            <h2 className="section-title">{t('howItWorks.title')}</h2>
            <p className="section-subtitle">{t('howItWorks.subtitle')}</p>
          </div>

          <div className="how-grid">
            <div className="how-card reveal reveal-delay-1">
              <span className="how-card-num">{t('howItWorks.step1Num')}</span>
              <h3 className="how-card-title">{t('howItWorks.step1Title')}</h3>
              <p className="how-card-desc">{t('howItWorks.step1Desc')}</p>
            </div>

            <div className="how-card reveal reveal-delay-2">
              <span className="how-card-num">{t('howItWorks.step2Num')}</span>
              <h3 className="how-card-title">{t('howItWorks.step2Title')}</h3>
              <p className="how-card-desc">{t('howItWorks.step2Desc')}</p>
            </div>

            <div className="how-card reveal reveal-delay-3">
              <span className="how-card-num">{t('howItWorks.step3Num')}</span>
              <h3 className="how-card-title">{t('howItWorks.step3Title')}</h3>
              <p className="how-card-desc">{t('howItWorks.step3Desc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CONTACT RAPIDE ===== */}
      <section id="contact" className="section contact-section">
        <div className="container">
          <div className="section-header section-header-center reveal">
            <div className="section-eyebrow">{t('contact.eyebrow')}</div>
            <h2 className="section-title">{t('contact.title')}</h2>
            <p className="section-subtitle">{t('contact.subtitle')}</p>
          </div>

          <div className="contact-grid">
            <div className="contact-info reveal">
              <div className="contact-item">
                <div className="contact-item-icon">
                  <Phone size={20} aria-hidden="true" />
                </div>
                <div>
                  <h4>{t('contact.phone')}</h4>
                  <p>{settings?.phone || '+243 97 000 0000'}</p>
                </div>
              </div>

              <div className="contact-item">
                <div className="contact-item-icon">
                  <Mail size={20} aria-hidden="true" />
                </div>
                <div>
                  <h4>{t('contact.email')}</h4>
                  <p>{settings?.email || 'contact@vanguard-services.com'}</p>
                </div>
              </div>

              <div className="contact-item">
                <div className="contact-item-icon">
                  <MapPin size={20} aria-hidden="true" />
                </div>
                <div>
                  <h4>{t('contact.address')}</h4>
                  <p>{settings?.address || 'Avenue de la Paix, Goma, RDC'}</p>
                </div>
              </div>

              <div className="contact-item">
                <div className="contact-item-icon">
                  <Clock size={20} aria-hidden="true" />
                </div>
                <div>
                  <h4>{t('contact.hours')}</h4>
                  <p>{t('contact.hoursValue')}</p>
                </div>
              </div>
            </div>

            <div className="contact-form-card reveal reveal-delay-2">
              <h3 className="contact-form-title">{t('contact.formTitle')}</h3>
              <p className="contact-form-note">{t('contact.subtitle')}</p>
              <Link to="/contact" className="btn btn-primary mt-4">
                {t('cta.button')}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}