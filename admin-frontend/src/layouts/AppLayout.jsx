import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../features/auth/authContext'
import { hasPermission } from '../features/auth/permissions'
import { useLanguage } from '../i18n/useLanguage'

export function AppLayout({ title, navigation }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { lang, setLang, t } = useLanguage()
  const [menuOpen, setMenuOpen] = useState(false)
  const logout = () => { signOut(); navigate('/admin/login', { replace: true }) }
  const visibleNavigation = navigation.filter((item) => {
    if (item.roles && !item.roles.includes(user?.role) && user?.role !== 'SUPER_ADMIN') return false
    if (item.excludeRoles && item.excludeRoles.includes(user?.role)) return false
    return !item.permission || hasPermission(user, item.permission) || user?.role === 'SUPER_ADMIN'
  })

  return <div className="app-shell">{menuOpen && <button type="button" className="drawer-overlay" aria-label={t('layout.closeMenu')} onClick={() => setMenuOpen(false)} />}<aside className={`sidebar ${menuOpen ? 'open' : ''}`}><strong>VANGUARD SERVICES</strong><span className="context">{title}</span><nav>{visibleNavigation.map((item) => <NavLink key={item.path} to={item.path} end={item.path.split('/').length === 2} onClick={() => setMenuOpen(false)}>{item.labelKey ? t(item.labelKey) : item.label}</NavLink>)}</nav></aside><section className="app-area"><header className="app-header"><div className="header-left"><button type="button" className="mobile-toggle" onClick={() => setMenuOpen(true)} aria-label={t('layout.openMenu')}>☰</button><div><strong>{user?.firstName} {user?.lastName}</strong><small>{user?.role} · {user?.department?.name || 'Global'}</small></div></div><div className="layout-header-actions"><div className="language-selector" aria-label="Language selector"><button type="button" className={`lang-btn ${lang === 'fr' ? 'active' : ''}`} onClick={() => setLang('fr')}>FR</button><span className="lang-divider">|</span><button type="button" className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button></div><button className="button secondary" onClick={logout}>{t('layout.logout')}</button></div></header><main className="app-main"><Outlet /></main></section></div>
}
