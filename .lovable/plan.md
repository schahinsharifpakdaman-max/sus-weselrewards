
# Prämien-App SuS Wesel 1920/75 – Schritt 1

Aufbau der Basis-App im Design „Athletic Pro" (Rot #E30613, Schwarz #121212, Off-White, Oswald + Inter). Mobile-first, deutsche UI. Backend über Lovable Cloud (Supabase). Etappenweise nach dem Plan – dieser Schritt liefert das Fundament, weitere Module folgen als eigene Etappen.

## Was in Schritt 1 gebaut wird

**1. Auth & Rollen**
- Login/Signup mit E-Mail + Passwort (Lovable Cloud)
- Drei Rollen: `admin`, `trainer`, `spieler` – gespeichert in separater `user_roles`-Tabelle mit `has_role()`-Funktion (kein Rollenfeld auf `profiles`, Sicherheit gegen Privilege Escalation)
- Geschützte Routen: unauthentifiziert → `/auth`; nach Login → rollenabhängiges Dashboard

**2. Datenmodell (Lovable Cloud, mit RLS und GRANTs)**
- `profiles` – Name, Mannschaft, Status (aktiv/verletzt), Trainer-/Spieler-Kennzeichen
- `user_roles` – user_id + role (Enum: admin/trainer/spieler)
- `teams` – Mannschaften
- `seasons` + `season_settings` – editierbare Werte mit Defaults (5 €/Ligapunkt, Startguthaben 150, Obergrenze 150, 5 € Fehltraining-Abzug, 2 Trainingstage/Woche, Aufstiegstopf 5.000 €, max. 16 Prämienempfänger, Untergrenze 0 €)
- `point_accounts` – ein Konto pro Person, Startwert 150 (per Trigger beim Anlegen einer Person)
- `point_transactions` – vollständiges Buchungsjournal (Datum, Typ, Punkte, Kommentar, gebucht von); nie gelöscht
- `rule_catalog` – Bonus-/Straf-Katalog (vom Admin pflegbar)
- Leere Tabellen-Skelette für spätere Etappen: `trainings`, `training_attendance`, `matches`, `match_participations`, `premium_settlements`
- RLS-Policies: Spieler = nur Lesen eigener Daten + Team-Ranking; Trainer = Lesen alles im eigenen Team, Schreiben Erfassungen; Admin = alles
- Trigger: Kontostand darf durch Boni nicht über 150 steigen (Auffüllung wird gekappt)

**3. Kaderverwaltung** (Admin)
- Liste aller Personen, gruppiert nach Mannschaft
- Neue Person anlegen (Name, Rolle, Mannschaft, Status) – legt automatisch Punktekonto mit 150 an
- Status wechseln (aktiv ↔ verletzt), Person bearbeiten
- Neue Mannschaft anlegen

**4. Saison-Einstellungen** (Admin)
- Formular mit allen Default-Werten aus dem Konzept, alle editierbar
- Aktive Saison auswählen/anlegen

**5. Punktekonto & Buchungsjournal**
- Persönliche Ansicht: großer farbcodierter Kontostand (150 = grün, 100–149 = gelb, <100 = rot), Fortschrittsbalken bis 150
- Chronologisches Journal mit Datum, Typ, ±Punkten, Kommentar, Verbucher
- Admin-Ansicht: Journal aller Personen mit Filter nach Person/Mannschaft
- Storno-Aktion (nur Admin) = Gegenbuchung, keine Löschung

**6. Dashboard (rollenabhängig, Design „Athletic Pro")**
- Header: rundes rotes SuS-Logo (Initiale „W"/„S"), Vereinsname klein, Screentitel, rechts Avatar
- Hero-Karte: Punktestand groß in Oswald, Prämien-Wert in €, roter Fortschrittsbalken
- Quick-Nav: 4 Icon-Buttons zu Training / Spieltag / Aufstieg / Kader (Module noch als „Kommt in Kürze"-Platzhalter)
- Team-Ranking-Ausschnitt (Top 3), für ALLE Rollen sichtbar
- Buchungsjournal – letzte Aktivitäten
- Nächste Termine – rot akzentuiert
- Bottom-Nav (fest): Home / Stats / Kader / Settings

**7. Demo-Daten** (Migration)
- 1 Mannschaft „1. Herren"
- 18 Spieler + 2 Trainer, alle mit Konto = 150
- 1 Admin-User (dem eingeloggten User zuweisbar)
- Aktive Saison mit Standard-Einstellungen
- Bonus-/Straf-Katalog vorbefüllt (Heimspiel-Dienst +15, Arbeitsdienst +10, Jugend-Support +10, Trainerstrafe −25)
- Ein paar Beispielbuchungen für optische Verifikation

**8. Navigation zu späteren Modulen**
- Routen `/training`, `/spieltag`, `/aufstiegstopf` existieren mit Platzhalter-Seite („In Vorbereitung – Etappe 2/3/5")
- Sie sind bereits in Bottom-Nav / Quick-Nav verlinkt

## Was NICHT in Schritt 1 kommt

Wird laut Plan in späteren Etappen gebaut, damit jede Stufe testbar bleibt:
- Etappe 2: Trainingsmodul mit Anwesenheit + Automatikbuchungen
- Etappe 3: Spieltag-Modul mit Prämienberechnung + CSV-Export
- Etappe 4: manuelle Buchungen aus Katalog + Trainerstrafe UI
- Etappe 5: Aufstiegstopf mit Simulation + Saisonabschluss + Dashboards fein
- Etappe 6: RLS-Sicherheitscheck (Scan + Härtung)

## Technische Details

- **Stack:** TanStack Start + React + Tailwind v4 (bestehend), shadcn/ui, Lovable Cloud (Supabase Auth + Postgres + RLS)
- **Design-Tokens** in `src/styles.css`: `--brand-red: #E30613`, `--brand-dark: #121212`, `--brand-gray: #F8FAFC`, semantische Status-Farben grün/gelb/rot, Radius groß (2xl/3xl wie Prototyp)
- **Fonts:** Oswald (Zahlen/Display) + Inter (UI) via `@fontsource`
- **Routen** (TanStack file-based):
  - `/` – Login-Redirect oder Dashboard
  - `/auth` – Login/Signup
  - `/_authenticated/dashboard`
  - `/_authenticated/konto` – eigenes Punktekonto + Journal
  - `/_authenticated/kader` – Kaderverwaltung (Admin/Trainer lesend)
  - `/_authenticated/einstellungen` – Saison-Settings (Admin)
  - `/_authenticated/training` – Platzhalter
  - `/_authenticated/spieltag` – Platzhalter
  - `/_authenticated/aufstiegstopf` – Platzhalter
- **Punkte-Cap-Trigger:** `BEFORE INSERT ON point_transactions` → Kontostand wird atomar aktualisiert und bei positiven Buchungen auf max. 150 gedeckelt
- **Erste Registrierung** wird automatisch zum Admin (nur beim allerersten User) – danach vergibt Admin Rollen

Nach Freigabe starte ich mit der Aktivierung von Lovable Cloud und dem SQL-Setup.
