import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Lock, User } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import vanguardLogo from '../../assets/logos/vanguard-services.png'
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
      <div className="login-container">
        {/* Brand & Logo Header */}
        <div className="login-brand">
          <img
            src={vanguardLogo}
            alt="Vanguard Services Logo"
            className="login-logo"
          />
          <h1 className="login-brand-title">VANGUARD SERVICES</h1>
          <span className="login-brand-subtitle">{t('brandSubtitle')}</span>
        </div>

        {/* Card Form */}
        <div className="login-card">
          <div className="login-card-header">
            <div>
              <h2>{t('welcomeTitle')}</h2>
              <p>{t('welcomeSubtitle')}</p>
            </div>

            {/* Language Selector FR | EN */}
            <div className="language-selector" aria-label="Language selector">
              <button
                type="button"
                className={`lang-btn ${lang === 'fr' ? 'active' : ''}`}
                onClick={() => setLang('fr')}
              >
                FR
              </button>
              <span className="lang-divider">|</span>
              <button
                type="button"
                className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
                onClick={() => setLang('en')}
              >
                EN
              </button>
            </div>
          </div>

          <form className="login-form" onSubmit={handleSubmit(onSubmit)} noValidate>
            {serverError && <div className="alert alert-danger">{serverError}</div>}

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
                  tabIndex={-1}
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
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="login-footer">
          <p>© {new Date().getFullYear()} Vanguard Services. {t('footerCopyright')}</p>
        </div>
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
