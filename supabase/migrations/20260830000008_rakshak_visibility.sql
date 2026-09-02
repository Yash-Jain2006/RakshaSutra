-- Allow authenticated users to view profiles of verified Rakshaks
-- This is necessary for the "Meet the Rakshaks" community list to populate.

CREATE POLICY "profiles_rakshaks_visible_to_authenticated" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (role = 'rakshak');
