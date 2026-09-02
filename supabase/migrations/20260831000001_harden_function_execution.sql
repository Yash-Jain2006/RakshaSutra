-- Restrict SECURITY DEFINER RPCs to the roles that actually need them.
-- Administrative functions still enforce public.is_admin() internally.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.approve_rakshak_application(uuid) from public, anon;
revoke execute on function public.reject_rakshak_application(uuid) from public, anon;
revoke execute on function public.deactivate_rakshak(uuid) from public, anon;
revoke execute on function public.resolve_rakshak_complaint(uuid, public.rakshak_complaint_status, text) from public, anon;
revoke execute on function public.ensure_profile_exists(text) from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_active_account() from public, anon;
revoke execute on function public.find_nearby_rakshaks(double precision, double precision, integer, integer) from public, anon;
revoke execute on function public.purge_expired_location_data() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.write_admin_audit_log() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

grant execute on function public.approve_rakshak_application(uuid) to authenticated, service_role;
grant execute on function public.reject_rakshak_application(uuid) to authenticated, service_role;
grant execute on function public.deactivate_rakshak(uuid) to authenticated, service_role;
grant execute on function public.resolve_rakshak_complaint(uuid, public.rakshak_complaint_status, text) to authenticated, service_role;
grant execute on function public.ensure_profile_exists(text) to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.is_active_account() to authenticated, service_role;
grant execute on function public.find_nearby_rakshaks(double precision, double precision, integer, integer) to authenticated, service_role;
grant execute on function public.purge_expired_location_data() to service_role;
