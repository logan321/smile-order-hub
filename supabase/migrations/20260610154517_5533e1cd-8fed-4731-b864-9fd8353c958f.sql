DROP POLICY IF EXISTS "Auth users can upload shirt templates" ON storage.objects;
CREATE POLICY "Auth users can upload shirt templates"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'shirt-templates'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Auth users can upload stamps" ON storage.objects;
CREATE POLICY "Auth users can upload stamps"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'stamp-catalog'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Admin All Access Authenticated" ON storage.objects;
DROP POLICY IF EXISTS "Admin Upload Access" ON storage.objects;

CREATE POLICY "Admins manage site-assets"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'site-assets' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'site-assets' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Allow authenticated write" ON public.site_config;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.site_config;

CREATE POLICY "Admins can insert site_config"
ON public.site_config FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update site_config"
ON public.site_config FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete site_config"
ON public.site_config FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can insert own subscription" ON public.subscriptions;

CREATE OR REPLACE FUNCTION public.update_site_config_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;