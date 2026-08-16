import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Phone, Mail, MapPin, ShieldCheck, Clock } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageProvider'
import { api } from '../api/client'

const ADMIN_URL = import.meta.env.VITE_ADMIN_URL || '/login'

export default function Footer() {
  const { t } = useLanguage()
  const [settings, setSettings] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const result = await api.getWebsiteSettings()
        if (!cancelled) setSettings(result?.settings || null)
      } catch {
        if (!cancelled) setSettings(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          {/* Colonne 1: Marque & Description */}
          <div className="footer-brand">
            <div className="footer-logo">
              <img
                src="/assets/logos/vanguard-mark.svg"
                alt="Vanguard Services"
                width="44"
                height="44"
              />
              <span className="footer-logo-text">
                <span className="footer-logo-name">VANGUARD</span>
                <span className="footer-logo-sub">SERVICES</span>
              </span>
            </div>
            <p className="footer-tagline">{t('footer.tagline')}</p>
            <div className="footer-socials">
              <a href="#facebook" className="footer-social-link" aria-label="Facebook">
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H7v-3h3V9.5C10 6.46 11.82 5 14.5 5c1.28 0 2.63.23 2.63.23v2.89h-1.48c-1.5 0-1.97.93-1.97 1.89V12h3.26l-.52 3h-2.74v6.8c4.56-.93 8-4.96 8-9.8z"/></svg>
              </a>
              <a href="#twitter" className="footer-social-link" aria-label="Twitter">
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="#instagram" className="footer-social-link" aria-label="Instagram">
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              </a>
              <a href="#linkedin" className="footer-social-link" aria-label="LinkedIn">
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.45a1.6 1.6 0 1 0 1.6 1.6 1.6 1.6 0 0 0-1.6-1.6z"/></svg>
              </a>
            </div>
          </div>

          {/* Colonne 2: Liens Rapides */}
          <div className="footer-col">
            <h4 className="footer-title">{t('footer.quickLinks')}</h4>
            <ul className="footer-links">
              <li>
                <Link to="/">{t('nav.home')}</Link>
              </li>
              <li>
                <a href="/#services">{t('nav.services')}</a>
              </li>
              <li>
                <a href="/#about">{t('nav.about')}</a>
              </li>
              <li>
                <a href="/#how-it-works">{t('nav.howItWorks')}</a>
              </li>
              <li>
                <Link to="/contact">{t('nav.contact')}</Link>
              </li>
            </ul>
          </div>

          {/* Colonne 3: Nos Services */}
          <div className="footer-col">
            <h4 className="footer-title">{t('footer.servicesTitle')}</h4>
            <ul className="footer-links">
              <li>
                <Link to="/transport">{t('services.transportTitle')}</Link>
              </li>
              <li>
                <Link to="/construction">{t('services.constructionTitle')}</Link>
              </li>
              <li>
                <Link to="/automobile">{t('services.automobileTitle')}</Link>
              </li>
            </ul>
          </div>

          {/* Colonne 4: Contact */}
          <div className="footer-col">
            <h4 className="footer-title">{t('nav.contact')}</h4>
            <ul className="footer-contact">
              <li>
                <MapPin size={16} aria-hidden="true" />
                <span>{settings?.address || 'Avenue de la Paix, Goma, RDC'}</span>
              </li>
              <li>
                <Phone size={16} aria-hidden="true" />
                <span>{settings?.phone || '+243 97 000 0000'}</span>
              </li>
              <li>
                <Mail size={16} aria-hidden="true" />
                <span>{settings?.email || 'contact@vanguard-services.com'}</span>
              </li>
              <li>
                <Clock size={16} aria-hidden="true" />
                <span>{t('contact.hoursValue')}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>
            © {new Date().getFullYear()} Vanguard Services. {t('footer.rights')}
          </p>
          <a href={ADMIN_URL} className="footer-agent" target="_blank" rel="noopener noreferrer">
            <ShieldCheck size={15} aria-hidden="true" />
            {t('nav.agent')}
          </a>
        </div>
      </div>
    </footer>
  )
}