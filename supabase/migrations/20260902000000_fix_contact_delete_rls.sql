-- Fix: Contact deletion fails because sos_event_deliveries has a CHECK
-- constraint (delivery_recipient) requiring contact_id NOT NULL when
-- recipient_type = 'contact', BUT the FK uses ON DELETE SET NULL.
-- These two rules directly conflict.
--
-- Solution: Change FK from ON DELETE SET NULL to ON DELETE CASCADE.
-- When a contact is deleted, their delivery records are removed too
-- (they're historical SOS records for a contact that no longer exists).

-- Step 1: Drop the old foreign key constraint on contact_id
ALTER TABLE public.sos_event_deliveries
  DROP CONSTRAINT IF EXISTS sos_event_deliveries_contact_id_fkey;

-- Step 2: Re-add with ON DELETE CASCADE instead of ON DELETE SET NULL
ALTER TABLE public.sos_event_deliveries
  ADD CONSTRAINT sos_event_deliveries_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES public.emergency_contacts(id)
  ON DELETE CASCADE;
