create type public.incident_rating as enum ('Safe', 'Unsafe');

create table public.incident_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  place text not null,
  description text not null,
  rating public.incident_rating not null,
  anonymous boolean not null default false,
  status text not null default 'pending', -- pending, reviewed, rejected
  created_at timestamptz not null default now()
);

-- RLS Policies
alter table public.incident_reports enable row level security;

-- Users can create reports
create policy "Users can insert incident reports"
  on public.incident_reports for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Users can view their own reports
create policy "Users can view own incident reports"
  on public.incident_reports for select
  to authenticated
  using (auth.uid() = user_id);

-- Admins can view all reports
create policy "Admins can view all incident reports"
  on public.incident_reports for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Admins can update reports (e.g., status)
create policy "Admins can update incident reports"
  on public.incident_reports for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
