# Musiki website

Responsive React + TypeScript + Vite Progressive Web App for listeners. This is the public website frontend and can be deployed independently from the API and Android app.

## Run locally
1. `npm install`
2. Copy `.env.example` to `.env` and set `VITE_API_URL` to the deployed API origin (or leave it as localhost for local development).
3. `npm run dev`

## Deploy to Vercel
- Import `bedober/Musiki` from GitHub.
- Set **Root Directory** to `apps/web`.
- Framework: Vite; Build: `npm run build`; Output: `dist`.
- Add environment variable `VITE_API_URL=https://your-api-domain`.
- Deploy and attach your website domain.

## Website features
Music catalogue and search, listener registration/sign-in, streaming via short-lived API URLs, personal playlists, liked tracks in the current browser session, offline downloads in IndexedDB subject to API entitlements, and Pesapal Premium checkout.

The API must allow this website origin in `WEB_ORIGIN`. Configure S3-compatible audio bucket CORS to allow GET/HEAD from the website origin so approved audio downloads can be saved in IndexedDB.

The website does not contain music files or production credentials. It displays published catalogue tracks from the API. Upload only audio for which Musiki has the required streaming and offline rights. The website has not yet been deployed to a public domain.
