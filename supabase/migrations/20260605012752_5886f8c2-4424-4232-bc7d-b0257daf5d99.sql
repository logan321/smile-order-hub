ALTER TABLE public.stamp_catalog ADD COLUMN layer_mapping JSONB;
GRANT ALL ON public.stamp_catalog TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stamp_catalog TO authenticated;