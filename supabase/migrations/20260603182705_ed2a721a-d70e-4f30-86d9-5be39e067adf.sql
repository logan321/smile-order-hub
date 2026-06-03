
CREATE POLICY "Public can read uv_maps" ON public.uv_maps FOR SELECT USING (true);
GRANT SELECT ON public.uv_maps TO anon;
