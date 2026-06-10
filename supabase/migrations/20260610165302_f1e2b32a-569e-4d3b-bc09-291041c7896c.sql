-- Create a private schema for security functions
CREATE SCHEMA IF NOT EXISTS private;

-- Move has_role to private schema and set safe search_path
-- We cast role to text to allow comparison with text input
DROP FUNCTION IF EXISTS public.has_role(_user_id uuid, _role text);
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text = _role
  )
$$;

-- Ensure execute is revoked from public for private functions
REVOKE EXECUTE ON FUNCTION private.has_role(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, text) TO authenticated, service_role;

-- Update RLS policies to use private.has_role and restrict roles
-- Patch Catalog
DROP POLICY IF EXISTS "Admins can manage all patch_catalog" ON public.patch_catalog;
CREATE POLICY "Admins can manage all patch_catalog" ON public.patch_catalog
FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'));

-- Niches
DROP POLICY IF EXISTS "Admins can manage all niches" ON public.niches;
CREATE POLICY "Admins can manage all niches" ON public.niches
FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'));

-- Stamp Colors
DROP POLICY IF EXISTS "Admins can manage all stamp_colors" ON public.stamp_colors;
CREATE POLICY "Admins can manage all stamp_colors" ON public.stamp_colors
FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'));

-- Shirt Templates
DROP POLICY IF EXISTS "Admins can manage all shirt_templates" ON public.shirt_templates;
CREATE POLICY "Admins can manage all shirt_templates" ON public.shirt_templates
FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'));

-- Stamp Catalog
DROP POLICY IF EXISTS "Admins can manage all stamp_catalog" ON public.stamp_catalog;
CREATE POLICY "Admins can manage all stamp_catalog" ON public.stamp_catalog
FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'));

-- User Roles
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins can manage all roles" ON public.user_roles
FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'));

-- Subscriptions
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can view all subscriptions" ON public.subscriptions
FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can manage subscriptions" ON public.subscriptions
FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'));

-- Site Config
DROP POLICY IF EXISTS "Admins can delete site_config" ON public.site_config;
CREATE POLICY "Admins can delete site_config" ON public.site_config
FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update site_config" ON public.site_config;
CREATE POLICY "Admins can update site_config" ON public.site_config
FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert site_config" ON public.site_config;
CREATE POLICY "Admins can insert site_config" ON public.site_config
FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- Fix Storage Policies to prevent listing (Linter 0025)
DROP POLICY IF EXISTS "Anyone can read shirt templates files" ON storage.objects;
CREATE POLICY "Anyone can read shirt templates files" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'shirt-templates');

DROP POLICY IF EXISTS "Anyone can read stamp catalog files" ON storage.objects;
CREATE POLICY "Anyone can read stamp catalog files" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'stamp-catalog');

DROP POLICY IF EXISTS "Public can read patches" ON storage.objects;
CREATE POLICY "Public can read patches" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'patch-catalog');

DROP POLICY IF EXISTS "Anyone can read text-styles" ON storage.objects;
CREATE POLICY "Anyone can read text-styles" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'text-styles');

DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
CREATE POLICY "Public Read Access" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'site-assets');

-- Revoke execute on trigger functions from public
REVOKE EXECUTE ON FUNCTION public.handle_new_user_subscription() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_tracking_id() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.redirect_stamp_like_template() FROM public, authenticated;

-- Ensure search_path is set for all SECURITY DEFINER functions
ALTER FUNCTION public.handle_new_user_subscription() SET search_path = 'public';
ALTER FUNCTION public.generate_tracking_id() SET search_path = 'public';
ALTER FUNCTION public.redirect_stamp_like_template() SET search_path = 'public';
