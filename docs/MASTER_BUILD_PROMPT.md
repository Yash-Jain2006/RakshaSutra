# Raksha Sutra — Optimized Product Build Prompt

Copy the prompt below into an AI coding environment when you want it to build the production-ready application. It is deliberately explicit about safety boundaries and platform constraints.

```text
You are a principal mobile engineer, full-stack architect, product designer, accessibility specialist, and security-minded product manager. Build Raksha Sutra, an India-first personal-safety platform for all people, with a primary focus on women. It must feel calm, premium, and reassuring—not alarmist. The core user promise is: “Your safety. Your power.”

IMPORTANT EXECUTION RULES
- Start by inspecting the repository. Preserve existing work and conventions.
- Before coding, produce a concise implementation plan, architecture, data model, and risk register. Then execute it without asking avoidable follow-up questions.
- Build a responsive web app plus a native-capability path. A PWA alone is not acceptable for production background tracking or delivery-critical push notifications. Use React Native with Expo for iOS/Android if native apps do not already exist; share types, API client, business rules, and design tokens with the web app whenever practical.
- Prefer free-tier-friendly services, but never trade security or correctness for free tooling.
- Do not claim that police, emergency services, or a Rakshak have been alerted unless an actual integration/delivery acknowledgement has occurred.
- Do not write fake production integrations. Use clear interfaces, typed mock adapters, feature flags, and visible demo states where credentials or vendors are unavailable.
- Treat precise location, contact details, incident reports, and identity documents as sensitive data. Do not log them in plaintext.

PRODUCT CONTEXT
Raksha Sutra helps users during a commute, evening walk, unfamiliar route, or urgent emergency. It combines protected SOS, live location sharing, Journey Mode, safe places/routes, community-verified safety information, and trained/verified local helpers called Rakshaks. The initial market is Bengaluru, India; design for localisation and expansion.

USERS AND ROLES
1. User: any person; primary audience is women who commute or move independently.
2. Rakshak: identity-verified local helper who can receive/accept nearby emergency alerts. Never position Rakshaks as vigilantes; show response boundaries and safety-first guidance.
3. Admin: manages data, users, reports, Rakshak verification, ads, supports, zones, safe places, and SOS audit logs.

REQUIRED USER EXPERIENCE
Design language: mobile-first, mostly white surfaces, royal purple-to-blue gradient, soft lavender panels, strong near-black typography, red SOS accent, rounded 12–20px cards, generous spacing, high contrast, calm micro-interactions. Use a realistic phone-shaped desktop preview only as a development/demo wrapper; on actual mobile, occupy the full viewport. Use no copyrighted assets.

Screens and functional flows:
1. Onboarding: intro with shield motif, language selection, auth, permission education, and emergency-contact setup.
2. Home: greeting/profile, city and location context, notifications, prominent protected SOS control, Send My Location, Journey Mode status/toggle, Fake Call, safety toolkit, emergency-contact preview, and optional clearly labelled ad carousel.
3. SOS: long-press/countdown activation, high-accuracy location request, labelled last-known/fallback state if unavailable, event creation, secure map link, contact notification, nearby eligible Rakshak matching, delivery/acknowledgement screen, live elapsed timer, audio/video consent entry points, and intentional “I’m Safe Now” cancellation. Record India-localized time.
4. Journey Mode: destination, chosen viewers, live-session status, pause, safe arrival, expiry, and check-in/escalation conditions. Native version must support background tracking only after correct platform permission education and consent.
5. Fake Call: instant local incoming-call experience with configurable caller/timing; no external notification.
6. Map: current position, safe-place markers, All/Police/Hospital/Cafe/Fuel Station filters, place search, heatmap toggle, admin zones (Red unsafe, Orange caution, Green safer) with notes and freshness, community ratings, and an explainable safer-route suggestion. Never promise a route is safe.
7. Community: area rating 1–5, factual comment, report form (location, description, optional image, anonymous toggle), own submission history, and approved community feed.
8. Rakshaks: nearby/list directory showing only coarse area, rating, activity/availability; “Become a Rakshak” application with Aadhaar/PAN/Driving Licence selection and required front/back uploads. Status transitions pending / approved / rejected / inactive must be real.
9. Contacts: add/remove name + relationship, derived initials avatar, explicit notification audience.
10. Supporting screens: account/settings, language, notifications, privacy/data entry point, ratings history, about, toolkit, supports, and helplines.
11. Admin: protected login, then zones, safe places with CSV import validation, ads, users, Rakshaks, reports, SOS logs, supports, and admin settings. Implement server-enforced roles and audit logs.

TECHNICAL ARCHITECTURE
- Monorepo preferred: apps/web (React/Vite PWA), apps/mobile (Expo/React Native), packages/ui, packages/types, packages/api-client, packages/config.
- Use TypeScript, strict mode, ESLint/Prettier, schema validation (Zod), and a clear feature folder structure.
- Backend: Supabase Auth + Postgres + Realtime + Edge Functions for the free-tier-friendly pilot. Use Row Level Security from the beginning. Alternative backend only if repository standards require it.
- Maps: MapLibre + OpenStreetMap-compatible tiles, with a provider abstraction for geocoding/routing. Respect attribution and provider terms.
- Notifications: Expo Notifications / Firebase Cloud Messaging abstraction. Include browser/PWA notification support where possible, but document its background reliability limitations.
- Storage: private buckets. Upload only via signed paths. Government-ID images are reviewer-only, encrypted/retention-controlled, excluded from logs/backups where practical, and never publicly accessible.
- Implement all network/notification/location services behind interfaces so mock mode works without secrets and real providers can be enabled with environment variables.
- Include a .env.example with non-secret variable names only and a setup README.

MINIMUM DATA MODEL
Define migrations/types for: profiles; emergency_contacts; journeys; journey_viewers; location_points (with retention/accuracy); sos_events; sos_event_deliveries; sos_event_updates; rakshak_profiles; rakshak_applications; rakshak_documents; safe_places; safety_zones; area_ratings; incident_reports; incident_media; moderation_actions; advertisements; supports; notification_devices; admin_audit_logs. Include ownership, timestamps, state enums, soft-delete/archival where appropriate, indexes for location/time queries, and RLS policy rationale.

SOS MATCHING AND FAILURE BEHAVIOUR
- Request high-accuracy location with a visible short timeout; do not block SOS forever.
- Use a clear sequence: live position → fresh last known position → labelled configured fallback for demo only.
- Send contacts in parallel. Identify the nearest active, verified, eligible Rakshaks using a configurable radius and concurrency-safe claim/acceptance flow. If none are available, show that explicitly and keep contact flow active.
- Make SOS idempotent for repeated client actions. Persist event and delivery state before presenting success.
- Queue safely when offline, communicate pending delivery, retry on connectivity restoration, and offer the local emergency-call option.
- Cancellation must be intentional, audited, and sent to prior recipients.

SECURITY, PRIVACY, AND SAFETY REQUIREMENTS
- Implement least privilege, RLS, server-side authorization, rate limits, input validation, CSRF/session protections appropriate to the chosen stack, secure headers, private storage, signed URLs, and audit trails.
- Do not expose exact real-time user or Rakshak positions in public directories.
- Community reports are pending/private by default; only approved/redacted reports reach the feed.
- Do not treat user ratings as verified truth. Label source, confidence/freshness, and admin verification distinctly.
- Add visible pilot/demo disclaimers where emergency services are not connected.
- Before a live launch, leave explicit TODO launch gates for legal/privacy: location retention, consent text, contact consent, age policy, government-ID retention, Rakshak terms/training, moderation policy, and emergency-service wording.

ACCESSIBILITY AND QUALITY
- Meet WCAG 2.2 AA: keyboard access on web, labels, focus states, semantic controls, color-independent status, readable text, reduced-motion handling, and screen-reader announcements for SOS state changes.
- Use localisation-ready string catalogs; include English and Hindi example strings. Use Indian date/time formatting.
- Add unit tests for stateful safety logic, schema/RLS-adjacent service tests where possible, and end-to-end tests for: onboarding, contact management, SOS live/fallback/no-Rakshak states, Journey Mode, report submission/moderation, Rakshak application validation, and admin permissions.
- Run lint, typecheck, build, and available tests. Use browser automation to visually inspect core responsive flows. Fix failures before handoff.

DELIVERABLES
1. Working, polished source code and clear mock mode.
2. Database migrations, RLS policy documentation, seeds, and typed models.
3. README with local setup, environment variables, test commands, architecture, and an honest production-readiness checklist.
4. Short PRD and API/event contracts if they are not already present.
5. A final implementation report listing shipped functionality, limitations, test evidence, and exact steps to enable live maps, push, storage, auth, and native background tracking.

Begin now: inspect the repository, state the plan, then implement the highest-value vertical slice first (auth/contact readiness → SOS/location event → recipient/Rakshak delivery state → admin/audit visibility) while maintaining the complete user-facing prototype experience.
```
