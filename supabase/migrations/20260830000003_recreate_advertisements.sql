-- Recreate the advertisements table (dropped accidentally)
CREATE TABLE public.advertisements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon_emoji text NOT NULL DEFAULT '🛒',
  image_url text NOT NULL DEFAULT '',
  target_url text,
  is_active boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;

-- Public read for active ads
CREATE POLICY "Anyone can read active ads" ON public.advertisements
  FOR SELECT USING (is_active = true);

-- Admin full access
CREATE POLICY "Admins can manage ads" ON public.advertisements
  FOR ALL USING (public.is_admin());

-- Grant access
GRANT SELECT ON public.advertisements TO anon;
GRANT SELECT ON public.advertisements TO authenticated;
GRANT ALL ON public.advertisements TO authenticated;
