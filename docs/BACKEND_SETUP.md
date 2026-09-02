# Backend and authentication setup

The app now contains a Supabase schema, strict Row Level Security policies, email/password authentication with optional Google OAuth, contact confirmation, a 48-hour location-retention routine, safety-data services, and SOS/contact Edge Functions. It deliberately remains in demo mode until public credentials are supplied.

## 1. Create the Supabase project

1. Create a Supabase project in the closest suitable region.
2. In **Authentication → URL Configuration**, set the Site URL and add the local and deployed URLs as redirect URLs.
3. In **Authentication → Providers**, enable Email. The client uses email/password sign-in and sign-up. Enable Google too if you want to offer the Google button in the interface, and configure its redirect URI there.
4. Copy the project URL and the browser-safe **publishable** key. Never use a secret/service key in the web application.

## 2. Configure this app

```powershell
Copy-Item .env.example .env.local
```

Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_APP_URL` in `.env.local`, then restart `npm run dev`.

## 3. Apply the schema and deploy the Edge Functions

Install the Supabase CLI, sign in, then link this folder to your project and push the migration:

```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase secrets set ALLOWED_ORIGIN=https://YOUR_DOMAIN RESEND_API_KEY=YOUR_RESEND_KEY CONFIRMATION_FROM_EMAIL='Raksha Sutra <safety@YOUR_DOMAIN>'
supabase functions deploy dispatch-sos
supabase functions deploy add-emergency-contact
supabase functions deploy confirm-emergency-contact --no-verify-jwt
```

Supabase supplies `SUPABASE_URL` and platform keys to hosted functions. Secret keys bypass RLS and are read only inside the functions; never create a custom `SUPABASE_*` secret and never copy one into `.env.local`, Git, or the browser bundle. For SMS confirmation instead of email, set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER` instead.

### Contact confirmation is mandatory

The app invokes `add-emergency-contact`, which sends the one-time confirmation before accepting the new contact. The contact is created as **Pending**, with notifications disabled. If the email/SMS provider cannot send the confirmation, the function deletes the contact and returns an error—the requirement cannot be bypassed. The contact becomes eligible for SOS alerts only after the secure confirmation link is used.

### Enforce 48-hour location retention

The schema applies a 48-hour expiry to SOS coordinates and Journey Mode location points. Run the purge function hourly through Supabase Cron after enabling `pg_cron` in the Dashboard:

```sql
select cron.schedule(
  'raksha-sutra-purge-expired-locations',
  '15 * * * *',
  $$select public.purge_expired_location_data()$$
);
```

The purge deletes journey points and zeroes exact SOS coordinates while preserving the non-location audit event. Check job history in Supabase Cron after setup.

## 4. First administration task

After signing in with the intended admin account, promote it from the Supabase SQL editor:

```sql
update public.profiles
set role = 'admin'
where id = 'THE_AUTH_USER_UUID';
```

Add verified Rakshaks only after identity review and training. Add safe places and zones through an authenticated admin workflow or SQL seed; do not use production personal data for tests.

## What is intentionally not live yet

- Push/SMS delivery of SOS alerts still needs approved provider credentials and delivery-webhook handling. The `dispatch-sos` function records delivery attempts as `queued`; only a provider acknowledgement may move them to `sent` or `delivered`.
- Background location, lock-screen alerts, and reliable push delivery require the planned native iOS/Android app.
- Identity-document review, report-photo scanning, rate limits, abuse response runbooks, and legal/consent text are launch gates.
