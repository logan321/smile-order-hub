
-- Add editor_enabled column to subscriptions
ALTER TABLE public.subscriptions ADD COLUMN editor_enabled boolean NOT NULL DEFAULT false;
