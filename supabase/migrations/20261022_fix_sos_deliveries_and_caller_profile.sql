-- 1. Update foreign key on sos_event_deliveries to reference profiles(id)
-- This allows any registered system user / contact / volunteer to receive in-app alert notifications without constraint violations
ALTER TABLE sos_event_deliveries DROP CONSTRAINT IF EXISTS sos_event_deliveries_rakshak_id_fkey;
ALTER TABLE sos_event_deliveries ADD CONSTRAINT sos_event_deliveries_rakshak_id_fkey 
  FOREIGN KEY (rakshak_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. Allow reading caller profile for active SOS events so responders can see the name in IncomingSosModal
DROP POLICY IF EXISTS "profiles_select_active_sos_caller" ON profiles;
CREATE POLICY "profiles_select_active_sos_caller" ON profiles 
  FOR SELECT 
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM sos_events 
      WHERE sos_events.user_id = profiles.id 
      AND sos_events.status = 'active'
    )
  );
