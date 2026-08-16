# Architecture de la plateforme Vanguard Services

## 1. Vue d'ensemble

Vanguard Services est conçu comme une application web monolithique modulaire, avec une séparation claire entre :

- couche de présentation : EJS + CSS premium + composants réutilisables
- couche d'application : Express + contrôleurs + services
- couche de persistance : PostgreSQL + Prisma
- couche de sécurité : sessions, rôles, middleware, validation des entrées

Cette architecture est adaptée à une équipe de développement moyenne, avec plusieurs départements, tout en restant simple à déployer, sécuriser et faire évoluer.

## 2. Choix techniques

### Backend : Node.js + Express

- performant pour les API web et le rendu serveur
- compatible avec Prisma et PostgreSQL
- simple à mettre en œuvre pour un monolithe modulaire
- idéal pour une plateforme interne sécurisée avec logique métier claire

### Frontend : EJS + CSS moderne

- EJS permet de générer des vues serveur rapides et simples
- évite la complexité d’un front-end séparé au démarrage
- bien adapté aux applications internes, administratives et commerciales
- plus facile pour la maintenance dans un contexte multi-services

### Base de données : PostgreSQL

- robuste, mature, très fiable pour les transactions
- adapté à la gestion de réservations, paiements, facturations et audit
- supporte des contraintes, index, transactions et intégrité référentielle

### ORM : Prisma

- réduit le risque d'erreurs SQL
- améliore la maintenabilité et la lisibilité
- facilite la migration des schémas et le développement par équipe
- bien adapté à un environnement de type SaaS interne

### Sécurité

- sessions sécurisées avec `express-session`
- mot de passe hashés avec `bcryptjs`
- `helmet` pour les en-têtes HTTP
- `rate-limiting` pour limiter les attaques de force brute
- rôles et permissions centralisés dans un middleware

## 3. Architecture logique

### 3.1 Couche présentation

- pages d’authentification
- dashboards par département
- modules opérationnels : coach, construction, automobile
- écrans de gestion des réservations, paiements et colis

### 3.2 Couche application

- routeurs par module
- contrôleurs pour traiter les requêtes HTTP
- services pour la logique métier
- middleware pour authentification, autorisation et validation

### 3.3 Couche données

- `Department` : structure les départements de l’entreprise
- `User` : comptes des agents et administrateurs
- `Bus`, `Trip`, `Booking`, `Ticket`, `Payment`, `Parcel`, `Notification` : module Vanguard Coach
- `Vehicle`, `Project`, `Lead` : modules de vente automobile et construction

## 4. Gestion des rôles

### SUPER_ADMIN
- voit tous les départements
- gère les rôles et les permissions
- contrôle les paramètres globaux

### SERVICE_ADMIN
- administre uniquement son service
- valide les actions de son équipe
- consulte les tableaux de bord du département

### AGENT
- exécute les opérations quotidiennes
- enregistre les réservations, paiements et colis
- ne gère pas les paramètres globaux

## 5. Structure des dossiers

```text
vanguard-services/
├── docs/
│   └── architecture.md
├── prisma/
│   └── schema.prisma
├── public/
│   ├── css/
│   │   └── styles.css
│   └── js/
│       └── main.js
├── src/
│   ├── config/
│   │   └── env.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── dashboardController.js
│   │   └── coachController.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── errorHandler.js
│   ├── lib/
│   │   └── prisma.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── coach.js
│   │   ├── dashboard.js
│   │   └── index.js
│   ├── services/
│   │   └── coachService.js
│   ├── utils/
│   │   ├── formatters.js
│   │   └── qr.js
│   ├── app.js
│   └── server.js
├── views/
│   ├── layouts/
│   │   └── main.ejs
│   ├── pages/
│   │   ├── home.ejs
│   │   ├── login.ejs
│   │   ├── dashboard.ejs
│   │   └── coach/
│   │       └── index.ejs
│   └── partials/
│       ├── header.ejs
│       └── footer.ejs
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── server.js
```

## 6. Décisions de conception

### Séparation fonctionnelle par module
Chaque domaine est isolé dans son propre dossier de routes et contrôleurs. Cela permet de développer plusieurs services sans casser le reste de l'application.

### Rôle par service
L'utilisateur est lié à un département. Cela évite qu'un admin d’un service puisse modifier les données d’un autre département.

### Clients sans compte
Les clients n'ont pas d’accès à la plateforme. Les réservations et colis sont enregistrés avec les informations du client, puis validés par un agent.

### Module coach prioritaire
Le domaine Vanguard Coach est le plus complexe et impose les flux de réservation, paiement, validation, billets et colis. C’est pourquoi il est structurally priorisé dans le schéma et les contrôleurs.

### Sécurité implicite
Les utilisateurs internes sont les seuls à accéder à l'application. Les clients ne peuvent pas se connecter, ce qui réduit le risque d'abus et simplifie la gestion d'accès.

### Design premium
La palette grise/blanche donne une image sérieuse, premium et professionnelle, tout en restant sobre et mobile-friendly.

## 7. Cas d’usage principaux

1. Un agent se connecte sur la plateforme
2. Il choisit un département et valide la réservation
3. Un client remplit un formulaire de réservation ou de colis
4. Le paiement est enregistré
5. Le paiement est vérifié manuellement par un agent
6. Un billet ou un reçu est généré avec QR code
7. Une notification est envoyée au client ou à l’équipe interne

## 8. Étapes de mise en œuvre

1. Définir le schéma Prisma
2. Créer les modules Express
3. Implémenter l’authentification et l’autorisation
4. Développer le module coach
5. Mettre en place les écrans de gestion
6. Vérifier les permissions par service
7. Préparer la couche de sécurité et la production
