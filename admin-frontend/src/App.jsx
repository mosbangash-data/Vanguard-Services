import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthProvider'
const LoginPage = lazy(() => import('./features/auth/LoginPage').then((m) => ({ default: m.LoginPage })))
const PasswordRecoveryPage = lazy(() => import('./features/auth/PasswordRecoveryPage').then((m) => ({ default: m.PasswordRecoveryPage })))
const ForbiddenPage = lazy(() => import('./components/Pages').then((m) => ({ default: m.ForbiddenPage })))
const NotFoundPage = lazy(() => import('./components/Pages').then((m) => ({ default: m.NotFoundPage })))
const PublicTicketPage = lazy(() => import('./components/Pages').then((m) => ({ default: m.PublicTicketPage })))
import { DepartmentRoute, ProtectedRoute, RoleRoute } from './routes/guards'
import { AppLayout } from './layouts/AppLayout'
import { AdminLayout } from './layouts/AdminLayout'

// Admin Features are loaded on demand so agent mobile sessions download only the page they open.
const AdminDashboardPage = lazy(() => import('./features/admin/dashboard/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })))
const UsersPage = lazy(() => import('./features/admin/users/UsersPage').then((m) => ({ default: m.UsersPage })))
const RolesPage = lazy(() => import('./features/admin/roles/RolesPage').then((m) => ({ default: m.RolesPage })))
const PermissionsPage = lazy(() => import('./features/admin/permissions/PermissionsPage').then((m) => ({ default: m.PermissionsPage })))
const DepartmentsPage = lazy(() => import('./features/admin/departments/DepartmentsPage').then((m) => ({ default: m.DepartmentsPage })))
const AuditLogsPage = lazy(() => import('./features/admin/audit/AuditLogsPage').then((m) => ({ default: m.AuditLogsPage })))
const NotificationsPage = lazy(() => import('./features/admin/notifications/NotificationsPage').then((m) => ({ default: m.NotificationsPage })))
const AccountPage = lazy(() => import('./features/admin/account/AccountPage').then((m) => ({ default: m.AccountPage })))

// Other Features & Resources
const DashboardPage = lazy(() => import('./features/admin/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const ProjectDetailPage = lazy(() => import('./features/construction/ProjectDetailPage').then((m) => ({ default: m.ProjectDetailPage })))
const ConstructionDashboardPage = lazy(() => import('./features/construction/ConstructionDashboardPage').then((m) => ({ default: m.ConstructionDashboardPage })))
const ProjectListPage = lazy(() => import('./features/construction/ProjectListPage').then((m) => ({ default: m.ProjectListPage })))
const ProjectFormPage = lazy(() => import('./features/construction/ProjectFormPage').then((m) => ({ default: m.ProjectFormPage })))
const ConstructionTemplatesPage = lazy(() => import('./features/construction/ConstructionTemplatesPage').then((m) => ({ default: m.ConstructionTemplatesPage })))
const CustomerRequestsPage = lazy(() => import('./features/construction/CustomerRequestsPage').then((m) => ({ default: m.CustomerRequestsPage })))
const CustomerRequestDetailPage = lazy(() => import('./features/construction/CustomerRequestsPage').then((m) => ({ default: m.CustomerRequestDetailPage })))
const QuoteRequestsPage = lazy(() => import('./features/construction/QuoteRequestsPage').then((m) => ({ default: m.QuoteRequestsPage })))
const QuoteRequestDetailPage = lazy(() => import('./features/construction/QuoteRequestsPage').then((m) => ({ default: m.QuoteRequestDetailPage })))
const ResourcePage = lazy(() => import('./features/resources/ResourcePage').then((m) => ({ default: m.ResourcePage })))
const CoachOperationsPage = lazy(() => import('./features/admin/coach/CoachOperationsPage').then((m) => ({ default: m.CoachOperationsPage })))
const AgentDashboard = lazy(() => import('./features/admin/coach/AgentDashboard').then((m) => ({ default: m.AgentDashboard })))
const AgenciesManagementPage = lazy(() => import('./features/admin/coach/AgenciesManagementPage').then((m) => ({ default: m.AgenciesManagementPage })))
const AgencyDetailPage = lazy(() => import('./features/admin/coach/AgencyDetailPage').then((m) => ({ default: m.AgencyDetailPage })))
const TicketScanner = lazy(() => import('./features/admin/coach/TicketScanner').then((m) => ({ default: m.TicketScanner })))
const AutoSalesDashboardPage = lazy(() => import('./features/admin/autosales/AutoSalesDashboardPage').then((m) => ({ default: m.AutoSalesDashboardPage })))
const AutoSalesAgentManagementPage = lazy(() => import('./features/admin/autosales/AutoSalesAgentWorkspacePage').then((m) => ({ default: m.AutoSalesAgentManagementPage })))
const AutoSalesAgentWorkspacePage = lazy(() => import('./features/admin/autosales/AutoSalesAgentWorkspacePage').then((m) => ({ default: m.AutoSalesAgentWorkspacePage })))
const AutoSalesAgentInquiryPage = lazy(() => import('./features/admin/autosales/AutoSalesAgentWorkspacePage').then((m) => ({ default: m.AutoSalesAgentInquiryPage })))
const AutoSalesAgentInquiryDetailPage = lazy(() => import('./features/admin/autosales/AutoSalesAgentWorkspacePage').then((m) => ({ default: m.AutoSalesAgentInquiryDetailPage })))
const AutoSalesAgentReservationsPage = lazy(() => import('./features/admin/autosales/AutoSalesAgentReservationsPage').then((m) => ({ default: m.AutoSalesAgentReservationsPage })))
const AutoSalesAgentPaymentsPage = lazy(() => import('./features/admin/autosales/AutoSalesAgentPaymentsPage').then((m) => ({ default: m.AutoSalesAgentPaymentsPage })))
const AutoSalesAgentSalesPage = lazy(() => import('./features/admin/autosales/AutoSalesAgentSalesPage').then((m) => ({ default: m.AutoSalesAgentSalesPage })))
const AutoSalesInquiryPage = lazy(() => import('./features/admin/autosales/AutoSalesCommercialPages').then((m) => ({ default: m.AutoSalesInquiryPage })))
const AutoSalesReservationPage = lazy(() => import('./features/admin/autosales/AutoSalesCommercialPages').then((m) => ({ default: m.AutoSalesReservationPage })))
const AutoSalesPaymentPage = lazy(() => import('./features/admin/autosales/AutoSalesCommercialPages').then((m) => ({ default: m.AutoSalesPaymentPage })))
const AutoSalesSalesPage = lazy(() => import('./features/admin/autosales/AutoSalesCommercialPages').then((m) => ({ default: m.AutoSalesSalesPage })))
const VehicleManagementPage = lazy(() => import('./features/admin/autosales/VehicleManagementPage').then((m) => ({ default: m.VehicleManagementPage })))
const VehicleDetailPage = lazy(() => import('./features/admin/autosales/VehicleManagementPage').then((m) => ({ default: m.VehicleDetailPage })))
const VehicleTemplatesPage = lazy(() => import('./features/admin/autosales/VehicleTemplatesPage').then((m) => ({ default: m.VehicleTemplatesPage })))
import { resourceByPath, resourceGroups } from './features/resources/resourceConfig'
import { useAuth } from './features/auth/authContext'
import { getDestination } from './features/auth/session'
import { useLanguage } from './i18n/useLanguage'

function RouteLoadingFallback() {
  const { t } = useLanguage()
  return <div role="status" className="vanguard-loading-text">{t('dashboard.loading')}</div>
}

function ResourceRoute({ path }) {
  const resource = resourceByPath[path]
  return <ResourcePage resource={resource} />
}
const ManagerDashboard = lazy(() => import('./features/admin/coach/ManagerDashboard').then((m) => ({ default: m.ManagerDashboard })))

function TransportDashboardRouter() {
  const { user } = useAuth()

  if (!user) return null

  if (user.department?.type !== 'VANGUARD_COACH' && user.role !== 'SUPER_ADMIN') {
    return <Navigate to="/403" replace />
  }

  switch (user.role) {
    case 'AGENT':
      return <AgentDashboard />
    case 'SERVICE_ADMIN':
    case 'MANAGER':
      return <ManagerDashboard />
    case 'SUPER_ADMIN':
      return <CoachOperationsPage />
    default:
      return <Navigate to="/403" replace />
  }
}

function CoachAgentRoute() {
  const { user } = useAuth()

  if (!user) return null

  if (user.role !== 'AGENT' || user.department?.type !== 'VANGUARD_COACH') {
    return <Navigate to={user ? getDestination(user) : '/admin/login'} replace />
  }

  return <AgentDashboard />
}

function renderDepartmentRoutes({ base, department, title, resources, DashboardComponent = DashboardPage }) {
  return (
    <Route key={base} element={<DepartmentRoute department={department} />}>
      <Route element={<AppLayout title={title} navigation={resources} />}>
        <Route path={base} element={<DashboardComponent />} />
        
        {/* Transport / Coach dedicated routes */}
        {department === 'VANGUARD_COACH' && <Route path="/transport/agent" element={<CoachAgentRoute />} />}
        {department === 'VANGUARD_COACH' && <Route path="/transport/agencies" element={<AgenciesManagementPage />} />}
        {department === 'VANGUARD_COACH' && <Route path="/transport/agencies/:id" element={<AgencyDetailPage />} />}
        {department === 'VANGUARD_COACH' && <Route path="/transport/scanner" element={<TicketScanner />} />}
        {department === 'VANGUARD_COACH' && <Route path="/transport/operations" element={<CoachOperationsPage />} />}

        {/* Automobile dedicated routes */}
        {department === 'AUTO_SALES' && <Route path="/automobile/vehicles" element={<VehicleManagementPage />} />}
        {department === 'AUTO_SALES' && <Route path="/automobile/vehicles/:id" element={<VehicleDetailPage />} />}
        {department === 'AUTO_SALES' && <Route path="/automobile/templates" element={<VehicleTemplatesPage />} />}
        {department === 'AUTO_SALES' && <Route path="/automobile/inquiries" element={<AutoSalesInquiryPage />} />}
        {department === 'AUTO_SALES' && <Route path="/automobile/reservations" element={<AutoSalesReservationPage />} />}
        {department === 'AUTO_SALES' && <Route path="/automobile/payments" element={<AutoSalesPaymentPage />} />}
        {department === 'AUTO_SALES' && <Route path="/automobile/sales" element={<AutoSalesSalesPage />} />}
        {department === 'AUTO_SALES' && <Route path="/automobile/agents" element={<AutoSalesAgentManagementPage />} />}
        {department === 'AUTO_SALES' && <Route path="/automobile/agent" element={<AutoSalesAgentWorkspacePage />} />}
        {department === 'AUTO_SALES' && <Route path="/automobile/agent/inquiries" element={<AutoSalesAgentInquiryPage />} />}
        {department === 'AUTO_SALES' && <Route path="/automobile/agent/inquiries/:id" element={<AutoSalesAgentInquiryDetailPage />} />}
        {department === 'AUTO_SALES' && <Route path="/automobile/agent/reservations" element={<AutoSalesAgentReservationsPage />} />}
        {department === 'AUTO_SALES' && <Route path="/automobile/agent/payments" element={<AutoSalesAgentPaymentsPage />} />}
        {department === 'AUTO_SALES' && <Route path="/automobile/agent/sales" element={<AutoSalesAgentSalesPage />} />}

        {/* Construction dedicated routes */}
        {department === 'CONSTRUCTION' && <Route path="/construction/projects" element={<ProjectListPage />} />}
        {department === 'CONSTRUCTION' && <Route path="/construction/projects/new" element={<ProjectFormPage />} />}
        {department === 'CONSTRUCTION' && <Route path="/construction/projects/:id/edit" element={<ProjectFormPage />} />}
        {department === 'CONSTRUCTION' && <Route path="/construction/projects/:id" element={<ProjectDetailPage />} />}
        {department === 'CONSTRUCTION' && <Route path="/construction/projects/:id/updates" element={<ProjectDetailPage />} />}
        {department === 'CONSTRUCTION' && <Route path="/construction/projects/:id/gallery" element={<ProjectDetailPage />} />}
        {department === 'CONSTRUCTION' && <Route path="/construction/templates" element={<ConstructionTemplatesPage />} />}
        {department === 'CONSTRUCTION' && <Route path="/construction/customer-requests" element={<CustomerRequestsPage />} />}
        {department === 'CONSTRUCTION' && <Route path="/construction/customer-requests/:id" element={<CustomerRequestDetailPage />} />}
        {department === 'CONSTRUCTION' && <Route path="/construction/quote-requests" element={<QuoteRequestsPage />} />}
        {department === 'CONSTRUCTION' && <Route path="/construction/quote-requests/:id" element={<QuoteRequestDetailPage />} />}

        {/* Dynamic resource fallback routes */}
        {resources.map((item) => (
          <Route key={item.path} path={item.path} element={<ResourceRoute path={item.path} />} />
        ))}
      </Route>
    </Route>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/admin/forgot-password" element={<PasswordRecoveryPage />} />
          <Route path="/admin/reset-password" element={<PasswordRecoveryPage />} />
          <Route path="/login" element={<Navigate to="/admin/login" replace />} />
          <Route path="/tickets/:ticketCode" element={<PublicTicketPage />} />
          <Route path="/public/vehicles" element={<ResourceRoute path="/public/vehicles" />} />
          
          <Route element={<ProtectedRoute />}>
            {/* Dedicated Super Admin Routes */}
            <Route element={<RoleRoute roles={['SUPER_ADMIN']} />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminDashboardPage />} />
                <Route path="/admin/users" element={<UsersPage />} />
                <Route path="/admin/roles" element={<RolesPage />} />
                <Route path="/admin/permissions" element={<PermissionsPage />} />
                <Route path="/admin/departments" element={<DepartmentsPage />} />
                <Route path="/admin/audit" element={<AuditLogsPage />} />
                <Route path="/admin/notifications" element={<NotificationsPage />} />
              </Route>
            </Route>

            {/* Common Account & Settings Route */}
            <Route element={<AdminLayout />}>
              <Route path="/admin/account" element={<AccountPage />} />
            </Route>

            {/* Department Specific Spaces */}
            {renderDepartmentRoutes({ base: '/transport', department: 'VANGUARD_COACH', title: 'Vanguard Coach', resources: resourceGroups.transport, DashboardComponent: TransportDashboardRouter })}
            {renderDepartmentRoutes({ base: '/construction', department: 'CONSTRUCTION', title: 'Construction', resources: resourceGroups.construction, DashboardComponent: ConstructionDashboardPage })}
            {renderDepartmentRoutes({ base: '/automobile', department: 'AUTO_SALES', title: 'AutoSales', resources: resourceGroups.automobile, DashboardComponent: AutoSalesDashboardPage })}
          </Route>

          <Route path="/403" element={<ForbiddenPage />} />
          <Route path="/" element={<Navigate to="/admin/login" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
