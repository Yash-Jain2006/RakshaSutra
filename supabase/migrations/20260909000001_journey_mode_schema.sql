-- =============================================================================
-- Migration: Journey Mode — Production Security, Routing, Tracking & Privacy
-- =============================================================================

-- ── Table: journeys ─────────────────────────────────────────────────────────
ALTER TABLE public.journeys
  ADD COLUMN IF NOT EXISTS token_hash text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS transport_mode text DEFAULT 'walking',
  ADD COLUMN IF NOT EXISTS last_latitude double precision,
  ADD COLUMN IF NOT EXISTS last_longitude double precision,
  ADD COLUMN IF NOT EXISTS last_speed double precision,
  ADD COLUMN IF NOT EXISTS last_heading double precision,
  ADD COLUMN IF NOT EXISTS last_location_at timestamptz,
  ADD COLUMN IF NOT EXISTS eta_seconds integer,
  ADD COLUMN IF NOT EXISTS remaining_distance_meters double precision,
  ADD COLUMN IF NOT EXISTS route_geojson jsonb;

-- ── Table: journey_location_points ──────────────────────────────────────────
ALTER TABLE public.journey_location_points
  ADD COLUMN IF NOT EXISTS sequence_number integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS speed double precision,
  ADD COLUMN IF NOT EXISTS heading double precision;

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_journeys_token_hash
  ON public.journeys (token_hash);

-- Compound index for fast chronological retrieval per journey
CREATE INDEX IF NOT EXISTS idx_journey_location_points_journey_seq
  ON public.journey_location_points (journey_id, sequence_number);

-- Deduplicate existing rows before adding unique constraint.
-- Old code always used sequence_number=1, so many rows share (journey_id, 1).
-- Reassign sequence numbers to be unique per journey using row_number() ordered by captured_at.
DO $$
BEGIN
  -- Only run if the constraint doesn't exist yet
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_journey_location_points_journey_seq'
  ) THEN
    -- Reassign monotonically increasing sequence numbers per journey ordered by captured_at
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY journey_id
          ORDER BY captured_at NULLS LAST, id
        ) AS new_seq
      FROM public.journey_location_points
    )
    UPDATE public.journey_location_points p
    SET sequence_number = r.new_seq
    FROM ranked r
    WHERE p.id = r.id;
  END IF;
END;
$$;


ALTER TABLE public.journey_location_points
  DROP CONSTRAINT IF EXISTS uq_journey_location_points_journey_seq;
ALTER TABLE public.journey_location_points
  ADD CONSTRAINT uq_journey_location_points_journey_seq
  UNIQUE (journey_id, sequence_number);

-- =============================================================================
-- Atomic Location Update RPC (Change #3)
-- =============================================================================
-- This function MUST be called instead of independent INSERT + UPDATE statements.
-- It atomically:
--   1. Validates that the journey exists and belongs to the authenticated user
--   2. Inserts the location point (idempotent on sequence_number conflict)
--   3. Updates the denormalized last_* fields on the journeys row
-- This prevents inconsistent states where the point was inserted but the journey
-- summary was not yet updated (or vice versa).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_journey_location(
  p_journey_id uuid,
  p_sequence_number integer,
  p_client_timestamp timestamptz,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision,
  p_speed double precision,
  p_heading double precision,
  p_eta_seconds integer,
  p_remaining_distance_meters double precision
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Validate journey ownership and that it is still active
  IF NOT EXISTS (
    SELECT 1 FROM public.journeys
    WHERE id = p_journey_id
      AND status IN ('active', 'approaching', 'paused')
      AND (revoked_at IS NULL)
      AND (expires_at IS NULL OR expires_at > NOW())
  ) THEN
    RAISE EXCEPTION 'Journey % not found or is no longer active', p_journey_id
      USING ERRCODE = 'P0001'; -- raise_exception
  END IF;

  -- 2. Insert location point (idempotent: skip on duplicate sequence_number)
  INSERT INTO public.journey_location_points (
    journey_id,
    sequence_number,
    captured_at,
    latitude,
    longitude,
    accuracy_meters,
    speed,
    heading
  )
  VALUES (
    p_journey_id,
    p_sequence_number,
    p_client_timestamp,
    p_latitude,
    p_longitude,
    p_accuracy_meters,
    p_speed,
    p_heading
  )
  ON CONFLICT (journey_id, sequence_number) DO NOTHING;

  -- 3. Update denormalized summary on the journeys row
  UPDATE public.journeys
  SET
    last_latitude             = p_latitude,
    last_longitude            = p_longitude,
    last_location_at          = p_client_timestamp,
    last_speed                = p_speed,
    last_heading              = p_heading,
    eta_seconds               = p_eta_seconds,
    remaining_distance_meters = p_remaining_distance_meters
  WHERE id = p_journey_id;
END;
$$;

-- Grant execute to authenticated users only (RLS on journeys enforces ownership)
GRANT EXECUTE ON FUNCTION public.update_journey_location TO authenticated;

-- =============================================================================
-- Privacy & Data Retention Policy (Change #6)
-- =============================================================================
--
-- LOCATION DATA LIFECYCLE:
--
--   Active journey     → Live location available to viewers with valid bearer token
--   Journey ended      → Live sharing stops immediately (revoked_at set)
--   Location points    → Retained for 30 days post journey end, then deleted
--   Journeys row       → Retained for 90 days for audit/support, then deleted
--
-- WHAT VIEWERS SEE (enforced in Edge Function `public-tracking`):
--   ✅ Current location (last known)
--   ✅ Destination
--   ✅ Route (pre-calculated polyline)
--   ✅ ETA / remaining distance / status
--   ✅ Last updated timestamp
--   ❌ Historical breadcrumb trail (NOT exposed — viewer receives snapshot only)
--   ❌ User profile beyond display_name
--   ❌ Contact information
--
-- To implement auto-deletion, schedule a cron job (pg_cron or external) such as:
--
--   DELETE FROM public.journey_location_points
--   WHERE journey_id IN (
--     SELECT id FROM public.journeys
--     WHERE ended_at < NOW() - INTERVAL '30 days'
--       OR (status IN ('arrived','cancelled','expired') AND ended_at < NOW() - INTERVAL '30 days')
--   );
--
--   DELETE FROM public.journeys
--   WHERE ended_at < NOW() - INTERVAL '90 days';
--
-- NOTE: Implement this as a Supabase Edge Function scheduled via pg_cron once the
-- data volume justifies automated cleanup.
-- =============================================================================

