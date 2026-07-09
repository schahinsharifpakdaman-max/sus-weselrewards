
-- 1. Internes Schema für Sicherheitsfunktionen
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

-- 2. has_role in app_private (bleibt SECURITY DEFINER, aber außerhalb der PostgREST-API)
CREATE OR REPLACE FUNCTION app_private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;
REVOKE ALL ON FUNCTION app_private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION app_private.is_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin','trainer')
  )
$$;
REVOKE ALL ON FUNCTION app_private.is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.is_staff() TO authenticated;

CREATE OR REPLACE FUNCTION app_private.my_profile_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;
REVOKE ALL ON FUNCTION app_private.my_profile_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.my_profile_id() TO authenticated;

CREATE OR REPLACE FUNCTION app_private.my_team_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;
REVOKE ALL ON FUNCTION app_private.my_team_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.my_team_id() TO authenticated;

CREATE OR REPLACE FUNCTION app_private.profile_in_my_team(_profile_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _profile_id
      AND p.team_id IS NOT NULL
      AND p.team_id = app_private.my_team_id()
  )
$$;
REVOKE ALL ON FUNCTION app_private.profile_in_my_team(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.profile_in_my_team(uuid) TO authenticated;

-- 3. Verweisende Policies neu auf app_private.has_role umbauen.
-- profiles
DROP POLICY IF EXISTS "profiles_read_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_write" ON public.profiles;
CREATE POLICY "profiles_read_scoped" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (team_id IS NOT NULL AND team_id = app_private.my_team_id())
    OR app_private.is_staff()
  );
CREATE POLICY "profiles_admin_write" ON public.profiles
  FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'));

-- teams
DROP POLICY IF EXISTS "teams_read_all" ON public.teams;
DROP POLICY IF EXISTS "teams_admin_write" ON public.teams;
CREATE POLICY "teams_read_all" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "teams_admin_write" ON public.teams FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(),'admin'))
  WITH CHECK (app_private.has_role(auth.uid(),'admin'));

-- user_roles
DROP POLICY IF EXISTS "roles_read_own_or_admin" ON public.user_roles;
DROP POLICY IF EXISTS "roles_admin_write" ON public.user_roles;
CREATE POLICY "roles_read_own_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles_admin_write" ON public.user_roles FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(),'admin'))
  WITH CHECK (app_private.has_role(auth.uid(),'admin'));

-- seasons + settings
DROP POLICY IF EXISTS "seasons_read_all" ON public.seasons;
DROP POLICY IF EXISTS "seasons_admin_write" ON public.seasons;
CREATE POLICY "seasons_read_all" ON public.seasons FOR SELECT TO authenticated USING (true);
CREATE POLICY "seasons_admin_write" ON public.seasons FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(),'admin'))
  WITH CHECK (app_private.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "settings_read_all" ON public.season_settings;
DROP POLICY IF EXISTS "settings_admin_write" ON public.season_settings;
CREATE POLICY "settings_read_all" ON public.season_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_admin_write" ON public.season_settings FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(),'admin'))
  WITH CHECK (app_private.has_role(auth.uid(),'admin'));

-- point_accounts: eigenes Konto, Team-Mitglieder, Staff
DROP POLICY IF EXISTS "accounts_read_all" ON public.point_accounts;
DROP POLICY IF EXISTS "point_accounts_admin_write" ON public.point_accounts;
CREATE POLICY "accounts_read_scoped" ON public.point_accounts
  FOR SELECT TO authenticated
  USING (
    profile_id = app_private.my_profile_id()
    OR app_private.profile_in_my_team(profile_id)
    OR app_private.is_staff()
  );

-- point_transactions: nur eigene, Staff sieht alles; Insert bleibt wie zuvor
DROP POLICY IF EXISTS "tx_read_all" ON public.point_transactions;
DROP POLICY IF EXISTS "tx_insert_admin_or_trainer" ON public.point_transactions;
CREATE POLICY "tx_read_own_or_staff" ON public.point_transactions
  FOR SELECT TO authenticated
  USING (
    profile_id = app_private.my_profile_id()
    OR app_private.is_staff()
  );
CREATE POLICY "tx_insert_admin_or_trainer" ON public.point_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    app_private.has_role(auth.uid(), 'admin')
    OR (app_private.has_role(auth.uid(), 'trainer') AND booked_by = auth.uid())
  );

