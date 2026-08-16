# Vanguard Services — Client Frontend Premium

## Description
Frontend public premium pour Vanguard Services. Site institutionnel/commercial avec trois activités principales :
- **Vanguard Coach** : Transport de passagers / réservation / billets
- **Vanguard Construction** : Construction / réalisations / demandes de devis
- **Vanguard Automobile** : Vente de véhicules / consultation / demandes

## Architecture
```
client-frontend/
├── package.json
├── vite.config.js
├── index.html
├── public/
│   └── assets/
│       ├── logos/
│       │   ├── vanguard-mark.svg
│       │   └── vanguard-logo.svg
│       ├── hero/
│       │   └── hero-main.svg
│       ├── transport/
│       │   ├── transport-hero.svg
│       │   └── transport-card.svg
│       ├── construction/
│       │   ├── construction-hero.svg
│       │   └── construction-card.svg
│       └── automobile/
│           ├── automobile-hero.svg
│           └── automobile-card.svg
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── api/
│   │   └── client.js
│   ├── i18n/
│   │   ├── LanguageProvider.jsx
│   │   ├── useLanguage.jsx
│   │   └── translations.js
│   ├── hooks/
│   │   ├── useReveal.js
│   │   └── useFetch.js
│   ├── components/
│   │   ├── LanguageSwitcher.jsx
│   │   ├── Navbar.jsx
│   │   ├── Footer.jsx
│   │   ├── SectionHeader.jsx
│   │   ├── StateView.jsx
│   │   └── ...
│   ├── layouts/
│   │   └── PublicLayout.jsx
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── Transport.jsx
│   │   ├── Construction.jsx
│   │   ├── Automobile.jsx
│   │   ├── VehicleDetail.jsx
│   │   ├── Contact.jsx
│   │   ├── Agent.jsx
│   │   └── Ticket.jsx
│   └── styles/
│       ├── design-system.css
│       ├── components.css
│       └── pages.css
└── .env
```

## Configuration
- **VITE_API_URL** : URL de l'API backend (par défaut `http://127.0.0.1:3000`)
- **VITE_AGENT_URL** : URL de l'espace agent (par défaut `http://localhost:5173/login`)

## Pages
- `/` — Page d'accueil premium
- `/transport` — Page transport avec parcours de réservation
- `/construction` — Page construction avec formulaire de devis
- `/automobile` — Page automobile avec vitrine véhicule
- `/automobile/vehicles/:id` — Page détail véhicule
- `/contact` — Page contact
- `/tickets/:ticketCode` — Page billet premium
- `/agent` — Espace agent (redirection vers login interne)

## Build & Dev
```bash
npm install
npm run dev     # Démarrage en mode développement (port 5174)
npm run build   # Build de production
npm run lint    # Lint avec oxlint
npm run preview # Aperçu du build
```

## Internationalisation
- Langues : FR / EN
- Sélecteur dans la navbar
- Toutes les chaînes UI passent par i18n

## Design System
- Couleurs : palette or/blanc/noir avec nuances
- Typographie : Playfair Display (titres) + Inter (corps)
- Espacement, border-radius, shadows cohérents
- Boutons, cartes, badges, formulaires stylisés
- Responsive : desktop, tablet (768px), mobile (390px)

## Endpoints API — Audit des contrats réels

### [EXISTE ET FONCTIONNE]
| Endpoint | Méthode | Description |
|---|---|---|
| `/api/vehicles` | GET | Liste des véhicules disponibles (public) |
| `/api/vehicles/:id` | GET | Détail d'un véhicule (public) |
| `/tickets/:ticketCode` | GET | Détail d'un billet public |

### [BACKEND MANQUANT — documenté, non appelé]
| Endpoint attendu | Méthode | Données nécessaires | Impact frontend |
|---|---|---|---|
| `/api/public/trips?from=&to=&date=` | GET | Route, Schedule, Trip | Recherche de trajets |
| `/api/public/trips/:id/seats` | GET | Sièges disponibles | Choix du siège |
| `/api/public/reservations` | POST | tripId, customerName, customerPhone, customerEmail, seatNumber | Création réservation |
| `/api/public/construction/projects` | GET | Project (status=PUBLISHED) | Réalisations |
| `/api/public/construction/quote-requests` | POST | customerName, customerEmail, customerPhone, projectType, description, budgetRange | Demande de devis |
| `/api/public/vehicle-inquiries` | POST | vehicleId, customerName, customerEmail, customerPhone, inquiryType, contactPreference, message | Demande d'information véhicule |
| `/api/public/website-settings` | GET | WebsiteSetting (companyName, address, phone, email, whatsapp, facebook, twitter, instagram) | Coordonnées du site |

### Règles
- Aucun mock permanent
- Aucun faux succès
- Les fonctionnalités dépendant d'un endpoint manquant affichent proprement l'état "indisponible"
- Les endpoints seront implémentés dans une phase ultérieure