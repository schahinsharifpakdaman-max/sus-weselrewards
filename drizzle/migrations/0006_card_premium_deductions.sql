CREATE OR REPLACE FUNCTION app_private.close_match(_match_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  m record; p record;
  premium_per_lp numeric; deduction_per_missed numeric;
  missed_count int; premium numeric; base_premium numeric;
  d timestamptz;
BEGIN
  IF NOT (app_private.has_role(auth.uid(),'admin') OR app_private.has_role(auth.uid(),'trainer')) THEN
    RAISE EXCEPTION 'Nicht berechtigt';
  END IF;
  SELECT * INTO m FROM public.matches WHERE id = _match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Spiel nicht gefunden'; END IF;
  IF m.closed THEN RAISE EXCEPTION 'Spiel bereits abgeschlossen'; END IF;
  d := m.scheduled_at;
  SELECT COALESCE(ss.premium_per_ligapunkt, 5)::numeric, COALESCE(ss.premium_deduction_per_missed_training, 5)::numeric
    INTO premium_per_lp, deduction_per_missed
    FROM public.season_settings ss WHERE ss.season_id = m.season_id;
  IF premium_per_lp IS NULL THEN premium_per_lp := 5; END IF;
  IF deduction_per_missed IS NULL THEN deduction_per_missed := 5; END IF;
  base_premium := m.ligapunkte * premium_per_lp;

  FOR p IN SELECT * FROM public.match_participations WHERE match_id = _match_id LOOP
    IF p.gelb THEN
      INSERT INTO public.point_transactions (profile_id, occurred_at, kind, delta, comment, booked_by)
      VALUES (p.profile_id, d, 'spiel_gelb', -5, 'Spiel ' || to_char(d,'DD.MM.YYYY') || ' vs. ' || m.opponent || ' — Gelbe Karte', auth.uid());
    END IF;
    IF p.gelbrot THEN
      INSERT INTO public.point_transactions (profile_id, occurred_at, kind, delta, comment, booked_by)
      VALUES (p.profile_id, d, 'spiel_gelbrot', -10, 'Spiel ' || to_char(d,'DD.MM.YYYY') || ' vs. ' || m.opponent || ' — Gelb-Rot', auth.uid());
    END IF;
    IF p.rot THEN
      INSERT INTO public.point_transactions (profile_id, occurred_at, kind, delta, comment, booked_by)
      VALUES (p.profile_id, d, 'spiel_rot', -20, 'Spiel ' || to_char(d,'DD.MM.YYYY') || ' vs. ' || m.opponent || ' — Rote Karte', auth.uid());
    END IF;
    IF p.late_minutes > 0 THEN
      INSERT INTO public.point_transactions (profile_id, occurred_at, kind, delta, comment, booked_by)
      VALUES (p.profile_id, d, 'spiel_verspaetung', -p.late_minutes, 'Spiel ' || to_char(d,'DD.MM.YYYY') || ' vs. ' || m.opponent || ' — ' || p.late_minutes || ' Min. verspätet', auth.uid());
    END IF;
    IF p.nominated AND p.played AND NOT p.rot THEN
      missed_count := (CASE WHEN p.training1_present THEN 0 ELSE 1 END) + (CASE WHEN p.training2_present THEN 0 ELSE 1 END);
      premium := base_premium - missed_count * deduction_per_missed
                 - (CASE WHEN p.gelb THEN 5 ELSE 0 END)
                 - (CASE WHEN p.gelbrot THEN 5 ELSE 0 END);
      UPDATE public.match_participations SET premium_euro = round(GREATEST(premium, 0), 2) WHERE id = p.id;
    ELSE
      UPDATE public.match_participations SET premium_euro = 0 WHERE id = p.id;
    END IF;
  END LOOP;
  UPDATE public.matches SET closed = true, closed_at = now(), closed_by = auth.uid() WHERE id = _match_id;
END $function$;