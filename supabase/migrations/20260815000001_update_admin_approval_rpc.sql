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

  -- Set identity_verified = true regardless of role
  UPDATE public.profiles
  SET identity_verified = true
  WHERE id = v_user_id;

  -- Delete sensitive Aadhaar/ID documents to ensure we do not retain PII
  DELETE FROM public.rakshak_documents
  WHERE application_id = app_id;

END;
$$;
