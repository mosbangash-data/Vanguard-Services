import React, { useState, useMemo, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Key,
  Building2,
  FileText,
  Bell,
  LogOut,
  Menu,
  X,
  Bus,
  CarFront,
  HardHat,
  ChevronDown,
  ChevronRight,
  User,
  Shield,
  Layers,
  FileSpreadsheet,
  QrCode,
  Compass,
  Calendar,
  Ticket,
  CreditCard,
  Package,
  UserRoundPlus,
  Wrench,
  Settings,
  Sun,
  Moon,
} from 'lucide-react'
import { useAuth } from '../features/auth/authContext'
import { hasPermission } from '../features/auth/permissions'
import { useLanguage } from '../i18n/useLanguage'
import { useTheme } from '../theme/useTheme'

const PATH_KEYS = {
  '/admin': 'dashboard',
  '/admin/users': 'users',
  '/admin/departments': 'departments',
  '/admin/roles': 'roles',
  '/admin/permissions': 'permissions',
  '/admin/notifications': 'notifications',
  '/admin/audit': 'audit',
  '/admin/account': 'account',

  '/transport': 'operations',
  '/transport/agencies': 'agencies',
  '/transport/buses': 'buses',
  '/transport/drivers': 'drivers',
  '/transport/destinations': 'destinations',
  '/transport/schedules': 'schedules',
  '/transport/trips': 'trips',
  '/transport/reservations': 'reservations',
  '/transport/tickets': 'tickets',
  '/transport/payments': 'payments',
  '/transport/parcels': 'parcels',
  '/transport/scanner': 'scanner',

  '/automobile': 'dashboard',
  '/automobile/vehicles': 'vehicles',
  '/automobile/templates': 'vehicleTemplates',
  '/automobile/inquiries': 'inquiries',
  '/automobile/reservations': 'reservations',
  '/automobile/payments': 'payments',
  '/automobile/sales': 'sales',
  '/automobile/agents': 'agents',

  '/construction': 'dashboard',
  '/construction/projects': 'projects',
  '/construction/templates': 'projectTemplates',
  '/construction/customer-requests': 'customerRequests',
  '/construction/quote-requests': 'quoteRequests',
}

