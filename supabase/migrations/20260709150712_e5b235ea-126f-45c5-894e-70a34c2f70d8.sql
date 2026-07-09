
-- =========================================================================
-- ENUMS
-- =========================================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'trainer', 'spieler');
CREATE TYPE public.person_status AS ENUM ('aktiv', 'verletzt');
CREATE TYPE public.transaction_kind AS ENUM (
  'bonus', 'strafe', 'training_unentschuldigt', 'training_verspaetung',
  'spiel_verspaetung', 'spiel_gelb', 'spiel_gelbrot', 'spiel_rot',
  'storno', 'manuell'
);

-- =========================================================================
-- TEAMS
-- =========================================================================
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- PROFILES  (eine Zeile pro Person; user_id ist optional -> Personen ohne Login möglich)
-- =========================================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  status public.person_status NOT NULL DEFAULT 'aktiv',
  is_trainer boolean NOT NULL DEFAULT false,
  aufstieg_beteiligt boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- USER_ROLES  (separate Tabelle -> keine Privilege-Escalation)
-- =========================================================================
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER function to check roles (no recursion into RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- =========================================================================
-- SEASONS + SETTINGS
-- =========================================================================
CREATE TABLE public.seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seasons TO authenticated;
GRANT ALL ON public.seasons TO service_role;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.season_settings (
  season_id uuid PRIMARY KEY REFERENCES public.seasons(id) ON DELETE CASCADE,
  premium_per_ligapunkt numeric(10,2) NOT NULL DEFAULT 5.00,
  max_premium_players_per_matchday int NOT NULL DEFAULT 16,
  point_account_start int NOT NULL DEFAULT 150,
  point_account_cap int NOT NULL DEFAULT 150,
  premium_deduction_per_missed_training numeric(10,2) NOT NULL DEFAULT 5.00,
  training_days_per_week int NOT NULL DEFAULT 2,
  aufstiegstopf_euro numeric(10,2) NOT NULL DEFAULT 5000.00,
  premium_min_euro numeric(10,2) NOT NULL DEFAULT 0.00,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.season_settings TO authenticated;
GRANT ALL ON public.season_settings TO service_role;
ALTER TABLE public.season_settings ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- POINT ACCOUNTS + TRANSACTIONS
-- =========================================================================
CREATE TABLE public.point_accounts (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance int NOT NULL DEFAULT 150,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.point_accounts TO authenticated;
GRANT ALL ON public.point_accounts TO service_role;
ALTER TABLE public.point_accounts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.point_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  kind public.transaction_kind NOT NULL,
  delta int NOT NULL,
  applied_delta int NOT NULL DEFAULT 0, -- tatsächlicher Effekt nach Cap
  comment text,
  rule_id uuid,
  booked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.point_transactions TO authenticated;
GRANT ALL ON public.point_transactions TO service_role;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_pt_profile_time ON public.point_transactions(profile_id, occurred_at DESC);

-- =========================================================================
-- RULE CATALOG
-- =========================================================================
CREATE TABLE public.rule_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  delta int NOT NULL,
  admin_only boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rule_catalog TO authenticated;
GRANT ALL ON public.rule_catalog TO service_role;
ALTER TABLE public.rule_catalog ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- HELPER: updated_at trigger
-- =========================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.season_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_pa_updated BEFORE UPDATE ON public.point_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- TRIGGER: automatische Kontoerstellung + Cap-Logik beim Buchen
-- =========================================================================
CREATE OR REPLACE FUNCTION public.create_point_account_for_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE start_value int;
BEGIN
  SELECT COALESCE((SELECT point_account_start FROM public.season_settings ss
                   JOIN public.seasons s ON s.id = ss.season_id
                   WHERE s.is_active LIMIT 1), 150) INTO start_value;
  INSERT INTO public.point_accounts (profile_id, balance) VALUES (NEW.id, start_value);
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_profile_create_account
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.create_point_account_for_profile();

-- Cap-Logik: berechnet applied_delta und aktualisiert Kontostand atomar
CREATE OR REPLACE FUNCTION public.apply_point_transaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_balance int;
  cap int;
  new_balance int;
  effective int;
BEGIN
  SELECT balance INTO current_balance FROM public.point_accounts
    WHERE profile_id = NEW.profile_id FOR UPDATE;
  IF current_balance IS NULL THEN
    INSERT INTO public.point_accounts (profile_id, balance) VALUES (NEW.profile_id, 150);
    current_balance := 150;
  END IF;

  SELECT COALESCE((SELECT point_account_cap FROM public.season_settings ss
                   JOIN public.seasons s ON s.id = ss.season_id
                   WHERE s.is_active LIMIT 1), 150) INTO cap;

  new_balance := current_balance + NEW.delta;
  IF NEW.delta > 0 AND new_balance > cap THEN
    new_balance := cap;
  END IF;
  effective := new_balance - current_balance;

  UPDATE public.point_accounts
    SET balance = new_balance
    WHERE profile_id = NEW.profile_id;

  NEW.applied_delta := effective;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_apply_tx
BEFORE INSERT ON public.point_transactions
FOR EACH ROW EXECUTE FUNCTION public.apply_point_transaction();

-- =========================================================================
-- AUTH TRIGGER: neuer User -> profile + Rolle (erster User = admin)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count int;
  assigned_role public.app_role;
  new_profile_id uuid;
BEGIN
  SELECT count(*) INTO user_count FROM auth.users;
  IF user_count <= 1 THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'spieler';
  END IF;

  INSERT INTO public.profiles (user_id, full_name, is_trainer)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    assigned_role = 'trainer'
  )
  RETURNING id INTO new_profile_id;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- RLS POLICIES
-- =========================================================================

-- teams: alle lesen, nur admin schreiben
CREATE POLICY "teams_read_all" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "teams_admin_write" ON public.teams FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- profiles: alle authentifizierten lesen (Ranking-Transparenz), admin schreibt
CREATE POLICY "profiles_read_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_admin_write" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- user_roles: user liest eigene Rolle, admin sieht alle, nur admin schreibt (via service_role bei Seeds)
CREATE POLICY "roles_read_own_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles_admin_write" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- seasons + settings: alle lesen, admin schreibt
CREATE POLICY "seasons_read_all" ON public.seasons FOR SELECT TO authenticated USING (true);
CREATE POLICY "seasons_admin_write" ON public.seasons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "settings_read_all" ON public.season_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_admin_write" ON public.season_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- point_accounts: alle lesen (Ranking transparent), Schreiben nur Trigger/Service
CREATE POLICY "accounts_read_all" ON public.point_accounts FOR SELECT TO authenticated USING (true);

-- point_transactions:
--   Lesen: alle (Transparenz), Insert: admin oder trainer
CREATE POLICY "tx_read_all" ON public.point_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "tx_insert_admin_or_trainer" ON public.point_transactions FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'trainer') AND booked_by = auth.uid())
  );

