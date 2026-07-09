
-- Etappe 5: Aufstiegstopf + Saisonabschluss
CREATE TABLE public.premium_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance_at_close int NOT NULL,
  share_ratio numeric NOT NULL,
  base_share_euro numeric NOT NULL,
  payout_euro numeric NOT NULL,
  matchday_premium_euro numeric NOT NULL DEFAULT 0,
  total_euro numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_id, profile_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.premium_settlements TO authenticated;
GRANT ALL ON public.premium_settlements TO service_role;
ALTER TABLE public.premium_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settlements_read_all" ON public.premium_settlements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "settlements_admin_write" ON public.premium_settlements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Aufstiegstopf-Abschluss: berechnet Anteile, schreibt Settlement-Zeilen, markiert Saison inaktiv.
CREATE OR REPLACE FUNCTION public.close_season(_season_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  cfg record;
  cap int;
  base numeric;
  eligible_count int;
  p record;
  matchday_sum numeric;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Nur Admins dürfen die Saison abschließen';
  END IF;

  SELECT * INTO s FROM public.seasons WHERE id = _season_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Saison nicht gefunden'; END IF;

  SELECT * INTO cfg FROM public.season_settings WHERE season_id = _season_id;
  cap := COALESCE(cfg.point_account_cap, 150);

  SELECT count(*) INTO eligible_count
    FROM public.profiles pr
    WHERE pr.aufstieg_beteiligt = true AND pr.is_trainer = false;

  IF eligible_count = 0 THEN
    RAISE EXCEPTION 'Keine berechtigten Spieler für den Aufstiegstopf';
  END IF;

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
      _season_id,
      p.id,
      p.balance,
      LEAST(p.balance::numeric / NULLIF(cap,0), 1.0),
      round(base, 2),
      round(base * LEAST(p.balance::numeric / NULLIF(cap,0), 1.0), 2),
      round(matchday_sum, 2),
      round(base * LEAST(p.balance::numeric / NULLIF(cap,0), 1.0) + matchday_sum, 2)
    );
  END LOOP;

  UPDATE public.seasons SET is_active = false WHERE id = _season_id;
END;
$$;

REVOKE ALL ON FUNCTION public.close_season(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_season(uuid) TO authenticated;
