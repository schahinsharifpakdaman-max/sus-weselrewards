
-- Move approve_profile logic into app_private, keep a SECURITY INVOKER wrapper in public
CREATE OR REPLACE FUNCTION app_private.approve_profile(
  _profile_id uuid,
  _team_id uuid,
  _role public.app_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user uuid;
BEGIN
  IF NOT app_private.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT user_id INTO target_user FROM public.profiles WHERE id = _profile_id;
  IF target_user IS NULL THEN
    RAISE EXCEPTION 'profile has no linked user';
  END IF;

  UPDATE public.profiles
    SET is_approved = true,
        team_id = _team_id,
        is_trainer = (_role = 'trainer'),
        requested_role = _role
    WHERE id = _profile_id;

  INSERT INTO public.user_roles (user_id, role)
    VALUES (target_user, _role)
    ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION app_private.approve_profile(uuid, uuid, public.app_role) FROM PUBLIC;

DROP FUNCTION IF EXISTS public.approve_profile(uuid, uuid, public.app_role);

CREATE OR REPLACE FUNCTION public.approve_profile(
  _profile_id uuid,
  _team_id uuid,
  _role public.app_role
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$ SELECT app_private.approve_profile(_profile_id, _team_id, _role) $$;

GRANT EXECUTE ON FUNCTION public.approve_profile(uuid, uuid, public.app_role) TO authenticated;
