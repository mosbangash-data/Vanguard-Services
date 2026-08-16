import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, ShieldCheck } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageProvider'
import LanguageSwitcher from './LanguageSwitcher'

const ADMIN_URL = import.meta.env.VITE_ADMIN_URL || '/login'

export default function Navbar() {
  const { t } = useLanguage()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname, location.hash])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  return (
    <header className={`navbar${scrolled ? ' navbar-scrolled' : ''}`}>
      <div className="container navbar-inner">
        <Link to="/" className="navbar-brand" aria-label="Vanguard Services — Accueil">
          <img
            src="/assets/logos/vanguard-mark.svg"
            alt="Vanguard Services"
            className="navbar-logo"
            width="40"
            height="40"
          />
          <span className="navbar-brand-text">
            <span className="navbar-brand-name">VANGUARD</span>
            <span className="navbar-brand-sub">SERVICES</span>
          </span>
        </Link>

        <div className="navbar-actions">
          <LanguageSwitcher />
          <a
            href={ADMIN_URL}
            className="btn btn-primary btn-sm navbar-agent"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ShieldCheck size={16} aria-hidden="true" />
            {t('nav.agent')}
          </a>
          <button
            type="button"
            className="navbar-burger"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Menu mobile */}
      <div className={`navbar-mobile${mobileOpen ? ' navbar-mobile-open' : ''}`}>
        <nav className="navbar-mobile-nav" aria-label="Navigation mobile">
          <a
            href={ADMIN_URL}
            className="btn btn-primary navbar-mobile-agent"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ShieldCheck size={16} aria-hidden="true" />
            {t('nav.agent')}
          </a>
          <div className="navbar-mobile-lang">
            <LanguageSwitcher />
          </div>
        </nav>
      </div>
    </header>
  )
}