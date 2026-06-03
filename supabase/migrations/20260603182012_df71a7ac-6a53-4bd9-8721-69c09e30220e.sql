
DROP POLICY IF EXISTS "Public can read order custom values" ON public.order_custom_values;
DROP POLICY IF EXISTS "Public can read order files" ON public.order_files;
DROP POLICY IF EXISTS "Public can read order items" ON public.order_items;
DROP POLICY IF EXISTS "Public can read order stages" ON public.order_stages;
DROP POLICY IF EXISTS "Public can read order by tracking_id" ON public.orders;
DROP POLICY IF EXISTS "Public can read user settings" ON public.user_settings;
DROP POLICY IF EXISTS "Public can read own shirt designs" ON public.shirt_designs;
DROP POLICY IF EXISTS "Public can insert shirt designs" ON public.shirt_designs;

DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;
CREATE POLICY "Users can insert own non-admin role"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND role = 'user'::public.app_role);

CREATE OR REPLACE FUNCTION public.get_tracking_owner(_slug text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id FROM public.user_settings WHERE tracking_slug = lower(_slug) LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_public_order(_tracking_id text, _owner uuid)
RETURNS TABLE(order_id uuid, tracking_id text, status text, order_date timestamptz, created_at timestamptz, user_id uuid, order_type text, delivery_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.tracking_id, o.status, o.date, o.created_at, o.user_id, o.order_type, o.delivery_date
  FROM public.orders o WHERE o.tracking_id = _tracking_id AND o.user_id = _owner LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_public_order_items(_order_id uuid)
RETURNS TABLE(quantity int, unit_price numeric, service_id uuid, service_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT oi.quantity, oi.unit_price, oi.service_id, s.name
  FROM public.order_items oi
  LEFT JOIN public.services s ON s.id = oi.service_id
  WHERE oi.order_id = _order_id;
$$;

CREATE OR REPLACE FUNCTION public.get_public_order_files(_order_id uuid)
RETURNS TABLE(file_id uuid, file_name text, file_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, file_name, file_url FROM public.order_files WHERE order_id = _order_id;
$$;

CREATE OR REPLACE FUNCTION public.get_public_order_custom_values(_order_id uuid)
RETURNS TABLE(value text, field_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.value, cf.name
  FROM public.order_custom_values v
  LEFT JOIN public.custom_fields cf ON cf.id = v.custom_field_id
  WHERE v.order_id = _order_id;
$$;

CREATE OR REPLACE FUNCTION public.get_public_order_stages(_owner uuid)
RETURNS TABLE(stage_id uuid, name text, stage_position int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name, position FROM public.order_stages WHERE user_id = _owner ORDER BY position;
$$;

CREATE OR REPLACE FUNCTION public.get_owner_whatsapp(_owner uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT whatsapp_number FROM public.user_settings WHERE user_id = _owner LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_tracking_owner(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_order(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_order_items(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_order_files(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_order_custom_values(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_order_stages(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_owner_whatsapp(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_tracking_owner(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_order(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_order_items(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_order_files(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_order_custom_values(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_order_stages(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_whatsapp(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.handle_new_user_subscription() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_tracking_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.redirect_stamp_like_template() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Auth users can delete own shirt templates" ON storage.objects;
CREATE POLICY "Auth users can delete own shirt templates"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'shirt-templates'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Auth users can delete own stamps" ON storage.objects;
CREATE POLICY "Auth users can delete own stamps"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'stamp-catalog'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );
