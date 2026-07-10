
-- Self-registration approval flow
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requested_role public.app_role,
  ADD COLUMN IF NOT EXISTS email text;

-- Backfill: all existing profiles are considered approved
UPDATE public.profiles SET is_approved = true WHERE is_approved = false;

-- Rewrite signup handler: create profile as pending, no role granted
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  user_count int;
  req_role public.app_role;
  is_first boolean;
BEGIN
  SELECT count(*) INTO user_count FROM auth.users;
  is_first := user_count <= 1;

  req_role := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'requested_role','')::public.app_role,
    'spieler'
  );

  INSERT INTO public.profiles (user_id, full_name, is_trainer, email, requested_role, is_approved)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    is_first OR req_role = 'trainer',
    NEW.email,
    req_role,
    is_first
  );

  IF is_first THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Approval RPC (admin only)
CREATE OR REPLACE FUNCTION public.approve_profile(
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

REVOKE ALL ON FUNCTION public.approve_profile(uuid, uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_profile(uuid, uuid, public.app_role) TO authenticated;

-- Allow admin to also read pending profiles even without team assignment (already covered by is_staff)

-- Ensure point_account trigger creates account on profile insert (needed for self-signup)
DROP TRIGGER IF EXISTS create_point_account_on_profile ON public.profiles;
CREATE TRIGGER create_point_account_on_profile
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_point_account_for_profile();
