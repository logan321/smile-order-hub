
-- 1. Custom order stages per user
CREATE TABLE public.order_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.order_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access on order_stages"
  ON public.order_stages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Public read for tracking page
CREATE POLICY "Public can read order stages"
  ON public.order_stages FOR SELECT
  USING (true);

-- 2. Custom fields for confection orders
CREATE TABLE public.custom_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text', -- text, number, date, select
  options TEXT[] DEFAULT '{}', -- for select type
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access on custom_fields"
  ON public.custom_fields FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Custom field values per order
CREATE TABLE public.order_custom_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  custom_field_id UUID NOT NULL REFERENCES public.custom_fields(id) ON DELETE CASCADE,
  value TEXT NOT NULL DEFAULT ''
);

ALTER TABLE public.order_custom_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner access via order"
  ON public.order_custom_values FOR ALL
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_custom_values.order_id AND orders.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_custom_values.order_id AND orders.user_id = auth.uid()));

CREATE POLICY "Public can read order custom values"
  ON public.order_custom_values FOR SELECT
  USING (true);

-- 4. Order files for layouts
CREATE TABLE public.order_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.order_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner access via order on files"
  ON public.order_files FOR ALL
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_files.order_id AND orders.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_files.order_id AND orders.user_id = auth.uid()));

CREATE POLICY "Public can read order files"
  ON public.order_files FOR SELECT
  USING (true);

-- 5. Add order_type column to orders
ALTER TABLE public.orders ADD COLUMN order_type TEXT NOT NULL DEFAULT 'designer';

-- 6. Storage bucket for order layouts
INSERT INTO storage.buckets (id, name, public) VALUES ('order-layouts', 'order-layouts', true);

CREATE POLICY "Authenticated users can upload order layouts"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'order-layouts' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update own order layouts"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'order-layouts' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view order layouts"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'order-layouts');

CREATE POLICY "Authenticated users can delete own order layouts"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'order-layouts' AND auth.role() = 'authenticated');