export function AdminLayout({ customNavigation, pageTitleOverride }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { lang, setLang, t } = useLanguage()
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [logoutPending, setLogoutPending] = useState(false)

  useEffect(() => {
    if (!mobileOpen) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [mobileOpen])

  // Expandable section states in sidebar
  const [expandedSections, setExpandedSections] = useState({
    admin: true,
    coach: true,
    auto: true,
    construction: true,
    'agent-tickets': false,
    'agent-transport': false,
  })

  const toggleSection = (sectionKey) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }))
  }

  const handleLogout = async () => {
    if (logoutPending) return
    setLogoutPending(true)
    try {
      await signOut()
    } finally {
      navigate('/admin/login', { replace: true })
      setLogoutPending(false)
    }
  }

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const userDept = user?.department?.type || user?.departmentType
  const isCoachAgent = user?.role === 'AGENT' && userDept === 'VANGUARD_COACH'

  // Navigation Items Definitions
  const navSections = useMemo(() => {
    // The coach agent works from operational queues, not the department's
    // administrative CRUD catalog. Keep each destination on its real route.
    if (isCoachAgent) {
      const agentSections = [
        { id: 'agent-dashboard', titleKey: 'navigation.sections.agentDashboard', items: [
          { path: '/transport/agent', labelKey: 'navigation.items.dashboard', icon: LayoutDashboard },
          { path: '/transport/reservations', labelKey: 'navigation.items.sellTicket', icon: UserRoundPlus, permission: 'CREATE_RESERVATION' },
          { path: '/transport/parcels', labelKey: 'navigation.items.parcels', icon: Package, permission: 'VIEW_PARCEL' },
          { path: '/transport/operations', labelKey: 'navigation.items.payments', icon: CreditCard, permission: 'VIEW_PAYMENT' },
          { path: '/admin/account', labelKey: 'navigation.items.account', icon: Settings },
        ] },
        { id: 'agent-tickets', titleKey: 'navigation.sections.agentTicketTools', collapsible: true, items: [
          { path: '/transport/tickets', labelKey: 'navigation.items.tickets', icon: Ticket, permission: 'VIEW_RESERVATION' },
        ] },
        { id: 'agent-transport', titleKey: 'navigation.sections.agentTransportTools', collapsible: true, items: [
          { path: '/transport/scanner', labelKey: 'navigation.items.scanner', icon: QrCode, permission: 'SCAN_TICKET' },
          { path: '/transport/trips', labelKey: 'navigation.items.departures', icon: Bus, permission: 'VIEW_TRIP' },
        ] },
      ]
      return agentSections.map((section) => ({
        id: section.id,
        title: t(section.titleKey),
        collapsible: section.collapsible,
        items: section.items.filter((item) => !item.permission || hasPermission(user, item.permission)).map((item) => ({ ...item, label: t(item.labelKey) })),
      })).filter((section) => section.items.length)
    }

    if (customNavigation) {
      let customTitle = pageTitleOverride || t('navigation.title', {}, 'Navigation')
      if (location.pathname.startsWith('/transport')) {
        customTitle = t('navigation.sections.coach')
      } else if (location.pathname.startsWith('/automobile')) {
        customTitle = t('navigation.sections.automobile')
      } else if (location.pathname.startsWith('/construction')) {
        customTitle = t('navigation.sections.construction')
      }

      return [
        {
          id: 'custom',
          title: customTitle,
          items: customNavigation
            .filter((item) => {
              if (item.roles && !item.roles.includes(user?.role) && !isSuperAdmin) return false
              if (item.excludeRoles && item.excludeRoles.includes(user?.role)) return false
              return !item.permission || hasPermission(user, item.permission) || isSuperAdmin
            })
            .map((item) => {
              const label = item.labelKey
                ? t(item.labelKey)
                : PATH_KEYS[item.path]
                ? t(`navigation.items.${PATH_KEYS[item.path]}`)
                : item.label
              return { ...item, label }
            }),
        },
      ]
    }

    const sections = []

    // 1. Global Dashboard (For Super Admin)
    if (isSuperAdmin) {
      sections.push({
        id: 'global',
        title: t('navigation.sections.global'),
        items: [
          { path: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
        ],
      })

      // 2. Global Administration
      sections.push({
        id: 'admin',
        title: t('navigation.sections.admin'),
        collapsible: true,
        items: [
          { path: '/admin/users', label: 'Utilisateurs', icon: Users, permission: 'VIEW_USER' },
          { path: '/admin/departments', label: 'Départements', icon: Building2, permission: 'VIEW_DEPARTMENT' },
          { path: '/admin/roles', label: 'Rôles', icon: ShieldCheck, permission: 'VIEW_ROLE' },
          { path: '/admin/permissions', label: 'Permissions', icon: Key, permission: 'VIEW_PERMISSION' },
          { path: '/admin/notifications', label: 'Notifications', icon: Bell },
        ],
      })
    }

    // 3. Vanguard Coach
    if (isSuperAdmin || userDept === 'VANGUARD_COACH') {
      sections.push({
        id: 'coach',
        title: t('navigation.sections.coach'),
        badge: t('layout.department'),
        badgeColor: 'coach',
        collapsible: isSuperAdmin,
        items: [
          { path: '/transport', label: 'Opérations', icon: Bus, end: true },
          { path: '/transport/agencies', label: 'Agences', icon: Building2, roles: ['SUPER_ADMIN', 'SERVICE_ADMIN'] },
          { path: '/transport/buses', label: 'Flotte de Bus', icon: Bus, roles: ['SUPER_ADMIN', 'SERVICE_ADMIN'] },
          { path: '/transport/drivers', label: 'Chauffeurs', icon: User, roles: ['SUPER_ADMIN', 'SERVICE_ADMIN'] },
          { path: '/transport/destinations', label: 'Destinations', icon: Compass, roles: ['SUPER_ADMIN', 'SERVICE_ADMIN'] },
          { path: '/transport/schedules', label: 'Horaires', icon: Calendar, roles: ['SUPER_ADMIN', 'SERVICE_ADMIN'] },
          { path: '/transport/trips', label: 'Voyages', icon: Layers, permission: 'VIEW_TRIP' },
          { path: '/transport/reservations', label: 'Réservations', icon: Ticket, permission: 'VIEW_RESERVATION' },
          { path: '/transport/tickets', label: 'Billets', icon: Ticket, permission: 'VIEW_RESERVATION' },
          { path: '/transport/payments', label: 'Paiements', icon: CreditCard, permission: 'VIEW_PAYMENT' },
          { path: '/transport/parcels', label: 'Colis', icon: Package },
          { path: '/transport/scanner', label: 'Scanner QR', icon: QrCode, permission: 'SCAN_TICKET' },
        ],
      })
    }

    // 4. Vanguard Automobile
    if (isSuperAdmin || userDept === 'AUTO_SALES') {
      sections.push({
        id: 'auto',
        title: t('navigation.sections.automobile'),
        badge: t('layout.vehicleSales'),
        badgeColor: 'auto',
        collapsible: isSuperAdmin,
        items: [
          { path: '/automobile', label: 'Dashboard', icon: LayoutDashboard, end: true },
          { path: '/automobile/vehicles', label: 'Véhicules', icon: CarFront, permission: 'VIEW_VEHICLE' },
          { path: '/automobile/templates', label: 'Véhicules templates', icon: Layers, permission: 'VIEW_VEHICLE' },
          { path: '/automobile/inquiries', label: 'Demandes clients', icon: FileSpreadsheet, permission: 'VIEW_VEHICLE_INQUIRY' },
          { path: '/automobile/reservations', label: 'Réservations', icon: Ticket, permission: 'VIEW_RESERVATION' },
          { path: '/automobile/payments', label: 'Paiements', icon: CreditCard, permission: 'VIEW_RESERVATION' },
          { path: '/automobile/sales', label: 'Ventes', icon: Shield, permission: 'VIEW_RESERVATION' },
        ],
      })
    }

    // 5. Vanguard Construction
    if (isSuperAdmin || userDept === 'CONSTRUCTION') {
      sections.push({
        id: 'construction',
        title: t('navigation.sections.construction'),
        badge: t('layout.construction'),
        badgeColor: 'construction',
        collapsible: isSuperAdmin,
        items: [
          { path: '/construction', label: 'Dashboard', icon: LayoutDashboard, end: true },
          { path: '/construction/projects', label: 'Projets', icon: HardHat, permission: 'VIEW_PROJECT' },
          { path: '/construction/templates', label: 'Projets templates', icon: Layers, permission: 'VIEW_PROJECT' },
          { path: '/construction/customer-requests', label: 'Demandes clients', icon: FileSpreadsheet, permission: 'VIEW_CUSTOMER_REQUEST' },
          { path: '/construction/quote-requests', label: 'Devis', icon: FileText, permission: 'VIEW_QUOTE_REQUEST' },
          { path: '/construction/projects', label: 'Mes chantiers', icon: Wrench, permission: 'VIEW_PROJECT' },
        ],
      })
    }

    // 6. System & Audit
    sections.push({
      id: 'system',
      title: t('navigation.sections.system'),
      items: [
        ...(isSuperAdmin
          ? [{ path: '/admin/audit', label: 'Audit & Activité', icon: FileText }]
          : []),
        { path: '/admin/account', label: 'Mon compte', icon: Settings },
      ],
    })

    const sectionKeys = { global: 'global', admin: 'admin', coach: 'coach', auto: 'automobile', construction: 'construction', system: 'system' }
    return sections.map((section) => ({
      ...section,
      title: t(`navigation.sections.${sectionKeys[section.id]}`) || section.title,
      items: section.items.map((item) => ({
        ...item,
        label: item.labelKey ? t(item.labelKey) : PATH_KEYS[item.path] ? (t(`navigation.items.${PATH_KEYS[item.path]}`) || item.label) : item.label,
      })),
    }))
  }, [customNavigation, pageTitleOverride, isSuperAdmin, userDept, user, t, location.pathname, isCoachAgent])

  useEffect(() => {
    const activeCollapsible = navSections.find((section) => section.collapsible && section.items.some((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)))
    if (activeCollapsible) setExpandedSections((current) => ({ ...current, [activeCollapsible.id]: true }))
  }, [navSections, location.pathname])

  // Get active page context title
  const currentPath = location.pathname
  const getContextTitle = () => {
    if (isCoachAgent) return t('agent.workspaceTitle')
    if (currentPath.startsWith('/transport')) return t('navigation.sections.coach')
    if (currentPath.startsWith('/automobile')) return t('navigation.sections.automobile')
    if (currentPath.startsWith('/construction')) return t('navigation.sections.construction')
    if (currentPath === '/admin/audit') return t('navigation.items.audit')
    if (currentPath === '/admin/account') return t('navigation.items.account')
    return t('navigation.sections.admin')
  }

  return (
      <div className={`app-shell vanguard-app-shell${isCoachAgent ? ' vanguard-agent-shell' : ''}`}>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="drawer-overlay"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside id="app-navigation" className={`sidebar vanguard-sidebar ${mobileOpen ? 'open' : ''}`} aria-label={t('navigation.title')}>
        <div className={`sidebar-brand vanguard-sidebar-brand ${isCoachAgent ? 'vanguard-agent-brand' : ''}`}>
          <Link to={isSuperAdmin ? '/admin' : userDept === 'VANGUARD_COACH' ? '/transport' : userDept === 'AUTO_SALES' ? '/automobile' : '/construction'} className="sidebar-brand-link">
            {isCoachAgent ? <img
              src={`${import.meta.env.BASE_URL}assets/logos/vanguard-admin-logo.svg`}
              alt="Vanguard Services"
              className="sidebar-logo vanguard-sidebar-logo-svg"
              onError={(e) => {
                e.target.onerror = null
                e.target.src = `${import.meta.env.BASE_URL}assets/logos/vanguard-services.png`
              }}
            /> : <img
              src={`${import.meta.env.BASE_URL}assets/logos/vanguard-admin-logo.svg`}
              alt={`Vanguard Services · ${t('authUi.administration')}`}
              className="sidebar-logo vanguard-sidebar-logo-svg"
              onError={(e) => {
                e.target.onerror = null
                e.target.src = `${import.meta.env.BASE_URL}assets/logos/vanguard-services.png`
              }}
            />}
          </Link>
        </div>

        <nav className="sidebar-nav vanguard-sidebar-nav">
          {navSections.map((section) => {
            const isCollapsible = section.collapsible
            const isExpanded = expandedSections[section.id] ?? true

            return (
              <div key={section.id} className={`vanguard-nav-section ${section.id.startsWith('agent-') ? 'vanguard-nav-section--agent' : ''}`}>
                {isCollapsible ? <button
                  type="button"
                  className="vanguard-nav-section-header is-collapsible"
                  aria-expanded={isExpanded}
                  aria-controls={`nav-section-${section.id}`}
                  onClick={() => toggleSection(section.id)}
                >
                  <div className="vanguard-nav-section-title-wrap">
                    <span className="vanguard-nav-section-title">{section.title}</span>
                    {section.badge && (
                      <span className={`vanguard-nav-badge vanguard-nav-badge--${section.badgeColor || 'default'}`}>
                        {section.badge}
                      </span>
                    )}
                  </div>
                  {isCollapsible && (
                    <span className="vanguard-nav-collapse-icon">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  )}
                </button> : <div className="vanguard-nav-section-header">
                  <div className="vanguard-nav-section-title-wrap">
                    <span className="vanguard-nav-section-title">{section.title}</span>
                    {section.badge && <span className={`vanguard-nav-badge vanguard-nav-badge--${section.badgeColor || 'default'}`}>{section.badge}</span>}
                  </div>
                </div>}

                <div id={`nav-section-${section.id}`} className="vanguard-nav-section-items" hidden={!isExpanded}>
                    {section.items.map((item) => {
                      const Icon = item.icon || ChevronRight
                      return (
                        <NavLink
                          key={`${item.path}:${item.labelKey || item.label}`}
                          to={item.path}
                          end={item.end}
                          className={({ isActive }) =>
                            `sidebar-link vanguard-sidebar-link ${isActive ? 'active' : ''}`
                          }
                          onClick={() => setMobileOpen(false)}
                        >
                          <span className="vanguard-sidebar-icon-wrap"><Icon className="vanguard-sidebar-icon" size={17} /></span>
                          <span className="vanguard-sidebar-label">{item.labelKey ? t(item.labelKey) : PATH_KEYS[item.path] ? t(`navigation.items.${PATH_KEYS[item.path]}`) : item.label}</span>
                        </NavLink>
                      )
                    })}
                </div>
              </div>
            )
          })}
        </nav>

        {/* Sidebar Footer User Card */}
        {!isCoachAgent && <div className="vanguard-sidebar-footer">
          <Link to="/admin/account" className="vanguard-sidebar-user" onClick={() => setMobileOpen(false)}>
            <div className="vanguard-sidebar-avatar">
              {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="vanguard-sidebar-user-info">
              <span className="vanguard-sidebar-user-name">
                {user?.firstName ? `${user.firstName} ${user.lastName || ''}` : user?.email || t('layout.administrator')}
              </span>
              <span className="vanguard-sidebar-user-role">{user?.role || 'SUPER_ADMIN'}</span>
            </div>
          </Link>
        </div>}
      </aside>

      {/* Main App Content Area */}
      <div className="app-area vanguard-app-area">
        <header className="app-header vanguard-app-header">
          <div className="header-left vanguard-header-left">
            <button
              type="button"
              className="mobile-toggle vanguard-mobile-toggle"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={t(mobileOpen ? 'layout.closeMenu' : 'layout.openMenu')}
              aria-expanded={mobileOpen}
              aria-controls="app-navigation"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <div className="vanguard-header-context">
              <span className="vanguard-header-context-tag">{getContextTitle()}</span>
            </div>
          </div>

          <div className="header-right vanguard-header-right">
            {!isCoachAgent && <>
            <label className="theme-selector">
              <span className="theme-selector-icon" aria-hidden="true">{resolvedTheme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}</span>
              <span className="sr-only">{t('layout.theme')}</span>
              <select value={theme} onChange={(event) => setTheme(event.target.value)} aria-label={t('layout.theme')}>
                <option value="light">{t('layout.themeLight')}</option>
                <option value="dark">{t('layout.themeDark')}</option>
                <option value="system">{t('layout.themeSystem')}</option>
              </select>
            </label>
            {/* Language Switcher */}
            <div className="language-selector" aria-label={t('layout.language')}>
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

            {/* User Profile Pill & Dropdown */}
            <div className="vanguard-header-user-wrap">
              <Link to="/admin/account" className="vanguard-header-user-btn" title={t('layout.manageAccount')}>
                <div className="vanguard-header-avatar">
                  {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="vanguard-header-user-details">
                  <span className="vanguard-header-name">
                {user?.firstName ? `${user.firstName} ${user.lastName || ''}` : user?.email || t('layout.administrator')}
                  </span>
                  <span className="vanguard-header-role-badge">{user?.role || 'SUPER_ADMIN'}</span>
                </div>
              </Link>
            </div>
            </>}

            {/* Logout Action */}
            <button
              type="button"
              className="vanguard-btn vanguard-btn--secondary vanguard-btn--sm vanguard-logout-btn"
              onClick={handleLogout}
              disabled={logoutPending}
              aria-label={t('layout.logout')}
              title={t('layout.logout')}
            >
              <LogOut size={15} />
              <span className="hide-on-mobile">{t('layout.logout')}</span>
            </button>
          </div>
        </header>

        <main className="app-main vanguard-app-main">
          <Outlet />
        </main>
        {isCoachAgent && (
          <nav className="agent-mobile-nav" aria-label={t('navigation.sections.coach')}>
            <NavLink to="/transport/agent" className={({ isActive }) => isActive ? 'active' : ''}><Bus size={19} /><span>{t('layout.home')}</span></NavLink>
            {hasPermission(user, 'CREATE_RESERVATION') && <NavLink to="/transport/reservations" className={({ isActive }) => isActive ? 'active' : ''}><Ticket size={19} /><span>{t('navigation.items.sellTicket')}</span></NavLink>}
            {hasPermission(user, 'VIEW_PARCEL') && <NavLink to="/transport/parcels" className={({ isActive }) => isActive ? 'active' : ''}><Package size={19} /><span>{t('layout.parcels')}</span></NavLink>}
            {hasPermission(user, 'VIEW_PAYMENT') && <NavLink to="/transport/operations" className={({ isActive }) => isActive ? 'active' : ''}><CreditCard size={19} /><span>{t('layout.payments')}</span></NavLink>}
            <NavLink to="/admin/account" className={({ isActive }) => isActive ? 'active' : ''}><Settings size={19} /><span>{t('navigation.items.account')}</span></NavLink>
          </nav>
        )}
      </div>
    </div>
  )
}
