# Musiki API

Fastify + Prisma + PostgreSQL backend. Includes email/password authentication, JWT sessions, published music catalogue, personal playlists, server-authorized offline download URLs, and Pesapal subscription checkout/IPN verification.

## Run locally
1. Copy `.env.example` to `.env` and set DATABASE_URL and a random JWT_SECRET (32+ chars).
2. Install dependencies: `npm install`
3. Generate Prisma client: `npm run prisma:generate`
4. Apply schema: `npm run prisma:migrate:dev -- --name init`
5. Start: `npm run dev`

## API
- POST /v1/auth/register { email, password, displayName }
- POST /v1/auth/login { email, password }
- GET /v1/auth/me (Bearer token)
- GET /v1/catalog?q=&limit=&cursor=
- GET /v1/playlists (Bearer token)
- POST /v1/playlists { name } (Bearer token)
- POST /v1/playlists/:id/tracks { trackId } (Bearer token)
- POST /v1/downloads/authorize { trackId } (Bearer token; returns 5-minute signed object URL)
- POST /v1/payments/pesapal { plan: "PREMIUM", phoneNumber } (Bearer token)
- GET /v1/payments/pesapal/status/:reference (Bearer token)
- GET /v1/payments/pesapal/ipn?OrderTrackingId=...&OrderMerchantReference=... (Pesapal IPN)

## Production setup
- Provision PostgreSQL and object storage (S3-compatible, e.g. Cloudflare R2); upload licensed audio under each Track.audioKey.
- Configure Pesapal merchant credentials, register the IPN URL in Pesapal, set PESAPAL_IPN_ID and callback URL. Use live credentials only after testing the sandbox flow.
- Deploy API as a persistent Node/Fastify service or a supported container/server runtime. Configure WEB_ORIGIN, secrets, TLS, backups, monitoring, and rate limits.
- Create ARTIST records and Track records with published=false; publish only after rights/metadata review.
- Never put database, JWT, storage, or Pesapal secrets in the browser.

Pesapal status is queried server-to-server before a user is upgraded; never trust the browser callback as proof of payment. Download authorization checks both Premium plan and track promotional entitlement on every request.

## Important
This is an implementation scaffold, not a deployed production service. Set credentials and run database migrations before use. Legal music rights, artist payouts/royalties, refunds, subscription renewal/cancellation, email verification, password reset, and admin moderation workflows still need product-specific implementation.
