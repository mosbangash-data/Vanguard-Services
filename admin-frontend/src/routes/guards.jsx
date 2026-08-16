import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/authContext'
import { hasDepartment, hasRole } from '../features/auth/permissions'
import { getDestination } from '../features/auth/session'

export function ProtectedRoute() { const { user, isRestoring } = useAuth(); const location = useLocation(); if (isRestoring) return <div className="page-state">Restauration de la session…</div>; return user ? <Outlet /> : <Navigate to="/admin/login" replace state={{ from: location }} /> }
export function RoleRoute({ roles }) { const { user } = useAuth(); return hasRole(user, ...roles) ? <Outlet /> : <Navigate to={getDestination(user)} replace /> }
export function DepartmentRoute({ department }) { const { user } = useAuth(); return hasDepartment(user, department) || hasRole(user, 'SUPER_ADMIN') ? <Outlet /> : <Navigate to="/403" replace /> }
