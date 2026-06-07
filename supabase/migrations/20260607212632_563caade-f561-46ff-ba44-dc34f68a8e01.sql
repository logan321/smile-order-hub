
-- 1) Fix function search_path
CREATE OR REPLACE FUNCTION public.update_uv_color_mappings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2) Remove RLS reference to auth.jwt user_metadata
DROP POLICY IF EXISTS "Admins can manage uv_color_mappings" ON public.uv_color_mappings;
CREATE POLICY "Admins can manage uv_color_mappings"
ON public.uv_color_mappings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) stamp_color_mappings ownership
DROP POLICY IF EXISTS "Autenticados podem escrever" ON public.stamp_color_mappings;
CREATE POLICY "Owners manage own stamp color mappings"
ON public.stamp_color_mappings
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.stamp_catalog sc WHERE sc.id = stamp_color_mappings.stamp_id AND sc.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.stamp_catalog sc WHERE sc.id = stamp_color_mappings.stamp_id AND sc.user_id = auth.uid()));

-- 4) order-layouts storage
DROP POLICY IF EXISTS "Authenticated users can upload order layouts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update own order layouts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own order layouts" ON storage.objects;

CREATE POLICY "Owners upload order layouts" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'order-layouts' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners update order layouts" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'order-layouts' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'order-layouts' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners delete order layouts" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'order-layouts' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- 5) text-styles storage
DROP POLICY IF EXISTS "Authenticated users can upload text-styles" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own text-styles" ON storage.objects;

CREATE POLICY "Owners upload text-styles" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'text-styles' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners update text-styles" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'text-styles' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'text-styles' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners delete text-styles" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'text-styles' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- 6) shirt-designs storage
DROP POLICY IF EXISTS "Anyone can upload shirt design files" ON storage.objects;

CREATE POLICY "Owners upload shirt designs" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'shirt-designs' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners update shirt designs" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'shirt-designs' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'shirt-designs' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners delete shirt designs" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'shirt-designs' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- 7) UPDATE policies for patch-catalog, shirt-templates, stamp-catalog
CREATE POLICY "Owners update patches" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'patch-catalog' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'patch-catalog' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners update shirt templates" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'shirt-templates' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'shirt-templates' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners update stamps" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'stamp-catalog' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'stamp-catalog' AND (auth.uid())::text = (storage.foldername(name))[1]);
