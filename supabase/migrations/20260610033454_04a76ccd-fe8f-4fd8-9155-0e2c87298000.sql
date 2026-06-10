-- Drop mobile test tables
DROP TABLE IF EXISTS public.mobile_stamp_catalog;
DROP TABLE IF EXISTS public.mobile_shirt_templates;
DROP TABLE IF EXISTS public.mobile_uv_maps;

-- Remove mobile configs
DELETE FROM public.site_config WHERE category = 'mobile_config';