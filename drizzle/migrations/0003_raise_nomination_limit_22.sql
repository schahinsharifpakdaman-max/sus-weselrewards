ALTER TABLE public.season_settings ALTER COLUMN max_premium_players_per_matchday SET DEFAULT 22;

UPDATE public.season_settings SET max_premium_players_per_matchday = 22;

CREATE OR REPLACE FUNCTION public.enforce_nomination_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  cap int;
  cnt int;
BEGIN
  IF NEW.nominated IS TRUE THEN
    SELECT COALESCE(ss.max_premium_players_per_matchday, 22)
      INTO cap
      FROM public.matches m
      LEFT JOIN public.season_settings ss ON ss.season_id = m.season_id
      WHERE m.id = NEW.match_id;
    IF cap IS NULL THEN cap := 22; END IF;

    SELECT count(*) INTO cnt FROM public.match_participations
      WHERE match_id = NEW.match_id AND nominated = true
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    IF cnt >= cap THEN
      RAISE EXCEPTION 'Nominierungslimit für dieses Spiel erreicht (max %)', cap;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;