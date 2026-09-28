CREATE OR REPLACE FUNCTION app_private.is_approved_member()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_approved)
      OR app_private.is_staff()
$$;
REVOKE ALL ON FUNCTION app_private.is_approved_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.is_approved_member() TO authenticated;

DROP POLICY IF EXISTS teams_read_all ON public.teams;
CREATE POLICY teams_read_approved ON public.teams FOR SELECT TO authenticated USING (app_private.is_approved_member());
DROP POLICY IF EXISTS rules_read_all ON public.rule_catalog;
CREATE POLICY rules_read_approved ON public.rule_catalog FOR SELECT TO authenticated USING (app_private.is_approved_member());
DROP POLICY IF EXISTS seasons_read_all ON public.seasons;
CREATE POLICY seasons_read_approved ON public.seasons FOR SELECT TO authenticated USING (app_private.is_approved_member());
DROP POLICY IF EXISTS settings_read_all ON public.season_settings;
CREATE POLICY settings_read_approved ON public.season_settings FOR SELECT TO authenticated USING (app_private.is_approved_member());
DROP POLICY IF EXISTS trainings_select_authenticated ON public.trainings;
CREATE POLICY trainings_read_approved ON public.trainings FOR SELECT TO authenticated USING (app_private.is_approved_member());
DROP POLICY IF EXISTS matches_select_authenticated ON public.matches;
CREATE POLICY matches_read_approved ON public.matches FOR SELECT TO authenticated USING (app_private.is_approved_member());