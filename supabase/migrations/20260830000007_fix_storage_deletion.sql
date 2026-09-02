-- Fix the RPCs to not attempt direct deletion from storage.objects
-- since Supabase triggers prevent this. Storage API must be used instead.

CREATE OR REPLACE FUNCTION public.approve_rakshak_application(app_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_coverage_area text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can approve applications';
  END IF;

  SELECT user_id, coverage_area INTO v_user_id, v_coverage_area
  FROM public.rakshak_applications
  WHERE id = app_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found or not in pending state';
  END IF;

  UPDATE public.rakshak_applications
  SET 
    status = 'verified',
    reviewer_id = auth.uid(),
    reviewed_at = now()
  WHERE id = app_id;

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

  UPDATE public.profiles
  SET role = 'rakshak'
  WHERE id = v_user_id AND role = 'user';

  UPDATE public.profiles
  SET identity_verified = true
  WHERE id = v_user_id;

  -- Delete sensitive DB records to ensure we do not retain PII
  -- (Physical storage files will be deleted via Storage API by the admin client)
  DELETE FROM public.rakshak_documents
  WHERE application_id = app_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_rakshak_application(app_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can reject applications';
  END IF;

  UPDATE public.rakshak_applications
  SET 
    status = 'rejected',
    reviewer_id = auth.uid(),
    reviewed_at = now()
  WHERE id = app_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found or not in pending state';
  END IF;

  -- Delete sensitive DB records to ensure we do not retain PII
  -- (Physical storage files will be deleted via Storage API by the admin client)
  DELETE FROM public.rakshak_documents
  WHERE application_id = app_id;
END;
$$;
