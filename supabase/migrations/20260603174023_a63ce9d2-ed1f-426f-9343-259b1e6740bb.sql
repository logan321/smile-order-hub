REVOKE ALL ON FUNCTION public.redirect_stamp_like_template() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redirect_stamp_like_template() FROM anon;
REVOKE ALL ON FUNCTION public.redirect_stamp_like_template() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.redirect_stamp_like_template() TO service_role;