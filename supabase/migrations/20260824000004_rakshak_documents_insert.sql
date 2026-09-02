-- Migration: Add insert policy for rakshak_documents

CREATE POLICY "rakshak_documents_owner_insert" ON public.rakshak_documents
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.rakshak_applications a
    WHERE a.id = application_id AND a.user_id = auth.uid()
  )
);
