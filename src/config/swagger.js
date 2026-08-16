const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Vanguard Services API',
      version: '1.0.0',
      description: 'Documentation API pour Vanguard Services',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      '/api/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Connexion - obtient un JWT',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    identifier: { type: 'string' },
                    password: { type: 'string' }
                  },
                  required: ['identifier','password']
                }
              }
            }
          },
          responses: { '200': { description: 'Token JWT' } }
        }
      },
      '/api/users': {
        get: { tags: ['Users'], summary: 'Liste des utilisateurs', responses: { '200': { description: 'Liste' } } },
        post: { tags: ['Users'], summary: 'Créer un utilisateur', responses: { '201': { description: 'Utilisateur créé' } } }
      },
      '/api/roles': { get: { tags: ['Roles'], summary: 'Lister les roles' } },
      '/api/permissions': { get: { tags: ['Permissions'], summary: 'Lister les permissions' } },
      '/api/departments': { get: { tags: ['Departments'], summary: 'Lister départements' } },
      '/api/destinations': { get: { tags: ['Destinations'], summary: 'Lister destinations' } },
      '/api/schedules': { get: { tags: ['Schedules'], summary: 'Lister schedules' } },
      '/api/trips': { get: { tags: ['Trips'], summary: 'Lister trips' } },
      '/api/notifications': { get: { tags: ['Notifications'], summary: 'Lister notifications' }, post: { tags: ['Notifications'], summary: 'Créer notification' } },
      '/api/audit-logs': { get: { tags: ['AuditLog'], summary: 'Lister logs d\'audit' } },
      '/api/reservations': { post: { tags: ['Reservations'], summary: 'Créer une réservation' } },
      '/api/reservation-payments': { post: { tags: ['ReservationPayments'], summary: 'Créer un paiement de réservation' } },
      '/api/reservation-payments/reservation/{reservationId}': { get: { tags: ['ReservationPayments'], summary: 'Lister les paiements d\'une réservation' } },
      '/api/reservation-payments/{id}': { get: { tags: ['ReservationPayments'], summary: 'Obtenir un paiement de réservation' } },
      '/api/tickets': { post: { tags: ['Tickets'], summary: 'Générer ticket' } }
    }
  },
  apis: [],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