-- rule_catalog: alle lesen, admin schreibt
CREATE POLICY "rules_read_all" ON public.rule_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "rules_admin_write" ON public.rule_catalog FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================================
-- SEED-DATEN: Team, Saison, Settings, Katalog
-- =========================================================================
INSERT INTO public.teams (name) VALUES ('1. Herren');

INSERT INTO public.seasons (name, is_active) VALUES ('Saison 2026/27', true);

INSERT INTO public.season_settings (season_id)
SELECT id FROM public.seasons WHERE is_active = true;

INSERT INTO public.rule_catalog (label, delta, admin_only, sort_order) VALUES
  ('Heimspiel-Dienst (Grill/Getränke/Turnier)', 15, false, 1),
  ('Arbeitsdienst Anlage (Platzpflege)', 10, false, 2),
  ('Jugend-Support (Co-Trainer)', 10, false, 3),
  ('Trainerstrafe: Beleidigung/Bloßstellen Spieler', -25, true, 4);

-- 18 Demo-Spieler + 2 Demo-Trainer (ohne user_id -> keine Logins)
WITH t AS (SELECT id FROM public.teams WHERE name = '1. Herren')
INSERT INTO public.profiles (full_name, team_id, is_trainer)
SELECT n, (SELECT id FROM t), false FROM unnest(ARRAY[
  'Lukas Müller','Max Schmidt','Tim Weber','Jonas Fischer','Paul Wagner',
  'Ben Becker','Leon Schulz','Finn Hoffmann','Noah Koch','Elias Richter',
  'Luis Klein','Felix Wolf','David Neumann','Jan Schwarz','Erik Zimmermann',
  'Moritz Braun','Nils Krüger','Tobias Hartmann'
]) AS n;

WITH t AS (SELECT id FROM public.teams WHERE name = '1. Herren')
INSERT INTO public.profiles (full_name, team_id, is_trainer)
SELECT n, (SELECT id FROM t), true FROM unnest(ARRAY[
  'Trainer Michael Maier','Co-Trainer Stefan Berg'
]) AS n;

-- ein paar Beispielbuchungen
INSERT INTO public.point_transactions (profile_id, kind, delta, comment)
SELECT id, 'training_verspaetung', -3, 'Verspätung 3 Min.'
FROM public.profiles WHERE full_name IN ('Max Schmidt','Ben Becker');

INSERT INTO public.point_transactions (profile_id, kind, delta, comment)
SELECT id, 'spiel_gelb', -15, 'Gelbe Karte wegen Meckerns'
FROM public.profiles WHERE full_name = 'Tim Weber';

INSERT INTO public.point_transactions (profile_id, kind, delta, comment)
SELECT id, 'training_unentschuldigt', -15, 'Unentschuldigt gefehlt'
FROM public.profiles WHERE full_name = 'Jonas Fischer';
