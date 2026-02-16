
-- Allow admins to manage shirt_templates for any user
CREATE POLICY "Admins can manage all shirt_templates"
ON public.shirt_templates FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to manage stamp_catalog for any user
CREATE POLICY "Admins can manage all stamp_catalog"
ON public.stamp_catalog FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to manage patch_catalog for any user
CREATE POLICY "Admins can manage all patch_catalog"
ON public.patch_catalog FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to manage template_zones for any user
CREATE POLICY "Admins can manage all template_zones"
ON public.template_zones FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to manage user_settings for any user
CREATE POLICY "Admins can manage all user_settings"
ON public.user_settings FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
