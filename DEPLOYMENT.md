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

### Cloudinary media storage
- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET

Do not put secrets in VITE_* variables. They are public in the browser.

## Render environment variables

Configure these in Render only; do not commit real values:

- `NODE_ENV=production`
- `DATABASE_URL=<Render PostgreSQL URL>`
- `SUPER_ADMIN_EMAIL=<real Super Admin email>`
- `SUPER_ADMIN_PASSWORD=<strong password>`
- `JWT_SECRET=<strong secret>`
- `SESSION_SECRET=<strong secret>`
- `CORS_ORIGIN=<allowed production origin>`

The Super Admin password is required in production and has no default.

## Build command

```text
npm run render:build
```

## Start command

npm start

## Production / Render

Configure these Render environment variables:

- `DATABASE_URL`: the Render PostgreSQL connection URL
- `SUPER_ADMIN_EMAIL`: the email used to log in to the Super Admin account
- `SUPER_ADMIN_PASSWORD`: a strong secret password, stored only in Render
- `NODE_ENV=production`

Set the Render commands as follows:

**Start Command**

```text
npm start
```

At startup in production, the application connects to PostgreSQL, runs
`npx prisma migrate deploy`, then creates or updates only the configured Super
Admin before opening the HTTP listener. It does not run `prisma/seed.js`, use
`deleteMany()`, or start accepting traffic when migration or bootstrap fails.

Expected startup logs are:

```text
Prisma connected to PostgreSQL successfully.
Database migrations applied.
Super Admin bootstrap completed.
Vanguard Services backend listening on http://localhost:<PORT>
```

## Health check

- Endpoint: /health
- Expected: HTTP 200

## Super Admin

The production bootstrap creates or updates the Super Admin by email.

- Use SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD from the Render environment.
- They are never exposed to the frontend or committed to source control.
- The configured account is made ACTIVE, assigned SUPER_ADMIN and
  VANGUARD_COACH, and receives the existing Super Admin permissions.
- Re-running the bootstrap is idempotent and does not overwrite unrelated
  accounts.

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

The official upload path is `POST /api/upload`: Multer keeps the request in memory,
the backend validates the file, Cloudinary stores the asset, and Prisma stores its
Cloudinary URL, `publicId`, and `resourceType`. No media is persisted on the Render
filesystem.

Render's filesystem remains ephemeral, which is safe for this pipeline because it is
not used as permanent media storage. Configure all three Cloudinary variables above
in Render; do not expose them through `VITE_*` variables.

### Orphan reconciliation

An upload can leave a Cloudinary asset without a `Media` row only if the database
write fails after Cloudinary accepts the file; the upload service attempts an
immediate rollback with `Promise.allSettled`. A successful upload followed by a
failed relation request can also leave a `Media` row without a relation.

Do not run a destructive cron job automatically. Before production, add a protected
manual or dry-run reconciliation command that lists old unreferenced `Media` rows,
checks their `publicId` and `resourceType`, and deletes only explicitly approved
assets after an operator review.

## Notes

- Dev mode remains unchanged.
- No business logic was modified for this deployment preparation.
- The production bootstrap test covers required variables, migration ordering,
  idempotence, password rotation, permissions, and migration failure handling.
