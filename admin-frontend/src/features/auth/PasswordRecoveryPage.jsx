import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLanguage } from '../../i18n/useLanguage'
import { requestPasswordReset, resetPassword } from './authApi'

function PasswordRecoveryContent() {
  const { t } = useLanguage()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState({ type: '', message: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus({ type: '', message: '' })
    setIsSubmitting(true)

    try {
      if (token) {
        const response = await resetPassword({ token, newPassword, confirmPassword })
        setStatus({ type: 'success', message: response.message || t('authUi.passwordReset') })
      } else {
        const response = await requestPasswordReset(email)
        setStatus({ type: 'success', message: response.message || t('authUi.resetEmailSent') })
      }
    } catch (error) {
      setStatus({
        type: 'error',
        message: error.response?.data?.message || error.message || t('authUi.requestFailed'),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="login-wrapper">
      <main className="recovery-panel" aria-labelledby="recovery-title">
        <div className="recovery-brand">
          <ShieldCheck size={30} aria-hidden="true" />
          <span>VANGUARD SERVICES</span>
        </div>
        <p className="login-panel-eyebrow">{t('authUi.administration')}</p>
        <h1 id="recovery-title">{token ? t('authUi.newPassword') : t('authUi.forgotPasswordTitle')}</h1>
        <p className="recovery-description">
          {token ? t('authUi.resetDescription') : t('authUi.recoveryDescription')}
        </p>

        {status.message && (
          <div className={`alert ${status.type === 'error' ? 'alert-danger' : 'alert-success'}`} role="alert">
            {status.message}
          </div>
        )}

        {!(status.type === 'success' && token) && (
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            {!token ? (
              <div className="form-group">
                <label className="form-label" htmlFor="recovery-email">{t('authUi.email')}</label>
                <div className="input-icon-wrap">
                  <Mail size={15} className="input-left-icon" aria-hidden="true" />
                  <input id="recovery-email" type="email" className="form-control input-with-left-icon" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                </div>
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="new-password">{t('authUi.newPassword')}</label>
                  <div className="input-icon-wrap">
                    <Lock size={15} className="input-left-icon" aria-hidden="true" />
                    <input id="new-password" type={showPassword ? 'text' : 'password'} className="form-control input-with-left-icon input-with-right-icon" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} required />
                    <button type="button" className="password-toggle-btn" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? t('hidePassword') : t('showPassword')}>
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="confirm-password">{t('authUi.confirmPassword')}</label>
                  <input id="confirm-password" type={showPassword ? 'text' : 'password'} className="form-control" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required />
                </div>
              </>
            )}
            <button type="submit" className="login-submit-btn" disabled={isSubmitting}>
              {isSubmitting ? t('authUi.processing') : token ? t('authUi.resetPassword') : t('authUi.receiveLink')}
              {!isSubmitting && <ArrowRight size={18} aria-hidden="true" />}
            </button>
          </form>
        )}

        <Link to="/admin/login" className="recovery-back-link"><ArrowLeft size={16} aria-hidden="true" /> {t('authUi.backToLogin')}</Link>
      </main>
    </div>
  )
}

export function PasswordRecoveryPage() {
  return <PasswordRecoveryContent />
}
