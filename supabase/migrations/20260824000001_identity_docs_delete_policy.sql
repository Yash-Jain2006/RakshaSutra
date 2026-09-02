-- Migration: Add delete policy for admin on identity-documents bucket

CREATE POLICY "identity_document_delete_by_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'identity-documents'
    AND public.is_admin()
  );
