import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Eye, EyeOff, Lock, ShieldCheck, User } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { LanguageProvider } from '../../i18n/LanguageProvider'
import { useLanguage } from '../../i18n/useLanguage'
import { login } from './authApi'
import { loginSchema } from './loginSchema'
import { getDestination } from './session'
import { useAuth } from './authContext'

function LoginPageContent() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const { lang, setLang, t } = useLanguage()

  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
  })

  const getLoginError = (error) => {
    const status = error.response?.status
    if (status === 401) return t('errors.invalidCredentials')
    if (status === 403) return t('errors.unauthorizedAccount')
    if (status === 429) return t('errors.rateLimit')
    if (!error.response) return t('errors.serviceUnavailable')
    return t('errors.genericError')
  }

  const onSubmit = async (values) => {
    setServerError('')
    try {
      const session = await login(values)
      signIn(session)
      navigate(getDestination(session.user), { replace: true })
    } catch (error) {
      setServerError(getLoginError(error))
    }
  }

  return (
    <div className="login-wrapper">
      <div className="login-shell">
        <section className="login-showcase" aria-label="Vanguard Services">
          <div className="login-showcase-content">
            <div className="login-showcase-brand">
              <ShieldCheck size={34} aria-hidden="true" />
              <span>VANGUARD SERVICES</span>
            </div>
            <div>
              <p className="login-showcase-eyebrow">{t('brandSubtitle')}</p>
              <h1>{t('welcomeTitle')}</h1>
              <p className="login-showcase-copy">{t('welcomeSubtitle')}</p>
            </div>
            <div className="login-showcase-services" aria-hidden="true">
              <span>Coach</span>
              <span>Construction</span>
              <span>Automobile</span>
            </div>
          </div>
        </section>

        <section className="login-panel">
          <div className="login-panel-topline">
            <span className="login-panel-label"><ShieldCheck size={16} /> Administration</span>
            <div className="language-selector" aria-label="Language selector">
              <button type="button" className={`lang-btn ${lang === 'fr' ? 'active' : ''}`} onClick={() => setLang('fr')}>FR</button>
              <span className="lang-divider">|</span>
              <button type="button" className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button>
            </div>
          </div>

          <div className="login-panel-heading">
            <p className="login-panel-eyebrow">Vanguard Services</p>
            <h2>Connexion</h2>
            <p>Accédez à votre espace de gestion.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit(onSubmit)} noValidate>
            {serverError && <div className="alert alert-danger" role="alert">{serverError}</div>}

            <div className="form-group">
              <label className="form-label" htmlFor="identifier">
                {t('identifierLabel')}
              </label>
              <div className="input-icon-wrap">
                <User size={15} className="input-left-icon" />
                <input
                  id="identifier"
                  type="text"
                  className={`form-control input-with-left-icon ${errors.identifier ? 'has-error' : ''}`}
                  autoComplete="username"
                  placeholder={t('identifierPlaceholder')}
                  aria-invalid={Boolean(errors.identifier)}
                  {...register('identifier')}
                />
              </div>
              {errors.identifier && (
                <p className="form-error">
                  {lang === 'en' ? 'Identifier is required.' : errors.identifier.message}
                </p>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                {t('passwordLabel')}
              </label>
              <div className="input-icon-wrap">
                <Lock size={15} className="input-left-icon" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className={`form-control input-with-left-icon input-with-right-icon ${errors.password ? 'has-error' : ''}`}
                  autoComplete="current-password"
                  placeholder={t('passwordPlaceholder')}
                  aria-invalid={Boolean(errors.password)}
                  {...register('password')}
                />
                <button
                  className="password-toggle-btn"
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && (
                <p className="form-error">
                  {lang === 'en' ? 'Password is required.' : errors.password.message}
                </p>
              )}
            </div>

            <button type="submit" className="login-submit-btn" disabled={isSubmitting}>
              {isSubmitting ? t('submitButtonLoading') : t('submitButton')}
              {!isSubmitting && <ArrowRight size={18} aria-hidden="true" />}
            </button>
            <Link to="/admin/forgot-password" className="login-forgot-link">
              Mot de passe oublié ?
            </Link>
          </form>
          <div className="login-footer">
            <p>© {new Date().getFullYear()} Vanguard Services. {t('footerCopyright')}</p>
          </div>
        </section>
      </div>
    </div>
  )
}

export function LoginPage() {
  return (
    <LanguageProvider>
      <LoginPageContent />
    </LanguageProvider>
  )
}
