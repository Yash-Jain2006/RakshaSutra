-- Add INSERT policy for profiles so users can recreate their profile if it goes missing
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
