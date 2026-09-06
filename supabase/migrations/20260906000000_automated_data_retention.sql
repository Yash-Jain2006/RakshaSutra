-- Migration: Add automated 90-day data retention for SOS logs and journeys using pg_cron

-- 1. Ensure pg_cron extension is available
CREATE EXTENSION IF NOT EXISTS pg_cron SCHEMA extensions;

-- 2. Create function to clean up old records
CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete SOS events older than 90 days.
  -- This will cascade and delete related sos_event_updates and sos_event_deliveries.
  DELETE FROM public.sos_events 
  WHERE created_at < NOW() - INTERVAL '90 days';

  -- Delete Journeys older than 90 days.
  -- This will cascade to journey_location_points and journey_viewers.
  DELETE FROM public.journeys 
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

-- 3. Schedule the cleanup function to run daily at midnight
SELECT cron.schedule(
  'cleanup-90-day-logs',
  '0 0 * * *',
  $$ SELECT public.cleanup_old_logs(); $$
);
