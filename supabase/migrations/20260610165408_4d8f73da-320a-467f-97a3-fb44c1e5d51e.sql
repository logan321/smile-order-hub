-- Update remaining policies to use private.has_role
DROP POLICY IF EXISTS "Admins can manage all template_zones" ON public.template_zones;
CREATE POLICY "Admins can manage all template_zones" ON public.template_zones
FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage all user_settings" ON public.user_settings;
CREATE POLICY "Admins can manage all user_settings" ON public.user_settings
FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage all text_styles" ON public.text_styles;
CREATE POLICY "Admins can manage all text_styles" ON public.text_styles
FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage uv_color_mappings" ON public.uv_color_mappings;
CREATE POLICY "Admins can manage uv_color_mappings" ON public.uv_color_mappings
FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage site-assets" ON storage.objects;
CREATE POLICY "Admins manage site-assets" ON storage.objects
FOR ALL TO authenticated USING ((bucket_id = 'site-assets'::text) AND private.has_role(auth.uid(), 'admin'));

-- Now it is safe to drop the public has_role functions
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.has_role(uuid, text);

-- Hard fix for storage listing: Remove the broad SELECT policies.
DROP POLICY IF EXISTS "Anyone can read shirt templates files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read stamp catalog files" ON storage.objects;
DROP POLICY IF EXISTS "Public can read patches" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read text-styles" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;

-- Re-confirming trigger revokes and search_path
REVOKE ALL ON FUNCTION public.handle_new_user_subscription() FROM public, authenticated;
REVOKE ALL ON FUNCTION public.generate_tracking_id() FROM public, authenticated;
REVOKE ALL ON FUNCTION public.redirect_stamp_like_template() FROM public, authenticated;

ALTER FUNCTION public.handle_new_user_subscription() SET search_path = 'public';
ALTER FUNCTION public.generate_tracking_id() SET search_path = 'public';
ALTER FUNCTION public.redirect_stamp_like_template() SET search_path = 'public';
