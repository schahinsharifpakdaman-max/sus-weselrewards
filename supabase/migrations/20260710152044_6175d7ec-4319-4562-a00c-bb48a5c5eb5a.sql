-- Allow admins to manage point accounts created by the profile insert trigger
DROP POLICY IF EXISTS "point_accounts_admin_write" ON public.point_accounts;
CREATE POLICY "point_accounts_admin_write"
ON public.point_accounts
FOR ALL
TO authenticated
USING (app_private.has_role(auth.uid(), 'admin'))
WITH CHECK (app_private.has_role(auth.uid(), 'admin'));

-- Make the account creation trigger idempotent so manual/profile flows cannot fail on an existing account
CREATE OR REPLACE FUNCTION public.create_point_account_for_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE start_value int;
BEGIN
  SELECT COALESCE((SELECT point_account_start FROM public.season_settings ss
                   JOIN public.seasons s ON s.id = ss.season_id
                   WHERE s.is_active LIMIT 1), 150) INTO start_value;
  INSERT INTO public.point_accounts (profile_id, balance)
  VALUES (NEW.id, start_value)
  ON CONFLICT (profile_id) DO NOTHING;
  RETURN NEW;
END; $function$;