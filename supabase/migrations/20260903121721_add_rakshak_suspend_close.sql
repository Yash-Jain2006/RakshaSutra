-- 1. Add 'closed' to rakshak_status enum
ALTER TYPE public.rakshak_status ADD VALUE IF NOT EXISTS 'closed';

-- 2. Suspend RPC
CREATE OR REPLACE FUNCTION public.suspend_rakshak(app_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can suspend rakshaks';
  END IF;

  SELECT user_id INTO v_user_id
  FROM public.rakshak_applications
  WHERE id = app_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  UPDATE public.rakshak_applications
  SET status = 'inactive'
  WHERE id = app_id;

  UPDATE public.rakshak_profiles
  SET status = 'inactive'
  WHERE profile_id = v_user_id;

  -- Remove rakshak role, but keep admin role if they are admin
  UPDATE public.profiles
  SET role = 'user'
  WHERE id = v_user_id AND role = 'rakshak';
END;
$$;
GRANT EXECUTE ON FUNCTION public.suspend_rakshak(uuid) TO authenticated;

-- 3. Close RPC
CREATE OR REPLACE FUNCTION public.close_rakshak(app_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can close rakshaks';
  END IF;

  SELECT user_id INTO v_user_id
  FROM public.rakshak_applications
  WHERE id = app_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  UPDATE public.rakshak_applications
  SET status = 'closed'
  WHERE id = app_id;

  UPDATE public.rakshak_profiles
  SET status = 'closed'
  WHERE profile_id = v_user_id;

  -- Remove rakshak role, but keep admin role if they are admin
  UPDATE public.profiles
  SET role = 'user'
  WHERE id = v_user_id AND role = 'rakshak';
END;
$$;
GRANT EXECUTE ON FUNCTION public.close_rakshak(uuid) TO authenticated;
