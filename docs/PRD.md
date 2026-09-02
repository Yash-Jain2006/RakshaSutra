# Raksha Sutra — Product Requirements Document

**Product:** Raksha Sutra  
**Version:** 1.0  
**Status:** MVP definition  
**Platform:** Mobile-first PWA now; native iOS/Android companion required for production safety capabilities  
**Primary market:** India, starting with Bengaluru

## 1. Product summary

Raksha Sutra is a personal-safety companion for anyone, with a primary focus on women. It gives a person a fast way to request help, share their live location with trusted contacts, discover safer nearby places and routes, and contribute to a moderated local-safety network. The product is designed for moments of uncertainty as much as explicit emergencies: a late commute, an unfamiliar route, an unsafe interaction, or a need to leave discreetly.

The product has three permissioned experiences:

| Experience | Purpose |
| --- | --- |
| User | Set up trusted contacts, start Journey Mode, request SOS help, find safe places, report local conditions, and optionally apply to help as a Rakshak. |
| Rakshak | A vetted volunteer who can receive nearby SOS alerts, acknowledge availability, and follow a safety-first response protocol. |
| Admin | Moderates reports, safe zones, safe places, users, Rakshak applications, advertisements, supports, and the SOS audit trail. |

## 2. Problem and opportunity

People often cannot safely unlock a phone, decide whom to call, describe where they are, or determine whether help has received their location during an escalating situation. Existing safety tools usually fall into one of two gaps: a generic emergency dialler that lacks trusted-context coordination, or a directory that becomes stale and cannot help in real time.

Raksha Sutra closes that gap by combining an intentional, low-friction emergency workflow with prevention tools and a carefully moderated local network. It should make the right next action obvious in under three seconds and provide an explicit confirmation of what happened after an alert is sent.

### Product principles

1. **Speed over choice in an emergency.** One clearly protected SOS path is always available.
2. **Confirm, do not assume.** Show alert recipients, location state, acknowledgement, and timestamps.
3. **Safety before engagement.** Rakshaks are not positioned as vigilantes; their role and training boundaries are explicit.
4. **Useful with degraded connectivity.** Location, networking, and permission failures need clear fallbacks.
5. **Trust must be earned.** Community data is visibly moderated, attributable or anonymous by user choice, and not treated as ground truth without confidence signals.
6. **Privacy by default.** Exact location is shared only for the chosen duration and audience; retention must be configured before production release.

## 3. Goals and non-goals

### Goals

- Let a user initiate an SOS, share current/live location, and notify trusted recipients quickly.
- Give users an easy Journey Mode that follows an active trip until the user is safe.
- Surface nearby, category-filterable safe places and safety-zone context.
- Build a structured, moderated community signal through ratings and incident reports.
- Create an application and review workflow for verified local Rakshaks.
- Give administrators the operational tools needed to moderate and audit the system.
- Deliver an installable, accessible mobile experience that can evolve into native iOS/Android apps.

### Non-goals for initial launch

- Replacing emergency services, dispatch centres, medical providers, or law enforcement.
- Guaranteeing that a Rakshak, contact, or public service can respond.
- Predicting crime or making safety guarantees from user-generated data.
- Providing unmoderated real-time chat between strangers.
- Publishing exact historic SOS locations or personally identifiable incident details.
- Building nationwide route intelligence before a geographically limited pilot is validated.

## 4. Target users

### Primary persona: independent commuter

**Example:** Ananya, 22–40, travels independently for work, study, family, or errands. She uses a smartphone daily, may commute after dark, and wants reassurance without continuously alarming family or friends.

**Needs:** A single emergency control; selected contacts who immediately receive a map link; a way to share a planned journey; confidence that the map and reports are current; the ability to leave an uncomfortable situation discreetly.

### Secondary persona: trusted circle member

**Example:** Meera, a sister or friend who receives an alert. She needs to understand urgency, locate the person, acknowledge receipt, and access a simple escalation path without installing a complex tool first.

### Secondary persona: verified Rakshak

**Example:** Priya, a locally active adult volunteer. She wants to contribute safely, knows what she can and cannot do, and expects clear identity verification, limited alert radius, privacy controls, and account-status transparency.

### Operational persona: safety administrator

**Example:** A city operations staff member. They need to review submissions, control zone visibility, verify volunteers, resolve abuse, manage content, and investigate SOS delivery issues from an immutable audit record.

## 5. User journeys and stories

### Onboarding and account

- As a new user, I can choose a language before I create an account so the app is comfortable to use.
- As a new user, I can sign up or log in using a low-friction, verified method.
- As a user, I can add or skip emergency contacts during onboarding, but the app clearly explains that SOS delivery is limited until contacts are added.
- As a user, I can grant, defer, or decline location and notification permissions and understand what is reduced when I decline.

