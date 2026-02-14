
-- Remover policies permissivas e substituir por mais restritivas
DROP POLICY "Service can insert roles" ON public.user_roles;
DROP POLICY "Service can insert subscriptions" ON public.subscriptions;

-- Apenas authenticated users podem inserir seu próprio registro (backup do trigger)
CREATE POLICY "Users can insert own role" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscription" ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
