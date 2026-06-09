-- 1. Garantir que a tabela site_config tenha RLS habilitado e políticas corretas
ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem para evitar conflitos
DROP POLICY IF EXISTS "Allow public read" ON public.site_config;
DROP POLICY IF EXISTS "Allow authenticated write" ON public.site_config;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.site_config;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.site_config;

-- Política para leitura pública (essencial para o site carregar)
CREATE POLICY "Allow public read" ON public.site_config
FOR SELECT USING (true);

-- Política para escrita apenas por usuários autenticados (admin)
CREATE POLICY "Allow authenticated write" ON public.site_config
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- Garantir GRANTs básicos (necessário no Supabase para a API funcionar)
GRANT SELECT ON public.site_config TO anon;
GRANT ALL ON public.site_config TO authenticated;
GRANT ALL ON public.site_config TO service_role;

-- 2. Configurar políticas para o Storage (bucket site-assets)
-- Remover políticas antigas do storage
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Admin Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "Admin Delete Access" ON storage.objects;
DROP POLICY IF EXISTS "Admin All Access Authenticated" ON storage.objects;

-- Política de leitura pública para objetos
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'site-assets' );

-- Política de upload para usuários autenticados
CREATE POLICY "Admin Upload Access"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'site-assets' );

-- Política de deleção/update para usuários autenticados
CREATE POLICY "Admin All Access Authenticated"
ON storage.objects FOR ALL
TO authenticated
USING ( bucket_id = 'site-assets' )
WITH CHECK ( bucket_id = 'site-assets' );
