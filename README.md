# Raksha Sutra

Raksha Sutra is a mobile-first personal-safety PWA for Bengaluru. It brings together emergency contacts, SOS creation and delivery queues, journey sharing, safe-place discovery, community reports, local helpers (Rakshaks), and a limited admin console.

> This repository is a pilot/prototype. It does **not** currently send a real SMS, email, push notification, or emergency-service request when SOS is triggered. In a live emergency, call **112** directly.

## Start the app

```powershell
npm install
npm run dev
```

Open the local address Vite prints (normally `http://127.0.0.1:5173`). Without browser-safe Supabase environment variables, the interface works in demo mode with local mock data.

## Configure Supabase

```powershell
Copy-Item .env.example .env.local
```

Set the values in `.env.local`, then restart Vite. Apply the database and deploy functions only after connecting the correct Supabase project:

```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy add-emergency-contact
supabase functions deploy confirm-emergency-contact
supabase functions deploy dispatch-sos
```

See [docs/BACKEND_SETUP.md](docs/BACKEND_SETUP.md) for provider secrets and [docs/PROJECT_DOCUMENTATION.md](docs/PROJECT_DOCUMENTATION.md) for the full architecture and implementation review.

## Verify

```powershell
npm run build
npx vitest run
```

The optional SOS concurrency check needs an isolated Supabase project and a service-role key; its prerequisites are documented in [tests/sos_acceptance_concurrency.mjs](tests/sos_acceptance_concurrency.mjs).

## Important documents

- [Project documentation](docs/PROJECT_DOCUMENTATION.md)
- [Product requirements](docs/PRD.md)
- [Launch gates](docs/LAUNCH_GATES.md)
- [Community reporting guidelines](docs/COMMUNITY_GUIDELINES.md)
