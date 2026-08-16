const resource = (path, label, endpoint, options = {}) => ({ path, label, endpoint, ...options })

export const resourceGroups = {
  admin: [
    resource('/admin/users', 'Utilisateurs', '/api/users', { permission: 'VIEW_USER', createPermission: 'CREATE_USER', updatePermission: 'UPDATE_USER', deletePermission: 'DELETE_USER', status: true, passwordReset: true }),
    resource('/admin/roles', 'Rôles', '/api/roles', { permission: 'VIEW_ROLE', createPermission: 'CREATE_ROLE', updatePermission: 'UPDATE_ROLE', deletePermission: 'DELETE_ROLE' }),
    resource('/admin/permissions', 'Permissions', '/api/permissions', { permission: 'VIEW_PERMISSION', createPermission: 'CREATE_PERMISSION', updatePermission: 'UPDATE_PERMISSION', deletePermission: 'DELETE_PERMISSION' }),
    resource('/admin/departments', 'Départements', '/api/departments', { permission: 'VIEW_DEPARTMENT', createPermission: 'CREATE_DEPARTMENT', updatePermission: 'UPDATE_DEPARTMENT', deletePermission: 'DELETE_DEPARTMENT' }),
    resource('/admin/audit', 'Audit', '/api/audit-logs', { readOnly: true }),
    resource('/admin/notifications', 'Notifications', '/api/notifications', { readOnly: true, markRead: true }),
  ],
  transport: [
    resource('/transport/agencies', 'Agences', '/api/agencies'), resource('/transport/buses', 'Bus', '/api/buses'), resource('/transport/drivers', 'Chauffeurs', '/api/drivers'), resource('/transport/destinations', 'Destinations', '/api/destinations'), resource('/transport/schedules', 'Horaires', '/api/schedules'), resource('/transport/trips', 'Voyages', '/api/trips'), resource('/transport/reservations', 'Réservations', '/api/reservations'), resource('/transport/payments', 'Paiements', '/api/reservation-payments', { permission: 'VIEW_PAYMENT', readOnly: true }), resource('/transport/tickets', 'Billets', '/api/tickets', { permission: 'VIEW_RESERVATION', readOnly: true }), resource('/transport/parcels', 'Colis', '/api/parcels'), resource('/transport/seats', 'Sièges', '/api/seats', { unavailable: 'La liste des sièges requiert un identifiant de bus : GET /api/seats/:busId.' }),
  ],
  construction: [
    resource('/construction/projects', 'Projets', '/api/construction/projects', { labelKey: 'construction.nav.projects', permission: 'VIEW_PROJECT', createPermission: 'CREATE_PROJECT', updatePermission: 'UPDATE_PROJECT', deletePermission: 'DELETE_PROJECT', excludeRoles: ['ENGINEER'] }),
    resource('/construction/customer-requests', 'Demandes clients', '/api/construction/customer-requests', { labelKey: 'construction.nav.customerRequests', permission: 'VIEW_CUSTOMER_REQUEST', createPermission: 'CREATE_CUSTOMER_REQUEST', updatePermission: 'UPDATE_CUSTOMER_REQUEST' }),
    resource('/construction/quote-requests', 'Demandes de devis', '/api/construction/quote-requests', { labelKey: 'construction.nav.quoteRequests', permission: 'VIEW_QUOTE_REQUEST', createPermission: 'CREATE_QUOTE_REQUEST', updatePermission: 'UPDATE_QUOTE_REQUEST' }),
    resource('/construction/engineer', 'Espace Ingénieur', '', { labelKey: 'construction.nav.engineerDashboard' }),
    resource('/construction/engineer/projects', 'Mes chantiers', '', { labelKey: 'construction.nav.engineerProjects', permission: 'VIEW_PROJECT' }),
  ],
  automobile: [
    resource('/automobile/vehicles', 'Véhicules', '/api/vehicles', { labelKey: 'autosales.nav.vehicles', permission: 'VIEW_VEHICLE', createPermission: 'CREATE_VEHICLE', updatePermission: 'UPDATE_VEHICLE', deletePermission: 'DELETE_VEHICLE' }),
    resource('/automobile/inquiries', 'Demandes', '/api/vehicle-inquiries', { labelKey: 'autosales.nav.inquiries', permission: 'VIEW_VEHICLE_INQUIRY', createPermission: 'CREATE_VEHICLE_INQUIRY', updatePermission: 'UPDATE_VEHICLE_INQUIRY' }),
    resource('/automobile/reservations', 'Réservations', '/api/vehicle-reservations', { labelKey: 'autosales.nav.reservations', permission: 'VIEW_RESERVATION', createPermission: 'MANAGE_VEHICLE_RESERVATION', updatePermission: 'MANAGE_VEHICLE_RESERVATION', deletePermission: 'CANCEL_VEHICLE_RESERVATION' }),
    resource('/automobile/payments', 'Paiements', '/api/vehicle-payments', { labelKey: 'autosales.nav.payments', permission: 'VIEW_RESERVATION', createPermission: 'MANAGE_VEHICLE_RESERVATION', updatePermission: 'MANAGE_VEHICLE_RESERVATION' }),
    resource('/automobile/sales', 'Ventes', '/api/vehicle-reservations', { labelKey: 'autosales.nav.sales', permission: 'VIEW_RESERVATION' }),
    resource('/automobile/agents', 'Agents', '/api/users', { labelKey: 'autosales.nav.agents', permission: 'VIEW_USER', createPermission: 'CREATE_USER', updatePermission: 'UPDATE_USER', deletePermission: 'DELETE_USER' }),
    resource('/automobile/agent', 'Espace agent', '', { labelKey: 'autosales.nav.agentWorkspace', unavailable: 'Accès réservé à l’agent AutoSales.' }),
    resource('/automobile/agent/inquiries', 'Mes demandes', '', { labelKey: 'autosales.nav.agentInquiries', permission: 'VIEW_VEHICLE_INQUIRY' }),
    resource('/automobile/agent/reservations', 'Mes réservations', '', { labelKey: 'autosales.nav.agentReservations', permission: 'VIEW_RESERVATION' }),
    resource('/automobile/agent/payments', 'Mes paiements', '', { labelKey: 'autosales.nav.agentPayments', permission: 'VIEW_RESERVATION' }),
    resource('/automobile/agent/sales', 'Mes ventes', '', { labelKey: 'autosales.nav.agentSales', permission: 'VIEW_RESERVATION' }),
    resource('/automobile/reports', 'Rapports', '', { labelKey: 'autosales.nav.reports', unavailable: 'Reporting will be available in a later delivery.' }),
    resource('/automobile/settings', 'Paramètres', '', { labelKey: 'autosales.nav.settings', unavailable: 'AutoSales settings will be available in a later delivery.' }),
  ],
}
resourceGroups.public = [resource('/public/vehicles', 'Catalogue véhicules', '/api/vehicles', { public: true, readOnly: true })]
export const resourceByPath = Object.values(resourceGroups).flat().reduce((all, item) => ({ ...all, [item.path]: item }), {})
