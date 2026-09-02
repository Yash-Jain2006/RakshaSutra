# Raksha Sutra project documentation

## 1. What this repository contains

Raksha Sutra is a React/Vite personal-safety pilot focused on Bengaluru. It provides a mobile-first UI with a desktop preview shell, while Supabase supplies the production-oriented data model, access controls, and three Edge Functions.

The application has a deliberate split between two modes:

| Mode | Trigger | Behaviour |
| --- | --- | --- |
| Demo | No `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` | Uses local seeded contacts, reports, places, and UI-only status feedback. |
| Connected | Both browser-safe Supabase values are set | Requires authentication, reads contacts from Supabase, creates SOS events, and queues delivery records through Edge Functions. |

The connected implementation still only **queues** SOS deliveries. It does not yet call an SMS, email, push, police, or emergency-services provider. The UI surfaces this as pilot/offline messaging, and `tel:112` remains available during SOS.

## 2. Technology and layout

```text
React 19 + TypeScript + Vite
        │
        ├── src/App.tsx       Application state and page orchestration
        ├── src/components/   Screen-level UI and reusable presentational pieces
        ├── src/services/     Auth and safety data access
        └── src/lib/          Supabase client configuration
                 │
                 ▼
       Supabase Auth, Postgres, Storage, Edge Functions
```

The app is a single React tree rather than a router-based application. `src/App.tsx` owns the active page, local UI state, device-location acquisition, SOS lifecycle, auth state, toast feedback, and modal visibility. Components receive callbacks such as `nav`, `notify`, `sendSOS`, and contact mutations as props.

### Key files

| Area | Code | Responsibility |
| --- | --- | --- |
| Bootstrap | `src/main.tsx` | Mounts React and imports the global stylesheet. |
| Orchestrator | `src/App.tsx` | Onboarding/auth gating, screen selection, local/demo state, SOS and journey coordination. |
| Styling | `src/styles.css` | Global design system and every responsive screen style; the reference welcome rules are at the end of the file. |
| Data fixtures | `src/data.ts` | Seeded safe places, Rakshaks, contacts, and community reports for demo mode. |
| Domain types | `src/types/` | TypeScript interfaces and finite status/role unions. |
| Services | `src/services/` | Supabase auth and safety operations. |
| Backend | `supabase/` | Schema migrations and Deno Edge Functions. |

## 3. User flows and implemented screens

### Entry and authentication

`WelcomeScreen` uses the supplied light lavender safety artwork as its visual source of truth, with transparent, accessible interaction zones aligned to the two CTAs:

1. **Get Started** sets onboarding complete and opens the sign-in/sign-up screen when Supabase is configured.
2. **Become a Rakshak** sets the intended page to `rakshak`, then uses the same sign-in gate. After a successful sign-in, the Rakshak screen is shown.

`AuthScreen` supports email/password sign-in, email/password sign-up (including name, age, and phone metadata), and Google OAuth. `authService.ts` subscribes to authentication changes and persists sessions via the Supabase client.

### Safety and support

| Screen/feature | Current implementation |
| --- | --- |
| Home | Greeting, journey state, SOS hold interaction, location sharing, shortcut tiles, contacts preview, and fake-call entry point. |
| SOS | A three-second press-and-hold starts SOS; the overlay includes a timer, a direct `112` link, delivery status, pilot/offline notice, and an intentional cancellation confirmation. |
| Location | Uses `navigator.geolocation` with high accuracy and a seven-second timeout. On failure/unavailability, it uses a clearly notified Bengaluru fallback coordinate. |
| Journey mode | Lets the user pick a destination and local contact viewers; pause, resume, and arrival currently update UI state and show a toast. It does not yet persist a journey or location points. |
| Emergency contacts | Validates that at least email or international phone is supplied. Connected mode creates contacts through an Edge Function and waits for recipient confirmation. |
| Fake call | Provides synthetic ringing through the Web Audio API, optional vibration, accept/decline UI, and connected-call duration. |
| Support | Links directly to 112, 181, and 1091 with concise safety tips. |

### Discovery, community, and helpers

| Screen/feature | Current implementation |
| --- | --- |
| Safe places/map | A static, client-side illustrated map, searchable seeded safe places, category filters, a heatmap visual toggle, and route guidance copy. |
| Community | Seeded feed and area ratings; users can compose a local report in memory and read guidelines. Uploading a photo is visual only. |
| Rakshaks | Displays seeded helpers, provides a complaint form, and opens a document-based application flow. Application records/documents are saved only when a configured signed-in user is available. |
| Settings | Local dark-mode, language, notification, recording toggles, navigation links, and sign-out where Supabase is active. |
| Admin | UI-only overview plus in-memory Rakshak applications and mock SOS audit-log filtering. Other tabs are explicit Phase 2 placeholders. |

## 4. SOS lifecycle

