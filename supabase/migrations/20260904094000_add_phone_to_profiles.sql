-- Migration: Add phone to profiles and grant permissions
-- Allows users and admins to store and update their phone number in their profile,
-- which is then used across automated WhatsApp and SMS notifications.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;

-- Grant select and update on the phone column to authenticated users
GRANT SELECT (phone) ON public.profiles TO authenticated;
GRANT UPDATE (phone) ON public.profiles TO authenticated;

-- Ensure service_role has full access for edge functions
GRANT ALL ON public.profiles TO service_role;
