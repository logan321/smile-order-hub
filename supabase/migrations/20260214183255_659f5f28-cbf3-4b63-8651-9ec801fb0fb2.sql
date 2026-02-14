
INSERT INTO storage.buckets (id, name, public) VALUES ('patch-catalog', 'patch-catalog', true);

CREATE POLICY "Owner can upload patches" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'patch-catalog' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owner can delete patches" ON storage.objects FOR DELETE
  USING (bucket_id = 'patch-catalog' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public can read patches" ON storage.objects FOR SELECT
  USING (bucket_id = 'patch-catalog');
