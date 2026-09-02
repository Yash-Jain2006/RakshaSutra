create extension if not exists pgcrypto;
create type public.app_role as enum ('user', 'rakshak', 'admin');
create type public.account_status as enum ('active', 'suspended', 'removed');
create type public.rakshak_status as enum (
  'pending',
  'verified',
  'rejected',
  'inactive'
);
create type public.sos_status as enum (
  'active',
  'cancelled',
  'safe',
  'expired'
);
create type public.location_source as enum ('precise', 'last_known', 'fallback');
create type public.delivery_recipient_type as enum ('contact', 'rakshak');
create type public.delivery_status as enum (
  'queued',
  'sent',
  'delivered',
  'acknowledged',
  'failed',
  'cancelled'
);
create type public.contact_confirmation_status as enum ('pending', 'confirmed', 'expired');
create type public.safety_level as enum ('red', 'orange', 'green');
create type public.moderation_status as enum (
  'pending',
  'approved',
  'rejected',
  'flagged'
);
create type public.rakshak_complaint_status as enum (
  'pending',
  'investigating',
  'substantiated',
  'dismissed'
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role public.app_role not null default 'user',
  account_status public.account_status not null default 'active',
  preferred_language text not null default 'en',
  city text,
  avatar_url text,
  notification_preferences jsonb not null default '{"push": true, "sms": false}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (
    char_length(trim(name)) between 1 and 120
  ),
  relationship text not null check (
    char_length(trim(relationship)) between 1 and 80
  ),
  phone_e164 text,
  email text,
  notification_enabled boolean not null default true,
  confirmation_status public.contact_confirmation_status not null default 'pending',
  confirmation_token uuid not null default gen_random_uuid() unique,
  confirmation_sent_at timestamptz,
  confirmation_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint emergency_contact_channel check (
    phone_e164 is not null
    or email is not null
  )
);
create table public.journeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  destination_name text,
  destination_latitude double precision,
  destination_longitude double precision,
  status text not null default 'active' check (
    status in (
      'active',
      'paused',
      'arrived',
      'cancelled',
      'expired'
    )
  ),
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
  latitude double precision not null check (
    latitude between -90 and 90
  ),
  longitude double precision not null check (
    longitude between -180 and 180
  ),
  accuracy_meters numeric(10, 2),
  captured_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '48 hours')
);
create table public.sos_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.sos_status not null default 'active',
  latitude double precision not null check (
    latitude between -90 and 90
  ),
  longitude double precision not null check (
    longitude between -180 and 180
  ),
  accuracy_meters numeric(10, 2),
  location_source public.location_source not null,
  map_session_token uuid not null default gen_random_uuid() unique,
  location_expires_at timestamptz not null default (now() + interval '48 hours'),
  started_at timestamptz not null default now(),
  cancelled_at timestamptz,
  safe_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sos_terminal_state check (
    (
      status = 'active'
      and ended_at is null
    )
    or (
      status in ('cancelled', 'safe', 'expired')
      and ended_at is not null
    )
  )
);
create table public.sos_event_updates (
  id uuid primary key default gen_random_uuid(),
  sos_event_id uuid not null references public.sos_events(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete
  set null,
    event_type text not null check (
      event_type in (
        'created',
        'location_updated',
        'contact_notified',
        'rakshak_notified',
        'rakshak_accepted',
        'cancelled',
        'safe',
        'delivery_failed'
      )
    ),
    details jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);
create table public.rakshak_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  status public.rakshak_status not null default 'pending',
  coverage_area text,
  coverage_latitude double precision,
  coverage_longitude double precision,
  average_rating numeric(2, 1) not null default 0 check (
    average_rating between 0 and 5
  ),
  response_count integer not null default 0 check (response_count >= 0),
  is_available boolean not null default false,
  verified_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete
  set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table public.rakshak_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  document_type text not null check (
    document_type in (
      'aadhaar',
      'pan',
      'driving_licence'
    )
  ),
  full_name_as_id text not null,
  coverage_area text not null,
  status public.rakshak_status not null default 'pending',
  reviewer_id uuid references public.profiles(id) on delete
  set null,
    reviewer_note text,
    submitted_at timestamptz not null default now(),
    reviewed_at timestamptz
);
create table public.rakshak_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.rakshak_applications(id) on delete cascade,
  side text not null check (side in ('front', 'back')),
  storage_path text not null unique,
  mime_type text not null,
  created_at timestamptz not null default now(),
  unique (application_id, side)
);
create table public.rakshak_complaints (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  rakshak_id uuid not null references public.rakshak_profiles(profile_id) on delete restrict,
  description text not null check (
    char_length(description) between 20 and 2500
  ),
  status public.rakshak_complaint_status not null default 'pending',
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete
  set null,
    reviewed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table public.sos_event_deliveries (
  id uuid primary key default gen_random_uuid(),
  sos_event_id uuid not null references public.sos_events(id) on delete cascade,
  recipient_type public.delivery_recipient_type not null,
  contact_id uuid references public.emergency_contacts(id) on delete
  set null,
    rakshak_id uuid references public.rakshak_profiles(profile_id) on delete
  set null,
    channel text not null check (
      channel in (
        'push',
        'sms',
        'email',
        'in_app'
      )
    ),
    status public.delivery_status not null default 'queued',
    provider_message_id text,
    sent_at timestamptz,
    delivered_at timestamptz,
    acknowledged_at timestamptz,
    failure_reason text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint delivery_recipient check (
      (
        recipient_type = 'contact'
        and contact_id is not null
        and rakshak_id is null
      )
      or (
        recipient_type = 'rakshak'
        and rakshak_id is not null
        and contact_id is null
      )
    )
);
create table public.safe_places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (
    category in (
      'police',
      'hospital',
      'cafe',
      'fuel_station'
    )
  ),
  address text not null,
  phone text,
  latitude double precision not null check (
    latitude between -90 and 90
  ),
  longitude double precision not null check (
    longitude between -180 and 180
  ),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete
  set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table public.safety_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  safety_level public.safety_level not null,
  notes text not null,
  latitude double precision not null check (
    latitude between -90 and 90
  ),
  longitude double precision not null check (
    longitude between -180 and 180
  ),
  radius_meters integer not null default 200 check (
    radius_meters between 25 and 5000
  ),
  effective_from timestamptz not null default now(),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete
  set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table public.area_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  place_label text not null,
  latitude double precision not null check (
    latitude between -90 and 90
  ),
  longitude double precision not null check (
    longitude between -180 and 180
  ),
  rating smallint not null check (
    rating between 1 and 5
  ),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.incident_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  place_label text not null,
  latitude double precision,
  longitude double precision,
  description text not null check (
    char_length(description) between 10 and 2500
  ),
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
create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.incident_reports(id) on delete cascade,
  admin_id uuid not null references public.profiles(id) on delete restrict,
  action public.moderation_status not null,
  reason text,
  created_at timestamptz not null default now()
);
create table public.advertisements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  image_url text not null,
  target_url text,
  is_active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete
  set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table public.supports (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  description text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete
  set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table public.notification_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (
    platform in ('web', 'ios', 'android')
  ),
  push_token text not null,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, push_token)
);
create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index emergency_contacts_user_id_idx on public.emergency_contacts(user_id);
create index journeys_user_status_idx on public.journeys(user_id, status);
create index journey_location_points_expiry_idx on public.journey_location_points(expires_at);
create index sos_events_user_started_at_idx on public.sos_events(user_id, started_at desc);
create index sos_events_location_expiry_idx on public.sos_events(location_expires_at);
create index sos_events_active_idx on public.sos_events(status, started_at desc)
where status = 'active';
create index sos_event_deliveries_event_idx on public.sos_event_deliveries(sos_event_id);
create index rakshak_profiles_discovery_idx on public.rakshak_profiles(
  status,
  is_available,
  coverage_latitude,
  coverage_longitude
);
create index rakshak_complaints_queue_idx on public.rakshak_complaints(status, created_at desc);
create index safe_places_category_active_idx on public.safe_places(category, is_active);
create index safety_zones_active_idx on public.safety_zones(is_active, safety_level);
create index incident_reports_feed_idx on public.incident_reports(moderation_status, created_at desc);
create index notification_devices_user_idx on public.notification_devices(user_id)
where enabled;
create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now();
return new;
end;
$$;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer
set search_path = '' as $$ begin
insert into public.profiles (
    id,
    display_name,
    preferred_language
  )
