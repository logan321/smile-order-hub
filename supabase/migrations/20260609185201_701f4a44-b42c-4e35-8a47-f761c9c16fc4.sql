-- Enable public access to the private bucket via RLS
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'site-assets' );

-- Allow authenticated users to upload
CREATE POLICY "Admin Upload Access"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'site-assets' );

-- Allow authenticated users to delete
CREATE POLICY "Admin Delete Access"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'site-assets' );
