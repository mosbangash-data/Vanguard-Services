const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../src/app');
const { main: seedMain } = require('../prisma/seed');

let server;
let baseUrl;
let adminToken;

const request = async (method, path, body, token) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !(body instanceof Buffer)) headers['Content-Type'] = 'application/json';

  const options = { method, headers };
  if (body !== undefined && body !== null) {
    options.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const res = await fetch(`${baseUrl}${path}`, options);
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: res.status, data };
};

test.before(async () => {
  await seedMain();

  server = http.createServer(app);
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', (err) => (err ? reject(err) : resolve())));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;

  const loginRes = await request('POST', '/api/auth/login', {
    identifier: 'admin@vanguard.local',
    password: 'Admin123!',
  });

  assert.equal(loginRes.status, 200, 'Admin login should succeed');
  adminToken = loginRes.data.data.token;
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

// ===== TRANSPORT PUBLIC =====

test('GET /api/public/trips — recherche publique sans JWT', async () => {
  const res = await request('GET', '/api/public/trips');
  assert.equal(res.status, 200);
  assert.equal(res.data.success, true);
  assert.ok(Array.isArray(res.data.data.items));
  assert.ok(res.data.data.page >= 1);
  assert.ok(res.data.data.limit >= 1);
});

test('GET /api/public/trips — filtre par date invalide', async () => {
  const res = await request('GET', '/api/public/trips?date=invalid-date');
  assert.equal(res.status, 400);
});

test('GET /api/public/trips/:id/seats — trajet inexistant', async () => {
  const res = await request('GET', '/api/public/trips/nonexistent-id/seats');
  assert.equal(res.status, 404);
});

test('POST /api/public/reservations — réservation sans JWT', async () => {
  const res = await request('POST', '/api/public/reservations', {
    tripId: 'nonexistent-trip',
    customerName: 'Test Client',
    customerPhone: '+243000000000',
    seatNumber: '1',
  });
  assert.equal(res.status, 404);
});

test('POST /api/public/reservations — données manquantes', async () => {
  const res = await request('POST', '/api/public/reservations', {
    customerName: 'Test Client',
  });
  assert.equal(res.status, 400);
});

test('POST /api/public/reservations — prix falsifié ignoré', async () => {
  // Récupérer un trajet réel
  const tripsRes = await request('GET', '/api/public/trips');
  assert.equal(tripsRes.status, 200);
  const trips = tripsRes.data.data.items;
  if (trips.length === 0) return; // Pas de trajet disponible

  const trip = trips[0];
  const res = await request('POST', '/api/public/reservations', {
    tripId: trip.id,
    customerName: 'Test Client',
    customerPhone: '+243000000000',
    seatNumber: '1',
    totalAmount: '0.01', // Prix falsifié — doit être ignoré
    status: 'CONFIRMED', // Statut falsifié — doit être ignoré
  });
  assert.equal(res.status, 201);
  assert.equal(res.data.data.reservation.status, 'PENDING');
  assert.notEqual(res.data.data.reservation.totalAmount, '0.01');
});

test('POST /api/public/reservations — double réservation concurrente', async () => {
  const tripsRes = await request('GET', '/api/public/trips');
  const trips = tripsRes.data.data.items;
  if (trips.length === 0) return;

  const trip = trips[0];
  const seat = '2';

  const payload = {
    tripId: trip.id,
    customerName: 'Concurrent Client',
    customerPhone: '+243111111111',
    seatNumber: seat,
  };

  const [res1, res2] = await Promise.all([
    request('POST', '/api/public/reservations', payload),
    request('POST', '/api/public/reservations', payload),
  ]);

  const statuses = [res1.status, res2.status].sort();
  assert.deepEqual(statuses, [201, 409]);
});

test('GET /api/public/reservations/:code — réservation introuvable', async () => {
  const res = await request('GET', '/api/public/reservations/RSV-NONEXISTENT');
  assert.equal(res.status, 404);
});

test('POST /api/public/reservations/:id/payments — paiement déclaré reste PENDING', async () => {
  const tripsRes = await request('GET', '/api/public/trips');
  const trips = tripsRes.data.data.items;
  if (trips.length === 0) return;

  const trip = trips[0];
  const createRes = await request('POST', '/api/public/reservations', {
    tripId: trip.id,
    customerName: 'Payment Client',
    customerPhone: '+243222222222',
    seatNumber: '3',
  });
  assert.equal(createRes.status, 201);
  const reservationId = createRes.data.data.reservation.id;

  const payRes = await request('POST', `/api/public/reservations/${reservationId}/payments`, {
    amount: '10.00',
    method: 'CASH',
  });
  assert.equal(payRes.status, 201);
  assert.equal(payRes.data.data.payment.status, 'PENDING');
});

// ===== CONSTRUCTION PUBLIC =====

test('GET /api/public/construction/projects — liste publique sans JWT', async () => {
  const res = await request('GET', '/api/public/construction/projects');
  assert.equal(res.status, 200);
  assert.equal(res.data.success, true);
  assert.ok(Array.isArray(res.data.data.items));
});

test('GET /api/public/construction/projects/:id — projet inexistant', async () => {
  const res = await request('GET', '/api/public/construction/projects/nonexistent-id');
  assert.equal(res.status, 404);
});

test('POST /api/public/construction/customer-requests — demande client sans JWT', async () => {
  const res = await request('POST', '/api/public/construction/customer-requests', {
    subject: 'Demande de construction',
    customerName: 'Client Public',
    customerPhone: '+243333333333',
    message: 'Je souhaite construire une maison de 3 chambres.',
  });
  assert.equal(res.status, 201);
  assert.equal(res.data.data.customerRequest.status, 'NEW');
});

test('POST /api/public/construction/customer-requests — données invalides', async () => {
  const res = await request('POST', '/api/public/construction/customer-requests', {
    subject: '',
    customerName: '',
    customerPhone: '',
    message: 'court',
  });
  assert.equal(res.status, 400);
});

test('POST /api/public/construction/quote-requests — demande de devis sans JWT', async () => {
  const res = await request('POST', '/api/public/construction/quote-requests', {
    customerName: 'Client Devis',
    customerPhone: '+243444444444',
    description: 'Je souhaite un devis pour la construction d un immeuble de 4 étages.',
  });
  assert.equal(res.status, 201);
  assert.equal(res.data.data.quoteRequest.status, 'NEW');
});

test('POST /api/public/construction/quote-requests — données invalides', async () => {
  const res = await request('POST', '/api/public/construction/quote-requests', {
    customerName: '',
    customerPhone: '',
    description: 'court',
  });
  assert.equal(res.status, 400);
});

// ===== AUTOMOBILE PUBLIC =====

test('GET /api/vehicles — liste publique existante', async () => {
  const res = await request('GET', '/api/vehicles');
  assert.equal(res.status, 200);
  assert.equal(res.data.success, true);
});

test('POST /api/public/vehicle-inquiries — demande d information sans JWT', async () => {
  // Créer un véhicule via admin
  const departmentsRes = await request('GET', '/api/departments', null, adminToken);
  const autoSales = departmentsRes.data.data.items.find((item) => item.type === 'AUTO_SALES');

  const createVehicleRes = await request('POST', '/api/vehicles', {
    departmentId: autoSales.id,
    brand: 'Toyota',
    model: 'Corolla',
    year: 2022,
    mileage: 5000,
    fuelType: 'Gasoline',
    transmission: 'Automatic',
    price: '25000.00',
    description: 'Public inquiry test vehicle',
  }, adminToken);
  assert.equal(createVehicleRes.status, 201);
  const vehicleId = createVehicleRes.data.data.vehicle.id;

  const res = await request('POST', '/api/public/vehicle-inquiries', {
    vehicleId,
    customerName: 'Client Auto',
    customerPhone: '+243555555555',
    message: 'Je souhaite plus d informations sur ce véhicule.',
  });
  assert.equal(res.status, 201);
  assert.equal(res.data.data.inquiry.status, 'NEW');
});

test('POST /api/public/vehicle-inquiries — véhicule inexistant', async () => {
  const res = await request('POST', '/api/public/vehicle-inquiries', {
    vehicleId: 'nonexistent-vehicle',
    customerName: 'Client Auto',
    customerPhone: '+243555555555',
    message: 'Je souhaite plus d informations sur ce véhicule.',
  });
  assert.equal(res.status, 404);
});

test('POST /api/public/vehicle-inquiries — données invalides', async () => {
  const res = await request('POST', '/api/public/vehicle-inquiries', {
    vehicleId: '',
    customerName: '',
    message: 'court',
  });
  assert.equal(res.status, 400);
});

// ===== WEBSITE SETTINGS PUBLIC =====

test('GET /api/public/website-settings — paramètres publics', async () => {
  const res = await request('GET', '/api/public/website-settings');
  assert.equal(res.status, 200);
  assert.equal(res.data.success, true);
});

// ===== SÉCURITÉ =====

test('SÉCURITÉ — aucune route publique ne permet de modifier un statut interne', async () => {
  const tripsRes = await request('GET', '/api/public/trips');
  const trips = tripsRes.data.data.items;
  if (trips.length === 0) return;

  const trip = trips[0];
  const res = await request('POST', '/api/public/reservations', {
    tripId: trip.id,
    customerName: 'Security Client',
    customerPhone: '+243666666666',
    seatNumber: '4',
    status: 'CONFIRMED', // Tentative de falsification
    totalAmount: '0.01', // Tentative de falsification
  });
  assert.equal(res.status, 201);
  assert.equal(res.data.data.reservation.status, 'PENDING');
  assert.notEqual(res.data.data.reservation.totalAmount, '0.01');
});

test('SÉCURITÉ — aucune route publique ne permet de valider un paiement', async () => {
  const tripsRes = await request('GET', '/api/public/trips');
  const trips = tripsRes.data.data.items;
  if (trips.length === 0) return;

  const trip = trips[0];
  const createRes = await request('POST', '/api/public/reservations', {
    tripId: trip.id,
    customerName: 'Security Payment',
    customerPhone: '+243777777777',
    seatNumber: '5',
  });
  assert.equal(createRes.status, 201);
  const reservationId = createRes.data.data.reservation.id;

  const payRes = await request('POST', `/api/public/reservations/${reservationId}/payments`, {
    amount: '10.00',
    method: 'CASH',
    status: 'VERIFIED', // Tentative de validation directe
  });
  assert.equal(payRes.status, 201);
  assert.equal(payRes.data.data.payment.status, 'PENDING');
});

test('SÉCURITÉ — aucune route publique ne permet de créer un compte interne', async () => {
  const res = await request('POST', '/api/public/users', {
    email: 'hacker@test.com',
    password: 'Hacker123!',
    firstName: 'Hacker',
    lastName: 'Test',
  });
  assert.equal(res.status, 404);
});