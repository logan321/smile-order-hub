CREATE TABLE public.stamp_color_mappings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    stamp_id UUID NOT NULL REFERENCES public.stamp_catalog(id) ON DELETE CASCADE,
    original_color TEXT NOT NULL,
    region_name TEXT NOT NULL,
    is_editable BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stamp_color_mappings TO authenticated;
GRANT ALL ON public.stamp_color_mappings TO service_role;

ALTER TABLE public.stamp_color_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all stamp color mappings" ON public.stamp_color_mappings
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage all stamp color mappings" ON public.stamp_color_mappings
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

-- Check if update_updated_at_column exists and create if not
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        CREATE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $body$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $body$ LANGUAGE plpgsql;
    END IF;
END $$;

CREATE TRIGGER update_stamp_color_mappings_updated_at 
    BEFORE UPDATE ON public.stamp_color_mappings 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();