### Emergency SOS

- As a user in danger, I can trigger SOS with a protected hold action so accidental taps do not create alerts.
- As a user, I can send my current location even if I am not using Journey Mode.
- As a user, I see which contacts and Rakshaks were alerted, whether a live location is active, and an Indian-localized timestamp.
- As a user, I see a clear state when no nearby verified Rakshak is available; contacts must still be notified.
- As a trusted contact, I can open a secure map link and see whether the user has cancelled the alert or marked themselves safe.
- As a user, I can cancel an SOS only through an intentional confirmation pattern; the system logs the cancellation and informs prior recipients.

### Journey Mode and safer travel

- As a user, I can start Journey Mode by selecting a destination and trusted viewers.
- As a user, I can see that tracking is active, pause it, arrive safely, or have it expire after a configured timeout.
- As a user, I can receive a check-in prompt if I am stationary too long, deviate materially, lose connectivity, or pass the expected arrival time.
- As a user, I can view a route recommendation that explains the safety signals behind it and never implies the route is guaranteed safe.

### Map and safe places

- As a user, I can search nearby safe places and filter police, hospitals, cafés, and fuel stations.
- As a user, I can turn a heatmap on or off and distinguish verified zones from community ratings.
- As a user, I can read the reason and freshness date behind an admin-verified zone.
- As an admin, I can add, edit, archive, and bulk-import safe places and zones with an audit trail.

### Community safety signal

- As a user, I can rate an area from 1–5 and leave a factual comment.
- As a user, I can submit an incident report with a location, description, optional photo, and anonymous-posting choice.
- As a user, I see whether my report is pending, approved, rejected, or flagged.
- As a community member, I only see approved reports that have passed privacy, safety, and abuse checks.
- As an admin, I can approve, reject, flag, redact, or remove a report, preserving moderation metadata.

### Rakshak network

- As a user, I can browse active verified Rakshaks in the local service area without seeing their precise location.
- As an applicant, I can choose Aadhaar, PAN Card, or Driving Licence, submit front and back images, and track a pending, approved, or rejected status.
- As an admin, I can review identification securely, request resubmission, approve/reject, and change a Rakshak to active/inactive.
- As a Rakshak, I can accept, decline, or time out an alert. I can see a minimized information set and safety guidance before responding.

### Account and support

- As a user, I can manage profile, language, notifications, contacts, privacy settings, and personal rating history.
- As a user, I can access regionally relevant support and helpline resources.
- As a user, I can initiate a fake incoming call locally without sending data externally.

## 6. Functional requirements

### 6.1 User MVP

| Capability | MVP acceptance criteria |
| --- | --- |
| Onboarding | Intro, language selection, authentication, permission education, and emergency-contact capture are available. |
| Dashboard | Shows location/city context, persistent SOS, Journey Mode state, fake-call entry, notification entry, contacts, and a safety toolkit. |
| SOS | A long-press protects activation; current or fallback location is resolved; an event is created; contacts are notified; closest eligible Rakshaks are selected; confirmation displays delivery state. |
| Location link | Recipient-safe link contains only the necessary coordinates/session token and opens in Google Maps or selected map app. |
| Journey Mode | Destination, selected viewers, duration, active tracking, safe-arrival, pause/cancel, and escalation triggers are supported. |
| Fake Call | Locally rendered, instant incoming-call UI with configurable caller name/timing; it works without a network connection. |
| Map | Place search, category filters, current position, safe-place markers, heatmap toggle, zone legend, and safer-route explanation are visible. |
| Community | Rating, comment, incident form, mock/real photo selection, anonymous toggle, report history, and approved feed are supported. |
| Rakshaks | Directory, application form, document type, front/back validation, pending confirmation, and status are supported. |
| Contacts | Add, list, avatar initials, relationship, remove, and user confirmation on changes. |
| Settings/support | Profile, preferences, privacy entry point, notifications, ratings history, support resources, and toolkit are available. |

### 6.2 Admin MVP

| Area | MVP acceptance criteria |
| --- | --- |
| Access | Separate protected admin sign-in with enforced role authorization. |
| Zones | Create/edit/archive zones, select Red/Orange/Green, add rationale, show effective date, and record audit actor/time. |
| Safe places | Create/edit/archive places with category, address, contact information, coordinates, and CSV validation/import. |
| Ads | Upload image, title, URL, active state, target placement, schedule, and impression/click telemetry. |
| Users | List/search, inspect safety-relevant account state, and activate/block with reason/audit logging. |
| Rakshaks | Review identity evidence in restricted storage, approve/reject/request resubmission, set active state, and inspect response history. |
| Reports | Search/filter, approve/reject/flag/redact, manage images, preserve a moderation reason, and suppress unsafe content. |
| SOS logs | Filter by date, user, delivery state, location/session reference, Rakshak response, and cancellation; never make raw history broadly downloadable. |
| Supports/settings | Manage support entries and admin profile/security settings. |

