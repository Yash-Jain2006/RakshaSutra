-- Migration to add Admin approval logic for Rakshak applications

-- 1. Create secure function to approve an application
CREATE OR REPLACE FUNCTION public.approve_rakshak_application(app_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_coverage_area text;
BEGIN
  -- Verify caller is an admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can approve applications';
  END IF;

  -- Get the user ID and coverage area from the application
  SELECT user_id, coverage_area INTO v_user_id, v_coverage_area
  FROM public.rakshak_applications
  WHERE id = app_id AND status = 'pending';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Application not found or not in pending state';
  END IF;

  -- Update application status
  UPDATE public.rakshak_applications
  SET 
    status = 'verified',
    reviewed_by = auth.uid(),
    reviewed_at = now()
  WHERE id = app_id;

  -- Create the rakshak profile
  INSERT INTO public.rakshak_profiles (
    profile_id, 
    status, 
    coverage_area, 
    verified_at, 
    reviewed_by
  )
  VALUES (
    v_user_id,
    'verified',
    v_coverage_area,
    now(),
    auth.uid()
  )
  ON CONFLICT (profile_id) DO UPDATE
  SET 
    status = 'verified',
    coverage_area = EXCLUDED.coverage_area,
    verified_at = now(),
    reviewed_by = auth.uid();

  -- Update the user's role to rakshak (if they aren't an admin already)
  UPDATE public.profiles
  SET role = 'rakshak'
  WHERE id = v_user_id AND role = 'user';

END;
$$;

-- 2. Create secure function to reject an application
CREATE OR REPLACE FUNCTION public.reject_rakshak_application(app_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Verify caller is an admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can reject applications';
  END IF;

  UPDATE public.rakshak_applications
  SET 
    status = 'rejected',
    reviewed_by = auth.uid(),
    reviewed_at = now()
  WHERE id = app_id AND status = 'pending';

END;
$$;

-- Grant execute permissions to authenticated users (the functions internally check for admin)
GRANT EXECUTE ON FUNCTION public.approve_rakshak_application(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_rakshak_application(uuid) TO authenticated;
