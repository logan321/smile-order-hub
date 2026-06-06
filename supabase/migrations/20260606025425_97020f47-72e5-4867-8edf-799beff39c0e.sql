ALTER TABLE public.uv_color_mappings 
  ADD COLUMN IF NOT EXISTS is_editable boolean NOT NULL DEFAULT true;

ALTER TABLE public.uv_color_mappings 
  ALTER COLUMN template_id DROP NOT NULL;

-- ensure FK on stamp_id with cascade if not yet there
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'uv_color_mappings_stamp_id_fkey'
      AND table_name = 'uv_color_mappings'
  ) THEN
    ALTER TABLE public.uv_color_mappings
      ADD CONSTRAINT uv_color_mappings_stamp_id_fkey
      FOREIGN KEY (stamp_id) REFERENCES public.stamp_catalog(id) ON DELETE CASCADE;
  END IF;
END$$;

-- helpful index
CREATE INDEX IF NOT EXISTS uv_color_mappings_stamp_id_idx ON public.uv_color_mappings(stamp_id);

-- ensure at least one of template_id / stamp_id is set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'uv_color_mappings_target_chk'
  ) THEN
    ALTER TABLE public.uv_color_mappings
      ADD CONSTRAINT uv_color_mappings_target_chk
      CHECK (template_id IS NOT NULL OR stamp_id IS NOT NULL);
  END IF;
END$$;