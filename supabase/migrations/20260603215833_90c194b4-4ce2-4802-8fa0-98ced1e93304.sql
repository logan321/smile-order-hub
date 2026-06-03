ALTER TABLE public.template_zones
  ADD COLUMN IF NOT EXISTS position_3d jsonb,
  ADD COLUMN IF NOT EXISTS normal_3d jsonb,
  ADD COLUMN IF NOT EXISTS default_size_3d jsonb,
  ADD COLUMN IF NOT EXISTS rotation_3d numeric;