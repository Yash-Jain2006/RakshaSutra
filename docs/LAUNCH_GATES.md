# Raksha Sutra — Production Launch Gates

Before any public launch of the Raksha Sutra platform, all gates listed below must be formally reviewed and signed off by the engineering, legal, and trust & safety teams.

## 🛑 Launch-Blocking Infrastructure & Safety Gaps

- [ ] **Offline / No-Network SOS Fallback (SMS)**: Browser PWA cannot send network requests without active data connectivity. An SMS-based fallback flow must be implemented for offline emergency scenarios.
- [ ] **Police-Verification API for Rakshak Vetting**: Integrate official background/police verification API checks for Rakshak applicants alongside manual document review.

## ⚖️ Legal & Compliance Gates

- [ ] **Location Retention Period Policy**: Define and enforce automated deletion of location records (currently 48-hour default in database functions).
- [ ] **Consent Text Review**: Legal audit of user consent copy during onboarding, location tracking, and SOS dispatch.
- [ ] **Emergency Contact Consent Flow**: Legal review of recipient consent mechanism when added by another user.
- [ ] **Minimum Age Policy**: Define age restrictions and guardian consent policy for users under 18.
- [ ] **Government-ID Retention & Encryption Policy**: Formalize retention schedules and deletion workflows for Aadhaar / PAN / Driving Licence uploads.
- [ ] **Rakshak Terms of Service & Scope-of-Help**: Define liability boundaries, non-vigilante guidance, and volunteer code of conduct.
- [ ] **Emergency Service Wording**: Legal verification that all UI copy explicitly discloses pilot/demo states and directs users to 112 directly.

## 🛡️ Trust & Safety Rate-Limiting Thresholds

- [ ] **SOS Soft-Flag Threshold**: Review pilot default of >3 SOS triggers within 15 minutes before audit flagging.
- [ ] **SOS Hard-Throttle Threshold**: Review pilot default of >8 SOS triggers within 60 seconds before throttling non-human automated spam.
- [ ] **Community Incident Report Limit**: Review pilot default of 5 report submissions per user per hour.

## 🔒 Security & Infrastructure

- [ ] **Secure Headers & CSP Review**: Review Content Security Policy (CSP), Strict-Transport-Security (HSTS), and X-Frame-Options headers on static hosting and API gateways.