## 7. Capability roadmap

| MVP / pilot | Later release |
| --- | --- |
| Responsive PWA with app shell and install prompt | Native iOS/Android apps for reliable background location and platform push |
| Browser geolocation with denied/unavailable fallback | Background geofencing, battery-aware sampling, wearable/lock-screen triggers |
| Trusted-contact notifications and verified Rakshak matching | Contact acknowledgement, escalation ladder, multilingual SMS/voice fallback |
| Curated places, admin zones, weighted community map | Trusted data-provider integrations and explainable route scoring |
| Moderated reports, rating, image upload | Reputation system, duplicate detection, automated abuse triage |
| Manual document review and local Rakshak directory | Training modules, re-verification, coverage scheduling, volunteer safety workflows |
| Admin CRUD and audit log | Operational dashboard, SLA alerting, city-partner integrations, data export controls |

## 8. Key experience and technical decisions

### Location and SOS resolution

1. Request a high-accuracy device location with a short, visible timeout.
2. If granted, store the event position with accuracy and capture time.
3. If denied, timed out, or unavailable, use the last known user-approved position if fresh; otherwise use a clearly labelled configured fallback (for prototype: Bengaluru centre) and show the degraded state.
4. Generate an event-scoped map/session link, not a permanently public coordinate URL for production.
5. Notify every enabled contact in parallel. Query active, verified Rakshaks within a configurable radius and select the nearest eligible group (pilot target: two primary candidates and a broader queued set).
6. Record attempt, delivery, acknowledgement, response, cancellation, and safe-arrival state as append-only events.

### Native-capability requirement

A browser PWA is suitable for the experience, prototype, and foreground location. It cannot be the sole production solution for reliable background tracking, lock-screen actions, or delivery-critical push behavior. The production architecture must include React Native, Flutter, or equivalent native iOS/Android clients with platform-specific background-location permission flows, notification channels, and battery constraints. The PWA can remain a useful fallback and web admin client.

### Free-tier-oriented reference architecture

| Concern | Recommended pilot choice | Production note |
| --- | --- | --- |
| Client | React + Vite PWA; migrate/add React Native with Expo | Share types, design tokens, and API client across mobile/web. |
| Auth/data/realtime | Supabase Auth, Postgres, Realtime, Edge Functions | Enforce Row Level Security; never expose service keys. |
| Push | Expo Notifications / Firebase Cloud Messaging | Native notification permission and delivery receipts required. |
| Maps/geocoding | OpenStreetMap tiles + MapLibre; OpenRouteService for pilot | Validate terms, capacity, attribution, and fallback routing before scale. |
| Media | Supabase Storage private buckets with signed URLs | ID evidence requires encryption, strict retention, and reviewer-only access. |
| Web hosting | Cloudflare Pages, Vercel, or Netlify free tier | Add monitoring, environment separation, and domain controls. |
| Observability | Sentry free tier / platform logs | Redact location and identity data from traces. |

## 9. Success metrics

### North-star metric

**Verified safety-session completion rate:** the percentage of started SOS or Journey sessions that reach a recorded safe, cancelled, or successfully handed-off terminal state with recipients informed.

### Activation and readiness

- ≥70% of activated users add at least two emergency contacts.
- ≥60% of activated users grant location permission after contextual education.
- ≥40% of activated users start Journey Mode at least once in the first 30 days.
- ≥20% of eligible users interact with a map/community safety feature in the first 30 days.

### Emergency reliability

- 95th percentile time from confirmed SOS to backend event creation: under 3 seconds on a supported connection.
- 95th percentile time from event creation to first contact-notification provider acceptance: under 10 seconds.
- ≥99.5% successful SOS event persistence, excluding client abandonment before confirmation.
- ≥95% of map-link sessions render a location or a clearly labelled fallback state.
- Track false activation, cancellation, recipient acknowledgement, Rakshak acceptance, and end-to-end delivery separately; never collapse them into one “sent” metric.

### Trust and community health

- ≥90% of published reports receive a moderation outcome within the agreed pilot SLA.
- <2% of published reports are later removed for policy/quality reasons.
- ≥80% of active Rakshaks retain verified status after scheduled re-check.
- Track report usefulness votes, duplicate rate, anonymous/non-anonymous mix, and zone freshness.

### Safety guardrails

