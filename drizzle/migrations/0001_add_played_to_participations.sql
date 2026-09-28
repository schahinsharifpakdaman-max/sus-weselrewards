ALTER TABLE public.match_participations ADD COLUMN IF NOT EXISTS played boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION app_private.close_match(_match_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  m record; p record;
  premium_per_lp numeric; deduction_per_missed numeric;
  missed_count int; premium numeric; base_premium numeric;
  d timestamptz; week_start timestamptz; week_end timestamptz;
BEGIN
  IF NOT (app_private.has_role(auth.uid(),'admin') OR app_private.has_role(auth.uid(),'trainer')) THEN
    RAISE EXCEPTION 'Nicht berechtigt';
  END IF;
  SELECT * INTO m FROM public.matches WHERE id = _match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Spiel nicht gefunden'; END IF;
  IF m.closed THEN RAISE EXCEPTION 'Spiel bereits abgeschlossen'; END IF;
  d := m.scheduled_at;
  week_start := date_trunc('week', d);
  week_end := week_start + interval '7 days';
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
    IF p.nominated AND p.played THEN
      SELECT count(*) INTO missed_count
        FROM public.training_attendance ta JOIN public.trainings t ON t.id = ta.training_id
       WHERE ta.profile_id = p.profile_id AND t.team_id = m.team_id
         AND t.scheduled_at >= week_start AND t.scheduled_at < week_end
         AND ta.status IN ('unentschuldigt','entschuldigt');
      premium := GREATEST(base_premium - missed_count * deduction_per_missed, 0);
      UPDATE public.match_participations SET premium_euro = round(premium, 2) WHERE id = p.id;
    ELSE
      UPDATE public.match_participations SET premium_euro = 0 WHERE id = p.id;
    END IF;
  END LOOP;
  UPDATE public.matches SET closed = true, closed_at = now(), closed_by = auth.uid() WHERE id = _match_id;
END $function$;