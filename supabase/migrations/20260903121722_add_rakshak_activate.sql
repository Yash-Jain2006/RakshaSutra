-- 4. Activate RPC
CREATE OR REPLACE FUNCTION public.activate_rakshak(app_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can activate rakshaks';
  END IF;

  SELECT user_id INTO v_user_id
  FROM public.rakshak_applications
  WHERE id = app_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  UPDATE public.rakshak_applications
  SET status = 'verified'
  WHERE id = app_id;

  UPDATE public.rakshak_profiles
  SET status = 'verified'
  WHERE profile_id = v_user_id;

  -- Add rakshak role
  UPDATE public.profiles
  SET role = 'rakshak'
  WHERE id = v_user_id AND role = 'user';
END;
$$;
GRANT EXECUTE ON FUNCTION public.activate_rakshak(uuid) TO authenticated;
