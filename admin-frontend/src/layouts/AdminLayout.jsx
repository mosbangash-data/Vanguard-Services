import { useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
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
} from 'lucide-react'
import { useAuth } from '../features/auth/authContext'

const adminNavItems = [
  { path: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { path: '/admin/users', label: 'Utilisateurs', icon: Users },
  { path: '/admin/roles', label: 'Rôles', icon: ShieldCheck },
  { path: '/admin/permissions', label: 'Permissions', icon: Key },
  { path: '/admin/departments', label: 'Départements', icon: Building2 },
  { path: '/admin/audit', label: 'Audit', icon: FileText },
  { path: '/admin/notifications', label: 'Notifications', icon: Bell },
]

const pageTitles = {
  '/admin': 'Tableau de bord',
  '/admin/users': 'Gestion des Utilisateurs',
  '/admin/roles': 'Gestion des Rôles',
  '/admin/permissions': 'Gestion des Permissions',
  '/admin/departments': 'Gestion des Départements',
  '/admin/audit': 'Logs d’Audit',
  '/admin/notifications': 'Centre de Notifications',
}

export function AdminLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    signOut()
    navigate('/admin/login', { replace: true })
  }

  const title = pageTitles[location.pathname] || 'Administration'

  return (
    <div className="app-shell">
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="drawer-overlay"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <img
            src="/assets/logos/vanguard-services.png"
            alt="Vanguard Services Logo"
            className="sidebar-logo"
          />
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-title">VANGUARD SERVICES</span>
            <span className="sidebar-brand-sub">Administration</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {adminNavItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'active' : ''}`
                }
                onClick={() => setMobileOpen(false)}
              >
                <Icon />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </aside>

      {/* App Area */}
      <div className="app-area">
        <header className="app-header">
          <div className="header-left">
            <button
              type="button"
              className="mobile-toggle"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <h1 className="header-title">{title}</h1>
          </div>

          <div className="header-right">
            <div className="user-badge">
              <span className="user-name">
                {user?.firstName ? `${user.firstName} ${user.lastName || ''}` : user?.email || 'Administrateur'}
              </span>
              <span className="user-role-badge">{user?.role || 'SUPER_ADMIN'}</span>
            </div>

            <button
              type="button"
              className="button secondary sm"
              onClick={handleLogout}
              title="Déconnexion"
            >
              <LogOut size={16} />
              <span>Déconnexion</span>
            </button>
          </div>
        </header>

        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
