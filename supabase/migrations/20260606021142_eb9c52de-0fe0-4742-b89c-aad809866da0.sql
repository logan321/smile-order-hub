DROP TABLE IF EXISTS public.uv_color_mappings CASCADE;

CREATE TABLE public.uv_color_mappings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id UUID NOT NULL REFERENCES public.shirt_templates(id) ON DELETE CASCADE,
    original_color TEXT NOT NULL,
    region_name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Grant permissions
GRANT SELECT ON public.uv_color_mappings TO authenticated;
GRANT SELECT ON public.uv_color_mappings TO anon;
GRANT ALL ON public.uv_color_mappings TO service_role;

-- Enable RLS
ALTER TABLE public.uv_color_mappings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view UV color mappings" ON public.uv_color_mappings
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage UV color mappings" ON public.uv_color_mappings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Updated_at trigger
CREATE TRIGGER update_uv_color_mappings_updated_at
    BEFORE UPDATE ON public.uv_color_mappings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
