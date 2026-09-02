-- Fix RLS for rakshak_applications by dropping the restrictive policy that causes UPSERT failures
DROP POLICY IF EXISTS "active_rakshak_applications_required" ON public.rakshak_applications;