- Zero unauthorised role-access incidents.
- Zero unencrypted identity-document objects at rest or in logs.
- 100% of SOS/admin actions have actor, timestamp, and outcome recorded.

## 10. Edge cases and expected behaviour

| Situation | Expected behaviour |
| --- | --- |
| Location permission denied | Explain impact; use a labelled fallback/last-known option; allow SOS; prompt to update settings later. |
| GPS accuracy is poor | Include accuracy metadata; mark location approximate; retry briefly without blocking SOS. |
| No network | Queue encrypted SOS intent locally; show that delivery is pending; offer emergency-call action; retry when connection returns. |
| App is backgrounded or killed | Native client uses approved background services and push; PWA explains the platform limitation rather than claiming live tracking. |
| No Rakshaks nearby | Notify contacts and show the explicit “no nearby Rakshak available” state; never fabricate a response. |
| Rakshak declines/times out | Offer the alert to the next eligible helper; update user and log the result. |
| SOS activated accidentally | Use hold + haptic/visual countdown; require an intentional cancel; notify recipients of cancellation. |
| Contact has no app | Use permitted SMS/voice/email fallback with an expiring secure map link; record channel state. |
| User has no contacts | Show setup prompt before activation; SOS still creates a local/logged event and may alert eligible Rakshaks where policy permits. |
| Duplicate SOS taps | De-duplicate within a short session window; update the original event instead of alert-spamming recipients. |
| Missing/invalid document image | Block applicant submission; identify which front/back asset is missing or unreadable. |
| Harmful report/photo | Keep pending/private by default; automatic and human moderation can flag, redact, or remove it. |
| Abuse or stalking concern | Contacts and Rakshaks receive the least data required; exact coordinates expire; user can revoke Journey viewers; audit all access. |
| Map/routing provider outage | Preserve SOS and location sharing; show map degradation; use cached safe places where allowed. |
| Battery saver / low battery | Reduce tracking frequency with an explanation; preserve periodic check-ins and final location updates when possible. |
| Language / RTL expansion | All strings are localizable; do not concatenate translated phrases; number/date formats follow locale. |

## 11. Explicitly out of scope

- Police dispatch integration or claims of police notification without a signed operational integration.
- Medical diagnosis, insurance claims, legal advice, or incident adjudication.
- Public display of real-time user, Rakshak, or SOS positions.
- Open messaging, live audio rooms, or direct contact discovery between strangers.
- Automatic identification from uploaded government ID or facial recognition in the pilot.
- Monetisation logic beyond a clearly labelled, non-safety-critical advertising placeholder.
- Guaranteeing safety ratings, route safety, response times, or availability.

## 12. Launch dependencies and open decisions

The user requested that privacy/legal requirements be deferred for now. They are intentionally not treated as implementation-complete. Before any live pilot, product/legal/security owners must decide data retention, consent language, contact notification consent, age eligibility, identity-document handling, Rakshak duty-of-care boundaries, escalation policy, abuse response, and local emergency-service claims. These decisions are a launch gate, not a later polish task.

Other launch dependencies: an operational moderator, a Rakshak verification reviewer, city-specific safe-place data ownership, a support-content owner, notification sender setup, incident runbook, on-call process, and a tested accessibility/localization review.

## 13. Initial delivery plan

1. **Foundation:** design system, authentication, roles, contacts, location permission UX, PWA shell, admin sign-in.
2. **Safety core:** SOS event model, secure location sessions, recipient notifications, Journey Mode, incident/SOS logging, basic native client proof-of-concept.
3. **Local intelligence:** safe places, zones, map, reports/ratings, moderation tooling.
4. **Rakshak program:** secure application uploads, review workflow, eligibility matching, acceptance flow, activity audit.
5. **Pilot hardening:** accessibility, localization, device/network test matrix, observability, security review, operations playbook, measured city pilot.

## 14. Confirmed operating policies

- **Location retention:** Precise SOS and Journey Mode coordinates are retained for 48 hours only. An hourly purge deletes journey points and removes exact SOS coordinates while preserving non-location audit information.
- **Emergency-contact confirmation:** Every new contact receives a mandatory, one-time SMS or email confirmation that explains their emergency-contact role. Until the contact confirms, the app shows **Pending** and excludes them from SOS delivery.
- **Rakshak complaints:** Users can submit private, factual concerns to the safety team. Admins investigate each case. A substantiated serious harassment or safety complaint results in permanent Rakshak-account removal; an unsubstantiated complaint does not.
- **Community reporting:** The in-app guidelines and [community policy](COMMUNITY_GUIDELINES.md) require reports about places or situations, never identifiable people. Pending moderation is the default state for every report.