values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(coalesce(new.email, ''), '@', 1),
      ''
    ),
    coalesce(
      new.raw_user_meta_data->>'preferred_language',
      'en'
    )
  ) on conflict (id) do nothing;
return new;
end;
$$;
create trigger on_auth_user_created
after
insert on auth.users for each row execute procedure public.handle_new_user();
create or replace function public.is_admin() returns boolean language sql stable security definer
set search_path = public as $$
select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and account_status = 'active'
  );
$$;
create or replace function public.is_active_account() returns boolean language sql stable security definer
set search_path = public as $$
select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and account_status = 'active'
  );
$$;
create or replace function public.purge_expired_location_data() returns void language plpgsql security definer
set search_path = public as $$ begin
delete from public.journey_location_points
where expires_at <= now();
update public.sos_events
set latitude = 0,
  longitude = 0,
  accuracy_meters = null,
  location_expires_at = now(),
  updated_at = now()
where location_expires_at <= now()
  and (
    latitude <> 0
    or longitude <> 0
  );
end;
$$;
create or replace function public.find_nearby_rakshaks(
    p_latitude double precision,
    p_longitude double precision,
    p_radius_meters integer default 2500,
    p_limit integer default 6
  ) returns table (
    profile_id uuid,
    display_name text,
    coverage_area text,
    distance_meters numeric
  ) language sql stable security definer
