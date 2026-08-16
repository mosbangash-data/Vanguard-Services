import axios from 'axios'

// Use an explicit environment variable in production. Falling back to a relative URL
// keeps the app safe when served behind a reverse proxy or a deployment platform.
const API_URL = import.meta.env.VITE_API_URL || ''

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Gestion centralisée des erreurs HTTP / réseau.
 * Ne transforme jamais une erreur backend en succès frontend.
 */
const getHttpErrorMessage = (status, backendMessage) => {
  if (backendMessage && typeof backendMessage === 'string' && backendMessage.trim()) {
    return backendMessage
  }
  switch (status) {
    case 400:
      return 'INVALID_REQUEST'
    case 401:
      return 'UNAUTHORIZED'
    case 403:
      return 'FORBIDDEN'
    case 404:
      return 'NOT_FOUND'
    case 409:
      return 'CONFLICT'
    case 429:
      return 'TOO_MANY_REQUESTS'
    case 500:
      return 'SERVER_ERROR'
    default:
      return 'NETWORK_ERROR'
  }
}

// Intercepteur pour gérer les erreurs de manière centralisée
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const backendMessage = error.response?.data?.message || error.response?.data?.error

    let message
    if (error.code === 'ECONNABORTED') {
      message = 'TIMEOUT'
    } else if (!error.response) {
      message = 'NETWORK_ERROR'
    } else {
      message = getHttpErrorMessage(status, backendMessage)
    }

    const apiError = new Error(message)
    apiError.status = status
    apiError.data = error.response?.data
    return Promise.reject(apiError)
  }
)

/**
 * ============================================================
 * CONTRATS API — LIVRAISON 1 (BACKEND PUBLIC SÉCURISÉ)
 * ============================================================
 *
 * [TRANSPORT]
 * - GET  /api/public/trips?departure=&arrival=&date=&page=&limit=
 *   → { success, data: { items: [{ id, departureAt, arrivalAt, status,
 *        route: { code, departureCity, arrivalCity, distanceKm, durationHours },
 *        schedule: { departureTime, returnTime, price },
 *        bus: { brand, model, plateNumber, seats }, availableSeats }], page, limit, total } }
 * - GET /api/public/trips/:tripId/seats
 *   → { success, data: { tripId, route, departureAt, arrivalAt, departureTime, returnTime,
 *        price, bus: { brand, model, plateNumber, seats }, seats: [{ number, available }] } }
 * - POST /api/public/reservations { tripId, customerName, customerPhone, customerEmail, seatNumber }
 *   → { success, data: { reservation: { id, reservationCode, status, seatNumber, totalAmount, tripId } } }
 * - GET /api/public/reservations/:code
 *   → { success, data: { reservation: { id, reservationCode, status, seatNumber, totalAmount,
 *        customerName, customerPhone, customerEmail, createdAt, trip: { id, departureAt, arrivalAt,
 *        route, schedule, bus }, payments } } }
 * - POST /api/public/reservations/:reservationId/payments { amount, method, reference, comment }
 *   → { success, data: { payment: { id, amount, method, status: 'PENDING', reference, createdAt },
 *        message } }
 *
 * [BILLET]
 * - GET /tickets/:ticketCode
 *   → { success, data: { ticket: { id, ticketCode, qrCode, serialNumber, status, issuedAt, usedAt,
 *        reservation: { id, reservationCode, customerName, customerPhone, customerEmail, seatNumber,
 *        totalAmount, status, trip: { id, departureAt, arrivalAt, schedule: { departureTime, returnTime,
 *        route: { code, departureCity, arrivalCity }, bus: { plateNumber, brand, model } } } } } } }
 *
 * [CONSTRUCTION]
 * - GET /api/public/construction/projects?page=&limit=
 *   → { success, data: { items: [{ id, title, slug, location, description, budget, createdAt,
 *        gallery: [{ id, caption, order, media: { url, mimeType } }] }], page, limit, total } }
 * - GET /api/public/construction/projects/:id
 *   → { success, data: { project: { id, title, slug, location, description, budget, createdAt, gallery } } }
 * - POST /api/public/construction/customer-requests { subject, customerName, customerPhone, customerEmail, message }
 *   → { success, data: { customerRequest: { id, subject, status, createdAt } } }
 * - POST /api/public/construction/quote-requests { customerName, customerPhone, customerEmail, projectType, description, budgetRange }
 *   → { success, data: { quoteRequest: { id, status, createdAt } } }
 *
 * [AUTOMOBILE]
 * - GET /api/vehicles?page=&limit=&search=
 *   → { success, data: { items: [...], page, limit, total } }
 * - GET /api/vehicles/:id
 *   → { success, data: { vehicle: {...} } }
 * - POST /api/public/vehicle-inquiries { vehicleId, customerName, customerEmail, customerPhone, inquiryType, contactPreference, message }
 *   → { success, data: { inquiry: { id, status, createdAt } } }
 *
 * [WEBSITE]
 * - GET /api/public/website-settings
 *   → { success, data: { settings: { companyName, logoUrl, address, phone, email, whatsapp,
 *       facebook, twitter, instagram, generalInfo } | null } }
 * ============================================================
 */

