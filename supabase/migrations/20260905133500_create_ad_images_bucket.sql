-- Migration: Create ad-images storage bucket and policies for product ad images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ad-images',
  'ad-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow public read access to ad-images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public read for ad-images'
  ) THEN
    CREATE POLICY "Public read for ad-images" ON storage.objects
      FOR SELECT USING (bucket_id = 'ad-images');
  END IF;
END $$;

-- Allow authenticated users / admins to upload to ad-images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Admins can upload ad-images'
  ) THEN
    CREATE POLICY "Admins can upload ad-images" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'ad-images');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Admins can update ad-images'
  ) THEN
    CREATE POLICY "Admins can update ad-images" ON storage.objects
      FOR UPDATE USING (bucket_id = 'ad-images');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Admins can delete ad-images'
  ) THEN
    CREATE POLICY "Admins can delete ad-images" ON storage.objects
      FOR DELETE USING (bucket_id = 'ad-images');
  END IF;
END $$;
