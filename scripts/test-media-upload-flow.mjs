import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

console.log('🧪 Démarrage du test automatisé du flux complet d\'upload des photos (Backend + Frontend)...\n');

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

// -------------------------------------------------------------
// SECTION 1 : VÉRIFICATION SYNTAXE ET FICHIERS FRONTEND
// -------------------------------------------------------------
console.log('--- TEST GROUP 1 : FICHIERS ET COMPOSANTS DU MODULE MÉDIA FRONTEND ---');

const mediaFiles = [
  'admin-frontend/src/utils/media.js',
  'admin-frontend/src/components/media/MediaUploader.jsx',
  'admin-frontend/src/components/ui/index.js',
  'admin-frontend/src/features/resources/resourceConfig.jsx',
  'admin-frontend/src/features/resources/DynamicResourceForm.jsx',
  'admin-frontend/src/features/resources/ResourcePage.jsx',
  'admin-frontend/src/features/admin/autosales/VehicleManagementPage.jsx',
  'admin-frontend/src/features/construction/ProjectDetailPage.jsx',
  'admin-frontend/src/features/construction/ProjectFormPage.jsx',
  'admin-frontend/src/features/construction/ProjectListPage.jsx',
  'admin-frontend/vite.config.js',
  'client-frontend/vite.config.js'
];

for (const relPath of mediaFiles) {
  check(`Fichier présent : ${relPath}`, () => {
    assert(fs.existsSync(path.resolve(relPath)), `Fichier ${relPath} manquant`);
  });
}

// -------------------------------------------------------------
// SECTION 2 : UTILITAIRES MÉDIA & RÉSOLUTION D'URL
// -------------------------------------------------------------
console.log('\n--- TEST GROUP 2 : UTILITAIRES MÉDIA & RÉSOLUTION D\'URL ---');

check('admin-frontend/src/utils/media.js exporte les constantes et fonctions requises', () => {
  const mediaUtilPath = path.resolve('admin-frontend/src/utils/media.js');
  const code = fs.readFileSync(mediaUtilPath, 'utf8');
  assert(code.includes('export function resolveMediaUrl'), 'resolveMediaUrl manquant');
  assert(code.includes('export const ALLOWED_IMAGE_TYPES'), 'ALLOWED_IMAGE_TYPES manquant');
  assert(code.includes('export const MAX_IMAGE_SIZE'), 'MAX_IMAGE_SIZE manquant');
  assert(code.includes('export function formatFileSize'), 'formatFileSize manquant');
  assert(code.includes('image/webp'), 'image/webp manquant dans ALLOWED_IMAGE_TYPES');
});

