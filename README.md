# Vanguard Services

Plateforme web multi-services pour les départements Vanguard Coach, Construction et Vente automobile.

## Stack
- Backend : Node.js + Express
- Frontend : EJS + CSS
- Base de données : PostgreSQL
- ORM : Prisma
- Authentification : sessions sécurisées + rôles

## Installation

1. Copier le fichier `.env.example` vers `.env`.
2. Configurer `DATABASE_URL`.
3. Installer les dépendances :
   `npm install`
4. Générer le client Prisma :
   `npx prisma generate`
5. Lancer les migrations :
   `npx prisma migrate dev --name init`
6. Démarrer l'application :
   `npm run dev`

## Structure projet

- `src/` : application Express
- `views/` : templates EJS
- `public/` : ressources statiques
- `prisma/` : schéma et migrations

## Rôles
- `SUPER_ADMIN`
- `SERVICE_ADMIN`
- `AGENT`

## Départements
- `VANGUARD_COACH`
- `CONSTRUCTION`
- `AUTO_SALES`