-- rule_catalog
DROP POLICY IF EXISTS "rules_read_all" ON public.rule_catalog;
DROP POLICY IF EXISTS "rules_admin_write" ON public.rule_catalog;
CREATE POLICY "rules_read_all" ON public.rule_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "rules_admin_write" ON public.rule_catalog FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(),'admin'))
  WITH CHECK (app_private.has_role(auth.uid(),'admin'));

-- trainings
DROP POLICY IF EXISTS "trainings_select_authenticated" ON public.trainings;
DROP POLICY IF EXISTS "trainings_admin_trainer_insert" ON public.trainings;
DROP POLICY IF EXISTS "trainings_admin_trainer_update" ON public.trainings;
DROP POLICY IF EXISTS "trainings_admin_delete" ON public.trainings;
CREATE POLICY "trainings_select_authenticated" ON public.trainings FOR SELECT TO authenticated USING (true);
CREATE POLICY "trainings_admin_trainer_insert" ON public.trainings FOR INSERT TO authenticated
  WITH CHECK (app_private.has_role(auth.uid(),'admin') OR app_private.has_role(auth.uid(),'trainer'));
CREATE POLICY "trainings_admin_trainer_update" ON public.trainings FOR UPDATE TO authenticated
  USING (app_private.has_role(auth.uid(),'admin') OR app_private.has_role(auth.uid(),'trainer'));
CREATE POLICY "trainings_admin_delete" ON public.trainings FOR DELETE TO authenticated
  USING (app_private.has_role(auth.uid(),'admin'));

-- training_attendance
DROP POLICY IF EXISTS "attendance_select_authenticated" ON public.training_attendance;
DROP POLICY IF EXISTS "attendance_admin_trainer_write" ON public.training_attendance;
CREATE POLICY "attendance_select_scoped" ON public.training_attendance
  FOR SELECT TO authenticated
  USING (
    profile_id = app_private.my_profile_id()
    OR app_private.is_staff()
  );
CREATE POLICY "attendance_admin_trainer_write" ON public.training_attendance FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(),'admin') OR app_private.has_role(auth.uid(),'trainer'))
  WITH CHECK (app_private.has_role(auth.uid(),'admin') OR app_private.has_role(auth.uid(),'trainer'));

-- matches
DROP POLICY IF EXISTS "matches_select_authenticated" ON public.matches;
DROP POLICY IF EXISTS "matches_admin_trainer_insert" ON public.matches;
DROP POLICY IF EXISTS "matches_admin_trainer_update" ON public.matches;
DROP POLICY IF EXISTS "matches_admin_delete" ON public.matches;
CREATE POLICY "matches_select_authenticated" ON public.matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "matches_admin_trainer_insert" ON public.matches FOR INSERT TO authenticated
  WITH CHECK (app_private.has_role(auth.uid(),'admin') OR app_private.has_role(auth.uid(),'trainer'));
CREATE POLICY "matches_admin_trainer_update" ON public.matches FOR UPDATE TO authenticated
  USING (app_private.has_role(auth.uid(),'admin') OR app_private.has_role(auth.uid(),'trainer'));
CREATE POLICY "matches_admin_delete" ON public.matches FOR DELETE TO authenticated
  USING (app_private.has_role(auth.uid(),'admin'));

-- match_participations
DROP POLICY IF EXISTS "mp_select_authenticated" ON public.match_participations;
DROP POLICY IF EXISTS "mp_admin_trainer_write" ON public.match_participations;
CREATE POLICY "mp_select_scoped" ON public.match_participations
  FOR SELECT TO authenticated
  USING (
    profile_id = app_private.my_profile_id()
    OR app_private.is_staff()
  );
CREATE POLICY "mp_admin_trainer_write" ON public.match_participations FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(),'admin') OR app_private.has_role(auth.uid(),'trainer'))
  WITH CHECK (app_private.has_role(auth.uid(),'admin') OR app_private.has_role(auth.uid(),'trainer'));

-- premium_settlements
DROP POLICY IF EXISTS "settlements_read_all" ON public.premium_settlements;
DROP POLICY IF EXISTS "settlements_admin_write" ON public.premium_settlements;
CREATE POLICY "settlements_read_scoped" ON public.premium_settlements
  FOR SELECT TO authenticated
  USING (
    profile_id = app_private.my_profile_id()
    OR app_private.is_staff()
  );
