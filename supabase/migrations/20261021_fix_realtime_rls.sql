-- =============================================================
-- FIX: Supabase Realtime requires RLS SELECT policies to deliver
-- postgres_changes events to subscribed clients.
-- Without these policies, Realtime silently drops INSERT events
-- and the IncomingSosModal never triggers for Rakshak users.
-- =============================================================

-- 1. Ensure RLS is enabled on sos_event_deliveries
ALTER TABLE IF EXISTS sos_event_deliveries ENABLE ROW LEVEL SECURITY;

-- 2. Allow Rakshaks to SELECT their own delivery rows
-- This is CRITICAL for Supabase Realtime to deliver INSERT events
DROP POLICY IF EXISTS "Rakshaks can read own deliveries" ON sos_event_deliveries;
CREATE POLICY "Rakshaks can read own deliveries"
  ON sos_event_deliveries
  FOR SELECT
  USING (rakshak_id = auth.uid());

-- 3. Allow the SOS event creator to read deliveries for their own events
DROP POLICY IF EXISTS "SOS creator can read event deliveries" ON sos_event_deliveries;
CREATE POLICY "SOS creator can read event deliveries"
  ON sos_event_deliveries
  FOR SELECT
  USING (
    sos_event_id IN (
      SELECT id FROM sos_events WHERE user_id = auth.uid()
    )
  );

-- 4. Allow Rakshaks to UPDATE their own delivery rows (for acknowledging)
DROP POLICY IF EXISTS "Rakshaks can update own deliveries" ON sos_event_deliveries;
CREATE POLICY "Rakshaks can update own deliveries"
  ON sos_event_deliveries
  FOR UPDATE
  USING (rakshak_id = auth.uid())
  WITH CHECK (rakshak_id = auth.uid());

-- 5. Ensure sos_events table allows Rakshaks to read active events
-- (needed for getSosEventDetails after Realtime fires)
ALTER TABLE IF EXISTS sos_events ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated user to read active SOS events (needed for Rakshak response)
DROP POLICY IF EXISTS "Authenticated users can read active SOS events" ON sos_events;
CREATE POLICY "Authenticated users can read active SOS events"
  ON sos_events
  FOR SELECT
  USING (
    auth.uid() = user_id  -- Creator can always read
    OR status = 'active'  -- Any authenticated user can see active events (for Rakshak response)
  );

-- Allow SOS creator to update their own events (mark safe/cancel)
DROP POLICY IF EXISTS "Users can update own SOS events" ON sos_events;
CREATE POLICY "Users can update own SOS events"
  ON sos_events
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Allow authenticated users to insert SOS events
DROP POLICY IF EXISTS "Users can create SOS events" ON sos_events;
CREATE POLICY "Users can create SOS events"
  ON sos_events
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 6. Enable Realtime for sos_event_deliveries and sos_events tables safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'sos_event_deliveries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sos_event_deliveries;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'sos_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sos_events;
  END IF;
END $$;
