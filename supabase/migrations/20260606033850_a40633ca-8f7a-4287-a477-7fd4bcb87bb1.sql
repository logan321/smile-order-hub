CREATE TABLE IF NOT EXISTS public.stamp_color_mappings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  stamp_id uuid NOT NULL,
  original_color text NOT NULL,
  region_name text NOT NULL DEFAULT '',
  is_editable boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Note: In a production environment with multiple users, stamp_id should ideally 
-- have a FOREIGN KEY reference to stamp_catalog(id) ON DELETE CASCADE.
-- Based on the instruction, we are following the provided schema exactly.

ALTER TABLE public.stamp_color_mappings ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'stamp_color_mappings' AND policyname = 'Todos podem ler'
    ) THEN
        CREATE POLICY "Todos podem ler" ON public.stamp_color_mappings FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'stamp_color_mappings' AND policyname = 'Autenticados podem escrever'
    ) THEN
        CREATE POLICY "Autenticados podem escrever" ON public.stamp_color_mappings FOR ALL USING (auth.uid() IS NOT NULL);
    END IF;
END $$;

-- Standard grants for PostgREST access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stamp_color_mappings TO authenticated;
GRANT SELECT ON public.stamp_color_mappings TO anon;
GRANT ALL ON public.stamp_color_mappings TO service_role;
