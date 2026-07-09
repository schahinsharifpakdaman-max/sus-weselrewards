
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_point_account_for_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_point_transaction() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
-- has_role bleibt aufrufbar, wird von RLS-Policies genutzt
