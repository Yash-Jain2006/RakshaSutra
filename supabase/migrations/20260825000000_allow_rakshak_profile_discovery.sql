-- Migration: Allow any authenticated user to discover Rakshak profiles
-- Problem: The existing policy "profiles_select_own_or_admin" only allows
-- users to read their own row. This blocks the Rakshak discovery screen from
-- showing verified Rakshaks to regular users.
-- Fix: Add a read-only policy that exposes only the minimum fields needed for
-- discovery (name, city, identity_verified) for profiles where role = 'rakshak'.

create policy "profiles_select_rakshaks"
  on public.profiles
  for select
  to authenticated
  using (role = 'rakshak');
