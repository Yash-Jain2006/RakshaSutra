-- Amendment 1b: Atomic Rakshak acceptance for SOS events.
-- Adds single-primary-responder claim semantics to sos_events.
-- The conditional UPDATE with AND accepted_rakshak_id IS NULL is inherently
-- atomic in PostgreSQL — only one concurrent transaction can match.

-- 1. Add accepted_rakshak_id to sos_events
ALTER TABLE public.sos_events
  ADD COLUMN accepted_rakshak_id uuid REFERENCES public.rakshak_profiles(profile_id) ON DELETE SET NULL;

CREATE INDEX sos_events_accepted_idx ON public.sos_events(accepted_rakshak_id) WHERE accepted_rakshak_id IS NOT NULL;

-- 2. Atomic acceptance RPC
--    Returns jsonb: { accepted: bool, reason?: string, event_id?: uuid, delivery_id?: uuid }
--    Only one Rakshak can win per SOS event. Losers get { accepted: false }.
CREATE OR REPLACE FUNCTION public.accept_sos_event(
  p_event_id uuid,
  p_rakshak_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_delivery_id uuid;
BEGIN
  -- Authorization: caller must be the Rakshak they claim to be
  IF auth.uid() IS DISTINCT FROM p_rakshak_id THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'Caller is not this Rakshak');
  END IF;

  -- Verify the Rakshak is verified and available
  IF NOT EXISTS (
    SELECT 1 FROM public.rakshak_profiles
    WHERE profile_id = p_rakshak_id
      AND status = 'verified'
      AND is_available = true
  ) THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'Rakshak is not eligible');
  END IF;

  -- Atomic claim: single conditional UPDATE.
  -- Only one concurrent transaction can match the WHERE clause because
  -- PostgreSQL's UPDATE acquires a row-level lock. The second concurrent
  -- UPDATE will block until the first commits, then re-evaluate the WHERE
  -- clause and find accepted_rakshak_id IS NO LONGER NULL → zero rows.
  UPDATE public.sos_events
    SET accepted_rakshak_id = p_rakshak_id,
        updated_at = now()
    WHERE id = p_event_id
      AND status = 'active'
      AND accepted_rakshak_id IS NULL
    RETURNING id INTO v_event_id;

  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object(
      'accepted', false,
      'reason', 'Event is not available for acceptance (already claimed, not active, or not found)'
    );
  END IF;

  -- Update the Rakshak's own delivery row to 'acknowledged'
  UPDATE public.sos_event_deliveries
    SET status = 'acknowledged',
        acknowledged_at = now(),
        updated_at = now()
    WHERE sos_event_id = p_event_id
      AND rakshak_id = p_rakshak_id
      AND status IN ('queued', 'sent', 'delivered')
    RETURNING id INTO v_delivery_id;

  -- Log the acceptance in the event timeline
  INSERT INTO public.sos_event_updates (sos_event_id, actor_id, event_type, details)
    VALUES (
      p_event_id,
      p_rakshak_id,
      'rakshak_accepted',
      jsonb_build_object('rakshak_id', p_rakshak_id, 'delivery_id', v_delivery_id)
    );

  RETURN jsonb_build_object(
    'accepted', true,
    'event_id', p_event_id,
    'delivery_id', v_delivery_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_sos_event(uuid, uuid) TO authenticated;
