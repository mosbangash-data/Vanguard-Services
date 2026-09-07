import { MapPin } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageProvider'
import { useReveal } from '../hooks/useReveal'
import SectionHeader from '../components/SectionHeader'

export default function ConstructionAbout() {
  const { t } = useLanguage()
  const revealRef = useReveal()

  return (
    <div ref={revealRef}>
      <section className="page-hero">
        <div className="page-hero-bg" style={{ backgroundImage: 'url(/assets/construction/construction-hero.jpg)' }} role="img" aria-label={t('institutional.constructionTitle')} />
        <div className="page-hero-overlay" />
        <div className="container page-hero-content">
          <h1 className="page-hero-title display-title reveal">{t('institutional.constructionTitle')}</h1>
        </div>
      </section>
      <section className="section">
        <div className="container institutional-content reveal">
          <SectionHeader center eyebrow={t('construction.eyebrow')} title={t('institutional.constructionTitle')} />
          <p>{t('institutional.constructionBody1')}</p>
          <p>{t('institutional.constructionBody2')}</p>
          <h3>{t('institutional.physicalAddress')}</h3>
          <p><MapPin size={17} aria-hidden="true" /> {t('institutional.constructionAddress')}</p>
          <p className="institutional-conclusion">{t('institutional.constructionConclusion')}</p>
        </div>
      </section>
    </div>
  )
}
