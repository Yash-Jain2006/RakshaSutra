DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'incident_rating') THEN
    CREATE TYPE public.incident_rating AS ENUM ('Safe', 'Unsafe');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.incident_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  place text not null,
  description text not null,
  rating public.incident_rating not null,
  anonymous boolean not null default false,
  status text not null default 'pending', -- pending, reviewed, rejected
  created_at timestamptz not null default now()
);

-- RLS Policies
ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;

-- Users can create reports
DROP POLICY IF EXISTS "Users can insert incident reports" ON public.incident_reports;
CREATE POLICY "Users can insert incident reports"
  ON public.incident_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own reports
DROP POLICY IF EXISTS "Users can view own incident reports" ON public.incident_reports;
CREATE POLICY "Users can view own incident reports"
  ON public.incident_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all reports
DROP POLICY IF EXISTS "Admins can view all incident reports" ON public.incident_reports;
CREATE POLICY "Admins can view all incident reports"
  ON public.incident_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Admins can update reports (e.g., status)
DROP POLICY IF EXISTS "Admins can update incident reports" ON public.incident_reports;
CREATE POLICY "Admins can update incident reports"
  ON public.incident_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
