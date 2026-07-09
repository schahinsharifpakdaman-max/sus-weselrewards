import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useMyRole } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CalendarPlus, Download, Lock, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/spieltag")({
  head: () => ({
    meta: [
      { title: "Spieltag — SuS Wesel Prämien" },
      { name: "description", content: "Spieltage anlegen, Kader nominieren, Karten und Verspätungen erfassen und Ligapunkt-Prämien automatisch verteilen." },
      { property: "og:title", content: "Spieltag — SuS Wesel Prämien" },
      { property: "og:description", content: "Spieltage anlegen, Kader nominieren, Karten und Verspätungen erfassen und Ligapunkt-Prämien automatisch verteilen." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SpieltagPage,
});

type Match = {
  id: string;
  team_id: string;
  scheduled_at: string;
  opponent: string;
  is_home: boolean;
  ligapunkte: 0 | 1 | 3;
  goals_for: number | null;
  goals_against: number | null;
  notes: string | null;
  closed: boolean;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SpieltagPage() {
  const { data: role } = useMyRole();
  const canManage = role === "admin" || role === "trainer";

  const { data: teams } = useQuery({
    queryKey: ["teams"],
    queryFn: async () =>
      (await supabase.from("teams").select("id, name").order("name")).data ?? [],
  });

  const [teamId, setTeamId] = useState<string>("");
  const activeTeamId = teamId || teams?.[0]?.id || "";

  const { data: matches } = useQuery<Match[]>({
    queryKey: ["matches", activeTeamId],
    enabled: !!activeTeamId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .eq("team_id", activeTeamId)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Match[];
    },
  });

  const [openMatch, setOpenMatch] = useState<Match | null>(null);

  return (
    <AppShell title="Spieltag">
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-black/5 p-4">
          <div className="flex items-center gap-3 justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-widest text-black/40">Mannschaft</p>
              <Select value={activeTeamId} onValueChange={setTeamId}>
                <SelectTrigger className="w-full h-9 mt-1">
                  <SelectValue placeholder="Mannschaft auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {(teams ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {canManage && activeTeamId && <NewMatchDialog teamId={activeTeamId} />}
          </div>
        </div>

        <section className="space-y-2">
          {(matches ?? []).map((m) => (
            <button
              key={m.id}
              onClick={() => setOpenMatch(m)}
              className="w-full text-left bg-white rounded-2xl border border-black/5 p-4 hover:border-brand-red/30 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-black/40">
                    {m.is_home ? "Heim" : "Auswärts"} · {fmtDate(m.scheduled_at)}
                  </p>
                  <p className="font-bold text-sm truncate">
                    {m.is_home ? "SuS Wesel" : m.opponent} –{" "}
                    {m.is_home ? m.opponent : "SuS Wesel"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {m.goals_for !== null && m.goals_against !== null && (
                    <p className="font-display text-xl leading-none">
                      {m.goals_for}:{m.goals_against}
                    </p>
                  )}
                  <p className="text-[10px] uppercase tracking-widest text-brand-red mt-1">
                    {m.ligapunkte} Pkt.
                  </p>
                </div>
              </div>
              <div className="mt-2">
                {m.closed ? (
                  <span className="text-[10px] uppercase tracking-widest bg-black/5 text-black/60 px-2 py-1 rounded-full inline-flex items-center gap-1">
                    <Lock className="size-3" /> Abgeschlossen
                  </span>
                ) : (
                  <span className="text-[10px] uppercase tracking-widest bg-brand-red/10 text-brand-red px-2 py-1 rounded-full">
                    Offen
                  </span>
                )}
              </div>
            </button>
          ))}
          {matches && matches.length === 0 && (
            <div className="bg-white rounded-2xl border border-black/5 p-8 text-center text-sm text-black/40">
              Noch keine Spiele für diese Mannschaft.
            </div>
          )}
        </section>
      </div>

      {openMatch && (
        <MatchDetailDialog
          match={openMatch}
          canManage={canManage}
          onClose={() => setOpenMatch(null)}
        />
      )}
    </AppShell>
  );
}

function NewMatchDialog({ teamId }: { teamId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(15);
  const defaultDT = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  const [scheduled, setScheduled] = useState(defaultDT);
  const [opponent, setOpponent] = useState("");
  const [isHome, setIsHome] = useState(true);
  const [notes, setNotes] = useState("");

  async function create() {
    if (!opponent.trim() || !scheduled) return;
    const { data: season } = await supabase
      .from("seasons")
      .select("id")
      .eq("is_active", true)
      .maybeSingle();
    const { error } = await supabase.from("matches").insert({
      team_id: teamId,
      season_id: season?.id ?? null,
      scheduled_at: new Date(scheduled).toISOString(),
      opponent: opponent.trim(),
      is_home: isHome,
      notes: notes || null,
    });
    if (error) return toast.error("Anlegen fehlgeschlagen", { description: error.message });
    toast.success("Spiel angelegt");
    setOpen(false);
    setOpponent("");
    setNotes("");
    qc.invalidateQueries({ queryKey: ["matches", teamId] });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="font-bold uppercase shrink-0">
          <CalendarPlus className="size-4" /> Spiel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neues Spiel</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Anpfiff</Label>
            <Input
              type="datetime-local"
              value={scheduled}
              onChange={(e) => setScheduled(e.target.value)}
            />
          </div>
          <div>
            <Label>Gegner</Label>
            <Input value={opponent} onChange={(e) => setOpponent(e.target.value)} />
          </div>
          <div>
            <Label>Ort</Label>
            <Select
              value={isHome ? "home" : "away"}
              onValueChange={(v) => setIsHome(v === "home")}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="home">Heim</SelectItem>
                <SelectItem value="away">Auswärts</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notizen</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={create}>Anlegen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type PartRow = {
  profile_id: string;
  full_name: string;
  is_trainer: boolean;
  participation_id: string | null;
  nominated: boolean;
  gelb: boolean;
  gelbrot: boolean;
  rot: boolean;
  late_minutes: number;
  premium_euro: number;
};

function MatchDetailDialog({
  match,
  canManage,
  onClose,
}: {
  match: Match;
  canManage: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["season-settings-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("season_settings")
        .select("premium_per_ligapunkt, max_premium_players_per_matchday")
        .maybeSingle();
      return data ?? { premium_per_ligapunkt: 5, max_premium_players_per_matchday: 16 };
    },
  });

  const { data: rows } = useQuery<PartRow[]>({
    queryKey: ["match-parts", match.id],
    queryFn: async () => {
      const [{ data: profiles }, { data: parts }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, is_trainer, status")
          .eq("team_id", match.team_id)
          .order("full_name"),
        supabase
          .from("match_participations")
          .select("*")
          .eq("match_id", match.id),
      ]);
      const map = new Map((parts ?? []).map((p) => [p.profile_id, p] as const));
      return (profiles ?? [])
        .filter((p) => p.status === "aktiv" && !p.is_trainer)
        .map<PartRow>((p) => {
          const x = map.get(p.id);
          return {
            profile_id: p.id,
            full_name: p.full_name,
            is_trainer: p.is_trainer,
            participation_id: x?.id ?? null,
            nominated: x?.nominated ?? false,
            gelb: x?.gelb ?? false,
            gelbrot: x?.gelbrot ?? false,
            rot: x?.rot ?? false,
            late_minutes: x?.late_minutes ?? 0,
            premium_euro: Number(x?.premium_euro ?? 0),
          };
        });
    },
  });

  const [draft, setDraft] = useState<Map<string, Partial<PartRow>>>(new Map());
  const [ligapunkte, setLigapunkte] = useState<number>(match.ligapunkte);
  const [goalsFor, setGoalsFor] = useState<string>(match.goals_for?.toString() ?? "");
  const [goalsAgainst, setGoalsAgainst] = useState<string>(match.goals_against?.toString() ?? "");

  const effective = useMemo(() => {
    return (rows ?? []).map((r) => ({ ...r, ...(draft.get(r.profile_id) ?? {}) }));
  }, [rows, draft]);

  const nomCount = effective.filter((r) => r.nominated).length;
  const cap = settings?.max_premium_players_per_matchday ?? 16;
  const premPerLp = Number(settings?.premium_per_ligapunkt ?? 5);
  const totalPot = ligapunkte * premPerLp;
  const perPlayer = nomCount > 0 ? Math.round((totalPot / nomCount) * 100) / 100 : 0;

  function updateRow(pid: string, patch: Partial<PartRow>) {
    setDraft((prev) => {
      const next = new Map(prev);
      const cur = next.get(pid) ?? {};
      next.set(pid, { ...cur, ...patch });
      return next;
    });
  }

  async function saveAll() {
    // Update match meta
    const { error: mErr } = await supabase
      .from("matches")
      .update({
        ligapunkte,
        goals_for: goalsFor === "" ? null : Number(goalsFor),
        goals_against: goalsAgainst === "" ? null : Number(goalsAgainst),
      })
      .eq("id", match.id);
    if (mErr) return toast.error("Spiel-Speichern fehlgeschlagen", { description: mErr.message });

    if (draft.size > 0) {
      const payload = effective
        .filter((r) => draft.has(r.profile_id))
        .map((r) => ({
          match_id: match.id,
          profile_id: r.profile_id,
          nominated: r.nominated,
          gelb: r.gelb,
          gelbrot: r.gelbrot,
          rot: r.rot,
          late_minutes: r.late_minutes,
        }));
      const { error } = await supabase
        .from("match_participations")
        .upsert(payload, { onConflict: "match_id,profile_id" });
      if (error) return toast.error("Speichern fehlgeschlagen", { description: error.message });
    }

    toast.success("Gespeichert");
    setDraft(new Map());
    qc.invalidateQueries({ queryKey: ["match-parts", match.id] });
    qc.invalidateQueries({ queryKey: ["matches", match.team_id] });
  }

  async function closeMatch() {
    if (draft.size > 0) return toast.error("Bitte zuerst Änderungen speichern.");
    if (!confirm("Spiel abschließen? Karten & Verspätung werden gebucht, Prämien verteilt.")) return;
    const { error } = await supabase.rpc("close_match", { _match_id: match.id });
    if (error) return toast.error("Abschließen fehlgeschlagen", { description: error.message });
    toast.success("Spiel abgeschlossen — Prämien verteilt");
    qc.invalidateQueries();
    onClose();
  }

  function exportCsv() {
    const header = "Spieler;Nominiert;Gelb;Gelb-Rot;Rot;Verspätung (Min);Prämie (€)";
    const lines = effective
      .filter((r) => r.nominated || r.gelb || r.gelbrot || r.rot || r.late_minutes > 0)
      .map((r) =>
        [
          r.full_name,
          r.nominated ? "Ja" : "Nein",
          r.gelb ? "Ja" : "",
          r.gelbrot ? "Ja" : "",
          r.rot ? "Ja" : "",
          r.late_minutes || "",
          r.premium_euro.toFixed(2).replace(".", ","),
        ].join(";"),
      );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spieltag_${new Date(match.scheduled_at).toISOString().slice(0, 10)}_${match.opponent}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="size-4 text-brand-red" />
            {match.is_home ? "Heim" : "Auswärts"} vs. {match.opponent}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-[10px] uppercase tracking-widest">Tore für</Label>
            <Input
              type="number"
              min={0}
              value={goalsFor}
              onChange={(e) => setGoalsFor(e.target.value)}
              disabled={!canManage || match.closed}
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-widest">Tore gegen</Label>
            <Input
              type="number"
              min={0}
              value={goalsAgainst}
              onChange={(e) => setGoalsAgainst(e.target.value)}
              disabled={!canManage || match.closed}
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-widest">Ligapunkte</Label>
            <Select
              value={String(ligapunkte)}
              onValueChange={(v) => setLigapunkte(Number(v))}
              disabled={!canManage || match.closed}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 (Sieg)</SelectItem>
                <SelectItem value="1">1 (Unent.)</SelectItem>
                <SelectItem value="0">0 (Nied.)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg p-2 bg-black/5">
            <p className="font-display text-lg leading-none">{nomCount}/{cap}</p>
            <p className="text-[9px] uppercase tracking-widest mt-1">Nominiert</p>
          </div>
          <div className="rounded-lg p-2 bg-brand-red/10 text-brand-red">
            <p className="font-display text-lg leading-none">{totalPot.toFixed(0)} €</p>
            <p className="text-[9px] uppercase tracking-widest mt-1">Prämientopf</p>
          </div>
          <div className="rounded-lg p-2 bg-emerald-500/10 text-emerald-700">
            <p className="font-display text-lg leading-none">{perPlayer.toFixed(2)} €</p>
            <p className="text-[9px] uppercase tracking-widest mt-1">Pro Spieler</p>
          </div>
        </div>

        <div className="divide-y divide-black/5 border border-black/5 rounded-xl">
          <div className="grid grid-cols-[1fr_auto] px-3 py-2 bg-black/5 text-[9px] uppercase tracking-widest text-black/50">
            <span>Spieler</span>
            <span>Nom · G · GR · R · Min</span>
          </div>
          {effective.map((r) => {
            const dis = !canManage || match.closed;
            return (
              <div key={r.profile_id} className="p-2 flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{r.full_name}</p>
                  {match.closed && r.premium_euro > 0 && (
                    <p className="text-[10px] text-emerald-700">
                      Prämie: {r.premium_euro.toFixed(2)} €
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    checked={r.nominated}
                    onCheckedChange={(v) => updateRow(r.profile_id, { nominated: !!v })}
                    disabled={dis || (!r.nominated && nomCount >= cap)}
                    title="Nominiert"
                  />
                  <Checkbox
                    checked={r.gelb}
                    onCheckedChange={(v) => updateRow(r.profile_id, { gelb: !!v })}
                    disabled={dis}
                    className="data-[state=checked]:bg-yellow-500 data-[state=checked]:border-yellow-500"
                    title="Gelb"
                  />
                  <Checkbox
                    checked={r.gelbrot}
                    onCheckedChange={(v) => updateRow(r.profile_id, { gelbrot: !!v })}
                    disabled={dis}
                    className="data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600"
                    title="Gelb-Rot"
                  />
                  <Checkbox
                    checked={r.rot}
                    onCheckedChange={(v) => updateRow(r.profile_id, { rot: !!v })}
                    disabled={dis}
                    className="data-[state=checked]:bg-brand-red data-[state=checked]:border-brand-red"
                    title="Rot"
                  />
                  <Input
                    type="number"
                    min={0}
                    value={r.late_minutes || ""}
                    onChange={(e) =>
                      updateRow(r.profile_id, {
                        late_minutes: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    disabled={dis}
                    className="h-8 w-12 text-xs text-center"
                    placeholder="0"
                  />
                </div>
              </div>
            );
          })}
          {effective.length === 0 && (
            <p className="p-4 text-sm text-black/40 text-center">Keine aktiven Spieler.</p>
          )}
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={exportCsv}>
            <Download className="size-4" /> CSV
          </Button>
          {canManage && !match.closed && (
            <>
              <Button variant="outline" onClick={saveAll}>
                Speichern
              </Button>
              <Button onClick={closeMatch} className="bg-brand-red hover:bg-brand-red/90">
                Abschließen & buchen
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}