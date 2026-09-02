-- Restore the two live location tables removed by the MVP cleanup migration.
-- Deliberately contains no sample records: places and zones must be supplied by
-- authorised administrators so every map result represents operational data.

create table public.journeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  destination_name text,
  destination_latitude double precision,
  destination_longitude double precision,
  status text not null default 'active' check (status in ('active', 'paused', 'arrived', 'cancelled', 'expired')),
  started_at timestamptz not null default now(),
  expected_arrival_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.journey_viewers (
  journey_id uuid not null references public.journeys(id) on delete cascade,
  contact_id uuid not null references public.emergency_contacts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (journey_id, contact_id)
);

create table public.journey_location_points (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.journeys(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_meters numeric(10, 2),
  captured_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '48 hours')
);

create table public.sos_event_updates (
  id uuid primary key default gen_random_uuid(),
  sos_event_id uuid not null references public.sos_events(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('created', 'location_updated', 'contact_notified', 'rakshak_notified', 'rakshak_accepted', 'cancelled', 'safe', 'delivery_failed')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.sos_event_deliveries (
  id uuid primary key default gen_random_uuid(),
  sos_event_id uuid not null references public.sos_events(id) on delete cascade,
  recipient_type public.delivery_recipient_type not null,
  contact_id uuid references public.emergency_contacts(id) on delete set null,
  rakshak_id uuid references public.rakshak_profiles(profile_id) on delete set null,
  channel text not null check (channel in ('push', 'sms', 'email', 'in_app')),
  status public.delivery_status not null default 'queued',
  provider_message_id text,
  sent_at timestamptz,
  delivered_at timestamptz,
  acknowledged_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_recipient check ((recipient_type = 'contact' and contact_id is not null and rakshak_id is null) or (recipient_type = 'rakshak' and rakshak_id is not null and contact_id is null))
);

create table public.incident_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  place_label text not null check (char_length(trim(place_label)) between 1 and 300),
  latitude double precision,
  longitude double precision,
  description text not null check (char_length(description) between 10 and 2500),
  sentiment text not null check (sentiment in ('safe', 'unsafe')),
  is_anonymous boolean not null default true,
  moderation_status public.moderation_status not null default 'pending',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.incident_media (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.incident_reports(id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null,
  created_at timestamptz not null default now()
);

create table public.safe_places (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 160),
  category text not null check (category in ('police', 'hospital', 'cafe', 'fuel_station')),
  address text not null check (char_length(trim(address)) between 1 and 500),
  phone text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.safety_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 160),
  safety_level public.safety_level not null,
  notes text not null default '' check (char_length(notes) <= 2500),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  radius_meters integer not null default 200 check (radius_meters between 25 and 5000),
  effective_from timestamptz not null default now(),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint safety_zone_valid_window check (expires_at is null or expires_at > effective_from)
);

create index safe_places_category_active_idx on public.safe_places(category, is_active);
create index safe_places_created_by_idx on public.safe_places(created_by);
create index safety_zones_active_level_idx on public.safety_zones(is_active, safety_level);
create index safety_zones_created_by_idx on public.safety_zones(created_by);
create index journeys_user_status_idx on public.journeys(user_id, status);
create index journey_location_points_expiry_idx on public.journey_location_points(expires_at);
create index sos_event_updates_event_idx on public.sos_event_updates(sos_event_id);
create index sos_event_deliveries_event_idx on public.sos_event_deliveries(sos_event_id);
create index incident_reports_feed_idx on public.incident_reports(moderation_status, created_at desc);
create index incident_media_report_idx on public.incident_media(report_id);

create trigger set_safe_places_updated_at
before update on public.safe_places
for each row execute procedure public.set_updated_at();

create trigger set_safety_zones_updated_at
before update on public.safety_zones
for each row execute procedure public.set_updated_at();

create trigger set_journeys_updated_at
before update on public.journeys
for each row execute procedure public.set_updated_at();

create trigger set_sos_event_deliveries_updated_at
before update on public.sos_event_deliveries
for each row execute procedure public.set_updated_at();

create trigger set_incident_reports_updated_at
before update on public.incident_reports
for each row execute procedure public.set_updated_at();

alter table public.safe_places enable row level security;
alter table public.safety_zones enable row level security;
alter table public.journeys enable row level security;
alter table public.journey_viewers enable row level security;
alter table public.journey_location_points enable row level security;
alter table public.sos_event_updates enable row level security;
alter table public.sos_event_deliveries enable row level security;
alter table public.incident_reports enable row level security;
alter table public.incident_media enable row level security;

create policy "journeys_owner_access"
on public.journeys for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "active_journeys_required"
on public.journeys as restrictive for all to authenticated
using ((select public.is_active_account()))
with check ((select public.is_active_account()));

create policy "journey_viewers_owner_access"
on public.journey_viewers for all to authenticated
using (exists (select 1 from public.journeys j where j.id = journey_id and j.user_id = (select auth.uid())))
with check (exists (select 1 from public.journeys j where j.id = journey_id and j.user_id = (select auth.uid())));

create policy "active_journey_viewers_required"
on public.journey_viewers as restrictive for all to authenticated
using ((select public.is_active_account()))
with check ((select public.is_active_account()));

create policy "journey_location_owner_access"
on public.journey_location_points for all to authenticated
using (exists (select 1 from public.journeys j where j.id = journey_id and j.user_id = (select auth.uid())))
with check (exists (select 1 from public.journeys j where j.id = journey_id and j.user_id = (select auth.uid())));

create policy "active_journey_points_required"
on public.journey_location_points as restrictive for all to authenticated
using ((select public.is_active_account()))
with check ((select public.is_active_account()));

create policy "sos_updates_owner_or_admin_read"
on public.sos_event_updates for select to authenticated
using (exists (select 1 from public.sos_events e where e.id = sos_event_id and (e.user_id = (select auth.uid()) or (select public.is_admin()))));

create policy "active_sos_updates_required"
on public.sos_event_updates as restrictive for all to authenticated
using ((select public.is_active_account()))
with check ((select public.is_active_account()));

create policy "deliveries_owner_or_admin_read"
on public.sos_event_deliveries for select to authenticated
using (exists (select 1 from public.sos_events e where e.id = sos_event_id and (e.user_id = (select auth.uid()) or (select public.is_admin()))));

create policy "active_deliveries_required"
on public.sos_event_deliveries as restrictive for all to authenticated
using ((select public.is_active_account()))
with check ((select public.is_active_account()));

create policy "reports_feed_owner_or_admin_read"
on public.incident_reports for select to authenticated
using (moderation_status = 'approved' or user_id = (select auth.uid()) or (select public.is_admin()));

create policy "reports_owner_insert"
on public.incident_reports for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "reports_admin_update"
on public.incident_reports for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "active_reports_required"
on public.incident_reports as restrictive for all to authenticated
using ((select public.is_active_account()))
with check ((select public.is_active_account()));

create policy "incident_media_owner_or_admin_read"
on public.incident_media for select to authenticated
using (exists (select 1 from public.incident_reports r where r.id = report_id and (r.user_id = (select auth.uid()) or (select public.is_admin()))));

create policy "active_incident_media_required"
on public.incident_media as restrictive for all to authenticated
using ((select public.is_active_account()))
with check ((select public.is_active_account()));

create policy "safe_places_authenticated_read"
on public.safe_places for select to authenticated
using (is_active or (select public.is_admin()));

create policy "safe_places_admin_write"
on public.safe_places for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "active_safe_places_required"
on public.safe_places as restrictive for all to authenticated
using ((select public.is_active_account()))
with check ((select public.is_active_account()));

create policy "safety_zones_authenticated_read"
on public.safety_zones for select to authenticated
using (
  (is_active and (expires_at is null or expires_at > now()))
  or (select public.is_admin())
);

create policy "safety_zones_admin_write"
on public.safety_zones for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "active_safety_zones_required"
on public.safety_zones as restrictive for all to authenticated
using ((select public.is_active_account()))
with check ((select public.is_active_account()));

grant select, insert, update, delete on public.safe_places, public.safety_zones to authenticated;
grant select, insert, update, delete on public.journeys, public.journey_viewers, public.journey_location_points to authenticated;
grant select on public.sos_event_updates, public.sos_event_deliveries, public.incident_reports, public.incident_media to authenticated;
grant insert on public.incident_reports to authenticated;
grant update on public.incident_reports to authenticated;

alter table public.rakshak_applications
  add column if not exists contact_phone text;

alter table public.rakshak_applications
  add constraint rakshak_application_contact_phone_length
  check (contact_phone is null or char_length(trim(contact_phone)) between 7 and 25);
