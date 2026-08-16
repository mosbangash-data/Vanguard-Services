import { useEffect, useState } from 'react'
import { Phone, Mail, MapPin, Clock, Info } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageProvider'
import { useReveal } from '../hooks/useReveal'
import SectionHeader from '../components/SectionHeader'
import { api } from '../api/client'
import { LoadingState } from '../components/StateView'

export default function Contact() {
  const { t } = useLanguage()
  const revealRef = useReveal()

  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const result = await api.getWebsiteSettings()
        if (!cancelled) {
          setSettings(result?.settings || null)
          setUnavailable(false)
        }
      } catch {
        if (!cancelled) {
          // Le backend public n'existe pas encore — on affiche l'indisponibilité proprement
          setSettings(null)
          setUnavailable(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const contactItems = settings
    ? [
        ...(settings.phone ? [{ icon: Phone, label: t('contact.phone'), value: settings.phone }] : []),
        ...(settings.email ? [{ icon: Mail, label: t('contact.email'), value: settings.email }] : []),
        ...(settings.address ? [{ icon: MapPin, label: t('contact.address'), value: settings.address }] : []),
      ]
    : []

  return (
    <div ref={revealRef}>
      <section className="page-hero">
        <div
          className="page-hero-bg"
          style={{ backgroundImage: 'url(/assets/hero/hero-main.jpg)' }}
          role="img"
          aria-label={t('contact.title')}
        />
        <div className="page-hero-overlay" />
        <div className="container page-hero-content">
          <h1 className="page-hero-title display-title reveal">{t('contact.title')}</h1>
          <p className="page-hero-subtitle reveal reveal-delay-1">{t('contact.subtitle')}</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="reveal">
            <SectionHeader
              center
              eyebrow={t('contact.eyebrow')}
              title={t('contact.title')}
              subtitle={t('contact.subtitle')}
            />
          </div>

          {loading && <LoadingState />}

          {!loading && (
            <div className="contact-grid">
              <div className="contact-info reveal">
                {unavailable && (
                  <div className="notice notice-info">
                    <Info size={18} aria-hidden="true" />
                    <div>
                      <strong>{t('contact.unavailableTitle')}</strong>
                      <p>{t('contact.unavailable')}</p>
                    </div>
                  </div>
                )}

                {!unavailable && contactItems.length === 0 && (
                  <div className="notice notice-info">
                    <Info size={18} aria-hidden="true" />
                    <span>{t('contact.unavailable')}</span>
                  </div>
                )}

                {contactItems.length > 0 &&
                  contactItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <div key={item.label} className="contact-item">
                        <div className="contact-item-icon">
                          <Icon size={20} aria-hidden="true" />
                        </div>
                        <div>
                          <h4>{item.label}</h4>
                          <p>{item.value}</p>
                        </div>
                      </div>
                    )
                  })}

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
                <div className="notice notice-info">
                  <Info size={18} aria-hidden="true" />
                  <span>{t('contact.unavailable')}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}