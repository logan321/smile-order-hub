-- CRÍTICO 1: Prevent users from self-inserting subscription rows
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "no_self_insert_subscription" ON public.subscriptions;
CREATE POLICY "no_self_insert_subscription" 
ON public.subscriptions FOR INSERT 
TO authenticated 
WITH CHECK (false);

-- CRÍTICO 2: Restrict storage uploads to the user's own folder
-- Assuming the bucket IDs 'models', 'textures', and 'uploads' exist as specified in the request
DROP POLICY IF EXISTS "upload_own_folder_only" ON storage.objects;
CREATE POLICY "upload_own_folder_only"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('models', 'textures', 'uploads')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- WARNING 1: Restrict emblem reading to the owner
ALTER TABLE public.emblems ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "emblems_own_tenant_only" ON public.emblems;
CREATE POLICY "emblems_own_tenant_only"
ON public.emblems FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- WARNING 2: Restrict shirt designs reading to the owner
-- Note: Using owner_user_id as identified from the schema
ALTER TABLE public.shirt_designs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "designs_own_tenant_only"  ON public.shirt_designs;
CREATE POLICY "designs_own_tenant_only"  
ON public.shirt_designs FOR SELECT
TO authenticated
USING (owner_user_id = auth.uid());

-- Grant access to authenticated users for SELECT (where policies allow)
GRANT SELECT ON public.emblems TO authenticated;
GRANT SELECT ON public.shirt_designs TO authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;

-- Ensure service_role has full access for background processing
GRANT ALL ON public.emblems TO service_role;
GRANT ALL ON public.shirt_designs TO service_role;
GRANT ALL ON public.subscriptions TO service_role;