import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, ShieldCheck, ChevronDown } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageProvider'
import LanguageSwitcher from './LanguageSwitcher'

const ADMIN_URL = import.meta.env.VITE_ADMIN_URL || '/login'

export default function Navbar() {
  const { t } = useLanguage()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const location = useLocation()
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30)
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => { setMobileOpen(false); setAboutOpen(false) }, [location.pathname, location.hash])
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])
  const brand = <><img src="/assets/logos/vanguard-mark.svg" alt="" className="navbar-logo" width="40" height="40" /><span className="navbar-brand-text"><span className="navbar-brand-name">VANGUARD</span><span className="navbar-brand-sub">SERVICES</span></span></>
  return <header className={`navbar${scrolled ? ' navbar-scrolled' : ''}`}>
    <div className="container navbar-inner">
      <Link to="/" className="navbar-brand" aria-label="Vanguard Services — Accueil">{brand}</Link>
      <nav className="navbar-nav" aria-label="Navigation principale">
        <Link to="/" className="nav-link">{t('nav.home')}</Link>
        <Link to="/#services" className="nav-link">{t('nav.services') || t('nav.transport')}</Link>
        <div className="navbar-about">
          <button className="nav-link navbar-about-trigger" aria-expanded={aboutOpen} onClick={() => setAboutOpen((open) => !open)}>{t('nav.about') || t('nav.coachAbout')}<ChevronDown size={15} /></button>
          {aboutOpen && <div className="navbar-about-menu"><Link to="/transport/about" className="navbar-about-link">{t('nav.coachAbout')}</Link><Link to="/construction/about" className="navbar-about-link">{t('nav.constructionAbout')}</Link></div>}
        </div>
      </nav>
      <div className="navbar-actions navbar-desktop-actions"><a href={ADMIN_URL} className="btn btn-primary btn-sm navbar-agent" target="_blank" rel="noopener noreferrer"><ShieldCheck size={16} />{t('nav.agent')}</a><LanguageSwitcher /></div>
      <button type="button" className="navbar-burger" onClick={() => setMobileOpen((v) => !v)} aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={mobileOpen}>{mobileOpen ? <X size={20} /> : <Menu size={20} />}<span>{t('nav.menu')}</span></button>
    </div>
    <div className={`navbar-mobile${mobileOpen ? ' navbar-mobile-open' : ''}`} aria-hidden={!mobileOpen}>
      <nav className="navbar-mobile-nav" aria-label="Navigation mobile">
        <Link to="/" className="navbar-mobile-link">{t('nav.home')}</Link><Link to="/#services" className="navbar-mobile-link">{t('nav.services') || t('nav.transport')}</Link>
        <div className="navbar-mobile-group"><span>{t('nav.about') || t('nav.coachAbout')}</span><Link to="/transport/about" className="navbar-mobile-link">{t('nav.coachAbout')}</Link><Link to="/construction/about" className="navbar-mobile-link">{t('nav.constructionAbout')}</Link></div>
        <a href={ADMIN_URL} className="btn btn-primary navbar-mobile-agent" target="_blank" rel="noopener noreferrer"><ShieldCheck size={16} />{t('nav.agent')}</a><div className="navbar-mobile-lang"><LanguageSwitcher /></div>
      </nav>
    </div>
  </header>
}