set search_path = public as $$
select rp.profile_id,
  p.display_name,
  rp.coverage_area,
  round(
    (
      6371000 * acos(
        least(
          1.0,
          greatest(
            -1.0,
            cos(radians(p_latitude)) * cos(radians(rp.coverage_latitude)) * cos(
              radians(rp.coverage_longitude) - radians(p_longitude)
            ) + sin(radians(p_latitude)) * sin(radians(rp.coverage_latitude))
          )
        )
      )
    )::numeric
  ) as distance_meters
from public.rakshak_profiles rp
  join public.profiles p on p.id = rp.profile_id
where rp.status = 'verified'
  and rp.is_available = true
  and rp.coverage_latitude is not null
  and rp.coverage_longitude is not null
  and (
    6371000 * acos(
      least(
        1.0,
        greatest(
          -1.0,
          cos(radians(p_latitude)) * cos(radians(rp.coverage_latitude)) * cos(
            radians(rp.coverage_longitude) - radians(p_longitude)
          ) + sin(radians(p_latitude)) * sin(radians(rp.coverage_latitude))
        )
      )
    )
  ) <= greatest(1, p_radius_meters)
order by distance_meters
limit greatest(1, least(p_limit, 20));
$$;
create or replace function public.write_admin_audit_log() returns trigger language plpgsql security definer
set search_path = public as $$ begin if public.is_admin() then
insert into public.admin_audit_logs (
    admin_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(new.id, old.id),
    '{}'::jsonb
  );
end if;
return coalesce(new, old);
end;
$$;
create or replace function public.resolve_rakshak_complaint(
    p_complaint_id uuid,
    p_status public.rakshak_complaint_status,
    p_admin_note text default null
  ) returns void language plpgsql security definer
set search_path = public as $$
declare v_rakshak_id uuid;
begin if not public.is_admin() then raise exception 'Only admins can resolve Rakshak complaints';
end if;
if p_status not in ('substantiated', 'dismissed') then raise exception 'Complaint outcome must be substantiated or dismissed';
end if;
select rakshak_id into v_rakshak_id
from public.rakshak_complaints
where id = p_complaint_id for
update;
if not found then raise exception 'Complaint not found';
end if;
update public.rakshak_complaints
set status = p_status,
  admin_note = p_admin_note,
  reviewed_by = auth.uid(),
  reviewed_at = now(),
  updated_at = now()
where id = p_complaint_id;
if p_status = 'substantiated' then
update public.rakshak_profiles
set status = 'inactive',
  is_available = false,
  updated_at = now()
where profile_id = v_rakshak_id;
update public.profiles
set account_status = 'removed',
  updated_at = now()
