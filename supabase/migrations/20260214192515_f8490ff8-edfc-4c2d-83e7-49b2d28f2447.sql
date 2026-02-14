
-- Add independent back-side position columns for shared zones
ALTER TABLE public.template_zones
  ADD COLUMN back_x_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN back_y_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN back_width_percent numeric NOT NULL DEFAULT 20,
  ADD COLUMN back_height_percent numeric NOT NULL DEFAULT 20,
  ADD COLUMN back_rotation numeric NOT NULL DEFAULT 0,
  ADD COLUMN back_path_data jsonb DEFAULT NULL;

-- Initialize back positions from current positions for existing shared zones
UPDATE public.template_zones
SET back_x_percent = x_percent,
    back_y_percent = y_percent,
    back_width_percent = width_percent,
    back_height_percent = height_percent,
    back_rotation = rotation,
    back_path_data = path_data
WHERE shared = true;
