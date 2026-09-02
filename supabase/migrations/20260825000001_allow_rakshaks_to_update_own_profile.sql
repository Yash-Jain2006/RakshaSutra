-- Allow rakshaks to update their own profile (e.g. coverage area)
CREATE POLICY "rakshaks_can_update_own_profile" ON public.rakshak_profiles
FOR UPDATE TO authenticated
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());