where id = v_rakshak_id;
insert into public.admin_audit_logs (
    admin_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
values (
    auth.uid(),
    'permanent_removal_after_substantiated_complaint',
    'rakshak_profile',
    v_rakshak_id,
    jsonb_build_object('complaint_id', p_complaint_id)
  );
end if;
end;
$$;
create trigger profiles_updated_at before
update on public.profiles for each row execute procedure public.set_updated_at();
create trigger emergency_contacts_updated_at before
update on public.emergency_contacts for each row execute procedure public.set_updated_at();
create trigger journeys_updated_at before
update on public.journeys for each row execute procedure public.set_updated_at();
create trigger sos_events_updated_at before
update on public.sos_events for each row execute procedure public.set_updated_at();
create trigger rakshak_profiles_updated_at before
update on public.rakshak_profiles for each row execute procedure public.set_updated_at();
create trigger rakshak_complaints_updated_at before
update on public.rakshak_complaints for each row execute procedure public.set_updated_at();
create trigger sos_event_deliveries_updated_at before
update on public.sos_event_deliveries for each row execute procedure public.set_updated_at();
create trigger safe_places_updated_at before
update on public.safe_places for each row execute procedure public.set_updated_at();
create trigger safety_zones_updated_at before
update on public.safety_zones for each row execute procedure public.set_updated_at();
create trigger area_ratings_updated_at before
update on public.area_ratings for each row execute procedure public.set_updated_at();
create trigger incident_reports_updated_at before
update on public.incident_reports for each row execute procedure public.set_updated_at();
create trigger advertisements_updated_at before
update on public.advertisements for each row execute procedure public.set_updated_at();
create trigger supports_updated_at before
update on public.supports for each row execute procedure public.set_updated_at();
create trigger notification_devices_updated_at before
update on public.notification_devices for each row execute procedure public.set_updated_at();
create trigger safety_zones_admin_audit
after
insert
  or
update
  or delete on public.safety_zones for each row execute procedure public.write_admin_audit_log();
create trigger safe_places_admin_audit
after
insert
  or
update
  or delete on public.safe_places for each row execute procedure public.write_admin_audit_log();
create trigger advertisements_admin_audit
after
insert
  or
update
  or delete on public.advertisements for each row execute procedure public.write_admin_audit_log();
create trigger supports_admin_audit
after
insert
  or
update
  or delete on public.supports for each row execute procedure public.write_admin_audit_log();
alter table public.profiles enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.journeys enable row level security;
alter table public.journey_viewers enable row level security;
alter table public.journey_location_points enable row level security;
alter table public.sos_events enable row level security;
alter table public.sos_event_updates enable row level security;
alter table public.rakshak_profiles enable row level security;
alter table public.rakshak_applications enable row level security;
alter table public.rakshak_documents enable row level security;
alter table public.rakshak_complaints enable row level security;
alter table public.sos_event_deliveries enable row level security;
alter table public.safe_places enable row level security;
alter table public.safety_zones enable row level security;
alter table public.area_ratings enable row level security;
alter table public.incident_reports enable row level security;
alter table public.incident_media enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.advertisements enable row level security;
alter table public.supports enable row level security;
alter table public.notification_devices enable row level security;
alter table public.admin_audit_logs enable row level security;
create policy "profiles_select_own_or_admin" on public.profiles for
select to authenticated using (
    id = auth.uid()
    or public.is_admin()
  );
create policy "profiles_update_own" on public.profiles for
update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "contacts_owner_access" on public.emergency_contacts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "journeys_owner_access" on public.journeys for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "journey_viewers_owner_access" on public.journey_viewers for all to authenticated using (
  exists (
    select 1
    from public.journeys j
    where j.id = journey_id
      and j.user_id = auth.uid()
  )
) with check (
  exists (
    select 1
    from public.journeys j
    where j.id = journey_id
      and j.user_id = auth.uid()
  )
);
create policy "journey_location_owner_access" on public.journey_location_points for all to authenticated using (
  exists (
    select 1
    from public.journeys j
    where j.id = journey_id
      and j.user_id = auth.uid()
  )
) with check (
  exists (
    select 1
    from public.journeys j
    where j.id = journey_id
      and j.user_id = auth.uid()
  )
);
create policy "sos_owner_or_admin_read" on public.sos_events for
select to authenticated using (
    user_id = auth.uid()
    or public.is_admin()
  );
create policy "sos_owner_insert" on public.sos_events for
insert to authenticated with check (user_id = auth.uid());
create policy "sos_owner_update" on public.sos_events for
update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sos_updates_owner_or_admin_read" on public.sos_event_updates for
select to authenticated using (
    exists (
      select 1
      from public.sos_events e
      where e.id = sos_event_id
        and (
          e.user_id = auth.uid()
          or public.is_admin()
        )
    )
  );
create policy "rakshaks_visible_to_authenticated" on public.rakshak_profiles for
select to authenticated using (
    status = 'verified'
    or profile_id = auth.uid()
    or public.is_admin()
  );
create policy "rakshak_application_owner_or_admin_read" on public.rakshak_applications for
select to authenticated using (
    user_id = auth.uid()
    or public.is_admin()
  );
create policy "rakshak_application_owner_insert" on public.rakshak_applications for
insert to authenticated with check (user_id = auth.uid());
create policy "rakshak_documents_owner_or_admin_read" on public.rakshak_documents for
select to authenticated using (
    exists (
      select 1
      from public.rakshak_applications a
      where a.id = application_id
        and (
          a.user_id = auth.uid()
          or public.is_admin()
        )
    )
  );
create policy "rakshak_complaints_reporter_or_admin_read" on public.rakshak_complaints for
select to authenticated using (
    reporter_id = auth.uid()
    or public.is_admin()
  );
create policy "rakshak_complaints_reporter_insert" on public.rakshak_complaints for
insert to authenticated with check (reporter_id = auth.uid());
create policy "deliveries_owner_or_admin_read" on public.sos_event_deliveries for
select to authenticated using (
    exists (
      select 1
      from public.sos_events e
      where e.id = sos_event_id
        and (
          e.user_id = auth.uid()
          or public.is_admin()
        )
    )
  );
create policy "safe_places_authenticated_read" on public.safe_places for
select to authenticated using (
    is_active
    or public.is_admin()
  );
create policy "safe_places_admin_write" on public.safe_places for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "safety_zones_authenticated_read" on public.safety_zones for
select to authenticated using (
    (
      is_active
      and (
        expires_at is null
        or expires_at > now()
      )
    )
    or public.is_admin()
  );
create policy "safety_zones_admin_write" on public.safety_zones for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "area_ratings_owner_access" on public.area_ratings for all to authenticated using (
  user_id = auth.uid()
  or public.is_admin()
) with check (user_id = auth.uid());
create policy "reports_feed_owner_or_admin_read" on public.incident_reports for
select to authenticated using (
    moderation_status = 'approved'
    or user_id = auth.uid()
    or public.is_admin()
  );
create policy "reports_owner_insert" on public.incident_reports for
insert to authenticated with check (user_id = auth.uid());
create policy "reports_admin_update" on public.incident_reports for
update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "incident_media_owner_or_admin_read" on public.incident_media for
select to authenticated using (
    exists (
      select 1
      from public.incident_reports r
      where r.id = report_id
        and (
          r.user_id = auth.uid()
          or public.is_admin()
        )
    )
  );
create policy "moderation_admin_read" on public.moderation_actions for
select to authenticated using (public.is_admin());
create policy "moderation_admin_write" on public.moderation_actions for
insert to authenticated with check (public.is_admin());
create policy "ads_authenticated_read" on public.advertisements for
select to authenticated using (
    is_active
    or public.is_admin()
  );
create policy "ads_admin_write" on public.advertisements for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "supports_authenticated_read" on public.supports for
select to authenticated using (
    is_active
    or public.is_admin()
  );
create policy "supports_admin_write" on public.supports for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "devices_owner_access" on public.notification_devices for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "admin_audit_admin_read" on public.admin_audit_logs for
select to authenticated using (public.is_admin());
create policy "active_profile_required" on public.profiles as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy "active_contacts_required" on public.emergency_contacts as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy "active_journeys_required" on public.journeys as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy "active_journey_viewers_required" on public.journey_viewers as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy "active_journey_points_required" on public.journey_location_points as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy "active_sos_required" on public.sos_events as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy "active_sos_updates_required" on public.sos_event_updates as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy "active_rakshak_required" on public.rakshak_profiles as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy "active_rakshak_applications_required" on public.rakshak_applications as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy "active_rakshak_documents_required" on public.rakshak_documents as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy "active_rakshak_complaints_required" on public.rakshak_complaints as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy "active_deliveries_required" on public.sos_event_deliveries as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy "active_safe_places_required" on public.safe_places as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy "active_safety_zones_required" on public.safety_zones as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy "active_ratings_required" on public.area_ratings as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy "active_reports_required" on public.incident_reports as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy "active_incident_media_required" on public.incident_media as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy "active_ads_required" on public.advertisements as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy "active_supports_required" on public.supports as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy "active_devices_required" on public.notification_devices as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
grant usage on schema public to authenticated;
grant select on public.profiles,
  public.emergency_contacts,
  public.journeys,
  public.journey_viewers,
  public.journey_location_points,
  public.sos_events,
  public.sos_event_updates,
  public.rakshak_profiles,
  public.rakshak_applications,
  public.rakshak_documents,
  public.rakshak_complaints,
  public.sos_event_deliveries,
  public.safe_places,
  public.safety_zones,
  public.area_ratings,
  public.incident_reports,
  public.incident_media,
  public.moderation_actions,
  public.advertisements,
  public.supports,
  public.notification_devices,
  public.admin_audit_logs to authenticated;
grant insert on public.emergency_contacts,
  public.journeys,
  public.journey_viewers,
  public.journey_location_points,
  public.sos_events,
  public.area_ratings,
  public.incident_reports,
  public.rakshak_applications,
  public.rakshak_complaints,
  public.notification_devices to authenticated;
grant update (
    display_name,
    preferred_language,
    city,
    avatar_url,
    notification_preferences
  ) on public.profiles to authenticated;
grant update (
    name,
    relationship,
    phone_e164,
    email,
    notification_enabled
  ) on public.emergency_contacts to authenticated;
grant update on public.journeys to authenticated;
grant update on public.sos_events to authenticated;
grant update on public.notification_devices to authenticated;
grant delete on public.emergency_contacts to authenticated;
grant delete on public.journeys to authenticated;
grant delete on public.journey_viewers to authenticated;
grant delete on public.journey_location_points to authenticated;
grant delete on public.area_ratings to authenticated;
grant delete on public.incident_reports to authenticated;
grant delete on public.notification_devices to authenticated;
grant execute on function public.find_nearby_rakshaks(
    double precision,
    double precision,
    integer,
    integer
  ) to service_role;
grant execute on function public.find_nearby_rakshaks(
    double precision,
    double precision,
    integer,
    integer
  ) to authenticated;
grant execute on function public.resolve_rakshak_complaint(
    uuid,
    public.rakshak_complaint_status,
    text
  ) to authenticated;
insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
  )
values (
    'identity-documents',
    'identity-documents',
    false,
    5242880,
    array [
    'image/jpeg',
    'image/png',
    'application/pdf'
  ]
  ) on conflict (id) do nothing;
insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
  )
values (
    'incident-media',
    'incident-media',
    false,
    5242880,
    array [
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
  ) on conflict (id) do nothing;
create policy "identity_document_upload_by_owner" on storage.objects for
insert to authenticated with check (
    bucket_id = 'identity-documents'
    and (storage.foldername(name)) [1] = auth.uid()::text
  );
create policy "identity_document_read_by_owner_or_admin" on storage.objects for
select to authenticated using (
    bucket_id = 'identity-documents'
    and (
      (storage.foldername(name)) [1] = auth.uid()::text
      or public.is_admin()
    )
  );
create policy "incident_media_upload_by_owner" on storage.objects for
insert to authenticated with check (
    bucket_id = 'incident-media'
    and (storage.foldername(name)) [1] = auth.uid()::text
  );
create policy "incident_media_read_by_owner_or_admin" on storage.objects for
select to authenticated using (
    bucket_id = 'incident-media'
    and (
      (storage.foldername(name)) [1] = auth.uid()::text
      or public.is_admin()
    )
  );