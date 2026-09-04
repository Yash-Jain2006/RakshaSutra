-- Migration: Add secure RPCs and RLS policies for admin deletion of SOS audit logs

-- 1. Create secure RPC function to delete a single SOS event and all child records
CREATE OR REPLACE FUNCTION public.delete_sos_event(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure caller is an admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can delete SOS logs';
  END IF;

  -- Delete from child tables (in case FK cascade is missing or restricted)
  DELETE FROM public.sos_event_deliveries WHERE sos_event_id = p_event_id;
  DELETE FROM public.sos_event_updates WHERE sos_event_id = p_event_id;

  -- Delete the event itself
  DELETE FROM public.sos_events WHERE id = p_event_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_sos_event(uuid) TO authenticated, service_role;

-- 2. Create secure RPC function to clear all SOS logs
CREATE OR REPLACE FUNCTION public.clear_all_sos_events()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure caller is an admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can clear SOS logs';
  END IF;

  -- Delete from child tables
  DELETE FROM public.sos_event_deliveries;
  DELETE FROM public.sos_event_updates;

  -- Delete all events
  DELETE FROM public.sos_events;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_all_sos_events() TO authenticated, service_role;

-- 3. Grant direct DELETE permissions to authenticated role
GRANT DELETE ON public.sos_events TO authenticated;
GRANT DELETE ON public.sos_event_updates TO authenticated;
GRANT DELETE ON public.sos_event_deliveries TO authenticated;

-- 4. Enable admin DELETE policies
DROP POLICY IF EXISTS "admin_delete_sos_events" ON public.sos_events;
CREATE POLICY "admin_delete_sos_events" ON public.sos_events
  FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_sos_event_updates" ON public.sos_event_updates;
CREATE POLICY "admin_delete_sos_event_updates" ON public.sos_event_updates
  FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_sos_event_deliveries" ON public.sos_event_deliveries;
CREATE POLICY "admin_delete_sos_event_deliveries" ON public.sos_event_deliveries
  FOR DELETE TO authenticated
  USING (public.is_admin());

