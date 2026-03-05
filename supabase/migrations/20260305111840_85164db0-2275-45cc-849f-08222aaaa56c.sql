
-- Create a public bucket for company logos
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload logos
CREATE POLICY "logos_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos');

-- Allow public read access to logos
CREATE POLICY "logos_public_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'logos');

-- Allow owners to delete their logos
CREATE POLICY "logos_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'logos');

-- Allow owners to update their logos
CREATE POLICY "logos_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'logos');
