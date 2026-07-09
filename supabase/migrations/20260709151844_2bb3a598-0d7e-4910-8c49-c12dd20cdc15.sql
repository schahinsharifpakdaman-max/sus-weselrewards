
-- Etappe 2: Trainingsmodul
CREATE TYPE public.attendance_status AS ENUM ('anwesend','entschuldigt','unentschuldigt','verspaetet');

CREATE TABLE public.trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  season_id uuid REFERENCES public.seasons(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL,
  notes text,
  closed boolean NOT NULL DEFAULT false,
  closed_at timestamptz,
  closed_by uuid REFERENCES auth.users(id),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trainings TO authenticated;
GRANT ALL ON public.trainings TO service_role;
ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainings_select_authenticated" ON public.trainings FOR SELECT TO authenticated USING (true);
CREATE POLICY "trainings_admin_trainer_insert" ON public.trainings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer'));
CREATE POLICY "trainings_admin_trainer_update" ON public.trainings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer'));
CREATE POLICY "trainings_admin_delete" ON public.trainings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trainings_updated_at BEFORE UPDATE ON public.trainings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.training_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id uuid NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.attendance_status NOT NULL DEFAULT 'anwesend',
  late_minutes integer NOT NULL DEFAULT 0 CHECK (late_minutes >= 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (training_id, profile_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_attendance TO authenticated;
GRANT ALL ON public.training_attendance TO service_role;
ALTER TABLE public.training_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_select_authenticated" ON public.training_attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "attendance_admin_trainer_write" ON public.training_attendance FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer'));

CREATE TRIGGER attendance_updated_at BEFORE UPDATE ON public.training_attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX training_attendance_training_idx ON public.training_attendance(training_id);
CREATE INDEX training_attendance_profile_idx ON public.training_attendance(profile_id);
CREATE INDEX trainings_team_date_idx ON public.trainings(team_id, scheduled_at DESC);

-- RPC: Training abschließen und automatische Buchungen erstellen
CREATE OR REPLACE FUNCTION public.close_training(_training_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t record;
  a record;
  d timestamptz;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer')) THEN
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
END;
$$;

REVOKE ALL ON FUNCTION public.close_training(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.close_training(uuid) TO authenticated;
