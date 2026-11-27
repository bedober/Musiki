# Musiki web app
React + TypeScript + Vite PWA. Run `npm install && npm run dev`.
The demo catalogue uses sample audio URLs and is not a production licensed music catalogue. Offline save uses IndexedDB and requires CORS-enabled media responses. Production downloads must be served by the Musiki API only after server-side entitlement and rights checks; never trust the demo client-side Free/Premium toggle.
For Vercel, set the project Root Directory to `apps/web`, Framework Preset to Vite, Build Command `npm run build`, Output Directory `dist`.