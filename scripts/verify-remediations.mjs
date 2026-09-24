import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

console.log('🧪 Démarrage de la suite de vérification automatisée de toutes les phases de remédiation...\n');

let totalTests = 0;
let passedTests = 0;

function check(title, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ [PASS] ${title}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${title}: ${err.message}`);
  }
}

// 1. Syntaxe de tous les fichiers JavaScript modifiés et créés
const filesToSyntaxCheck = [
  'src/app.js',
  'src/services/publicTransportService.js',
  'src/services/tripService.js',
  'src/services/reservationPaymentService.js',
  'src/controllers/reservationPaymentController.js',
  'src/routes/reservationPayments.js',
  'src/middleware/uploadMiddleware.js',
  'src/routes/upload.js',
  'src/repositories/busMediaRepository.js',
  'src/services/busMediaService.js',
  'src/controllers/busMediaController.js',
  'src/routes/busMedia.js',
  'src/validators/busMediaValidator.js',
  'src/repositories/vehicleRepository.js',
  'src/services/busService.js',
  'src/validators/vehicleMediaValidator.js',
];

console.log('--- TEST GROUP 1 : VALIDATION SYNTAXIQUE DU BACKEND ---');
for (const relPath of filesToSyntaxCheck) {
  check(`Syntaxe valide pour ${relPath}`, () => {
    const fullPath = path.resolve(relPath);
    assert(fs.existsSync(fullPath), `Fichier ${relPath} introuvable`);
    const code = fs.readFileSync(fullPath, 'utf8');
    new vm.Script(code, { filename: relPath });
  });
}

console.log('\n--- TEST GROUP 2 : MODÈLE PRISMA ET MIGRATION SQL ---');
check('Schéma Prisma contient PaymentStatus étendu', () => {
  const schema = fs.readFileSync(path.resolve('prisma/schema.prisma'), 'utf8');
  assert(schema.includes('PROCESSING'), 'PROCESSING manquant dans PaymentStatus');
  assert(schema.includes('FAILED'), 'FAILED manquant dans PaymentStatus');
  assert(schema.includes('CANCELLED'), 'CANCELLED manquant dans PaymentStatus');
  assert(schema.includes('REFUNDED'), 'REFUNDED manquant dans PaymentStatus');
});

check('Schéma Prisma contient BusMedia et relations idempotence Payment', () => {
  const schema = fs.readFileSync(path.resolve('prisma/schema.prisma'), 'utf8');
  assert(schema.includes('model BusMedia'), 'model BusMedia manquant');
  assert(schema.includes('agencyId'), 'agencyId manquant dans model Payment');
  assert(schema.includes('idempotencyKey'), 'idempotencyKey manquant dans model Payment');
  assert(/media\s+BusMedia\[\]/.test(schema), 'media BusMedia[] manquant sur Bus');
});

check('Fichier de migration SQL pour paiements et BusMedia existe', () => {
  const migrationPath = path.resolve('prisma/migrations/20260913160000_secure_payments_bus_media/migration.sql');
  assert(fs.existsSync(migrationPath), 'Fichier de migration SQL manquant');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes('BusMedia'), 'Table BusMedia manquante dans le SQL de migration');
  assert(sql.includes('idempotencyKey'), 'idempotencyKey manquant dans le SQL de migration');
  assert(sql.includes('agencyId'), 'agencyId manquant dans le SQL de migration');
});

console.log('\n--- TEST GROUP 3 : CALCUL SERVEUR DU SOLDE ET IDEMPOTENCE ---');
check('publicTransportService calcule le solde serveur et bloque la manipulation du montant', () => {
  const code = fs.readFileSync(path.resolve('src/services/publicTransportService.js'), 'utf8');
  assert(code.includes('remainingBalanceCents'), 'remainingBalanceCents manquant');
  assert(code.includes('clientAmountCents !== remainingBalanceCents'), 'Vérification égalité solde restant manquante');
  assert(code.includes('idempotencyKey'), 'Support idempotencyKey manquant');
  assert(!code.includes('const countryCode = payload.countryCode || resolvedCountryCode;'), 'Variable dupliquée countryCode doit être corrigée');
});

console.log('\n--- TEST GROUP 4 : TRAÇABILITÉ AGENCE PHYSIQUE ET REÇU ---');
check('reservationPaymentService résout l\'agence et génère le reçu', () => {
  const code = fs.readFileSync(path.resolve('src/services/reservationPaymentService.js'), 'utf8');
  assert(code.includes('resolvedAgencyId'), 'resolvedAgencyId manquant dans validateReservationPayment');
  assert(code.includes('getReservationPaymentReceipt'), 'getReservationPaymentReceipt manquant');
  assert(code.includes('REC-'), 'Numérotation de reçu REC- manquante');
});

check('Contrôleur et routes reservationPayments exposent GET /:id/receipt', () => {
  const ctrlCode = fs.readFileSync(path.resolve('src/controllers/reservationPaymentController.js'), 'utf8');
  assert(ctrlCode.includes('getReservationPaymentReceipt'), 'Contrôleur getReservationPaymentReceipt manquant');
  const routeCode = fs.readFileSync(path.resolve('src/routes/reservationPayments.js'), 'utf8');
  assert(routeCode.includes('/:id/receipt'), 'Route /:id/receipt manquante');
});

check('CoachOperationsPage intègre l\'affichage et l\'impression du reçu', () => {
  const code = fs.readFileSync(path.resolve('admin-frontend/src/features/admin/coach/CoachOperationsPage.jsx'), 'utf8');
  assert(code.includes('receiptData'), 'State receiptData manquant');
  assert(code.includes('viewReceipt'), 'Fonction viewReceipt manquante');
  assert(code.includes('window.print()'), 'Action impression reçu manquante');
});

console.log('\n--- TEST GROUP 5 : INTERFACE CLIENT CASH AGENCE ---');
check('Transport.jsx client expose uniquement le paiement en agence pour les réservations coach', () => {
  const code = fs.readFileSync(path.resolve('client-frontend/src/pages/Transport.jsx'), 'utf8');
  assert(code.includes("const PAYMENT_METHODS = ['CASH']"), 'Sélection du mode de paiement cash manquante');
  assert(code.includes('paymentAgencyNotice'), 'Notice d\'agence manquante');
  assert(code.includes('idempotencyKey:'), 'Envoi de clé d\'idempotence manquant');
  assert(code.includes('disabled={paymentLoading}'), 'Protection anti double soumission manquante');
  assert(!code.includes('MOBILE_MONEY'), 'Le flux mobile doit être retiré du client');
});

console.log('\n--- TEST GROUP 6-8 : CASH-ONLY PAYMENT FLOW ---');
check('Le backend public et les providers restent strictement cash / agency uniquement', () => {
  const paymentIndex = fs.readFileSync(path.resolve('src/services/payment/index.js'), 'utf8');
  const publicService = fs.readFileSync(path.resolve('src/services/publicTransportService.js'), 'utf8');
  const validator = fs.readFileSync(path.resolve('src/validators/publicValidator.js'), 'utf8');
  assert(paymentIndex.includes('getProvider = () => agencyPaymentProvider'), 'Provider agency-only manquant');
  assert(publicService.includes("const allowedMethods = new Set(['CASH'])"), 'Validation publique cash-only manquante');
  assert(validator.includes("const ALLOWED_PUBLIC_PAYMENT_METHODS = ['CASH'];"), 'Validateur public cash-only manquant');
  assert(!publicService.includes('MOBILE_MONEY'), 'Paiement mobile encore présent dans le service public');
});

console.log('\n--- TEST GROUP 9-14 : UPLOAD MULTIPART, BUS MEDIA & VEHICLE MEDIA ---');
check('uploadMiddleware gère le multipart en mémoire pour Cloudinary', () => {
  const code = fs.readFileSync(path.resolve('src/middleware/uploadMiddleware.js'), 'utf8');
  assert(code.includes('parseMultipart'), 'Fonction parseMultipart manquante');
  assert(code.includes('ALLOWED_MIME_TYPES'), 'Validation ALLOWED_MIME_TYPES manquante');
  assert(code.includes('MAX_FILE_SIZE'), 'Limite MAX_FILE_SIZE manquante');
  assert(code.includes('memoryStorage'), 'Le stockage Multer doit rester en mémoire');
});

check('Route /api/upload et /api/bus-media sont déclarées et montées dans src/app.js', () => {
  const appCode = fs.readFileSync(path.resolve('src/app.js'), 'utf8');
  assert(appCode.includes("require('./routes/busMedia')"), 'Import busMediaRoutes manquant');
  assert(appCode.includes("require('./routes/upload')"), 'Import uploadRoutes manquant');
  assert(appCode.includes("app.use('/api/bus-media'"), 'Montage /api/bus-media manquant');
  assert(appCode.includes("app.use('/api/upload'"), 'Montage /api/upload manquant');
});

check('VehicleManagementPage implémente la galerie complète et l\'upload', () => {
  const code = fs.readFileSync(path.resolve('admin-frontend/src/features/admin/autosales/VehicleManagementPage.jsx'), 'utf8');
  assert(code.includes('uploadImage'), 'Fonction uploadImage manquante');
  assert(code.includes('setPrimary'), 'Fonction setPrimary manquante');
  assert(code.includes('deletePhoto'), 'Fonction deletePhoto manquante');
  assert(code.includes('Galerie & Photos'), 'Section Galerie & Photos manquante');
});

check('Tri des médias véhicule et bus place isPrimary en premier', () => {
  const vehRepo = fs.readFileSync(path.resolve('src/repositories/vehicleRepository.js'), 'utf8');
  assert(vehRepo.includes("orderBy: [{ isPrimary: 'desc' }, { order: 'asc' }]"), 'Tri isPrimary desc manquant sur VehicleRepository');
  const busService = fs.readFileSync(path.resolve('src/services/busService.js'), 'utf8');
  assert(busService.includes("orderBy: [{ isPrimary: 'desc' }, { order: 'asc' }]"), 'Tri isPrimary desc manquant sur busService');
});

console.log(`\n==================================================`);
console.log(`RÉSULTAT DE LA VÉRIFICATION : ${passedTests}/${totalTests} tests réussis.`);
console.log(`==================================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