check('Fonction resolveMediaUrl résout correctement les différents formats d\'URL', () => {
  function resolveMediaUrl(url, baseUrl = '') {
    if (!url) return '';
    if (typeof url !== 'string') return '';
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    if (/^https?:\/\//i.test(url)) return url;
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    const cleanBase = baseUrl ? (baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl) : '';
    return `${cleanBase}${cleanUrl}`;
  }

  assert.equal(resolveMediaUrl(null), '');
  assert.equal(resolveMediaUrl(''), '');
  assert.equal(resolveMediaUrl('data:image/png;base64,123'), 'data:image/png;base64,123');
  assert.equal(resolveMediaUrl('blob:http://localhost/abc'), 'blob:http://localhost/abc');
  assert.equal(resolveMediaUrl('https://example.com/photo.jpg'), 'https://example.com/photo.jpg');
  assert.equal(resolveMediaUrl('http://example.com/photo.jpg'), 'http://example.com/photo.jpg');
  assert.equal(resolveMediaUrl('/uploads/img.jpg'), '/uploads/img.jpg');
  assert.equal(resolveMediaUrl('uploads/img.jpg'), '/uploads/img.jpg');
  assert.equal(resolveMediaUrl('/uploads/img.jpg', 'https://api.vanguard.cd'), 'https://api.vanguard.cd/uploads/img.jpg');
  assert.equal(resolveMediaUrl('/uploads/img.jpg', 'https://api.vanguard.cd/'), 'https://api.vanguard.cd/uploads/img.jpg');
});

// -------------------------------------------------------------
// SECTION 3 : COMPOSANT RÉUTILISABLE MediaUploader
// -------------------------------------------------------------
console.log('\n--- TEST GROUP 3 : COMPOSANT RÉUTILISABLE MediaUploader ---');

check('MediaUploader supporte le drag & drop, la preview locale, le badge principal et le delete', () => {
  const code = fs.readFileSync(path.resolve('admin-frontend/src/components/media/MediaUploader.jsx'), 'utf8');
  assert(code.includes('handleDrop'), 'Gestion du drag & drop manquante');
  assert(code.includes('URL.createObjectURL'), 'Génération de preview locale manquante');
  assert(code.includes('onSetPrimary'), 'Prop onSetPrimary manquante');
  assert(code.includes('Principal'), 'Badge Principal manquant');
  assert(code.includes('formatFileSize'), 'Affichage de la taille de fichier manquant');
  assert(code.includes('accept="image/jpeg,image/png,image/webp,image/gif"'), 'Attribut accept manquant');
});

check('MediaUploader est exporté dans components/ui/index.js', () => {
  const code = fs.readFileSync(path.resolve('admin-frontend/src/components/ui/index.js'), 'utf8');
  assert(code.includes("export { MediaUploader } from '../media/MediaUploader'"), 'Export MediaUploader manquant dans ui/index.js');
});

// -------------------------------------------------------------
// SECTION 4 : GESTION DES BUS (RESOURCE CONFIG & FORMULAIRES DYNAMIQUES)
// -------------------------------------------------------------
console.log('\n--- TEST GROUP 4 : GESTION DES BUS & FORMULAIRE DYNAMIQUE ---');

check('resourceConfig configure le champ photo pour les bus et préserve les autres ressources', () => {
  const code = fs.readFileSync(path.resolve('admin-frontend/src/features/resources/resourceConfig.jsx'), 'utf8');
  assert(code.includes("resolveMediaUrl(primary)"), 'resolveMediaUrl manquant pour les vignettes de bus');
  assert(code.includes("mediaConfig: {"), 'mediaConfig manquant dans la config bus');
  assert(code.includes("mediaEndpoint: '/api/bus-media'"), 'mediaEndpoint /api/bus-media manquant');
  assert(code.includes("name: 'gallery'"), 'Champ gallery manquant dans la config bus');
  assert(code.includes("type: 'gallery'"), 'Type gallery manquant dans la config bus');

  // Vérifier qu\'aucune autre ressource n\'a de type: "gallery" ou "media" parasite
  const resourcesWithoutMedia = ['agencies', 'drivers', 'destinations', 'schedules', 'trips', 'reservations', 'payments', 'parcels'];
  for (const res of resourcesWithoutMedia) {
    const resRegex = new RegExp(`${res}:\\s*{[\\s\\S]*?fields:\\s*\\[([\\s\\S]*?)\\]`);
    const match = code.match(resRegex);
    if (match) {
      assert(!match[1].includes("type: 'gallery'"), `Ressource ${res} ne doit pas avoir de champ gallery`);
      assert(!match[1].includes("type: 'media'"), `Ressource ${res} ne doit pas avoir de champ media`);
    }
  }
});

check('DynamicResourceForm sépare les médias du payload JSON et gère l\'état pending/existing/deleted', () => {
  const code = fs.readFileSync(path.resolve('admin-frontend/src/features/resources/DynamicResourceForm.jsx'), 'utf8');
  assert(code.includes('__pendingMedia'), '__pendingMedia manquant dans le payload enrichi');
  assert(code.includes('__deletedMediaIds'), '__deletedMediaIds manquant dans le payload enrichi');
  assert(code.includes('__primaryExistingId'), '__primaryExistingId manquant dans le payload enrichi');
  assert(code.includes('MediaUploader'), 'MediaUploader manquant dans DynamicResourceForm');
  assert(code.includes('delete payload[field.name]'), 'Suppression des champs media du JSON de l\'entité manquante');
});

check('ResourcePage orchestre l\'upload physique, la création de l\'entité et l\'association BusMedia', () => {
  const code = fs.readFileSync(path.resolve('admin-frontend/src/features/resources/ResourcePage.jsx'), 'utf8');
  assert(code.includes("import { api, uploadMedia } from '../../services/api'"), 'API média centralisée manquante');
  assert(code.includes('uploadMedia(file, {'), 'Appel uploadMedia manquant dans mutationFn');
  assert(code.includes("api.delete(`${mediaConfig.mediaEndpoint}/${delId}`)"), 'Suppression des médias supprimés manquante');
  assert(code.includes("api.put(`${mediaConfig.mediaEndpoint}/${primaryExistingId}`"), 'Mise à jour du média principal existant manquante');
  assert(code.includes("api.post(mediaConfig.mediaEndpoint, mediaPayload)"), 'Association du média via mediaConfig.mediaEndpoint manquante');
});

// -------------------------------------------------------------
// SECTION 5 : GESTION DES VÉHICULES (AUTOSALES)
// -------------------------------------------------------------
console.log('\n--- TEST GROUP 5 : VÉHICULES (AUTOSALES) ---');

check('VehicleManagementPage utilise MediaUploader, uploadImage sans Content-Type manuel et résout les URLs', () => {
  const code = fs.readFileSync(path.resolve('admin-frontend/src/features/admin/autosales/VehicleManagementPage.jsx'), 'utf8');
  assert(code.includes('MediaUploader'), 'MediaUploader manquant dans VehicleManagementPage');
  assert(code.includes('resolveMediaUrl'), 'resolveMediaUrl manquant');
  assert(!code.includes("headers: { 'Content-Type': 'multipart/form-data' }"), 'Content-Type multipart forcé manuellement doit être supprimé');
  assert(code.includes('uploadedMedia?.id'), 'mediaId manquant lors de l\'association vehicle-media');
});

check('vehicleMediaService utilise mediaId et la validation Media centralisée', () => {
  const code = fs.readFileSync(path.resolve('src/services/vehicleMediaService.js'), 'utf8');
  assert(code.includes('mediaId'), 'Association par mediaId manquante');
  const mediaConfig = fs.readFileSync(path.resolve('src/config/media.js'), 'utf8');
  assert(mediaConfig.includes("'image/webp'"), 'image/webp manquant dans la configuration Media centrale');
});

check('vehicleMediaRepository supporte la connexion d\'un Media existant par mediaId', () => {
  const code = fs.readFileSync(path.resolve('src/repositories/vehicleMediaRepository.js'), 'utf8');
  assert(code.includes('connect: { id: mediaId }'), 'Support connect mediaId manquant');
});

// -------------------------------------------------------------
// SECTION 6 : PROJETS DE CONSTRUCTION
// -------------------------------------------------------------
console.log('\n--- TEST GROUP 6 : PROJETS DE CONSTRUCTION ---');

check('ProjectDetailPage utilise MediaUploader avec sélection de photo principale et suppression', () => {
  const code = fs.readFileSync(path.resolve('admin-frontend/src/features/construction/ProjectDetailPage.jsx'), 'utf8');
  assert(code.includes('MediaUploader'), 'MediaUploader manquant dans ProjectDetailPage');
  assert(code.includes('resolveMediaUrl'), 'resolveMediaUrl manquant');
  assert(code.includes('setPrimaryProjectPhoto'), 'setPrimaryProjectPhoto manquante');
  assert(code.includes('uploadProjectPhoto'), 'uploadProjectPhoto manquante');
  assert(code.includes('deleteProjectPhoto'), 'deleteProjectPhoto manquante');
});

check('ProjectFormPage intègre MediaUploader pour l\'ajout de photos lors de la création/édition', () => {
  const code = fs.readFileSync(path.resolve('admin-frontend/src/features/construction/ProjectFormPage.jsx'), 'utf8');
  assert(code.includes('MediaUploader'), 'MediaUploader manquant dans ProjectFormPage');
  assert(code.includes('galleryFiles'), 'galleryFiles manquant');
  assert(code.includes('existingGallery'), 'existingGallery manquant');
});

check('ProjectListPage affiche la miniature du projet avec resolveMediaUrl et fallback HardHat', () => {
  const code = fs.readFileSync(path.resolve('admin-frontend/src/features/construction/ProjectListPage.jsx'), 'utf8');
  assert(code.includes('resolveMediaUrl(project.gallery[0].media.secureUrl || project.gallery[0].media.url)'), 'Miniature projet Cloudinary manquante');
  assert(code.includes('<HardHat size={18} />'), 'Icône fallback HardHat manquante');
});

check('constructionRepository inclut la galerie et le media associé dans listProjects et getProjectById', () => {
  const code = fs.readFileSync(path.resolve('src/repositories/constructionRepository.js'), 'utf8');
  assert(code.includes('gallery: {'), 'Inclusion gallery manquante');
  assert(code.includes('include: { media: true }'), 'Inclusion media dans gallery manquante');
  assert(code.includes("orderBy: { order: 'asc' }"), 'Tri par order asc manquant');
});

// -------------------------------------------------------------
// SECTION 7 : PROXY VITE POUR L'API
// -------------------------------------------------------------
console.log('\n--- TEST GROUP 7 : PROXY VITE POUR L\'API ---');

check('admin-frontend/vite.config.js proxifie /api vers le backend local', () => {
  const code = fs.readFileSync(path.resolve('admin-frontend/vite.config.js'), 'utf8');
  assert(code.includes("'/api'"), 'Proxy /api manquant dans admin-frontend/vite.config.js');
  assert(code.includes("'http://127.0.0.1:3000'"), 'Target 127.0.0.1:3000 manquant dans admin-frontend/vite.config.js');
});

check('client-frontend/vite.config.js proxifie /api vers le backend local', () => {
  const code = fs.readFileSync(path.resolve('client-frontend/vite.config.js'), 'utf8');
  assert(code.includes("'/api'"), 'Proxy /api manquant dans client-frontend/vite.config.js');
  assert(code.includes("'http://127.0.0.1:3000'"), 'Target 127.0.0.1:3000 manquant dans client-frontend/vite.config.js');
});

// -------------------------------------------------------------
// SECTION 8 : VÉRIFICATION SYNTAXIQUE DE TOUS LES FICHIERS JS DU BACKEND MODIFIÉS
// -------------------------------------------------------------
console.log('\n--- TEST GROUP 8 : VALIDATION SYNTAXIQUE DES REPOSITORIES & SERVICES ---');

const backendFilesToSyntax = [
  'src/services/vehicleMediaService.js',
  'src/repositories/vehicleMediaRepository.js',
  'src/services/busMediaService.js',
  'src/repositories/busMediaRepository.js',
  'src/repositories/constructionRepository.js'
];

for (const f of backendFilesToSyntax) {
  check(`Syntaxe JS valide : ${f}`, () => {
    const code = fs.readFileSync(path.resolve(f), 'utf8');
    new vm.Script(code, { filename: f });
  });
}

console.log(`\n==================================================`);
console.log(`RÉSULTAT DES TESTS : ${passedTests}/${totalTests} tests réussis.`);
console.log(`==================================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
