
GRANT EXECUTE ON FUNCTION app_private.approve_profile(uuid, uuid, public.app_role) TO authenticated;

DO $$
DECLARE
  admin_uid uuid;
  new_email text := 'abteilungsleiterfussball@sus-wesel.de';
  new_pass  text := 'Senna-800';
BEGIN
  SELECT ur.user_id INTO admin_uid
    FROM public.user_roles ur
    WHERE ur.role = 'admin'
    ORDER BY ur.created_at NULLS LAST
    LIMIT 1;

  IF admin_uid IS NULL THEN
    RAISE NOTICE 'No admin user found';
    RETURN;
  END IF;

  UPDATE auth.users
    SET email = new_email,
        encrypted_password = crypt(new_pass, gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = admin_uid;

  UPDATE auth.identities
    SET identity_data = jsonb_set(
          COALESCE(identity_data, '{}'::jsonb),
          '{email}', to_jsonb(new_email), true),
        updated_at = now()
    WHERE user_id = admin_uid AND provider = 'email';

  UPDATE public.profiles
    SET email = new_email
    WHERE user_id = admin_uid;
END $$;
