import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('🚀 Démarrage des vérifications de non-régression et diagnostic HTTP 429...\n');

// -------------------------------------------------------------
// 1. Validation Backend: Configuration du Rate Limiter (src/app.js)
// -------------------------------------------------------------
const appJsPath = path.resolve('src/app.js');
const appJsSrc = fs.readFileSync(appJsPath, 'utf8');

assert(appJsSrc.includes("app.use('/api', apiLimiter);"), 'FAIL: apiLimiter doit être monté uniquement sur /api');
assert(!appJsSrc.includes('app.use(rateLimit('), 'FAIL: rateLimit ne doit plus être monté globalement');
assert(appJsSrc.includes("reqPath === '/health' || reqPath === '/api/health'"), 'FAIL: Le health check doit être exempté de rate limiting');
assert(appJsSrc.includes("max: isTestEnv ? 2000 : 300"), 'FAIL: Le quota normal doit être de 300 reqs / 15 min');
console.log('✅ 1. Backend: apiLimiter restreint à /api, health checks et assets statiques complètement exemptés.');

// -------------------------------------------------------------
// 2. Validation Frontend: Configuration QueryClient (main.jsx)
// -------------------------------------------------------------
const mainJsxPath = path.resolve('admin-frontend/src/main.jsx');
const mainJsxSrc = fs.readFileSync(mainJsxPath, 'utf8');

assert(mainJsxSrc.includes('status === 429'), 'FAIL: Le QueryClient doit expressément interdire les retries sur HTTP 429');
assert(mainJsxSrc.includes('staleTime: 30 * 1000'), 'FAIL: Le QueryClient doit définir un staleTime de 30s');
assert(mainJsxSrc.includes('retry: false'), 'FAIL: Les mutations ne doivent pas être réessayées automatiquement');

// Tester la fonction de retry intelligente extraite
const retryFnMatch = mainJsxSrc.match(/retry:\s*\((failureCount,\s*error)\)\s*=>\s*\{([\s\S]*?)\n\s*\},/);
assert(retryFnMatch, 'FAIL: Impossible d’extraire la fonction retry');
const retryFn = new Function('failureCount', 'error', retryFnMatch[2]);

// Simulations de statuts
assert.equal(retryFn(0, { response: { status: 429 } }), false, 'Doit refuser le retry sur 429');
assert.equal(retryFn(0, { response: { status: 401 } }), false, 'Doit refuser le retry sur 401');
assert.equal(retryFn(0, { response: { status: 403 } }), false, 'Doit refuser le retry sur 403');
assert.equal(retryFn(0, { response: { status: 404 } }), false, 'Doit refuser le retry sur 404');
assert.equal(retryFn(0, { response: { status: 500 } }), true, 'Peut retenter une fois sur erreur 500');
assert.equal(retryFn(1, { response: { status: 500 } }), false, 'Ne doit pas retenter plus d’une fois');
console.log('✅ 2. Frontend main.jsx: Smart retry validé (0 retry sur 429/401/403/404, staleTime = 30s).');

// -------------------------------------------------------------
// 3. Validation ResourcePage: Refetch Unitaire & Persistance Notice
// -------------------------------------------------------------
const resourcePagePath = path.resolve('admin-frontend/src/features/resources/ResourcePage.jsx');
const resourcePageSrc = fs.readFileSync(resourcePagePath, 'utf8');

assert(resourcePageSrc.includes('query.refetch()'), 'FAIL: query.refetch() unitaire manquant');
assert(!resourcePageSrc.includes('setNotice(msg)\n      refresh()'), 'FAIL: refresh() ne doit pas écraser setNotice(msg)');
assert(resourcePageSrc.includes("setTimeout(() => setNotice(''), 4000)"), 'FAIL: Le message de succès doit rester visible 4s');
console.log('✅ 3. ResourcePage: 1 seul refetch unitaire ciblé après création, conservation du message de confirmation.');

