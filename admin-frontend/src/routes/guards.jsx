import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/authContext'
import { hasDepartment, hasPermission, hasRole } from '../features/auth/permissions'
import { getDestination } from '../features/auth/session'
import { useLanguage } from '../i18n/useLanguage'

export function ProtectedRoute() { const { user, isRestoring } = useAuth(); const location = useLocation(); const { t } = useLanguage(); if (isRestoring) return <div className="page-state" role="status">{t('dashboard.loading')}</div>; return user ? <Outlet /> : <Navigate to="/admin/login" replace state={{ from: location }} /> }
export function RoleRoute({ roles }) { const { user } = useAuth(); return hasRole(user, ...roles) ? <Outlet /> : <Navigate to={getDestination(user)} replace /> }
export function PermissionRoute({ permission }) { const { user } = useAuth(); return hasPermission(user, permission) ? <Outlet /> : <Navigate to="/403" replace /> }
export function DepartmentRoute({ department }) { const { user } = useAuth(); return hasDepartment(user, department) || hasRole(user, 'SUPER_ADMIN') ? <Outlet /> : <Navigate to="/403" replace /> }
