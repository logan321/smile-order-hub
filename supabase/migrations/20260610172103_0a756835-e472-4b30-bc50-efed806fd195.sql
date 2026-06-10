-- Tighten policies from public to authenticated
DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    FOR r IN (
        SELECT policyname, tablename, cmd, roles, qual, with_check 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND roles @> '{public}'
        AND (cmd = 'INSERT' OR cmd = 'ALL' OR cmd = 'UPDATE' OR cmd = 'DELETE')
        AND tablename != 'trial_fingerprints' -- Skip internal tables
    ) LOOP
        EXECUTE format('ALTER POLICY %I ON %I TO authenticated', r.policyname, r.tablename);
    END LOOP;
END $$;

-- Harden storage policies
DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    FOR r IN (
        SELECT policyname, tablename, cmd, roles, qual, with_check 
        FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects'
        AND roles @> '{public}'
        AND (cmd = 'INSERT' OR cmd = 'ALL' OR cmd = 'UPDATE' OR cmd = 'DELETE')
    ) LOOP
        EXECUTE format('ALTER POLICY %I ON storage.%I TO authenticated', r.policyname, r.tablename);
    END LOOP;
END $$;

-- Fix the uv_maps public read if it's too broad
-- DROP POLICY IF EXISTS "Public can read uv_maps" ON public.uv_maps;
-- CREATE POLICY "Authenticated users can read uv_maps" ON public.uv_maps FOR SELECT TO authenticated USING (true);
-- Wait, let's keep it public if it's needed for the simulator before login.
