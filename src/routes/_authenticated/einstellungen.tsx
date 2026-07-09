import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useMyRole } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/einstellungen")({
  head: () => ({ meta: [{ title: "Einstellungen — SuS Wesel Prämien" }] }),
  component: SettingsPage,
});

type Settings = {
  season_id: string;
  premium_per_ligapunkt: number;
  max_premium_players_per_matchday: number;
  point_account_start: number;
  point_account_cap: number;
  premium_deduction_per_missed_training: number;
  training_days_per_week: number;
  aufstiegstopf_euro: number;
  premium_min_euro: number;
};

function SettingsPage() {
  const { data: role } = useMyRole();
  const qc = useQueryClient();

  const { data: initial } = useQuery({
    queryKey: ["settings-full"],
    queryFn: async () => {
      const { data: s } = await supabase.from("seasons").select("id, name").eq("is_active", true).maybeSingle();
      if (!s) return null;
      const { data } = await supabase.from("season_settings").select("*").eq("season_id", s.id).maybeSingle();
      return data as Settings | null;
    },
  });

  const [form, setForm] = useState<Settings | null>(null);
  useEffect(() => {
    if (initial) setForm(initial);
  }, [initial]);

  if (role !== "admin") {
    return (
      <AppShell title="Einstellungen">
        <p className="text-sm text-black/60">Nur Admins können Einstellungen ändern.</p>
      </AppShell>
    );
  }
  if (!form) return <AppShell title="Einstellungen"><p>Lädt…</p></AppShell>;

  async function save() {
    if (!form) return;
    const { season_id, ...rest } = form;
    const { error } = await supabase.from("season_settings").update(rest).eq("season_id", season_id);
    if (error) return toast.error("Speichern fehlgeschlagen", { description: error.message });
    toast.success("Einstellungen gespeichert");
    qc.invalidateQueries();
  }

  function field<K extends keyof Settings>(key: K, label: string, suffix?: string) {
    return (
      <div>
        <Label>{label}</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            step="0.01"
            value={String(form![key])}
            onChange={(e) => setForm({ ...form!, [key]: Number(e.target.value) })}
          />
          {suffix && <span className="text-sm text-black/50 w-8">{suffix}</span>}
        </div>
      </div>
    );
  }

  return (
    <AppShell title="Saison-Einstellungen">
      <div className="bg-white rounded-2xl border border-black/5 p-5 space-y-4">
        {field("premium_per_ligapunkt", "Prämie pro Ligapunkt", "€")}
        {field("max_premium_players_per_matchday", "Max. prämienberechtigte Spieler / Spieltag")}
        {field("point_account_start", "Startguthaben Punktekonto", "Pkt")}
        {field("point_account_cap", "Obergrenze Punktekonto", "Pkt")}
        {field("premium_deduction_per_missed_training", "Prämienabzug je Fehltraining", "€")}
        {field("training_days_per_week", "Trainingstage pro Woche")}
        {field("aufstiegstopf_euro", "Aufstiegstopf", "€")}
        {field("premium_min_euro", "Untergrenze Spieltagsprämie", "€")}
        <Button onClick={save} className="w-full font-bold uppercase">Speichern</Button>
      </div>
    </AppShell>
  );
}