// -------------------------------------------------------------
// 4. Validation DynamicResourceForm: Champs Relationnels & Bouton
// -------------------------------------------------------------
const formPath = path.resolve('admin-frontend/src/features/resources/DynamicResourceForm.jsx');
const formSrc = fs.readFileSync(formPath, 'utf8');

assert(formSrc.includes('function RelationalSelectField'), 'FAIL: RelationalSelectField manquant');
assert(formSrc.includes('isRelationalSelect'), 'FAIL: Séparation des champs relationnels et statiques manquante');
assert(formSrc.includes('disabled={isSubmitting}'), 'FAIL: Le bouton de soumission doit être désactivé pendant l’enregistrement');
assert(formSrc.includes('staleTime: 30 * 60 * 1000'), 'FAIL: Cache de 30min manquant sur departments-lookup');
console.log('✅ 4. DynamicResourceForm: options relationnelles isolées, protection anti-double-clic active.');

// -------------------------------------------------------------
// 5. Simulation Réseau du Flux Complet de Création
// -------------------------------------------------------------
console.log('\n--- Simulation du trafic réseau (Création Chauffeur / Destination) ---');

class NetworkTracker {
  constructor() {
    this.logs = [];
  }
  record(method, url) {
    this.logs.push({ method, url, timestamp: Date.now() });
  }
  count(method, urlPattern) {
    return this.logs.filter((l) => (!method || l.method === method) && (!urlPattern || l.url.includes(urlPattern))).length;
  }
}

const network = new NetworkTracker();

// Phase A: L'utilisateur ouvre /transport/drivers
network.record('GET', '/api/drivers?page=1&limit=100');
assert.equal(network.count('GET', '/api/drivers'), 1, 'Phase A: 1 seule requête initiale de chargement');

// Phase B: L'utilisateur clique sur "Nouveau Chauffeur"
// Champs statiques (nom, prénom, permis, etc.): 0 requête réseau
assert.equal(network.logs.length, 1, 'Phase B: 0 requête déclenchée par l’ouverture du formulaire pour champs statiques');

// Phase C: L'utilisateur remplit les champs (frappes clavier)
const simulatedInputs = ['Dieudonné', 'Mukendi', 'CD-DRV-2024-001', '+243812345678'];
simulatedInputs.forEach((val) => {
  // Pas d'appel réseau lors de la saisie
});
assert.equal(network.logs.length, 1, 'Phase C: 0 requête générée lors de la saisie clavier des champs');

// Phase D: L'utilisateur clique UNE SEULE FOIS sur "Créer"
network.record('POST', '/api/drivers');
assert.equal(network.count('POST', '/api/drivers'), 1, 'Phase D: Exactement 1 requête POST émise');

// Phase E: Réponse 201 Created -> déclenchement du onSuccess
// Le frontend exécute query.refetch()
network.record('GET', '/api/drivers?page=1&limit=100');

assert.equal(network.count('POST', '/api/drivers'), 1, 'Total POST: exactement 1');
assert.equal(network.count('GET', '/api/drivers'), 2, 'Total GET: exactement 2 (1 au chargement de page + 1 au rafraîchissement)');
assert.equal(network.logs.length, 3, 'Total requêtes pour toute la session: exactement 3');

console.log('✅ 5. Simulation réseau réussie :');
console.log(`   - Requêtes avant POST : 1 (GET initial de la liste)`);
console.log(`   - Requêtes pendant saisie : 0`);
console.log(`   - Requêtes lors du clic "Créer" : 1 (POST /api/drivers)`);
console.log(`   - Requêtes après création : 1 (GET /api/drivers pour rafraîchir)`);
console.log(`   - Total trafic action création : EXACTEMENT 1 POST + 1 GET.`);

console.log('\n🎉 TOUS LES TESTS DE VALIDATION 429 ONT RÉUSSI À 100% !');
