-- Migration: Cleanup Unused Tables
-- Description: Drops tables that are not part of the core MVP.

-- Drop Journey & Live Tracking tables
-- DO NOT DROP: These are core MVP features for live location tracking
-- DROP TABLE IF EXISTS public.journey_location_points CASCADE;
-- DROP TABLE IF EXISTS public.journey_viewers CASCADE;
-- DROP TABLE IF EXISTS public.journeys CASCADE;

-- Drop SOS & Incident Expansion tables
-- DO NOT DROP: These are core MVP features for the SOS flow
-- DROP TABLE IF EXISTS public.sos_event_updates CASCADE;
-- DROP TABLE IF EXISTS public.sos_event_deliveries CASCADE;
-- DROP TABLE IF EXISTS public.incident_media CASCADE;
-- DROP TABLE IF EXISTS public.incident_reports CASCADE;

-- Drop Location Features tables
DROP TABLE IF EXISTS public.area_ratings CASCADE;
DROP TABLE IF EXISTS public.safety_zones CASCADE;
DROP TABLE IF EXISTS public.safe_places CASCADE;

-- Drop Admin / Operational Expansion tables
DROP TABLE IF EXISTS public.admin_audit_logs CASCADE;
DROP TABLE IF EXISTS public.notification_devices CASCADE;
DROP TABLE IF EXISTS public.supports CASCADE;
DROP TABLE IF EXISTS public.moderation_actions CASCADE;