const unwrap = (res) => {
  const payload = res.data
  if (!payload || payload.success !== true) {
    throw new Error('INVALID_RESPONSE')
  }
  // Certaines routes peuvent retourner data: null (ex. website-settings sans enregistrement)
  return payload.data ?? null
}

export const api = {
  // ===== TRANSPORT =====
  /**
   * Rechercher des trajets publics.
   * @param {{ departure?: string, arrival?: string, date?: string, page?: number, limit?: number }} params
   */
  searchTrips: (params = {}) =>
    apiClient.get('/api/public/trips', { params }).then(unwrap),

  /**
   * Récupérer les sièges d'un trajet.
   * @param {string} tripId
   */
  getTripSeats: (tripId) =>
    apiClient.get(`/api/public/trips/${tripId}/seats`).then(unwrap),

  /**
   * Créer une réservation publique.
   * @param {{ tripId: string, customerName: string, customerPhone: string, customerEmail?: string, seatNumber: string }} payload
   */
  createReservation: (payload) =>
    apiClient.post('/api/public/reservations', payload).then(unwrap),

  /**
   * Consulter une réservation avec sa référence.
   * @param {string} code
   */
  getReservationByCode: (code) =>
    apiClient.get(`/api/public/reservations/${code}`).then(unwrap),

  /**
   * Déclarer un paiement pour une réservation (reste PENDING, jamais VERIFIED).
   * @param {string} reservationId
   * @param {{ amount: string|number, method: string, reference?: string, comment?: string }} payload
   */
  createReservationPayment: (reservationId, payload) =>
    apiClient.post(`/api/public/reservations/${reservationId}/payments`, payload).then(unwrap),

  // ===== BILLET =====
  /**
   * Récupérer un billet par son code.
   * @param {string} ticketCode
   */
  getTicket: (ticketCode) =>
    apiClient.get(`/tickets/${ticketCode}`).then(unwrap),

  // ===== CONSTRUCTION =====
  /**
   * Lister les projets publics publiés.
   * @param {{ page?: number, limit?: number }} params
   */
  listPublicProjects: (params = {}) =>
    apiClient.get('/api/public/construction/projects', { params }).then(unwrap),

  /**
   * Récupérer un projet public publié.
   * @param {string} id
   */
  getPublicProject: (id) =>
    apiClient.get(`/api/public/construction/projects/${id}`).then(unwrap),

  /**
   * Envoyer une demande client (Construction).
   * @param {{ subject: string, customerName: string, customerPhone: string, customerEmail?: string, message: string }} payload
   */
  createCustomerRequest: (payload) =>
    apiClient.post('/api/public/construction/customer-requests', payload).then(unwrap),

  /**
   * Envoyer une demande de devis (Construction).
   * @param {{ customerName: string, customerPhone: string, customerEmail?: string, projectType?: string, description: string, budgetRange?: string }} payload
   */
  createQuoteRequest: (payload) =>
    apiClient.post('/api/public/construction/quote-requests', payload).then(unwrap),

  // ===== AUTOMOBILE =====
  /**
   * Lister les véhicules publics disponibles.
   * @param {{ page?: number, limit?: number, search?: string }} params
   */
  listVehicles: (params = {}) =>
    apiClient.get('/api/vehicles', { params }).then(unwrap),

  /**
   * Récupérer un véhicule public.
   * @param {string} id
   */
  getVehicle: (id) =>
    apiClient.get(`/api/vehicles/${id}`).then(unwrap),

  /**
   * Envoyer une demande d'information (Automobile).
   * @param {{ vehicleId: string, customerName: string, customerEmail?: string, customerPhone?: string, inquiryType?: string, contactPreference?: string, message: string }} payload
   */
  createVehicleInquiry: (payload) =>
    apiClient.post('/api/public/vehicle-inquiries', payload).then(unwrap),

  // ===== WEBSITE =====
  /**
   * Récupérer les paramètres publics du site.
   */
  getWebsiteSettings: () =>
    apiClient.get('/api/public/website-settings').then(unwrap),
}

export default api