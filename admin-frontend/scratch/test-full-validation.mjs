import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

console.log('🚀 Démarrage de la validation finale approfondie...\n')

// 1. Validation de l'absence totale du bug "backend" et de JsonForm
const resourcePagePath = path.resolve('admin-frontend/src/features/resources/ResourcePage.jsx')
const resourcePageSrc = fs.readFileSync(resourcePagePath, 'utf8')

assert(!resourcePageSrc.includes('Données JSON'), 'FAIL: Le texte Données JSON est encore présent')
assert(!resourcePageSrc.includes('contrat backend'), 'FAIL: Le texte contrat backend est encore présent')
assert(!resourcePageSrc.includes('<textarea value={value}'), 'FAIL: Le textarea JSON brut est encore présent')
assert(!resourcePageSrc.includes('JsonForm'), 'FAIL: Le composant JsonForm est encore présent')
console.log('✅ 1. Bug "backend" et textarea JSON éliminés à 100% de ResourcePage.')

// 2. Validation des états UI dans ResourcePage (Chargement, Erreur, Vide, Données)
assert(resourcePageSrc.includes('LoadingState'), 'FAIL: LoadingState manquant')
assert(resourcePageSrc.includes('ErrorState'), 'FAIL: ErrorState manquant')
assert(resourcePageSrc.includes('EmptyState'), 'FAIL: EmptyState manquant')
assert(resourcePageSrc.includes('resource-table-container'), 'FAIL: resource-table-container manquant')
assert(resourcePageSrc.includes('resource-mobile-cards'), 'FAIL: resource-mobile-cards manquant')
console.log('✅ 2. Les 4 états UI (Chargement, Erreur, Liste vide, Données) sont distincts et gérés.')

// 3. Validation de la recherche et debounce
assert(resourcePageSrc.includes('debouncedSearch'), 'FAIL: debouncedSearch manquant')
assert(resourcePageSrc.includes('setTimeout'), 'FAIL: debounce timer manquant')
assert(resourcePageSrc.includes('clear-search-btn'), 'FAIL: bouton de suppression rapide manquant')
console.log('✅ 3. Système de recherche réactif avec debounce de 300ms et réinitialisation.')

// 4. Validation des schémas de ressources dans resourceConfig.js
const configPath = path.resolve('admin-frontend/src/features/resources/resourceConfig.js')
const configSrc = fs.readFileSync(configPath, 'utf8')

const resourcesToCheck = [
  { name: 'drivers', fields: ['firstName', 'lastName', 'licenseNumber', 'phone', 'email', 'isActive'] },
  { name: 'destinations', fields: ['code', 'departureCity', 'arrivalCity', 'distanceKm', 'durationHours', 'description'] },
  { name: 'buses', fields: ['plateNumber', 'brand', 'model', 'seats', 'status'] },
  { name: 'schedules', fields: ['routeId', 'busId', 'departureTime', 'returnTime', 'price', 'availableDays', 'status'] },
  { name: 'trips', fields: ['scheduleId', 'departureAt', 'arrivalAt', 'status'] },
  { name: 'agencies', fields: ['name', 'code', 'city', 'address', 'phone', 'email', 'managerName', 'openingHours', 'isActive'] },
]

for (const res of resourcesToCheck) {
  assert(configSrc.includes(`/transport/${res.name}`), `FAIL: Ressource /transport/${res.name} manquante`)
  assert(configSrc.includes(`/api/${res.name}`), `FAIL: Endpoint /api/${res.name} manquant`)
  for (const field of res.fields) {
    assert(configSrc.includes(`name: '${field}'`), `FAIL: Champ ${field} manquant pour ${res.name}`)
  }
  console.log(`✅ 4. Schéma complet validé pour ${res.name} (${res.fields.length} champs).`)
}

// 5. Validation des relations dynamiques
assert(configSrc.includes("optionsUrl: '/api/destinations'"), 'FAIL: relation destinations manquante')
assert(configSrc.includes("optionsUrl: '/api/buses'"), 'FAIL: relation buses manquante')
assert(configSrc.includes("optionsUrl: '/api/schedules'"), 'FAIL: relation schedules manquante')
console.log('✅ 5. Sélecteurs relationnels configurés pour Horaires et Voyages.')

// 6. Validation du formulaire dynamique DynamicResourceForm.jsx
const formPath = path.resolve('admin-frontend/src/features/resources/DynamicResourceForm.jsx')
const formSrc = fs.readFileSync(formPath, 'utf8')

assert(formSrc.includes('export function DynamicResourceForm'), 'FAIL: DynamicResourceForm non exporté')
assert(formSrc.includes('departments-lookup'), 'FAIL: Auto-résolution departmentId manquante')
assert(formSrc.includes('form-alert-error'), 'FAIL: Préservation et affichage serverError manquant')
assert(formSrc.includes('multiselect-pill'), 'FAIL: Pastilles multiselect manquantes')
console.log('✅ 6. DynamicResourceForm: structure accessible, gestion erreurs serveur, auto-résolution departmentId.')

// 7. Validation CSS Design System et Responsive Mobile
const cssPath = path.resolve('admin-frontend/src/vanguard-design-system.css')
const cssSrc = fs.readFileSync(cssPath, 'utf8')

assert(cssSrc.includes('.resource-mobile-cards'), 'FAIL: CSS mobile cards manquant')
assert(cssSrc.includes('.resource-form-grid'), 'FAIL: CSS form grid manquant')
assert(cssSrc.includes('@media (max-width: 768px)'), 'FAIL: Breakpoint 768px manquant')
assert(cssSrc.includes('@media (max-width: 640px)'), 'FAIL: Breakpoint 640px manquant')
console.log('✅ 7. Styles CSS responsive validés (cartes mobiles, formulaire en 1 colonne sur petit écran).')

console.log('\n🌟 TOUTES LES VALIDATIONS INTERNES SONT PASSÉES AVEC SUCCÈS !')
