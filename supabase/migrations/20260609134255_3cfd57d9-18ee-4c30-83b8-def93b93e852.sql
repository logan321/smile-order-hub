-- Adiciona a coluna is_default se ela não existir
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'shirt_templates' AND COLUMN_NAME = 'is_default') THEN
    ALTER TABLE public.shirt_templates ADD COLUMN is_default BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Garante que apenas um template por usuário seja o padrão (opcional, mas recomendado)
-- Vamos gerenciar isso no front-end para simplificar agora, mas mantemos o suporte na tabela.

-- Garante as permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shirt_templates TO authenticated;
GRANT ALL ON public.shirt_templates TO service_role;