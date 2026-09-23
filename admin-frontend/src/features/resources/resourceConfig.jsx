import React from 'react'
import { getMediaUrl, getPrimaryMedia } from '../../utils/media'
import { MediaThumbnail } from '../../components/media'

const resource = (path, label, endpoint, options = {}) => ({
  path,
  label,
  endpoint,
  departmentType: path.startsWith('/transport')
    ? 'VANGUARD_COACH'
    : path.startsWith('/automobile')
    ? 'AUTO_SALES'
    : path.startsWith('/construction')
    ? 'CONSTRUCTION'
    : null,
  ...options,
})

export const resourceGroups = {
  admin: [
    resource('/admin/users', 'Utilisateurs', '/api/users', {
      singularLabel: 'Utilisateur',
      permission: 'VIEW_USER',
      createPermission: 'CREATE_USER',
      updatePermission: 'UPDATE_USER',
      deletePermission: 'DELETE_USER',
      status: true,
      passwordReset: true,
      columns: [
        { key: 'name', label: 'Nom complet', render: (u) => `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email },
        { key: 'email', label: 'Email' },
        { key: 'role', label: 'Rôle', badge: true },
        { key: 'department', label: 'Département', render: (u) => u.department?.name || '—' },
        { key: 'status', label: 'Statut', badge: true },
        { key: 'createdAt', label: 'Créé le', type: 'date' },
      ],
    }),
    resource('/admin/roles', 'Rôles', '/api/roles', {
      singularLabel: 'Rôle',
      permission: 'VIEW_ROLE',
      createPermission: 'CREATE_ROLE',
      updatePermission: 'UPDATE_ROLE',
      deletePermission: 'DELETE_ROLE',
      columns: [
        { key: 'name', label: 'Nom du rôle' },
        { key: 'code', label: 'Code' },
        { key: 'description', label: 'Description' },
        { key: 'createdAt', label: 'Créé le', type: 'date' },
      ],
    }),
    resource('/admin/permissions', 'Permissions', '/api/permissions', {
      singularLabel: 'Permission',
      permission: 'VIEW_PERMISSION',
      createPermission: 'CREATE_PERMISSION',
      updatePermission: 'UPDATE_PERMISSION',
      deletePermission: 'DELETE_PERMISSION',
      columns: [
        { key: 'name', label: 'Permission' },
        { key: 'code', label: 'Code' },
        { key: 'description', label: 'Description' },
      ],
    }),
    resource('/admin/departments', 'Départements', '/api/departments', {
      singularLabel: 'Département',
      permission: 'VIEW_DEPARTMENT',
      createPermission: 'CREATE_DEPARTMENT',
      updatePermission: 'UPDATE_DEPARTMENT',
      deletePermission: 'DELETE_DEPARTMENT',
      columns: [
        { key: 'name', label: 'Nom' },
        { key: 'type', label: 'Type', badge: true },
        { key: 'description', label: 'Description' },
        { key: 'isActive', label: 'Statut', badge: true, badgeMap: { true: { variant: 'active', label: 'Actif' }, false: { variant: 'inactive', label: 'Inactif' } } },
      ],
    }),
    resource('/admin/audit', 'Audit', '/api/audit-logs', {
      singularLabel: 'Journal d’audit',
      readOnly: true,
      columns: [
        { key: 'action', label: 'Action', badge: true },
        { key: 'user', label: 'Utilisateur', render: (l) => l.user?.email || 'Système' },
        { key: 'ipAddress', label: 'IP' },
        { key: 'createdAt', label: 'Horodatage', type: 'datetime' },
      ],
    }),
    resource('/admin/notifications', 'Notifications', '/api/notifications', {
      singularLabel: 'Notification',
      readOnly: true,
      markRead: true,
      columns: [
        { key: 'title', label: 'Titre' },
        { key: 'message', label: 'Message' },
        { key: 'type', label: 'Type', badge: true },
        { key: 'isRead', label: 'État', render: (n) => n.isRead ? 'Lue' : 'Non lue' },
        { key: 'createdAt', label: 'Date', type: 'datetime' },
      ],
    }),
  ],

  transport: [
    resource('/transport/agencies', 'Agences', '/api/agencies', {
      singularLabel: 'Agence',
      roles: ['SUPER_ADMIN', 'SERVICE_ADMIN'],
      columns: [
        { key: 'name', label: 'Nom' },
        { key: 'code', label: 'Code' },
        { key: 'city', label: 'Ville' },
        { key: 'phone', label: 'Téléphone' },
        { key: 'managerName', label: 'Responsable' },
        { key: 'isActive', label: 'Statut', badge: true, badgeMap: { true: { variant: 'active', label: 'Active' }, false: { variant: 'inactive', label: 'Inactive' } } },
      ],
      fields: [
        { name: 'name', label: 'Nom de l’agence', type: 'text', required: true, placeholder: 'Ex: Agence Gombe' },
        { name: 'code', label: 'Code agence', type: 'text', required: true, uppercase: true, placeholder: 'Ex: AGC-GOMBE', helper: 'Identifiant unique' },
        { name: 'city', label: 'Ville', type: 'text', placeholder: 'Ex: Kinshasa' },
        { name: 'address', label: 'Adresse physique', type: 'text', placeholder: 'Ex: 12 Boulevard du 30 Juin' },
        { name: 'phone', label: 'Téléphone', type: 'tel', placeholder: 'Ex: +243 810 000 000' },
        { name: 'email', label: 'Email professionnel', type: 'email', placeholder: 'Ex: gombe@vanguard.cd' },
        { name: 'managerName', label: 'Responsable d’agence', type: 'text', placeholder: 'Ex: Michel Tshimanga' },
        { name: 'openingHours', label: 'Horaires d’ouverture', type: 'text', placeholder: 'Ex: Lun-Sam : 07h00 - 18h00' },
        { name: 'isActive', label: 'Statut de l’agence', type: 'select', defaultValue: true, options: [{ value: true, label: 'Active (Ouverte)' }, { value: false, label: 'Inactive (Fermée)' }] },
      ],
    }),

    resource('/transport/buses', 'Bus', '/api/buses', {
      singularLabel: 'Bus',
      roles: ['SUPER_ADMIN', 'SERVICE_ADMIN'],
      mediaConfig: {
        entityType: 'bus',
        mediaEndpoint: '/api/bus-media',
        relationKey: 'busId',
        uploadEntityType: 'bus',
        primaryOnFirstUpload: true,
      },
      columns: [
        { key: 'photo', label: 'Photo', render: (b) => (
          <MediaThumbnail media={b.media} alt={`${b.brand || ''} ${b.model || ''}`} size={40} />
        )},
        { key: 'plateNumber', label: 'Immatriculation' },
        { key: 'brand', label: 'Marque' },
        { key: 'model', label: 'Modèle' },
        { key: 'seats', label: 'Capacité', render: (b) => `${b.seats || 0} places` },
        { key: 'status', label: 'Statut', badge: true, badgeMap: { ACTIVE: { variant: 'active', label: 'En service' }, MAINTENANCE: { variant: 'warning', label: 'En maintenance' }, OUT_OF_SERVICE: { variant: 'inactive', label: 'Hors service' } } },
        { key: 'createdAt', label: 'Enregistré le', type: 'date' },
      ],
      fields: [
        { name: 'plateNumber', label: 'Numéro d’immatriculation', type: 'text', required: true, uppercase: true, placeholder: 'Ex: 1234-AB-01', helper: 'Plaque d’immatriculation officielle' },
        { name: 'brand', label: 'Marque', type: 'text', required: true, placeholder: 'Ex: Mercedes-Benz' },
        { name: 'model', label: 'Modèle', type: 'text', required: true, placeholder: 'Ex: Tourismo 16 RHD' },
        { name: 'seats', label: 'Nombre de places assises', type: 'number', required: true, placeholder: 'Ex: 54', min: 1, max: 120 },
        { name: 'status', label: 'Statut opérationnel', type: 'select', defaultValue: 'ACTIVE', options: [
          { value: 'ACTIVE', label: 'En service' },
          { value: 'MAINTENANCE', label: 'En maintenance' },
          { value: 'OUT_OF_SERVICE', label: 'Hors service' },
        ]},
        { name: 'gallery', label: 'Photos du bus', type: 'gallery', helper: 'Ajoutez une photo principale et des photos supplémentaires.', fullWidth: true },
      ],
    }),

    resource('/transport/drivers', 'Chauffeurs', '/api/drivers', {
      singularLabel: 'Chauffeur',
      roles: ['SUPER_ADMIN', 'SERVICE_ADMIN'],
      columns: [
        { key: 'name', label: 'Chauffeur', render: (d) => `${d.firstName || ''} ${d.lastName || ''}`.trim() || '—' },
        { key: 'licenseNumber', label: 'N° de permis' },
        { key: 'phone', label: 'Téléphone', render: (d) => d.phone || '—' },
        { key: 'email', label: 'Email', render: (d) => d.email || '—' },
        { key: 'isActive', label: 'Statut', badge: true, badgeMap: { true: { variant: 'active', label: 'Actif' }, false: { variant: 'inactive', label: 'Inactif' } } },
        { key: 'createdAt', label: 'Enregistré le', type: 'date' },
      ],
      fields: [
        { name: 'firstName', label: 'Prénom', type: 'text', required: true, placeholder: 'Ex: Dieudonné' },
        { name: 'lastName', label: 'Nom', type: 'text', required: true, placeholder: 'Ex: Mukendi' },
        { name: 'licenseNumber', label: 'Numéro de permis', type: 'text', required: true, uppercase: true, placeholder: 'Ex: CD-DRV-2024-001', helper: 'Numéro de permis de conduire valide' },
        { name: 'phone', label: 'Numéro de téléphone', type: 'tel', placeholder: 'Ex: +243 812 345 678' },
        { name: 'email', label: 'Adresse email', type: 'email', placeholder: 'Ex: dieudonne.mukendi@vanguard.cd' },
        { name: 'isActive', label: 'Statut d’activité', type: 'select', defaultValue: true, options: [
          { value: true, label: 'Actif (En service)' },
          { value: false, label: 'Inactif (Suspendu / Congé)' },
        ]},
      ],
    }),

    resource('/transport/destinations', 'Destinations', '/api/destinations', {
      singularLabel: 'Destination / Trajet',
      roles: ['SUPER_ADMIN', 'SERVICE_ADMIN'],
      columns: [
        { key: 'code', label: 'Code' },
        { key: 'departureCity', label: 'Ville départ' },
        { key: 'arrivalCity', label: 'Ville arrivée' },
        { key: 'distanceKm', label: 'Distance', render: (r) => r.distanceKm ? `${r.distanceKm} km` : '—' },
        { key: 'durationHours', label: 'Durée estimée', render: (r) => r.durationHours ? `${r.durationHours} h` : '—' },
        { key: 'status', label: 'Statut', badge: true },
        { key: 'createdAt', label: 'Créé le', type: 'date' },
      ],
      fields: [
        { name: 'code', label: 'Code du trajet', type: 'text', required: true, uppercase: true, placeholder: 'Ex: KIN-LBS', helper: 'Code court unique en majuscules (ex: KIN-MAT)' },
        { name: 'departureCity', label: 'Ville de départ', type: 'text', required: true, placeholder: 'Ex: Kinshasa' },
        { name: 'arrivalCity', label: 'Ville d’arrivée', type: 'text', required: true, placeholder: 'Ex: Lubumbashi' },
        { name: 'distanceKm', label: 'Distance en km', type: 'number', placeholder: 'Ex: 2300', min: 0 },
        { name: 'durationHours', label: 'Durée estimée (heures)', type: 'number', placeholder: 'Ex: 36', min: 0 },
        { name: 'description', label: 'Description / Notes de parcours', type: 'textarea', placeholder: 'Ex: Trajet RN1 direct, pauses prévues…', fullWidth: true },
      ],
    }),

    resource('/transport/schedules', 'Horaires', '/api/schedules', {
      singularLabel: 'Horaire',
      roles: ['SUPER_ADMIN', 'SERVICE_ADMIN'],
      columns: [
        { key: 'route', label: 'Trajet', render: (s) => s.route ? `${s.route.departureCity} → ${s.route.arrivalCity}` : 'Trajet assigné' },
        { key: 'departureTime', label: 'Départ' },
        { key: 'returnTime', label: 'Retour', render: (s) => s.returnTime || '—' },
        { key: 'price', label: 'Prix', render: (s) => `${s.price || 0} USD` },
        { key: 'availableDays', label: 'Jours', render: (s) => Array.isArray(s.availableDays) ? s.availableDays.join(', ') : '—' },
        { key: 'bus', label: 'Bus', render: (s) => s.bus ? `${s.bus.plateNumber} (${s.bus.brand})` : '—' },
        { key: 'status', label: 'Statut', badge: true },
      ],
      fields: [
        {
          name: 'agencyId',
          label: 'Agence opérationnelle',
          type: 'select',
          optionsUrl: '/api/agencies',
          optionsMapper: (item) => ({ value: item.id, label: `${item.name} • ${item.code}` }),
          placeholder: 'Affecter à une agence',
        },
        {
          name: 'routeId',
          label: 'Trajet / Destination',
          type: 'select',
          required: true,
          optionsUrl: '/api/destinations',
          optionsMapper: (item) => ({ value: item.id, label: `${item.code} : ${item.departureCity} → ${item.arrivalCity}` }),
          placeholder: 'Sélectionner le trajet',
        },
        {
          name: 'busId',
          label: 'Bus affecté',
          type: 'select',
          required: true,
          optionsUrl: '/api/buses',
          optionsMapper: (item) => ({ value: item.id, label: `${item.plateNumber} (${item.brand} ${item.model} - ${item.seats} pl.)` }),
          placeholder: 'Sélectionner le bus',
        },
        { name: 'departureTime', label: 'Heure de départ', type: 'time', required: true, placeholder: '06:30' },
        { name: 'returnTime', label: 'Heure de retour (optionnel)', type: 'time', placeholder: '18:00' },
        { name: 'price', label: 'Prix standard ($ USD)', type: 'number', required: true, placeholder: 'Ex: 35.00', step: '0.01', min: 0 },
        {
          name: 'availableDays',
          label: 'Jours de circulation',
          type: 'multiselect',
          required: true,
          fullWidth: true,
          options: [
            { value: 'Lundi', label: 'Lundi' },
            { value: 'Mardi', label: 'Mardi' },
            { value: 'Mercredi', label: 'Mercredi' },
            { value: 'Jeudi', label: 'Jeudi' },
            { value: 'Vendredi', label: 'Vendredi' },
            { value: 'Samedi', label: 'Samedi' },
            { value: 'Dimanche', label: 'Dimanche' },
          ],
          defaultValue: ['Lundi', 'Mercredi', 'Vendredi'],
        },
        {
          name: 'status',
          label: 'Statut horaire',
          type: 'select',
          defaultValue: 'ACTIVE',
          options: [
            { value: 'ACTIVE', label: 'Actif' },
            { value: 'INACTIVE', label: 'Inactif' },
          ],
        },
      ],
    }),

    resource('/transport/trips', 'Voyages', '/api/trips', {
      singularLabel: 'Voyage',
      permission: 'VIEW_TRIP',
      columns: [
        { key: 'schedule', label: 'Trajet', render: (t) => t.schedule?.route ? `${t.schedule.route.departureCity} → ${t.schedule.route.arrivalCity}` : t.schedule?.departureTime ? `Départ ${t.schedule.departureTime}` : '—' },
        { key: 'departureAt', label: 'Départ', type: 'datetime' },
        { key: 'arrivalAt', label: 'Arrivée', type: 'datetime' },
        { key: 'status', label: 'Statut', badge: true, badgeMap: { SCHEDULED: { variant: 'info', label: 'Programmé' }, IN_PROGRESS: { variant: 'warning', label: 'En cours' }, COMPLETED: { variant: 'success', label: 'Terminé' }, CANCELLED: { variant: 'danger', label: 'Annulé' } } },
        { key: 'createdAt', label: 'Planifié le', type: 'date' },
      ],
      fields: [
        {
          name: 'scheduleId',
          label: 'Horaire / Trajet associé',
          type: 'select',
          required: true,
          optionsUrl: '/api/schedules',
          optionsMapper: (item) => ({
            value: item.id,
            label: `Départ ${item.departureTime} (${item.route ? item.route.departureCity + ' → ' + item.route.arrivalCity : 'Trajet standard'} - ${item.price} USD)`,
          }),
          placeholder: 'Sélectionner l’horaire',
        },
        { name: 'departureAt', label: 'Date et heure de départ', type: 'datetime-local', required: true },
        { name: 'arrivalAt', label: 'Date et heure estimée d’arrivée', type: 'datetime-local', required: true },
        {
          name: 'status',
          label: 'Statut du voyage',
          type: 'select',
          defaultValue: 'SCHEDULED',
          options: [
            { value: 'SCHEDULED', label: 'Programmé' },
            { value: 'IN_PROGRESS', label: 'En cours' },
            { value: 'COMPLETED', label: 'Terminé' },
            { value: 'CANCELLED', label: 'Annulé' },
          ],
        },
      ],
    }),

    resource('/transport/reservations', 'Réservations', '/api/reservations', {
      singularLabel: 'Réservation',
      permission: 'VIEW_RESERVATION',
      createPermission: 'CREATE_RESERVATION',
      updatePermission: 'UPDATE_RESERVATION',
      columns: [
        { key: 'reservationCode', label: 'Code' },
        { key: 'customerName', label: 'Passager' },
        { key: 'customerPhone', label: 'Téléphone' },
        { key: 'trip', label: 'Trajet', render: (r) => r.trip?.schedule?.route ? `${r.trip.schedule.route.departureCity} → ${r.trip.schedule.route.arrivalCity}` : '—' },
        { key: 'seatNumber', label: 'Siège', render: (r) => r.seatNumber ? `N° ${r.seatNumber}` : '—' },
        { key: 'paymentStatus', label: 'Paiement', render: (r) => r.payments?.length ? r.payments.map((payment) => payment.status).join(', ') : 'Non payé' },
        { key: 'ticketCode', label: 'Billet', render: (r) => r.tickets?.[0]?.ticketCode || '—' },
        { key: 'status', label: 'Statut', badge: true, badgeMap: { PENDING: { variant: 'warning', label: 'En attente' }, CONFIRMED: { variant: 'active', label: 'Confirmée' }, CANCELLED: { variant: 'danger', label: 'Annulée' }, COMPLETED: { variant: 'success', label: 'Terminée' } } },
        { key: 'totalAmount', label: 'Montant', render: (r) => `${r.totalAmount || r.amount || 0} ${r.currency || 'USD'}` },
        { key: 'createdAt', label: 'Date', type: 'datetime' },
      ],
      fields: [
        {
          name: 'tripId',
          label: 'Voyage',
          type: 'select',
          required: true,
          optionsUrl: '/api/trips',
          optionsMapper: (item) => ({
            value: item.id,
            label: `${item.schedule?.route ? `${item.schedule.route.departureCity} → ${item.schedule.route.arrivalCity}` : 'Voyage'} • ${new Date(item.departureAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
          }),
          placeholder: 'Choisir le voyage',
        },
        { name: 'customerName', label: 'Nom du client', type: 'text', required: true, placeholder: 'Ex: Jean Nday' },
        { name: 'customerPhone', label: 'Téléphone du client', type: 'tel', required: true, placeholder: 'Ex: +243 812 345 678' },
        { name: 'customerEmail', label: 'Email client', type: 'email', placeholder: 'Ex: jean@vanguard.cd' },
        { name: 'seatNumber', label: 'Numéro de siège', type: 'number', required: true, min: 1, placeholder: 'Ex: 12' },
        { name: 'status', label: 'Statut', type: 'select', defaultValue: 'PENDING', options: [
          { value: 'PENDING', label: 'En attente' },
          { value: 'CONFIRMED', label: 'Confirmée' },
          { value: 'CANCELLED', label: 'Annulée' },
          { value: 'COMPLETED', label: 'Terminée' },
        ]},
        { name: 'totalAmount', label: 'Montant total', type: 'number', placeholder: 'Ex: 35.00', step: '0.01', min: 0 },
      ],
    }),

    resource('/transport/payments', 'Paiements', '/api/reservation-payments', {
      singularLabel: 'Paiement',
      permission: 'VIEW_PAYMENT',
      readOnly: true,
      columns: [
        { key: 'paymentReference', label: 'Référence' },
        { key: 'amount', label: 'Montant', render: (p) => `${p.amount || 0} ${p.currency || 'USD'}` },
        { key: 'status', label: 'Statut', badge: true, badgeMap: { PENDING: { variant: 'warning', label: 'En attente' }, PROCESSING: { variant: 'warning', label: 'Traitement' }, VERIFIED: { variant: 'active', label: 'Vérifié' }, COMPLETED: { variant: 'success', label: 'Payé' }, FAILED: { variant: 'danger', label: 'Échoué' }, CANCELLED: { variant: 'danger', label: 'Annulé' }, REFUNDED: { variant: 'info', label: 'Remboursé' }, REJECTED: { variant: 'danger', label: 'Rejeté' } } },
        { key: 'channel', label: 'Canal', render: (p) => p.channel === 'AGENCY' ? 'En agence' : p.channel === 'ONLINE' ? 'En ligne' : (p.channel || '—') },
        { key: 'createdAt', label: 'Date', type: 'datetime' },
      ],
      fields: [
        {
          name: 'reservationId',
          label: 'Réservation concernée',
          type: 'select',
          required: true,
          optionsUrl: '/api/reservations',
          optionsMapper: (item) => ({ value: item.id, label: `${item.reservationCode} • ${item.customerName}` }),
          placeholder: 'Choisir la réservation',
        },
        { name: 'amount', label: 'Montant', type: 'number', required: true, placeholder: 'Ex: 35.00', step: '0.01', min: 0 },
        { name: 'currency', label: 'Devise', type: 'select', defaultValue: 'USD', options: [{ value: 'USD', label: 'USD ($)' }, { value: 'CDF', label: 'CDF (FC)' }] },
        { name: 'channel', label: 'Mode de paiement', type: 'select', defaultValue: 'AGENCY', options: [{ value: 'AGENCY', label: 'En agence' }, { value: 'ONLINE', label: 'En ligne' }] },
        { name: 'method', label: 'Méthode', type: 'text', placeholder: 'Ex: Cash, MoMo, Airtel Money' },
        { name: 'status', label: 'Statut du paiement', type: 'select', defaultValue: 'PENDING', options: [
          { value: 'PENDING', label: 'En attente' },
          { value: 'PROCESSING', label: 'Traitement' },
          { value: 'VERIFIED', label: 'Vérifié' },
          { value: 'COMPLETED', label: 'Payé' },
          { value: 'FAILED', label: 'Échoué' },
          { value: 'CANCELLED', label: 'Annulé' },
          { value: 'REFUNDED', label: 'Remboursé' },
          { value: 'REJECTED', label: 'Rejeté' },
        ]},
        { name: 'reference', label: 'Référence fournisseur', type: 'text', placeholder: 'Ex: TXN-123' },
      ],
    }),

    resource('/transport/tickets', 'Billets', '/api/tickets', {
      singularLabel: 'Billet',
      permission: 'VIEW_RESERVATION',
      readOnly: true,
      columns: [
        { key: 'ticketCode', label: 'Code Billet' },
        { key: 'reservation', label: 'Réservation', render: (t) => t.reservation?.reservationCode || t.reservationCode || '—' },
        { key: 'status', label: 'Statut', badge: true, badgeMap: { VALID: { variant: 'active', label: 'Valide' }, USED: { variant: 'success', label: 'Utilisé' }, CANCELLED: { variant: 'danger', label: 'Annulé' } } },
        { key: 'createdAt', label: 'Émis le', type: 'datetime' },
      ],
      fields: [
        {
          name: 'reservationId',
          label: 'Réservation',
          type: 'select',
          required: true,
          optionsUrl: '/api/reservations',
          optionsMapper: (item) => ({ value: item.id, label: `${item.reservationCode} • ${item.customerName}` }),
          placeholder: 'Choisir la réservation',
        },
      ],
    }),

    resource('/transport/parcels', 'Colis', '/api/parcels', {
      singularLabel: 'Colis',
      columns: [
        { key: 'trackingCode', label: 'Code de suivi' },
        { key: 'senderName', label: 'Expéditeur' },
        { key: 'senderPhone', label: 'Tél. Expéditeur' },
        { key: 'recipientName', label: 'Destinataire' },
        { key: 'recipientPhone', label: 'Tél. Destinataire' },
        { key: 'status', label: 'Statut', badge: true },
        { key: 'amount', label: 'Prix', render: (p) => `${p.amount || 0} ${p.currency || 'USD'}` },
        { key: 'createdAt', label: 'Enregistré le', type: 'date' },
      ],
      fields: [
        { name: 'senderName', label: 'Nom expéditeur', type: 'text', required: true, placeholder: 'Ex: A. Kabila' },
        { name: 'senderPhone', label: 'Téléphone expéditeur', type: 'tel', required: true, placeholder: 'Ex: +243 812 345 678' },
        { name: 'recipientName', label: 'Nom destinataire', type: 'text', required: true, placeholder: 'Ex: M. Mbuyi' },
        { name: 'recipientPhone', label: 'Téléphone destinataire', type: 'tel', required: true, placeholder: 'Ex: +243 900 000 000' },
        {
          name: 'originAgencyId',
          label: 'Agence d’origine',
          type: 'select',
          optionsUrl: '/api/agencies',
          optionsMapper: (item) => ({ value: item.id, label: `${item.name} • ${item.city || '—'}` }),
          placeholder: 'Sélectionner l’agence d’origine',
        },
        {
          name: 'destinationAgencyId',
          label: 'Agence de destination',
          type: 'select',
          optionsUrl: '/api/agencies',
          optionsMapper: (item) => ({ value: item.id, label: `${item.name} • ${item.city || '—'}` }),
          placeholder: 'Sélectionner l’agence de destination',
        },
        { name: 'originCity', label: 'Ville d’origine', type: 'text', required: true, placeholder: 'Ex: Kinshasa' },
        { name: 'destinationCity', label: 'Ville de destination', type: 'text', required: true, placeholder: 'Ex: Lubumbashi' },
        { name: 'category', label: 'Catégorie', type: 'select', defaultValue: 'STANDARD', options: [{ value: 'STANDARD', label: 'Standard' }, { value: 'DOCUMENT', label: 'Document' }, { value: 'FRAGILE', label: 'Fragile' }] },
        { name: 'weightKg', label: 'Poids (kg)', type: 'number', required: true, min: 0, step: '0.01', placeholder: 'Ex: 5.5' },
        { name: 'volumeM3', label: 'Volume (m³)', type: 'number', required: true, min: 0, step: '0.01', placeholder: 'Ex: 0.15' },
        { name: 'declaredValue', label: 'Valeur déclarée', type: 'number', min: 0, step: '0.01', placeholder: 'Ex: 100.00' },
        { name: 'amount', label: 'Montant à payer', type: 'number', required: true, min: 0, step: '0.01', placeholder: 'Ex: 35.00' },
        { name: 'currency', label: 'Devise', type: 'select', defaultValue: 'USD', options: [{ value: 'USD', label: 'USD ($)' }, { value: 'CDF', label: 'CDF (FC)' }] },
        { name: 'status', label: 'Statut du colis', type: 'select', defaultValue: 'REGISTERED', options: [
          { value: 'REGISTERED', label: 'Enregistré' },
          { value: 'PAYMENT_PENDING', label: 'Paiement en attente' },
          { value: 'PAID', label: 'Payé' },
          { value: 'ACCEPTED', label: 'Accepté' },
          { value: 'IN_TRANSIT', label: 'En transit' },
          { value: 'ARRIVED_AT_AGENCY', label: 'Arrivé à l’agence' },
          { value: 'READY_FOR_PICKUP', label: 'Prêt à récupérer' },
          { value: 'COLLECTED', label: 'Retiré' },
          { value: 'RETURNED', label: 'Retourné' },
          { value: 'CANCELLED', label: 'Annulé' },
          { value: 'DELIVERED', label: 'Livré' },
        ]},
        { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Détails, fragilité, etc.', fullWidth: true },
      ],
    }),

    resource('/transport/seats', 'Sièges', '/api/seats', {
      unavailable: 'La consultation des sièges s’effectue par bus : GET /api/seats/:busId.',
    }),
  ],

  construction: [
    resource('/construction/projects', 'Projets', '/api/construction/projects', {
      labelKey: 'construction.nav.projects',
      permission: 'VIEW_PROJECT',
      createPermission: 'CREATE_PROJECT',
      updatePermission: 'UPDATE_PROJECT',
      deletePermission: 'DELETE_PROJECT',
    }),
    resource('/construction/templates', 'Projets templates', '/api/construction/projects', {
      permission: 'VIEW_PROJECT',
    }),
    resource('/construction/customer-requests', 'Demandes clients', '/api/construction/customer-requests', {
      labelKey: 'construction.nav.customerRequests',
      permission: 'VIEW_CUSTOMER_REQUEST',
      createPermission: 'CREATE_CUSTOMER_REQUEST',
      updatePermission: 'UPDATE_CUSTOMER_REQUEST',
    }),
    resource('/construction/quote-requests', 'Demandes de devis', '/api/construction/quote-requests', {
      labelKey: 'construction.nav.quoteRequests',
      permission: 'VIEW_QUOTE_REQUEST',
      createPermission: 'CREATE_QUOTE_REQUEST',
      updatePermission: 'UPDATE_QUOTE_REQUEST',
    }),
  ],

  automobile: [
    resource('/automobile/vehicles', 'Véhicules', '/api/vehicles', {
      singularLabel: 'Véhicule',
      labelKey: 'autosales.nav.vehicles',
      permission: 'VIEW_VEHICLE',
      createPermission: 'CREATE_VEHICLE',
      updatePermission: 'UPDATE_VEHICLE',
      deletePermission: 'DELETE_VEHICLE',
      mediaConfig: {
        entityType: 'vehicle',
        mediaEndpoint: '/api/vehicle-media',
        relationKey: 'vehicleId',
        uploadEntityType: 'vehicle',
        primaryOnFirstUpload: true,
      },
      columns: [
        { key: 'photo', label: 'Photo', render: (v) => (
          <MediaThumbnail media={v.media} alt={`${v.brand || ''} ${v.model || ''}`} size={40} />
        )},
        { key: 'brand', label: 'Marque' },
        { key: 'model', label: 'Modèle' },
        { key: 'year', label: 'Année' },
        { key: 'price', label: 'Prix', render: (v) => `${v.price || 0} ${v.currency || 'USD'}` },
        { key: 'mileage', label: 'Kilométrage', render: (v) => v.mileage != null ? `${v.mileage} km` : '—' },
        { key: 'status', label: 'Statut', badge: true, badgeMap: {
          AVAILABLE: { variant: 'active', label: 'Disponible' },
          RESERVED: { variant: 'warning', label: 'Réservé' },
          SOLD: { variant: 'inactive', label: 'Vendu' },
          IN_MAINTENANCE: { variant: 'danger', label: 'En maintenance' },
        }},
        { key: 'createdAt', label: 'Enregistré le', type: 'date' },
      ],
      fields: [
        { name: 'brand', label: 'Marque', type: 'text', required: true, placeholder: 'Ex: Toyota' },
        { name: 'model', label: 'Modèle', type: 'text', required: true, placeholder: 'Ex: Land Cruiser Prado' },
        { name: 'year', label: 'Année', type: 'number', required: true, placeholder: 'Ex: 2022', min: 1990, max: 2030 },
        { name: 'price', label: 'Prix de vente', type: 'number', required: true, placeholder: 'Ex: 45000', min: 0 },
        { name: 'currency', label: 'Devise', type: 'select', defaultValue: 'USD', options: [{ value: 'USD', label: 'USD ($)' }, { value: 'CDF', label: 'CDF (FC)' }] },
        { name: 'mileage', label: 'Kilométrage (km)', type: 'number', placeholder: 'Ex: 35000', min: 0 },
        { name: 'fuelType', label: 'Carburant', type: 'select', defaultValue: 'Essence', options: [
          { value: 'Essence', label: 'Essence' },
          { value: 'Diesel', label: 'Diesel' },
          { value: 'Hybride', label: 'Hybride' },
          { value: 'Électrique', label: 'Électrique' },
        ]},
        { name: 'transmission', label: 'Boîte de vitesses', type: 'select', defaultValue: 'Automatique', options: [
          { value: 'Automatique', label: 'Automatique' },
          { value: 'Manuelle', label: 'Manuelle' },
        ]},
        { name: 'color', label: 'Couleur', type: 'text', placeholder: 'Ex: Noir métallisé' },
        { name: 'status', label: 'Statut', type: 'select', defaultValue: 'AVAILABLE', options: [
          { value: 'AVAILABLE', label: 'Disponible' },
          { value: 'RESERVED', label: 'Réservé' },
          { value: 'SOLD', label: 'Vendu' },
          { value: 'IN_MAINTENANCE', label: 'En maintenance' },
        ]},
        { name: 'description', label: 'Description détaillée', type: 'textarea', placeholder: 'Détails sur l’état, équipements, options…', fullWidth: true },
        { name: 'gallery', label: 'Photos du véhicule', type: 'gallery', helper: 'Ajoutez une photo principale et des photos supplémentaires.', fullWidth: true },
      ],
    }),
    resource('/automobile/templates', 'Véhicules templates', '/api/vehicles', {
      permission: 'VIEW_VEHICLE',
    }),
    resource('/automobile/inquiries', 'Demandes', '/api/vehicle-inquiries', {
      labelKey: 'autosales.nav.inquiries',
      permission: 'VIEW_VEHICLE_INQUIRY',
      createPermission: 'CREATE_VEHICLE_INQUIRY',
      updatePermission: 'UPDATE_VEHICLE_INQUIRY',
    }),
    resource('/automobile/reservations', 'Réservations', '/api/vehicle-reservations', {
      labelKey: 'autosales.nav.reservations',
      permission: 'VIEW_RESERVATION',
      createPermission: 'MANAGE_VEHICLE_RESERVATION',
      updatePermission: 'MANAGE_VEHICLE_RESERVATION',
      deletePermission: 'CANCEL_VEHICLE_RESERVATION',
    }),
    resource('/automobile/payments', 'Paiements', '/api/vehicle-payments', {
      labelKey: 'autosales.nav.payments',
      permission: 'VIEW_RESERVATION',
      createPermission: 'MANAGE_VEHICLE_RESERVATION',
      updatePermission: 'MANAGE_VEHICLE_RESERVATION',
    }),
    resource('/automobile/sales', 'Ventes', '/api/vehicle-reservations', {
      labelKey: 'autosales.nav.sales',
      permission: 'VIEW_RESERVATION',
    }),
    resource('/automobile/agents', 'Agents', '/api/users', {
      labelKey: 'autosales.nav.agents',
      permission: 'VIEW_USER',
      createPermission: 'CREATE_USER',
      updatePermission: 'UPDATE_USER',
      deletePermission: 'DELETE_USER',
    }),
    resource('/automobile/agent', 'Espace agent', '', {
      labelKey: 'autosales.nav.agentWorkspace',
      unavailable: 'Accès réservé à l’agent AutoSales.',
    }),
    resource('/automobile/agent/inquiries', 'Mes demandes', '', {
      labelKey: 'autosales.nav.agentInquiries',
      permission: 'VIEW_VEHICLE_INQUIRY',
    }),
    resource('/automobile/agent/reservations', 'Mes réservations', '', {
      labelKey: 'autosales.nav.agentReservations',
      permission: 'VIEW_RESERVATION',
    }),
    resource('/automobile/agent/payments', 'Mes paiements', '', {
      labelKey: 'autosales.nav.agentPayments',
      permission: 'VIEW_RESERVATION',
    }),
    resource('/automobile/agent/sales', 'Mes ventes', '', {
      labelKey: 'autosales.nav.agentSales',
      permission: 'VIEW_RESERVATION',
    }),
    resource('/automobile/reports', 'Rapports', '', {
      labelKey: 'autosales.nav.reports',
      unavailable: 'Reporting will be available in a later delivery.',
    }),
    resource('/automobile/settings', 'Paramètres', '', {
      labelKey: 'autosales.nav.settings',
      unavailable: 'AutoSales settings will be available in a later delivery.',
    }),
  ],
}

resourceGroups.public = [
  resource('/public/vehicles', 'Catalogue véhicules', '/api/vehicles', { public: true, readOnly: true }),
]

export const resourceByPath = Object.values(resourceGroups)
  .flat()
  .reduce((all, item) => ({ ...all, [item.path]: item }), {})
