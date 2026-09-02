-- Migration: Fix rakshak_applications RLS for upsert (update policy) and admin read

-- 1. Add UPDATE policy so owner can re-submit / upsert their application
CREATE POLICY "rakshak_application_owner_update" ON public.rakshak_applications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2. Ensure the admin email has role='admin' in profiles
-- (This is idempotent - safe to run multiple times)
UPDATE public.profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'rakshaasutra@gmail.com' LIMIT 1
)
AND role != 'admin';
