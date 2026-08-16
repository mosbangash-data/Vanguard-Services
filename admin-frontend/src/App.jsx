import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthProvider'
import { LoginPage } from './features/auth/LoginPage'
import { ForbiddenPage, NotFoundPage, PublicTicketPage } from './components/Pages'
import { DepartmentRoute, ProtectedRoute, RoleRoute } from './routes/guards'
import { AppLayout } from './layouts/AppLayout'
import { AdminLayout } from './layouts/AdminLayout'

// Admin Features
import { AdminDashboardPage } from './features/admin/dashboard/AdminDashboardPage'
import { UsersPage } from './features/admin/users/UsersPage'
import { RolesPage } from './features/admin/roles/RolesPage'
import { PermissionsPage } from './features/admin/permissions/PermissionsPage'
import { DepartmentsPage } from './features/admin/departments/DepartmentsPage'
import { AuditLogsPage } from './features/admin/audit/AuditLogsPage'
import { NotificationsPage } from './features/admin/notifications/NotificationsPage'

// Other Features & Resources
import { DashboardPage } from './features/admin/DashboardPage'
import { ProjectDetailPage } from './features/construction/ProjectDetailPage'
import { ConstructionDashboardPage } from './features/construction/ConstructionDashboardPage'
import { ProjectListPage } from './features/construction/ProjectListPage'
import { ProjectFormPage } from './features/construction/ProjectFormPage'
import { CustomerRequestsPage, CustomerRequestDetailPage } from './features/construction/CustomerRequestsPage'
import { QuoteRequestsPage, QuoteRequestDetailPage } from './features/construction/QuoteRequestsPage'
import { ConstructionEngineerDashboardPage } from './features/construction/ConstructionEngineerDashboardPage'
import { ConstructionEngineerProjectsPage } from './features/construction/ConstructionEngineerProjectsPage'
import { ConstructionEngineerProjectDetailPage } from './features/construction/ConstructionEngineerProjectDetailPage'
import { ResourcePage } from './features/resources/ResourcePage'
import { CoachOperationsPage } from './features/admin/coach/CoachOperationsPage'
import { AutoSalesDashboardPage } from './features/admin/autosales/AutoSalesDashboardPage'
import { AutoSalesAgentManagementPage, AutoSalesAgentWorkspacePage, AutoSalesAgentInquiryPage, AutoSalesAgentInquiryDetailPage } from './features/admin/autosales/AutoSalesAgentWorkspacePage'
import { AutoSalesAgentReservationsPage } from './features/admin/autosales/AutoSalesAgentReservationsPage'
import { AutoSalesAgentPaymentsPage } from './features/admin/autosales/AutoSalesAgentPaymentsPage'
import { AutoSalesAgentSalesPage } from './features/admin/autosales/AutoSalesAgentSalesPage'
import { AutoSalesInquiryPage, AutoSalesReservationPage, AutoSalesPaymentPage, AutoSalesSalesPage } from './features/admin/autosales/AutoSalesCommercialPages'
import { VehicleManagementPage, VehicleDetailPage } from './features/admin/autosales/VehicleManagementPage'
import { resourceByPath, resourceGroups } from './features/resources/resourceConfig'

function ResourceRoute({ path }) {
  const resource = resourceByPath[path]
  return <ResourcePage resource={resource} />
}

function renderDepartmentRoutes({ base, department, title, resources, DashboardComponent = DashboardPage }) {
  return (
    <Route key={base} element={<DepartmentRoute department={department} />}>
      <Route element={<AppLayout title={title} navigation={resources} />}>
        <Route path={base} element={<DashboardComponent />} />
        {department === 'AUTO_SALES' && <Route path="/automobile/vehicles" element={<VehicleManagementPage />} />}
        {department === 'AUTO_SALES' && <Route path="/automobile/vehicles/:id" element={<VehicleDetailPage />} />}
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
        {department === 'CONSTRUCTION' && <Route path="/construction/engineer" element={<ConstructionEngineerDashboardPage />} />}
        {department === 'CONSTRUCTION' && <Route path="/construction/engineer/projects" element={<ConstructionEngineerProjectsPage />} />}
        {department === 'CONSTRUCTION' && <Route path="/construction/engineer/projects/:id" element={<ConstructionEngineerProjectDetailPage />} />}
        {department === 'CONSTRUCTION' && <Route path="/construction/projects" element={<ProjectListPage />} />}
        {department === 'CONSTRUCTION' && <Route path="/construction/projects/new" element={<ProjectFormPage />} />}
        {department === 'CONSTRUCTION' && <Route path="/construction/projects/:id/edit" element={<ProjectFormPage />} />}
        {department === 'CONSTRUCTION' && <Route path="/construction/projects/:id" element={<ProjectDetailPage />} />}
        {department === 'CONSTRUCTION' && <Route path="/construction/projects/:id/updates" element={<ProjectDetailPage />} />}
        {department === 'CONSTRUCTION' && <Route path="/construction/projects/:id/gallery" element={<ProjectDetailPage />} />}
        {department === 'CONSTRUCTION' && <Route path="/construction/customer-requests" element={<CustomerRequestsPage />} />}
        {department === 'CONSTRUCTION' && <Route path="/construction/customer-requests/:id" element={<CustomerRequestDetailPage />} />}
        {department === 'CONSTRUCTION' && <Route path="/construction/quote-requests" element={<QuoteRequestsPage />} />}
        {department === 'CONSTRUCTION' && <Route path="/construction/quote-requests/:id" element={<QuoteRequestDetailPage />} />}
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
        <Routes>
          <Route path="/admin/login" element={<LoginPage />} />
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

            {/* Department Specific Spaces */}
            {renderDepartmentRoutes({ base: '/transport', department: 'VANGUARD_COACH', title: 'Vanguard Coach', resources: resourceGroups.transport, DashboardComponent: CoachOperationsPage })}
            {renderDepartmentRoutes({ base: '/construction', department: 'CONSTRUCTION', title: 'Construction', resources: resourceGroups.construction, DashboardComponent: ConstructionDashboardPage })}
            {renderDepartmentRoutes({ base: '/automobile', department: 'AUTO_SALES', title: 'AutoSales', resources: resourceGroups.automobile, DashboardComponent: AutoSalesDashboardPage })}
          </Route>

          <Route path="/403" element={<ForbiddenPage />} />
          <Route path="/" element={<Navigate to="/admin/login" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
