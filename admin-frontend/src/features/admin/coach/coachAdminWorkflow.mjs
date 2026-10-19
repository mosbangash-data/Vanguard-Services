export function buildCoachServiceAdminNav({ t, can, icons }) {
  return [
    { id: 'coach-dashboard', title: t('coachAdminNav.dashboard'), standalone: { path: '/transport', icon: icons.dashboard, end: true }, items: [] },
    { id: 'coach-travel', title: t('coachAdminNav.travel'), collapsible: true, items: [
      { path: '/transport/trips', label: t('navigation.items.trips'), icon: icons.bus, permission: 'VIEW_TRIP' },
      { path: '/transport/destinations', label: t('navigation.items.destinations'), icon: icons.compass },
      { path: '/transport/buses', label: t('navigation.items.buses'), icon: icons.bus },
      { path: '/transport/drivers', label: t('navigation.items.drivers'), icon: icons.user },
      { path: '/transport/agencies', label: t('navigation.items.agencies'), icon: icons.building },
      { path: '/transport/schedules', label: t('navigation.items.schedules'), icon: icons.calendar },
    ].filter((item) => !item.permission || can(item.permission)) },
    { id: 'coach-finance', title: t('coachAdminNav.finance'), collapsible: true, items: [
      ...(can('VIEW_PAYMENT') ? [{ path: '/transport/financial-reports', label: t('coachFinance.nav'), icon: icons.fileText }] : []),
      ...(can('VIEW_PAYMENT') ? [{ path: '/transport/payments', label: t('navigation.items.payments'), icon: icons.creditCard }] : []),
      ...(can('VIEW_PAYMENT') ? [{ path: '/transport/operations', label: t('operations.title'), icon: icons.wallet }] : []),
      ...(can('APPROVE_DAILY_CASH_CLOSURE') ? [{ path: '/transport/cash-closure', label: t('managerWorkspace.cashClosureTitle'), icon: icons.wallet }] : []),
    ] },
    { id: 'coach-tickets', title: t('coachAdminNav.tickets'), collapsible: true, items: [
      ...(can('VIEW_RESERVATION') ? [{ path: '/transport/reservations', label: t('navigation.items.reservations'), icon: icons.ticket }] : []),
      ...(can('VIEW_RESERVATION') ? [{ path: '/transport/tickets', label: t('navigation.items.tickets'), icon: icons.ticket }] : []),
      ...(can('SCAN_TICKET') ? [{ path: '/transport/scanner', label: t('navigation.items.scanner'), icon: icons.qrCode }] : []),
    ] },
    { id: 'coach-parcels', title: t('coachAdminNav.parcels'), standalone: { path: '/transport/parcels', icon: icons.package }, items: [] },
    { id: 'coach-account', title: t('coachAdminNav.account'), standalone: { path: '/admin/account', icon: icons.settings }, items: [] },
  ]
}

export function calculateTripArrivalAt(date, departureTime, durationHours) {
  if (!date || !departureTime) return ''
  const [hours, minutes] = String(departureTime).split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return ''
  const departure = new Date(`${date}T00:00:00`)
  departure.setHours(hours, minutes, 0, 0)
  departure.setTime(departure.getTime() + (Number(durationHours) || 2) * 60 * 60 * 1000)
  return new Date(departure.getTime() - departure.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
