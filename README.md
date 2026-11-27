# Musiki

A music streaming platform for web and Android, built around licensed music, artist tools, subscriptions and reliable offline listening.

## Monorepo

- `apps/web` — React + TypeScript progressive web app.
- `apps/api` — Fastify API and Prisma data model.
- `apps/android` — Native Android player (Kotlin + Media3).
- `docs` — architecture, API and release notes.

## Product rules

- Premium subscribers may download tracks whose licences permit offline use.
- Free users may download only tracks explicitly marked as promotional.
- Offline playback uses locally stored, app-managed media. Entitlements are checked online and refreshed when connectivity returns.
- Never upload copyrighted music without distribution rights and artist/label authorization.

## Local development

See each app's README. The web client can run independently in demo mode; production authentication, catalog and payments require the API and configured secrets.

## Status

Initial project scaffold. Production integrations (database, object storage, authentication provider, Pesapal merchant credentials and Android signing) must be configured before release.
