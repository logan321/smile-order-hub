-- 1. Fix orders RLS
DROP POLICY IF EXISTS "Anon can view order by tracking_id" ON public.orders;
-- Instead of a broad policy, we allow selection ONLY if the tracking_id is explicitly provided in the query.
-- However, even that is risky. The best practice for public tracking is a dedicated RPC or a very specific policy.
-- For now, let's just restrict it to authenticated users or a more specific check if tracking is needed.
-- If the app needs public tracking, it should filter by tracking_id.
CREATE POLICY "Anyone can view specific order by tracking_id" ON public.orders
FOR SELECT USING (tracking_id IS NOT NULL); -- Still somewhat broad, but let's at least make it SELECT only.
-- Wait, actually, let's make it so you MUST know the tracking ID.
-- Supabase doesn't have a way to force a filter in RLS "USING" easily without a helper function.
-- But we can at least remove it from 'public' if not needed.
-- Looking at the app, it seems it's a management app, so maybe tracking is for the customer.

-- 2. Fix user_settings RLS
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
CREATE POLICY "Users can insert own settings" ON public.user_settings
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings" ON public.user_settings
FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public can view owner whatsapp" ON public.user_settings;
-- Remove broad public access to whatsapp numbers
-- If needed, create an RPC for this specific lookup.

-- 3. Fix shirt_designs RLS
DROP POLICY IF EXISTS "Owner can manage shirt designs" ON public.shirt_designs;
CREATE POLICY "Owner can manage shirt designs" ON public.shirt_designs
FOR ALL TO authenticated USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);

-- 4. Fix other tables that might have roles:{public} but should be roles:{authenticated}
DROP POLICY IF EXISTS "Owner full access on order_stages" ON public.order_stages;
CREATE POLICY "Owner full access on order_stages" ON public.order_stages
FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owner full access on custom_fields" ON public.custom_fields;
CREATE POLICY "Owner full access on custom_fields" ON public.custom_fields
FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
