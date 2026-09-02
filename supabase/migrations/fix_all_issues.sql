-- FIX 1: Allow users to see the Verified Rakshaks in the "Meet the Rakshaks" list
-- (This fixes the empty list issue for normal users)
CREATE POLICY "profiles_rakshaks_visible_to_authenticated" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (role = 'rakshak');

-- FIX 2: Self-heal any missing profile records
-- (This fixes the "This account cannot add emergency contacts" error)
-- It finds any users in auth.users who didn't get a profile created properly 
-- and creates an active profile for them.
INSERT INTO public.profiles (id, display_name, role, account_status)
SELECT 
    id, 
    COALESCE(raw_user_meta_data->>'display_name', split_part(email, '@', 1), 'User'), 
    'user', 
    'active'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);
