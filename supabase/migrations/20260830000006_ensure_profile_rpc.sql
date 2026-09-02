-- Create a secure RPC to ensure a user's profile exists
-- This bypasses restrictive RLS policies that block self-healing

CREATE OR REPLACE FUNCTION public.ensure_profile_exists(user_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow authenticated users to ensure their own profile
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.profiles (id, display_name, account_status)
  VALUES (auth.uid(), coalesce(user_name, 'Unknown'), 'active')
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.ensure_profile_exists(text) TO authenticated;
