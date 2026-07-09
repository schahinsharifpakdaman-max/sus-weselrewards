
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.apply_point_transaction() FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.create_point_account_for_profile() FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.enforce_nomination_limit() FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, authenticated, anon;