CREATE POLICY "settlements_admin_write" ON public.premium_settlements FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(),'admin'))
  WITH CHECK (app_private.has_role(auth.uid(),'admin'));

-- 4. Alte public.has_role und public.close_* durch INVOKER-Wrapper ersetzen.
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- close_training in app_private + INVOKER-Wrapper
CREATE OR REPLACE FUNCTION app_private.close_training(_training_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t record; a record; d timestamptz;
BEGIN
  IF NOT (app_private.has_role(auth.uid(),'admin') OR app_private.has_role(auth.uid(),'trainer')) THEN
    RAISE EXCEPTION 'Nicht berechtigt';
  END IF;
  SELECT * INTO t FROM public.trainings WHERE id = _training_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Training nicht gefunden'; END IF;
  IF t.closed THEN RAISE EXCEPTION 'Training bereits abgeschlossen'; END IF;
  d := t.scheduled_at;
  FOR a IN SELECT * FROM public.training_attendance WHERE training_id = _training_id LOOP
    IF a.status = 'unentschuldigt' THEN
      INSERT INTO public.point_transactions (profile_id, occurred_at, kind, delta, comment, booked_by)
      VALUES (a.profile_id, d, 'training_unentschuldigt', -15,
              'Training ' || to_char(d,'DD.MM.YYYY') || ' — unentschuldigt gefehlt', auth.uid());
    ELSIF a.status = 'verspaetet' AND a.late_minutes > 0 THEN
      INSERT INTO public.point_transactions (profile_id, occurred_at, kind, delta, comment, booked_by)
      VALUES (a.profile_id, d, 'training_verspaetung', -a.late_minutes,
              'Training ' || to_char(d,'DD.MM.YYYY') || ' — ' || a.late_minutes || ' Min. verspätet', auth.uid());
    END IF;
  END LOOP;
  UPDATE public.trainings SET closed = true, closed_at = now(), closed_by = auth.uid() WHERE id = _training_id;
END $$;
REVOKE ALL ON FUNCTION app_private.close_training(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.close_training(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.close_training(_training_id uuid)
RETURNS void
LANGUAGE sql SECURITY INVOKER
SET search_path = public
AS $$ SELECT app_private.close_training(_training_id) $$;
REVOKE ALL ON FUNCTION public.close_training(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_training(uuid) TO authenticated;

-- close_match
CREATE OR REPLACE FUNCTION app_private.close_match(_match_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m record; p record; premium_per_lp numeric; nominated_count int;
  premium_per_player numeric; total_pot numeric; d timestamptz;
BEGIN
  IF NOT (app_private.has_role(auth.uid(),'admin') OR app_private.has_role(auth.uid(),'trainer')) THEN
    RAISE EXCEPTION 'Nicht berechtigt';
  END IF;
  SELECT * INTO m FROM public.matches WHERE id = _match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Spiel nicht gefunden'; END IF;
  IF m.closed THEN RAISE EXCEPTION 'Spiel bereits abgeschlossen'; END IF;
  d := m.scheduled_at;
  SELECT COALESCE(ss.premium_per_ligapunkt, 5)::numeric INTO premium_per_lp
    FROM public.season_settings ss WHERE ss.season_id = m.season_id;
  IF premium_per_lp IS NULL THEN premium_per_lp := 5; END IF;
  SELECT count(*) INTO nominated_count FROM public.match_participations WHERE match_id = _match_id AND nominated = true;
  total_pot := m.ligapunkte * premium_per_lp;
  IF nominated_count > 0 AND total_pot > 0 THEN
    premium_per_player := round(total_pot / nominated_count, 2);
  ELSE premium_per_player := 0; END IF;

  FOR p IN SELECT * FROM public.match_participations WHERE match_id = _match_id LOOP
    IF p.gelb THEN
      INSERT INTO public.point_transactions (profile_id, occurred_at, kind, delta, comment, booked_by)
      VALUES (p.profile_id, d, 'spiel_gelb', -5,
              'Spiel ' || to_char(d,'DD.MM.YYYY') || ' vs. ' || m.opponent || ' — Gelbe Karte', auth.uid());
    END IF;
    IF p.gelbrot THEN
      INSERT INTO public.point_transactions (profile_id, occurred_at, kind, delta, comment, booked_by)
      VALUES (p.profile_id, d, 'spiel_gelbrot', -10,
              'Spiel ' || to_char(d,'DD.MM.YYYY') || ' vs. ' || m.opponent || ' — Gelb-Rot', auth.uid());
    END IF;
    IF p.rot THEN
      INSERT INTO public.point_transactions (profile_id, occurred_at, kind, delta, comment, booked_by)
      VALUES (p.profile_id, d, 'spiel_rot', -20,
              'Spiel ' || to_char(d,'DD.MM.YYYY') || ' vs. ' || m.opponent || ' — Rote Karte', auth.uid());
    END IF;
    IF p.late_minutes > 0 THEN
      INSERT INTO public.point_transactions (profile_id, occurred_at, kind, delta, comment, booked_by)
      VALUES (p.profile_id, d, 'spiel_verspaetung', -p.late_minutes,
              'Spiel ' || to_char(d,'DD.MM.YYYY') || ' vs. ' || m.opponent || ' — ' || p.late_minutes || ' Min. verspätet', auth.uid());
    END IF;
    IF p.nominated THEN
      UPDATE public.match_participations SET premium_euro = premium_per_player WHERE id = p.id;
    ELSE
      UPDATE public.match_participations SET premium_euro = 0 WHERE id = p.id;
    END IF;
  END LOOP;
  UPDATE public.matches SET closed = true, closed_at = now(), closed_by = auth.uid() WHERE id = _match_id;
END $$;
REVOKE ALL ON FUNCTION app_private.close_match(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.close_match(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.close_match(_match_id uuid)
RETURNS void
LANGUAGE sql SECURITY INVOKER
SET search_path = public
AS $$ SELECT app_private.close_match(_match_id) $$;
REVOKE ALL ON FUNCTION public.close_match(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_match(uuid) TO authenticated;

-- close_season
CREATE OR REPLACE FUNCTION app_private.close_season(_season_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record; cfg record; cap int; base numeric; eligible_count int; p record; matchday_sum numeric;
BEGIN
  IF NOT app_private.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Nur Admins dürfen die Saison abschließen';
  END IF;
  SELECT * INTO s FROM public.seasons WHERE id = _season_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Saison nicht gefunden'; END IF;
  SELECT * INTO cfg FROM public.season_settings WHERE season_id = _season_id;
  cap := COALESCE(cfg.point_account_cap, 150);
  SELECT count(*) INTO eligible_count FROM public.profiles pr
    WHERE pr.aufstieg_beteiligt = true AND pr.is_trainer = false;
  IF eligible_count = 0 THEN RAISE EXCEPTION 'Keine berechtigten Spieler für den Aufstiegstopf'; END IF;
  base := COALESCE(cfg.aufstiegstopf_euro, 0)::numeric / eligible_count;
  DELETE FROM public.premium_settlements WHERE season_id = _season_id;
  FOR p IN
    SELECT pr.id, pr.full_name, COALESCE(pa.balance, cap) AS balance
    FROM public.profiles pr
    LEFT JOIN public.point_accounts pa ON pa.profile_id = pr.id
    WHERE pr.aufstieg_beteiligt = true AND pr.is_trainer = false
  LOOP
    SELECT COALESCE(sum(premium_euro),0) INTO matchday_sum
      FROM public.match_participations mp
      JOIN public.matches m ON m.id = mp.match_id
      WHERE m.season_id = _season_id AND mp.profile_id = p.id;
    INSERT INTO public.premium_settlements
      (season_id, profile_id, balance_at_close, share_ratio, base_share_euro, payout_euro, matchday_premium_euro, total_euro)
    VALUES (
      _season_id, p.id, p.balance,
      LEAST(p.balance::numeric / NULLIF(cap,0), 1.0),
      round(base, 2),
      round(base * LEAST(p.balance::numeric / NULLIF(cap,0), 1.0), 2),
      round(matchday_sum, 2),
      round(base * LEAST(p.balance::numeric / NULLIF(cap,0), 1.0) + matchday_sum, 2)
    );
  END LOOP;
  UPDATE public.seasons SET is_active = false WHERE id = _season_id;
END $$;
REVOKE ALL ON FUNCTION app_private.close_season(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.close_season(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.close_season(uuid);
CREATE OR REPLACE FUNCTION public.close_season(_season_id uuid)
RETURNS void
LANGUAGE sql SECURITY INVOKER
SET search_path = public
AS $$ SELECT app_private.close_season(_season_id) $$;
REVOKE ALL ON FUNCTION public.close_season(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_season(uuid) TO authenticated;
