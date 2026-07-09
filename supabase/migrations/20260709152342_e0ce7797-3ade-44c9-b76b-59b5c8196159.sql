
CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  season_id uuid REFERENCES public.seasons(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL,
  opponent text NOT NULL,
  is_home boolean NOT NULL DEFAULT true,
  ligapunkte integer NOT NULL DEFAULT 0 CHECK (ligapunkte IN (0,1,3)),
  goals_for integer,
  goals_against integer,
  notes text,
  closed boolean NOT NULL DEFAULT false,
  closed_at timestamptz,
  closed_by uuid REFERENCES auth.users(id),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "matches_select_authenticated" ON public.matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "matches_admin_trainer_insert" ON public.matches FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer'));
CREATE POLICY "matches_admin_trainer_update" ON public.matches FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer'));
CREATE POLICY "matches_admin_delete" ON public.matches FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER matches_updated_at BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX matches_team_date_idx ON public.matches(team_id, scheduled_at DESC);

CREATE TABLE public.match_participations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nominated boolean NOT NULL DEFAULT true,
  gelb boolean NOT NULL DEFAULT false,
  gelbrot boolean NOT NULL DEFAULT false,
  rot boolean NOT NULL DEFAULT false,
  late_minutes integer NOT NULL DEFAULT 0 CHECK (late_minutes >= 0),
  premium_euro numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, profile_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_participations TO authenticated;
GRANT ALL ON public.match_participations TO service_role;
ALTER TABLE public.match_participations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mp_select_authenticated" ON public.match_participations FOR SELECT TO authenticated USING (true);
CREATE POLICY "mp_admin_trainer_write" ON public.match_participations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer'));

CREATE TRIGGER mp_updated_at BEFORE UPDATE ON public.match_participations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX mp_match_idx ON public.match_participations(match_id);
CREATE INDEX mp_profile_idx ON public.match_participations(profile_id);

CREATE OR REPLACE FUNCTION public.enforce_nomination_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cap int;
  cnt int;
BEGIN
  IF NEW.nominated IS TRUE THEN
    SELECT COALESCE(ss.max_premium_players_per_matchday, 16)
      INTO cap
      FROM public.matches m
      LEFT JOIN public.season_settings ss ON ss.season_id = m.season_id
      WHERE m.id = NEW.match_id;
    IF cap IS NULL THEN cap := 16; END IF;

    SELECT count(*) INTO cnt FROM public.match_participations
      WHERE match_id = NEW.match_id AND nominated = true
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    IF cnt >= cap THEN
      RAISE EXCEPTION 'Nominierungslimit für dieses Spiel erreicht (max %)', cap;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mp_nomination_limit
  BEFORE INSERT OR UPDATE OF nominated ON public.match_participations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_nomination_limit();

CREATE OR REPLACE FUNCTION public.close_match(_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m record;
  p record;
  premium_per_lp numeric;
  nominated_count int;
  premium_per_player numeric;
  total_pot numeric;
  d timestamptz;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer')) THEN
    RAISE EXCEPTION 'Nicht berechtigt';
  END IF;

  SELECT * INTO m FROM public.matches WHERE id = _match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Spiel nicht gefunden'; END IF;
  IF m.closed THEN RAISE EXCEPTION 'Spiel bereits abgeschlossen'; END IF;

  d := m.scheduled_at;

  SELECT COALESCE(ss.premium_per_ligapunkt, 5)::numeric
    INTO premium_per_lp
    FROM public.season_settings ss WHERE ss.season_id = m.season_id;
  IF premium_per_lp IS NULL THEN premium_per_lp := 5; END IF;

  SELECT count(*) INTO nominated_count
    FROM public.match_participations WHERE match_id = _match_id AND nominated = true;

  total_pot := m.ligapunkte * premium_per_lp;
  IF nominated_count > 0 AND total_pot > 0 THEN
    premium_per_player := round(total_pot / nominated_count, 2);
  ELSE
    premium_per_player := 0;
  END IF;

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
END;
$$;

REVOKE ALL ON FUNCTION public.close_match(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.close_match(uuid) TO authenticated;
