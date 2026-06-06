CREATE TABLE public.stamp_color_mappings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    stamp_id UUID NOT NULL REFERENCES public.stamp_catalog(id) ON DELETE CASCADE,
    original_color TEXT NOT NULL,
    region_name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.stamp_color_mappings TO authenticated;
GRANT ALL ON public.stamp_color_mappings TO service_role;

ALTER TABLE public.stamp_color_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stamp color mappings" ON public.stamp_color_mappings
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage stamp color mappings" ON public.stamp_color_mappings
    FOR ALL USING (true) WITH CHECK (true);

-- Ensure shirt_designs can store selected colors
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shirt_designs' AND column_name='selected_colors') THEN
        ALTER TABLE public.shirt_designs ADD COLUMN selected_colors JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;