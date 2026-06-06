CREATE TABLE public.template_color_mappings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id UUID NOT NULL REFERENCES public.shirt_templates(id) ON DELETE CASCADE,
    original_color TEXT NOT NULL,
    region_name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_color_mappings TO authenticated;
GRANT ALL ON public.template_color_mappings TO service_role;

ALTER TABLE public.template_color_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all template color mappings" ON public.template_color_mappings
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage all template color mappings" ON public.template_color_mappings
    FOR ALL TO authenticated USING (
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

-- Trigger for updated_at (function already exists from previous migration)
CREATE TRIGGER update_template_color_mappings_updated_at 
    BEFORE UPDATE ON public.template_color_mappings 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();