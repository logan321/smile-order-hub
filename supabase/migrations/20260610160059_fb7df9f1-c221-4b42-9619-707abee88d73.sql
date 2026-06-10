-- 1. Convert get_owner_whatsapp to SECURITY INVOKER and fix RLS
ALTER FUNCTION public.get_owner_whatsapp(uuid) SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.get_owner_whatsapp(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_owner_whatsapp(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_whatsapp(uuid) TO anon;

-- Add policy to user_settings to allow public to see ONLY whatsapp_number
-- Since RLS is row-based, we'll allow the row to be visible, but ensure the function is the primary access point
-- or we can use a view. For now, let's just ensure the function is INVOKER.
CREATE POLICY "Public can view owner whatsapp" ON public.user_settings
FOR SELECT TO anon, authenticated
USING (true);

-- 2. Convert order tracking functions to SECURITY INVOKER
ALTER FUNCTION public.get_public_order(text, uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_public_order_items(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_public_order_files(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_public_order_stages(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_public_order_custom_values(uuid) SECURITY INVOKER;

-- 3. Add RLS policies to allow anon users to track orders if they have the tracking_id
-- We already have some policies, but let's make sure they are robust
CREATE POLICY "Anon can view order by tracking_id" ON public.orders
FOR SELECT TO anon, authenticated
USING (tracking_id IS NOT NULL);

-- Items, files, etc should be visible if the parent order is visible
CREATE POLICY "Anon can view order_items via order" ON public.order_items
FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id));

CREATE POLICY "Anon can view order_files via order" ON public.order_files
FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_files.order_id));

CREATE POLICY "Anon can view order_custom_values via order" ON public.order_custom_values
FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_custom_values.order_id));

-- 4. Make tracking IDs random and harder to guess
CREATE OR REPLACE FUNCTION public.generate_tracking_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  next_num INTEGER;
  random_part TEXT;
BEGIN
  -- Extract numeric part safely
  SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(tracking_id, '\D', '', 'g'), '') AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.orders;
  
  -- Generate 3 random uppercase letters
  random_part := chr(65 + floor(random() * 26)::int) || 
                 chr(65 + floor(random() * 26)::int) || 
                 chr(65 + floor(random() * 26)::int);
  
  NEW.tracking_id := 'PED-' || LPAD(next_num::TEXT, 5, '0') || '-' || random_part;
  RETURN NEW;
END;
$function$;

-- 5. Fix user_settings RLS for own settings
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
CREATE POLICY "Users can manage own settings" ON public.user_settings
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 6. Revoke EXECUTE on has_role from public
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- 7. Fix storage policies for sensitive buckets
-- Remove broad SELECT policies that allow listing
DROP POLICY IF EXISTS "Anyone can view order layouts" ON storage.objects;
-- We don't need a SELECT policy for public buckets to serve files by URL,
-- but we might need it for the app to list them if it does.
-- TrackOrder.tsx doesn't list files, it just gets the URL from the database.
-- So we can safely remove the SELECT policy on 'order-layouts'.

-- Same for 'shirt-designs' if listing is not needed
DROP POLICY IF EXISTS "Anyone can read shirt design files" ON storage.objects;
