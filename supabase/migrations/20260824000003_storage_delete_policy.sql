-- Migration: Add storage policy for admin to delete identity documents

DO $$ 
BEGIN
  -- Try to create the policy for admins to delete objects
  BEGIN
    CREATE POLICY "identity_document_delete_by_admin" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'identity-documents' AND public.is_admin());
  EXCEPTION
    WHEN duplicate_object THEN
      -- Policy already exists, do nothing
      NULL;
  END;
END $$;
