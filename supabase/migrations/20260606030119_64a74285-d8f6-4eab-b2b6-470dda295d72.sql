-- Primeiro, removemos as políticas problemáticas que tentam acessar auth.users via SELECT direto
DROP POLICY IF EXISTS "Admins can manage uv_color_mappings" ON public.uv_color_mappings;
DROP POLICY IF EXISTS "Admins can manage UV color mappings" ON public.uv_color_mappings;

-- Criamos uma política robusta que usa o JWT do usuário (mais performático e evita problemas de JOIN)
-- e também verifica a tabela user_roles se ela for o padrão do projeto para controle de acesso.
CREATE POLICY "Admins can manage uv_color_mappings" ON public.uv_color_mappings
FOR ALL
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin') OR
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin') OR
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Garantir que todos possam ler as cores (necessário para o editor do cliente)
-- Já existe "Public can view uv_color_mappings", mas vamos reforçar se necessário.
-- GRANT SELECT ON public.uv_color_mappings TO anon, authenticated;
