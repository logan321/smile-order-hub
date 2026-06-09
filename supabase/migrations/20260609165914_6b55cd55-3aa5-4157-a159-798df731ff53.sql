-- 1. Preparar a tabela stamp_catalog
ALTER TABLE public.stamp_catalog ADD COLUMN IF NOT EXISTS codigo TEXT UNIQUE;
ALTER TABLE public.stamp_catalog ADD COLUMN IF NOT EXISTS miniatura_frente_url TEXT;

-- 2. Criar a tabela uv_data (usando nome diferente para evitar conflito com possíveis tabelas existentes)
CREATE TABLE IF NOT EXISTS public.uv_data (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo TEXT NOT NULL UNIQUE,
    uv_frente_url TEXT,
    uv_costas_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    user_id UUID REFERENCES auth.users(id)
);

-- 3. Configurar permissões (GRANTs)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uv_data TO authenticated;
GRANT ALL ON public.uv_data TO service_role;

-- 4. Habilitar RLS e criar políticas
ALTER TABLE public.uv_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own uv_data" ON public.uv_data
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Criar índice para busca rápida por código
CREATE INDEX IF NOT EXISTS idx_uv_data_codigo ON public.uv_data(codigo);