```text
3-second hold / immediate-danger action
        │
        ▼
Browser geolocation ── failure ──► Bengaluru fallback coordinate
        │
        ▼
Demo: local active overlay          Connected: insert `sos_events`
                                              │
                                              ▼
                                  call `dispatch-sos` Edge Function
                                              │
                                              ▼
                       find confirmed contacts + up to 6 nearby Rakshaks
                                              │
                                              ▼
                         insert auditable `sos_event_deliveries` as `queued`
                                              │
                                              ▼
                   Cancel/Safe: update event terminal status and timestamp
```

`dispatch-sos` validates the caller and event ownership using the caller client before using a server-only client to gather recipients. It intentionally does not mark deliveries as sent until a real provider acknowledgement exists. Nearby Rakshak discovery uses the `find_nearby_rakshaks` SQL function with a 2.5 km default radius and a maximum of six results.

The second migration adds `accept_sos_event(event_id, rakshak_id)`. The RPC authorizes the caller, checks the Rakshak is verified and available, then uses an atomic conditional PostgreSQL `UPDATE` so only one responder can claim a live event.

## 5. Backend design

### Database groups

| Domain | Primary tables |
| --- | --- |
| Identity and permission | `profiles`, `notification_devices`, `admin_audit_logs` |
| Contacts and journeys | `emergency_contacts`, `journeys`, `journey_viewers`, `journey_location_points` |
| SOS | `sos_events`, `sos_event_updates`, `sos_event_deliveries` |
| Rakshak trust | `rakshak_profiles`, `rakshak_applications`, `rakshak_documents`, `rakshak_complaints` |
| Map/community | `safe_places`, `safety_zones`, `area_ratings`, `incident_reports`, `incident_media`, `moderation_actions` |
| Content/support | `advertisements`, `supports` |

The core migration enables RLS on every application table. Most policies use owner access, with explicit admin access where needed. It also adds restrictive policies requiring an active account. Storage policies limit identity-document and incident-media objects to their owner or an admin.

Sensitive location is retained for 48 hours by default: journey points have `expires_at`, and SOS coordinates have `location_expires_at`. `purge_expired_location_data()` deletes expired journey points and irreversibly blanks expired SOS coordinates; this function still needs a scheduled invocation in the deployment environment.

### Edge Functions

| Function | Endpoint purpose |
| --- | --- |
| `add-emergency-contact` | Authenticates the owner, validates contact data, saves a disabled/pending contact, then sends a confirmation link by Resend email or Twilio SMS. It removes the contact if provider delivery fails. |
| `confirm-emergency-contact` | Accepts a tokenized confirmation link, enables the contact, rotates the token, and returns a small confirmation webpage. It is intentionally public (`verify_jwt = false`) because recipients are not signed in. |
| `dispatch-sos` | Confirms the active SOS belongs to the caller, builds recipient rows, and inserts queued/auditable deliveries. Provider delivery is intentionally left for a future approved integration. |

### Required environment values

Browser values belong in `.env.local` and must never include a service-role or secret key:

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
VITE_APP_URL=http://127.0.0.1:5173
```

Function-only values include `ALLOWED_ORIGIN`, Resend configuration (`RESEND_API_KEY`, `CONFIRMATION_FROM_EMAIL`), Twilio configuration (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`), and a Supabase secret/service key managed by the platform.

## 6. Local development and verification

```powershell
npm install
npm run dev
npm run build
npx vitest run
```

There is one unit test file, `src/__tests__/safety.test.ts`, covering database-contact mapping and the documented SOS soft-flag threshold. `tests/sos_acceptance_concurrency.mjs` is an integration-style script that needs an isolated Supabase instance and a service-role key; it creates and removes its own test identities/data.

Current verification performed for this revision:

- `npm run build` completes successfully.
- `npx vitest run` passes 3 tests.
- Browser checks at 360 × 844 confirm the welcome page renders, Get Started opens authentication, and Become a Rakshak enters the protected auth gate.

## 7. Delivery caveats and next actions

This is safety-sensitive software; the following are not optional before a public launch:

1. Integrate and test real SMS/email/push providers with provider acknowledgements, delivery retry handling, monitoring, and a separately designed offline emergency strategy.
2. Persist Journey Mode, contact-selection state, and location updates; add recipient-safe access to tracking links.
3. Replace seeded map, Rakshak, community, and admin screen data with RLS-protected database queries and audit-backed moderation actions.
4. Add a real administrator authorization entry path; the current Admin navigation is a UI demo and must not be treated as a privileged control surface.
5. Schedule `purge_expired_location_data()`, define retention/deletion for identity files, and complete legal review for consent, age, emergency wording, and volunteer scope.
6. Test the emergency UX on physical Android/iOS devices, including geolocation permission denial, bad connectivity, accessibility, and backgrounding behaviour.

The detailed release checklist is maintained in [LAUNCH_GATES.md](LAUNCH_GATES.md). The product intent and business scope are in [PRD.md](PRD.md); community policy is in [COMMUNITY_GUIDELINES.md](COMMUNITY_GUIDELINES.md).
