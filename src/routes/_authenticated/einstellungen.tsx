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
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/einstellungen")({
  head: () => ({
    meta: [
      { title: "Einstellungen — SuS Wesel Prämien" },
      { name: "description", content: "Saison-Einstellungen, Punkte-Caps, Prämien-Beträge und Regelkatalog für das Prämien-System von SuS Wesel konfigurieren." },
      { property: "og:title", content: "Einstellungen — SuS Wesel Prämien" },
      { property: "og:description", content: "Saison-Einstellungen, Punkte-Caps, Prämien-Beträge und Regelkatalog für das Prämien-System von SuS Wesel konfigurieren." },
      { name: "robots", content: "noindex" },
    ],
  }),
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
      <RuleCatalogEditor />
    </AppShell>
  );
}

type Rule = {
  id: string;
  label: string;
  delta: number;
  admin_only: boolean;
  active: boolean;
  sort_order: number;
};

function RuleCatalogEditor() {
  const qc = useQueryClient();
  const { data: rules } = useQuery({
    queryKey: ["rule_catalog_admin"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rule_catalog")
        .select("*")
        .order("sort_order", { ascending: true });
      return (data ?? []) as Rule[];
    },
  });

  const [newLabel, setNewLabel] = useState("");
  const [newDelta, setNewDelta] = useState<number>(0);
  const [newAdminOnly, setNewAdminOnly] = useState(false);
  const [busy, setBusy] = useState(false);

  async function addRule() {
    if (!newLabel.trim() || !newDelta) {
      toast.error("Bezeichnung und Punkte (≠ 0) erforderlich");
      return;
    }
    setBusy(true);
    const nextSort = ((rules ?? []).at(-1)?.sort_order ?? 0) + 10;
    const { error } = await supabase.from("rule_catalog").insert({
      label: newLabel.trim(),
      delta: newDelta,
      admin_only: newAdminOnly,
      active: true,
      sort_order: nextSort,
    });
    setBusy(false);
    if (error) return toast.error("Anlegen fehlgeschlagen", { description: error.message });
    toast.success("Regel hinzugefügt");
    setNewLabel("");
    setNewDelta(0);
    setNewAdminOnly(false);
    qc.invalidateQueries({ queryKey: ["rule_catalog_admin"] });
    qc.invalidateQueries({ queryKey: ["rules"] });
  }

  async function updateRule(id: string, patch: Partial<Rule>) {
    const { error } = await supabase.from("rule_catalog").update(patch).eq("id", id);
    if (error) return toast.error("Update fehlgeschlagen", { description: error.message });
    qc.invalidateQueries({ queryKey: ["rule_catalog_admin"] });
    qc.invalidateQueries({ queryKey: ["rules"] });
  }

  async function deleteRule(id: string) {
    if (!confirm("Regel wirklich löschen? Bereits gebuchte Einträge bleiben erhalten.")) return;
    const { error } = await supabase.from("rule_catalog").delete().eq("id", id);
    if (error) return toast.error("Löschen fehlgeschlagen", { description: error.message });
    toast.success("Regel gelöscht");
    qc.invalidateQueries({ queryKey: ["rule_catalog_admin"] });
    qc.invalidateQueries({ queryKey: ["rules"] });
  }

  return (
    <section className="bg-white rounded-2xl border border-black/5 p-5 space-y-4 mt-6">
      <div>
        <h2 className="font-display text-xl uppercase">Regel-Katalog</h2>
        <p className="text-xs text-black/50">
          Bonus- und Strafwerte für manuelle Buchungen. Trainer-Strafen kennzeichnen als „Admin only".
        </p>
      </div>

      <div className="divide-y divide-black/5 rounded-xl border border-black/5 overflow-hidden">
        {(rules ?? []).map((r) => (
          <div key={r.id} className="p-3 flex items-center gap-2 flex-wrap">
            <Input
              className="flex-1 min-w-[160px]"
              value={r.label}
              onChange={(e) => updateRule(r.id, { label: e.target.value })}
            />
            <Input
              type="number"
              className="w-20"
              value={String(r.delta)}
              onChange={(e) => updateRule(r.id, { delta: Number(e.target.value) })}
            />
            <label className="flex items-center gap-2 text-xs">
              <Switch
                checked={r.admin_only}
                onCheckedChange={(v) => updateRule(r.id, { admin_only: v })}
              />
              Admin only
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Switch
                checked={r.active}
                onCheckedChange={(v) => updateRule(r.id, { active: v })}
              />
              Aktiv
            </label>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => deleteRule(r.id)}
              title="Löschen"
            >
              <Trash2 className="size-4 text-brand-red" />
            </Button>
          </div>
        ))}
        {(rules ?? []).length === 0 && (
          <p className="p-4 text-sm text-black/40">Noch keine Regeln.</p>
        )}
      </div>

      <div className="rounded-xl border border-dashed border-black/15 p-3 space-y-2">
        <h3 className="text-sm font-bold uppercase tracking-wide">Neue Regel</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            className="flex-1 min-w-[160px]"
            placeholder="Bezeichnung (z. B. Heimspiel-Dienst)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
          <Input
            type="number"
            className="w-24"
            placeholder="±Pkt"
            value={newDelta === 0 ? "" : String(newDelta)}
            onChange={(e) => setNewDelta(Number(e.target.value))}
          />
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={newAdminOnly} onCheckedChange={setNewAdminOnly} />
            Admin only
          </label>
          <Button onClick={addRule} disabled={busy} className="font-bold uppercase">
            <Plus className="size-4 mr-1" /> Hinzufügen
          </Button>
        </div>
      </div>
    </section>
  );
}