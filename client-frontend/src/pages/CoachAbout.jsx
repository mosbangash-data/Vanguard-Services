import { useLanguage } from '../i18n/LanguageProvider'
import { useReveal } from '../hooks/useReveal'
import SectionHeader from '../components/SectionHeader'

export default function CoachAbout() {
  const { t } = useLanguage()
  const revealRef = useReveal()
  const items = t('institutional.commitmentItems')

  return (
    <div ref={revealRef}>
      <section className="page-hero">
        <div className="page-hero-bg" style={{ backgroundImage: 'url(/assets/hero/hero-main.jpg)' }} role="img" aria-label={t('institutional.coachTitle')} />
        <div className="page-hero-overlay" />
        <div className="container page-hero-content">
          <h1 className="page-hero-title display-title reveal">{t('institutional.coachTitle')}</h1>
        </div>
      </section>
      <section className="section">
        <div className="container institutional-content reveal">
          <SectionHeader center eyebrow={t('transportPage.heroTitle')} title={t('institutional.coachTitle')} />
          <p>{t('institutional.coachBody1')}</p>
          <p>{t('institutional.coachBody2')}</p>
          <p>{t('institutional.coachBody3')}</p>
          <h3>{t('institutional.visionTitle')}</h3>
          <p>{t('institutional.visionBody1')}</p>
          <p>{t('institutional.visionBody2')}</p>
          <h3>{t('institutional.commitmentTitle')}</h3>
          <p>{t('institutional.commitmentIntro')}</p>
          <ul>{items.map((item) => <li key={item}>{item};</li>)}</ul>
          <p>{t('institutional.coachBody4')}</p>
          <p className="institutional-conclusion">{t('institutional.coachConclusion')}</p>
        </div>
      </section>
    </div>
  )
}
