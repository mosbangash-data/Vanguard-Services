import React, { useState } from 'react'
import { KeyRound, UserCheck, Shield, Building2, CheckCircle2, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../auth/authContext'
import { api } from '../../../services/api'
import { useLanguage } from '../../../i18n/useLanguage'
import { useTheme } from '../../../theme/useTheme'
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  FormField,
  Input,
  Button,
} from '../../../components/ui'

export function AccountPage() {
  const { user } = useAuth()
  const { t, lang, setLang } = useLanguage()
  const { theme, setTheme } = useTheme()

  // Form states
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setSuccessMsg('')
    setErrorMsg('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMsg(t('accountUi.allFieldsRequired'))
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg(t('accountUi.passwordMismatch'))
      return
    }

    if (newPassword.length < 8) {
      setErrorMsg(t('accountUi.passwordMinLength'))
      return
    }

    try {
      setLoading(true)
      const response = await api.post('/api/auth/change-password', {
        currentPassword,
        newPassword,
        confirmPassword,
      })

      if (response.data?.success || response.status === 200) {
        setSuccessMsg(t('accountUi.passwordUpdated'))
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch (err) {
      setErrorMsg(
        err?.response?.data?.message ||
          t('accountUi.updateFailed')
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page vanguard-account-page">
      <PageHeader
        eyebrow={t('accountUi.eyebrow')}
        title={t('accountUi.title')}
        subtitle={t('accountUi.subtitle')}
      />

      {user?.firstLogin && (
        <div className="vanguard-alert-warning vanguard-account-first-login">
          <AlertTriangle size={20} aria-hidden="true" />
          <p>
            <strong>{t('accountUi.firstLogin')}</strong> {t('accountUi.firstLoginHint')}
          </p>
        </div>
      )}

      <div className="vanguard-account-grid">
        {/* Profile Details Card */}
        <Card>
          <CardHeader>
            <div className="vanguard-account-card-heading">
              <UserCheck size={18} aria-hidden="true" />
              <CardTitle>{t('accountUi.profile')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="vanguard-account-profile">
              <div className="vanguard-account-identity">
                <div className="vanguard-account-avatar" aria-hidden="true">
                  {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                  <h4 className="vanguard-account-name">
                    {user?.firstName ? `${user.firstName} ${user.lastName || ''}` : t('accountUi.user')}
                  </h4>
                  <p className="vanguard-account-email">{user?.email}</p>
                </div>
              </div>

              <div className="vanguard-account-details">
                <div>
                  <span className="vanguard-account-label">{t('accountUi.role')}</span>
                  <div className="vanguard-account-value">
                    <Shield size={14} aria-hidden="true" />
                    <span>{user?.role || 'SUPER_ADMIN'}</span>
                  </div>
                </div>

                <div>
                  <span className="vanguard-account-label">{t('accountUi.department')}</span>
                  <div className="vanguard-account-value">
                    <Building2 size={14} aria-hidden="true" />
                    <span>{user?.department?.name || user?.departmentType || t('accountUi.global')}</span>
                  </div>
                </div>

                {user?.agency && (
                  <div className="vanguard-account-agency">
                    <span className="vanguard-account-label">{t('accountUi.agency')}</span>
                    <div className="vanguard-account-value">
                      {user.agency.name} ({user.agency.city})
                    </div>
                  </div>
                )}
              </div>

              <section className="vanguard-account-preferences" aria-labelledby="account-preferences-title">
                <h3 id="account-preferences-title">{t('accountUi.preferences')}</h3>
                <FormField label={t('layout.language')}>
                  <select className="form-control" value={lang} onChange={(event) => setLang(event.target.value)} aria-label={t('layout.language')}>
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                  </select>
                </FormField>
                <FormField label={t('layout.theme')}>
                  <select className="form-control" value={theme} onChange={(event) => setTheme(event.target.value)} aria-label={t('layout.theme')}>
                    <option value="light">{t('layout.themeLight')}</option>
                    <option value="dark">{t('layout.themeDark')}</option>
                    <option value="system">{t('layout.themeSystem')}</option>
                  </select>
                </FormField>
              </section>
            </div>
          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card>
          <CardHeader>
            <div className="vanguard-account-card-heading vanguard-account-card-heading--password">
              <KeyRound size={18} aria-hidden="true" />
              <CardTitle>{t('accountUi.changePassword')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange}>
              {successMsg && (
                <div className="vanguard-account-feedback vanguard-account-feedback--success" role="status">
                  <CheckCircle2 size={16} />
                  <span>{successMsg}</span>
                </div>
              )}

              {errorMsg && (
                <div className="vanguard-account-feedback vanguard-account-feedback--error" role="alert">
                  <AlertTriangle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <FormField label={t('accountUi.currentPassword')} required>
                <div className="vanguard-account-password-field">
                  <Input
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder={t('accountUi.currentPasswordPlaceholder')}
                    required
                  />
                  <button
                    type="button"
                    className="vanguard-account-password-toggle"
                    aria-label={showCurrent ? t('hidePassword') : t('showPassword')}
                    onClick={() => setShowCurrent(!showCurrent)}
                  >
                    {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </FormField>

              <FormField label={t('accountUi.newPassword')} helper={t('accountUi.atLeast8')} required>
                <div className="vanguard-account-password-field">
                  <Input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t('accountUi.newPasswordPlaceholder')}
                    required
                  />
                  <button
                    type="button"
                    className="vanguard-account-password-toggle"
                    aria-label={showNew ? t('hidePassword') : t('showPassword')}
                    onClick={() => setShowNew(!showNew)}
                  >
                    {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </FormField>

              <FormField label={t('accountUi.confirmPassword')} required>
                <div className="vanguard-account-password-field">
                  <Input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('accountUi.confirmPasswordPlaceholder')}
                    required
                  />
                  <button
                    type="button"
                    className="vanguard-account-password-toggle"
                    aria-label={showConfirm ? t('hidePassword') : t('showPassword')}
                    onClick={() => setShowConfirm(!showConfirm)}
                  >
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </FormField>

              <div className="vanguard-account-form-actions">
                <Button type="submit" variant="primary" loading={loading}>
                  {t('accountUi.updatePassword')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
