import React, { useState } from 'react'
import { KeyRound, UserCheck, Shield, Building2, CheckCircle2, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../auth/authContext'
import { api } from '../../../services/api'
import { useLanguage } from '../../../i18n/useLanguage'
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
  const { t } = useLanguage()

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
        <div className="vanguard-alert-warning" style={{
          backgroundColor: '#FFFBEB',
          border: '1px solid #FDE68A',
          padding: '14px 18px',
          borderRadius: '10px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <AlertTriangle size={20} color="#D97706" />
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#92400E' }}>
            <strong>{t('accountUi.firstLogin')}</strong> {t('accountUi.firstLoginHint')}
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* Profile Details Card */}
        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <UserCheck size={18} color="#2563EB" />
              <CardTitle>{t('accountUi.profile')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingBottom: '16px', borderBottom: '1px solid #E2E8F0' }}>
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  backgroundColor: '#0F172A',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '1.2rem'
                }}>
                  {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '1.05rem', color: '#0F172A' }}>
                    {user?.firstName ? `${user.firstName} ${user.lastName || ''}` : t('accountUi.user')}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748B' }}>{user?.email}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>{t('accountUi.role')}</span>
                  <div style={{ marginTop: '3px', fontWeight: 600, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={14} color="#2563EB" />
                    <span>{user?.role || 'SUPER_ADMIN'}</span>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>{t('accountUi.department')}</span>
                  <div style={{ marginTop: '3px', fontWeight: 600, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Building2 size={14} color="#2563EB" />
                    <span>{user?.department?.name || user?.departmentType || t('accountUi.global')}</span>
                  </div>
                </div>

                {user?.agency && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>{t('accountUi.agency')}</span>
                    <div style={{ marginTop: '3px', fontWeight: 600, color: '#0F172A' }}>
                      {user.agency.name} ({user.agency.city})
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <KeyRound size={18} color="#D97706" />
              <CardTitle>{t('accountUi.changePassword')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange}>
              {successMsg && (
                <div style={{
                  backgroundColor: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  color: '#15803D',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontSize: '0.84rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <CheckCircle2 size={16} />
                  <span>{successMsg}</span>
                </div>
              )}

              {errorMsg && (
                <div style={{
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#B91C1C',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontSize: '0.84rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertTriangle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <FormField label={t('accountUi.currentPassword')} required>
                <div style={{ position: 'relative' }}>
                  <Input
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder={t('accountUi.currentPasswordPlaceholder')}
                    required
                  />
                  <button
                    type="button"
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
                    onClick={() => setShowCurrent(!showCurrent)}
                  >
                    {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </FormField>

              <FormField label={t('accountUi.newPassword')} helper={t('accountUi.atLeast8')} required>
                <div style={{ position: 'relative' }}>
                  <Input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t('accountUi.newPasswordPlaceholder')}
                    required
                  />
                  <button
                    type="button"
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
                    onClick={() => setShowNew(!showNew)}
                  >
                    {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </FormField>

              <FormField label={t('accountUi.confirmPassword')} required>
                <div style={{ position: 'relative' }}>
                  <Input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('accountUi.confirmPasswordPlaceholder')}
                    required
                  />
                  <button
                    type="button"
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
                    onClick={() => setShowConfirm(!showConfirm)}
                  >
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </FormField>

              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
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
