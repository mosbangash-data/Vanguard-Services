# Vanguard Services — Render deployment guide

## Architecture

This project is prepared for a single Render Web Service + one PostgreSQL database.

- Web Service: serves the Express API and both Vite frontends
- Public frontend: client-frontend/dist at the root path
- Admin frontend: admin-frontend/dist under /admin
- API: /api and /health remain on the backend
- Database: PostgreSQL Render instance via DATABASE_URL

This avoids paying for separate backend, client, and admin services when a single Express instance can serve everything.

## Recommended Render layout

- 1 Web Service
- 1 PostgreSQL database

## Required environment variables

Set these in Render as Environment Variables.

### Backend
- PORT
- NODE_ENV
- DATABASE_URL
- JWT_SECRET
- SESSION_SECRET
- JWT_EXPIRES_IN
- APP_NAME
- CORS_ORIGIN
- SUPER_ADMIN_EMAIL
- SUPER_ADMIN_PASSWORD

### Public frontend build
- VITE_API_URL
- VITE_ADMIN_URL

### Admin frontend build
- VITE_API_URL
- VITE_ADMIN_URL

Do not put secrets in VITE_* variables. They are public in the browser.

## Build command

npm install
npm run prisma:generate
npm run build

## Start command

npx prisma migrate deploy && node src/server.js

## Health check

- Endpoint: /health
- Expected: HTTP 200

## Super Admin

The application seeds the Super Admin only if the account does not already exist.

- Use SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD from the Render environment.
- They are never exposed to the frontend or committed to source control.
- The seeded user is created/updated without overwriting unrelated accounts.

## CORS

The backend accepts a comma-separated CORS_ORIGIN list. For production, provide the exact production domain, for example:

https://your-domain.onrender.com

Keep localhost origins only for local development.

## Prisma / PostgreSQL

- Use the Render PostgreSQL connection string in DATABASE_URL.
- Prisma migrations must be run with:
  - npx prisma migrate deploy
- Prisma client should be generated during the build stage:
  - npx prisma generate

## Static frontends

The Express server serves the generated static files in production:

- / -> client-frontend/dist
- /admin -> admin-frontend/dist
- /api/* -> API routes
- /health -> health endpoint

This keeps direct refreshes on public routes working as long as they are matched by the SPA fallback.

## Uploads / media

The current project stores or references uploaded files via the application filesystem and existing media routes. Render's filesystem is ephemeral for typical web services, so production should not rely on local disk permanence.

Current state at code level:
- there are upload/media endpoints but no persistent cloud storage layer is configured yet
- local storage should not be considered durable on Render for production uploads

Required next step before full production use:
- move uploaded files to a durable external storage such as Render Disk (if supported by setup) or S3-compatible storage
- update media URLs to reference the external provider
- keep local fallback only for development

## Notes

- Dev mode remains unchanged.
- No business logic was modified for this deployment preparation.
- No functional test suite was re-run beyond the minimal syntax- and config-level checks needed for production prep.
