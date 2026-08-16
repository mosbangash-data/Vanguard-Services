import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  HardHat,
  Building2,
  Hammer,
  Ruler,
  CheckCircle2,
  Info,
  Send,
  MapPin,
  ArrowRight,
} from 'lucide-react'
import { useLanguage } from '../i18n/LanguageProvider'
import { useReveal } from '../hooks/useReveal'
import SectionHeader from '../components/SectionHeader'
import { LoadingState, ErrorState, EmptyState } from '../components/StateView'
import { api } from '../api/client'
import { useFetch } from '../hooks/useFetch'
import { translateError } from '../utils/errors'

export default function Construction() {
  const { t } = useLanguage()
  const revealRef = useReveal()

  // Demande de devis
  const [quoteForm, setQuoteForm] = useState({
    name: '',
    email: '',
    phone: '',
    projectType: '',
    budget: '',
    description: '',
  })
  const [quoteSubmitting, setQuoteSubmitting] = useState(false)
  const [quoteSuccess, setQuoteSuccess] = useState(null)
  const [quoteError, setQuoteError] = useState(null)

  // Demande client
  const [requestForm, setRequestForm] = useState({
    subject: '',
    name: '',
    email: '',
    phone: '',
    message: '',
  })
  const [requestSubmitting, setRequestSubmitting] = useState(false)
  const [requestSuccess, setRequestSuccess] = useState(null)
  const [requestError, setRequestError] = useState(null)

  const services = [
    { icon: Building2, title: t('constructionPage.service1Title'), desc: t('constructionPage.service1Desc') },
    { icon: Hammer, title: t('constructionPage.service2Title'), desc: t('constructionPage.service2Desc') },
    { icon: Ruler, title: t('constructionPage.service3Title'), desc: t('constructionPage.service3Desc') },
    { icon: HardHat, title: t('constructionPage.service4Title'), desc: t('constructionPage.service4Desc') },
  ]

  // Projets publics
  const { data: projectsData, loading: projectsLoading, error: projectsError, execute: reloadProjects } = useFetch(
    () => api.listPublicProjects({ page: 1, limit: 50 }),
    { deps: [] }
  )

  const projects = projectsData?.items || []

  const handleQuoteSubmit = async (e) => {
    e.preventDefault()
    setQuoteSubmitting(true)
    setQuoteError(null)
    try {
      const result = await api.createQuoteRequest({
        customerName: quoteForm.name,
        customerEmail: quoteForm.email || null,
        customerPhone: quoteForm.phone || null,
        projectType: quoteForm.projectType || null,
        budgetRange: quoteForm.budget || null,
        description: quoteForm.description,
      })
      setQuoteSuccess(result?.quoteRequest || true)
      setQuoteForm({ name: '', email: '', phone: '', projectType: '', budget: '', description: '' })
    } catch (err) {
      setQuoteError(translateError(err, t))
    } finally {
      setQuoteSubmitting(false)
    }
  }

  const handleRequestSubmit = async (e) => {
    e.preventDefault()
    setRequestSubmitting(true)
    setRequestError(null)
    try {
      const result = await api.createCustomerRequest({
        subject: requestForm.subject,
        customerName: requestForm.name,
        customerPhone: requestForm.phone || null,
        customerEmail: requestForm.email || null,
        message: requestForm.message,
      })
      setRequestSuccess(result?.customerRequest || true)
      setRequestForm({ subject: '', name: '', email: '', phone: '', message: '' })
    } catch (err) {
      setRequestError(translateError(err, t))
    } finally {
      setRequestSubmitting(false)
    }
  }

  const handleQuoteChange = (e) => {
    setQuoteForm({ ...quoteForm, [e.target.name]: e.target.value })
  }

  const handleRequestChange = (e) => {
    setRequestForm({ ...requestForm, [e.target.name]: e.target.value })
  }

  const getProjectImage = (project) => {
    const url = project.gallery?.[0]?.media?.url
    return url || '/assets/construction/construction-card.jpg'
  }

  return (
    <div ref={revealRef}>
      {/* ===== HERO ===== */}
      <section className="page-hero">
        <div
          className="page-hero-bg"
          style={{ backgroundImage: 'url(/assets/construction/construction-hero.jpg)' }}
          role="img"
          aria-label={t('constructionPage.heroTitle')}
        />
        <div className="page-hero-overlay" />
        <div className="container page-hero-content">
          <h1 className="page-hero-title display-title reveal">{t('constructionPage.heroTitle')}</h1>
          <p className="page-hero-subtitle reveal reveal-delay-1">{t('constructionPage.heroSubtitle')}</p>
        </div>
      </section>

      {/* ===== SERVICES ===== */}
      <section className="section">
        <div className="container">
          <div className="reveal">
            <SectionHeader
              center
              eyebrow={t('construction.eyebrow')}
              title={t('constructionPage.servicesTitle')}
              subtitle={t('constructionPage.servicesSubtitle')}
            />
          </div>
          <div className="grid grid-4">
            {services.map((service, index) => {
              const Icon = service.icon
              return (
                <div key={service.title} className={`why-card reveal reveal-delay-${index + 1}`}>
                  <div className="why-card-icon">
                    <Icon size={26} aria-hidden="true" />
                  </div>
                  <h3 className="why-card-title">{service.title}</h3>
                  <p className="why-card-desc">{service.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ===== RÉALISATIONS ===== */}
      <section className="section section-alt">
        <div className="container">
          <div className="reveal">
            <SectionHeader
              center
              eyebrow={t('construction.eyebrow')}
              title={t('constructionPage.projectsTitle')}
              subtitle={t('constructionPage.projectsSubtitle')}
            />
          </div>

          {projectsLoading && <LoadingState />}
          {projectsError && <ErrorState message={translateError(projectsError, t)} onRetry={reloadProjects} />}
          {!projectsLoading && !projectsError && projects.length === 0 && (
            <EmptyState message={t('constructionPage.noProjects')} />
          )}

          {!projectsLoading && !projectsError && projects.length > 0 && (
            <div className="grid grid-3 project-grid">
              {projects.map((project, index) => (
                <Link
                  to={`/construction/projects/${project.id}`}
                  key={project.id}
                  className={`project-card card reveal reveal-delay-${(index % 3) + 1}`}
                >
                  <div className="project-card-image">
                    <img
                      src={getProjectImage(project)}
                      alt={project.title}
                      loading="lazy"
                      width="800"
                      height="500"
                    />
                    <div className="project-card-overlay" />
                    <span className="badge badge-success project-card-status">
                      {t('constructionPage.statusPublished')}
                    </span>
                  </div>
                  <div className="project-card-body">
                    <h3 className="project-card-title">{project.title}</h3>
                    {project.location && (
                      <p className="project-card-location">
                        <MapPin size={14} aria-hidden="true" />
                        {project.location}
                      </p>
                    )}
                    {project.description && (
                      <p className="project-card-desc">{project.description}</p>
                    )}
                    <span className="project-card-cta">
                      {t('constructionPage.viewProject')}
                      <ArrowRight size={16} aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ===== DEMANDE CLIENT ===== */}
      <section className="section">
        <div className="container">
          <div className="reveal">
            <SectionHeader
              center
              eyebrow={t('construction.eyebrow')}
              title={t('constructionPage.customerRequestTitle')}
              subtitle={t('constructionPage.customerRequestSubtitle')}
            />
          </div>

          <div className="quote-layout">
            <div className="quote-info reveal">
              <div className="quote-features">
                <div className="quote-feature">
                  <CheckCircle2 size={20} aria-hidden="true" />
                  <span>{t('construction.feature1Title')}</span>
                </div>
                <div className="quote-feature">
                  <CheckCircle2 size={20} aria-hidden="true" />
                  <span>{t('construction.feature2Title')}</span>
                </div>
                <div className="quote-feature">
                  <CheckCircle2 size={20} aria-hidden="true" />
                  <span>{t('construction.feature3Title')}</span>
                </div>
              </div>
            </div>

            <div className="quote-form-card reveal reveal-delay-2">
              {requestSuccess ? (
                <div className="form-success">
                  <div className="confirmation-icon">
                    <CheckCircle2 size={48} aria-hidden="true" />
                  </div>
                  <h3>{t('constructionPage.requestReceived')}</h3>
                  <p>{t('constructionPage.customerRequestSuccess')}</p>
                  {requestSuccess?.id && (
                    <div className="confirmation-code">
                      {t('constructionPage.customerRequestSuccessId')} : {requestSuccess.id}
                    </div>
                  )}
                  <button
                    type="button"
                    className="btn btn-outline mt-4"
                    onClick={() => setRequestSuccess(null)}
                  >
                    {t('constructionPage.newRequest')}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRequestSubmit}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="csubject">
                      {t('constructionPage.customerRequestSubject')} <span className="required">*</span>
                    </label>
                    <input
                      id="csubject"
                      name="subject"
                      type="text"
                      className="form-input"
                      placeholder={t('constructionPage.customerRequestSubjectPlaceholder')}
                      value={requestForm.subject}
                      onChange={handleRequestChange}
                      required
                      minLength={3}
                      maxLength={120}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="cname">
                      {t('constructionPage.customerRequestName')} <span className="required">*</span>
                    </label>
                    <input
                      id="cname"
                      name="name"
                      type="text"
                      className="form-input"
                      value={requestForm.name}
                      onChange={handleRequestChange}
                      required
                      minLength={2}
                      maxLength={120}
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label" htmlFor="cemail">
                        {t('constructionPage.customerRequestEmail')}
                      </label>
                      <input
                        id="cemail"
                        name="email"
                        type="email"
                        className="form-input"
                        value={requestForm.email}
                        onChange={handleRequestChange}
                        maxLength={160}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="cphone">
                        {t('constructionPage.customerRequestPhone')} <span className="required">*</span>
                      </label>
                      <input
                        id="cphone"
                        name="phone"
                        type="tel"
                        className="form-input"
                        value={requestForm.phone}
                        onChange={handleRequestChange}
                        required
                        minLength={7}
                        maxLength={30}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="cmessage">
                      {t('constructionPage.customerRequestMessage')} <span className="required">*</span>
                    </label>
                    <textarea
                      id="cmessage"
                      name="message"
                      className="form-textarea"
                      placeholder={t('constructionPage.customerRequestMessagePlaceholder')}
                      value={requestForm.message}
                      onChange={handleRequestChange}
                      required
                      minLength={10}
                      maxLength={2000}
                    />
                  </div>
                  {requestError && <div className="notice notice-error">{requestError}</div>}
                  <button type="submit" className="btn btn-primary btn-lg" disabled={requestSubmitting}>
                    <Send size={18} aria-hidden="true" />
                    {requestSubmitting ? t('constructionPage.customerRequestSending') : t('constructionPage.customerRequestSubmit')}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===== DEMANDE DE DEVIS ===== */}
      <section className="section section-alt">
        <div className="container">
          <div className="quote-layout">
            <div className="quote-info reveal">
              <SectionHeader
                eyebrow={t('construction.eyebrow')}
                title={t('constructionPage.quoteTitle')}
                subtitle={t('constructionPage.quoteSubtitle')}
              />
              <div className="quote-features">
                <div className="quote-feature">
                  <CheckCircle2 size={20} aria-hidden="true" />
                  <span>{t('construction.feature1Title')}</span>
                </div>
                <div className="quote-feature">
                  <CheckCircle2 size={20} aria-hidden="true" />
                  <span>{t('construction.feature2Title')}</span>
                </div>
                <div className="quote-feature">
                  <CheckCircle2 size={20} aria-hidden="true" />
                  <span>{t('construction.feature3Title')}</span>
                </div>
              </div>
            </div>

            <div className="quote-form-card reveal reveal-delay-2">
              {quoteSuccess ? (
                <div className="form-success">
                  <div className="confirmation-icon">
                    <CheckCircle2 size={48} aria-hidden="true" />
                  </div>
                  <h3>{t('constructionPage.requestReceived')}</h3>
                  <p>{t('constructionPage.quoteSuccess')}</p>
                  <div className="notice notice-info">
                    <Info size={18} aria-hidden="true" />
                    <span>{t('constructionPage.quoteSuccess')}</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline mt-4"
                    onClick={() => setQuoteSuccess(null)}
                  >
                    {t('constructionPage.newRequest')}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleQuoteSubmit}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="qname">
                      {t('constructionPage.quoteName')} <span className="required">*</span>
                    </label>
                    <input
                      id="qname"
                      name="name"
                      type="text"
                      className="form-input"
                      value={quoteForm.name}
                      onChange={handleQuoteChange}
                      required
                      minLength={2}
                      maxLength={120}
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label" htmlFor="qemail">
                        {t('constructionPage.quoteEmail')}
                      </label>
                      <input
                        id="qemail"
                        name="email"
                        type="email"
                        className="form-input"
                        value={quoteForm.email}
                        onChange={handleQuoteChange}
                        maxLength={160}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="qphone">
                        {t('constructionPage.quotePhone')} <span className="required">*</span>
                      </label>
                      <input
                        id="qphone"
                        name="phone"
                        type="tel"
                        className="form-input"
                        value={quoteForm.phone}
                        onChange={handleQuoteChange}
                        required
                        minLength={7}
                        maxLength={30}
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label" htmlFor="qtype">
                        {t('constructionPage.quoteType')}
                      </label>
                      <select
                        id="qtype"
                        name="projectType"
                        className="form-select"
                        value={quoteForm.projectType}
                        onChange={handleQuoteChange}
                      >
                        <option value="">{t('constructionPage.quoteTypePlaceholder')}</option>
                        <option value="house">{t('constructionPage.projectTypes.house')}</option>
                        <option value="building">{t('constructionPage.projectTypes.building')}</option>
                        <option value="commercial">{t('constructionPage.projectTypes.commercial')}</option>
                        <option value="renovation">{t('constructionPage.projectTypes.renovation')}</option>
                        <option value="other">{t('constructionPage.projectTypes.other')}</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="qbudget">
                        {t('constructionPage.quoteBudget')}
                      </label>
                      <input
                        id="qbudget"
                        name="budget"
                        type="text"
                        className="form-input"
                        placeholder={t('constructionPage.quoteBudgetPlaceholder')}
                        value={quoteForm.budget}
                        onChange={handleQuoteChange}
                        maxLength={50}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="qdesc">
                      {t('constructionPage.quoteDescription')} <span className="required">*</span>
                    </label>
                    <textarea
                      id="qdesc"
                      name="description"
                      className="form-textarea"
                      placeholder={t('constructionPage.quoteDescriptionPlaceholder')}
                      value={quoteForm.description}
                      onChange={handleQuoteChange}
                      required
                      minLength={10}
                      maxLength={2000}
                    />
                  </div>
                  {quoteError && <div className="notice notice-error">{quoteError}</div>}
                  <button type="submit" className="btn btn-primary btn-lg" disabled={quoteSubmitting}>
                    <Send size={18} aria-hidden="true" />
                    {quoteSubmitting ? t('constructionPage.quoteSending') : t('constructionPage.quoteSubmit')}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}