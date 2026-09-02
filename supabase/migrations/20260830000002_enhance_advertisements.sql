-- Migration: Enhance advertisements table for admin-managed sponsor ads
-- Adds icon_emoji and description columns, plus RLS policies

-- Add missing columns
ALTER TABLE public.advertisements
  ADD COLUMN IF NOT EXISTS icon_emoji text NOT NULL DEFAULT '🛒',
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;

-- Rename title -> heading for clarity (keep backward compat via alias if needed)
-- We'll just use the existing 'title' column as the heading.

-- Enable RLS
ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;

-- Public read for active ads (all users can see active ads)
DROP POLICY IF EXISTS "Anyone can read active ads" ON public.advertisements;
CREATE POLICY "Anyone can read active ads" ON public.advertisements
  FOR SELECT USING (is_active = true);

-- Admin full access
DROP POLICY IF EXISTS "Admins can manage ads" ON public.advertisements;
CREATE POLICY "Admins can manage ads" ON public.advertisements
  FOR ALL USING (public.is_admin());

-- Grant access
GRANT SELECT ON public.advertisements TO anon;
GRANT SELECT ON public.advertisements TO authenticated;
GRANT ALL ON public.advertisements TO authenticated;
