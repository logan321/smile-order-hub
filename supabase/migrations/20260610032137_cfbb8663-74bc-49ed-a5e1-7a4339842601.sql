-- 1. Create mobile_uv_maps (clone of uv_maps)
CREATE TABLE public.mobile_uv_maps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    name TEXT NOT NULL,
    image_url TEXT,
    uv_width INTEGER,
    uv_height INTEGER,
    uv_zones JSONB DEFAULT '{}'::jsonb,
    user_id UUID NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobile_uv_maps TO authenticated;
GRANT ALL ON public.mobile_uv_maps TO service_role;
ALTER TABLE public.mobile_uv_maps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own mobile uv maps" ON public.mobile_uv_maps FOR ALL USING (auth.uid() = user_id);

-- 2. Create mobile_shirt_templates (clone of shirt_templates)
CREATE TABLE public.mobile_shirt_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    name TEXT NOT NULL,
    front_image_url TEXT,
    back_image_url TEXT,
    uv_map_id UUID REFERENCES public.mobile_uv_maps(id),
    user_id UUID NOT NULL,
    active BOOLEAN DEFAULT true,
    niche_id UUID
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobile_shirt_templates TO authenticated;
GRANT ALL ON public.mobile_shirt_templates TO service_role;
ALTER TABLE public.mobile_shirt_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own mobile templates" ON public.mobile_shirt_templates FOR ALL USING (auth.uid() = user_id);

-- 3. Create mobile_stamp_catalog (clone of stamp_catalog)
CREATE TABLE public.mobile_stamp_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    miniatura_frente_url TEXT,
    codigo TEXT,
    category TEXT,
    user_id UUID NOT NULL,
    active BOOLEAN DEFAULT true,
    niche_id UUID,
    uv_frente_url TEXT
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobile_stamp_catalog TO authenticated;
GRANT ALL ON public.mobile_stamp_catalog TO service_role;
ALTER TABLE public.mobile_stamp_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own mobile stamps" ON public.mobile_stamp_catalog FOR ALL USING (auth.uid() = user_id);
