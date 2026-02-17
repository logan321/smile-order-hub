
-- Add tracking_slug column to user_settings
ALTER TABLE public.user_settings
ADD COLUMN tracking_slug text NOT NULL DEFAULT '';

-- Create unique index (only for non-empty slugs)
CREATE UNIQUE INDEX idx_user_settings_tracking_slug 
ON public.user_settings (tracking_slug) 
WHERE tracking_slug <> '';
