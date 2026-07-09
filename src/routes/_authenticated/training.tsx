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
import { CalendarPlus, Lock, Users, ClockAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/training")({
  head: () => ({
    meta: [
      { title: "Training — SuS Wesel Prämien" },
      { name: "description", content: "Trainingseinheiten planen, Anwesenheit erfassen und Fehlzeiten automatisch als Punktabzug ins Prämien-System buchen." },
      { property: "og:title", content: "Training — SuS Wesel Prämien" },
      { property: "og:description", content: "Trainingseinheiten planen, Anwesenheit erfassen und Fehlzeiten automatisch als Punktabzug ins Prämien-System buchen." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TrainingPage,
});

type Training = {
  id: string;
  team_id: string;
  scheduled_at: string;
  notes: string | null;
  closed: boolean;
};

type AttendanceStatus = "anwesend" | "entschuldigt" | "unentschuldigt" | "verspaetet";

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  anwesend: "Anwesend",
  entschuldigt: "Entschuldigt",
  unentschuldigt: "Unentschuldigt",
  verspaetet: "Verspätet",
};

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  anwesend: "bg-emerald-500/10 text-emerald-700",
  entschuldigt: "bg-amber-500/10 text-amber-700",
  unentschuldigt: "bg-brand-red/10 text-brand-red",
  verspaetet: "bg-orange-500/10 text-orange-700",
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TrainingPage() {
  const { data: role } = useMyRole();
  const canManage = role === "admin" || role === "trainer";

  const { data: teams } = useQuery({
    queryKey: ["teams"],
    queryFn: async () =>
      (await supabase.from("teams").select("id, name").order("name")).data ?? [],
  });

  const [teamId, setTeamId] = useState<string>("");
  const activeTeamId = teamId || teams?.[0]?.id || "";

  const { data: trainings } = useQuery<Training[]>({
    queryKey: ["trainings", activeTeamId],
    enabled: !!activeTeamId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trainings")
        .select("id, team_id, scheduled_at, notes, closed")
        .eq("team_id", activeTeamId)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Training[];
    },
  });

  const [openTraining, setOpenTraining] = useState<Training | null>(null);

  return (
    <AppShell title="Training">
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-black/5 p-4 space-y-3">
          <div className="flex items-center gap-3 justify-between">
            <div className="min-w-0">
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
            {canManage && activeTeamId && <NewTrainingDialog teamId={activeTeamId} />}
          </div>
        </div>

        <section className="space-y-2">
          {(trainings ?? []).map((t) => (
            <button
              key={t.id}
              onClick={() => setOpenTraining(t)}
              className="w-full text-left bg-white rounded-2xl border border-black/5 p-4 flex items-center justify-between gap-3 hover:border-brand-red/30 transition-colors"
            >
              <div className="min-w-0">
                <p className="font-bold text-sm">{fmtDate(t.scheduled_at)}</p>
                {t.notes && (
                  <p className="text-[11px] text-black/50 truncate">{t.notes}</p>
                )}
              </div>
              {t.closed ? (
                <span className="text-[10px] uppercase tracking-widest bg-black/5 text-black/60 px-2 py-1 rounded-full flex items-center gap-1">
                  <Lock className="size-3" /> Abgeschlossen
                </span>
              ) : (
                <span className="text-[10px] uppercase tracking-widest bg-brand-red/10 text-brand-red px-2 py-1 rounded-full">
                  Offen
                </span>
              )}
            </button>
          ))}
          {trainings && trainings.length === 0 && (
            <div className="bg-white rounded-2xl border border-black/5 p-8 text-center text-sm text-black/40">
              Noch keine Trainings für diese Mannschaft.
            </div>
          )}
        </section>
      </div>

      {openTraining && (
        <TrainingDetailDialog
          training={openTraining}
          canManage={canManage}
          onClose={() => setOpenTraining(null)}
        />
      )}
    </AppShell>
  );
}

function NewTrainingDialog({ teamId }: { teamId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(19);
  const defaultDT = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  const [scheduled, setScheduled] = useState(defaultDT);
  const [notes, setNotes] = useState("");

  async function create() {
    if (!scheduled) return;
    const { error } = await supabase.from("trainings").insert({
      team_id: teamId,
      scheduled_at: new Date(scheduled).toISOString(),
      notes: notes || null,
    });
    if (error) return toast.error("Anlegen fehlgeschlagen", { description: error.message });
    toast.success("Training angelegt");
    setOpen(false);
    setNotes("");
    qc.invalidateQueries({ queryKey: ["trainings", teamId] });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="font-bold uppercase shrink-0">
          <CalendarPlus className="size-4" /> Termin
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neues Training</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Datum & Uhrzeit</Label>
            <Input
              type="datetime-local"
              value={scheduled}
              onChange={(e) => setScheduled(e.target.value)}
            />
          </div>
          <div>
            <Label>Notizen (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={create}>Anlegen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type AttendanceRow = {
  profile_id: string;
  full_name: string;
  is_trainer: boolean;
  status: AttendanceStatus;
  late_minutes: number;
  attendance_id: string | null;
};

function TrainingDetailDialog({
  training,
  canManage,
  onClose,
}: {
  training: Training;
  canManage: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  const { data: rows } = useQuery<AttendanceRow[]>({
    queryKey: ["training-attendance", training.id],
    queryFn: async () => {
      const [{ data: profiles }, { data: att }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, is_trainer, status")
          .eq("team_id", training.team_id)
          .order("full_name"),
        supabase
          .from("training_attendance")
          .select("id, profile_id, status, late_minutes")
          .eq("training_id", training.id),
      ]);
      const attMap = new Map(
        (att ?? []).map((a) => [a.profile_id, a] as const),
      );
      return (profiles ?? [])
        .filter((p) => p.status === "aktiv")
        .map<AttendanceRow>((p) => {
          const a = attMap.get(p.id);
          return {
            profile_id: p.id,
            full_name: p.full_name,
            is_trainer: p.is_trainer,
            status: (a?.status as AttendanceStatus) ?? "anwesend",
            late_minutes: a?.late_minutes ?? 0,
            attendance_id: a?.id ?? null,
          };
        });
    },
  });

  const [draft, setDraft] = useState<Map<string, { status: AttendanceStatus; late_minutes: number }>>(
    new Map(),
  );

  const effective = useMemo(() => {
    return (rows ?? []).map((r) => {
      const d = draft.get(r.profile_id);
      return d ? { ...r, ...d } : r;
    });
  }, [rows, draft]);

  const counts = useMemo(() => {
    const c = { anwesend: 0, entschuldigt: 0, unentschuldigt: 0, verspaetet: 0 };
    effective.forEach((r) => (c[r.status] += 1));
    return c;
  }, [effective]);

  function updateDraft(pid: string, patch: Partial<{ status: AttendanceStatus; late_minutes: number }>) {
    setDraft((prev) => {
      const next = new Map(prev);
      const cur = next.get(pid) ?? {
        status: rows?.find((r) => r.profile_id === pid)?.status ?? "anwesend",
        late_minutes: rows?.find((r) => r.profile_id === pid)?.late_minutes ?? 0,
      };
      const merged = { ...cur, ...patch };
      if (merged.status !== "verspaetet") merged.late_minutes = 0;
      next.set(pid, merged);
      return next;
    });
  }

  async function save() {
    if (draft.size === 0) return toast.info("Keine Änderungen");
    const payload = Array.from(draft.entries()).map(([pid, v]) => ({
      training_id: training.id,
      profile_id: pid,
      status: v.status,
      late_minutes: v.late_minutes,
    }));
    const { error } = await supabase
      .from("training_attendance")
      .upsert(payload, { onConflict: "training_id,profile_id" });
    if (error) return toast.error("Speichern fehlgeschlagen", { description: error.message });
    toast.success("Anwesenheiten gespeichert");
    setDraft(new Map());
    qc.invalidateQueries({ queryKey: ["training-attendance", training.id] });
  }

  async function closeTraining() {
    if (draft.size > 0) {
      return toast.error("Bitte zuerst Änderungen speichern.");
    }
    if (!confirm("Training abschließen? Automatische Buchungen werden erstellt.")) return;
    const { error } = await supabase.rpc("close_training", { _training_id: training.id });
    if (error) return toast.error("Abschließen fehlgeschlagen", { description: error.message });
    toast.success("Training abgeschlossen — Buchungen erstellt");
    qc.invalidateQueries();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-4" /> {fmtDate(training.scheduled_at)}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-2 text-center">
          {(Object.keys(STATUS_LABELS) as AttendanceStatus[]).map((k) => (
            <div key={k} className={`rounded-lg p-2 ${STATUS_COLORS[k]}`}>
              <p className="font-display text-xl leading-none">{counts[k]}</p>
              <p className="text-[9px] uppercase tracking-widest mt-1">{STATUS_LABELS[k]}</p>
            </div>
          ))}
        </div>

        <div className="divide-y divide-black/5 border border-black/5 rounded-xl">
          {effective.map((r) => (
            <div key={r.profile_id} className="p-3 flex items-center gap-2 justify-between">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{r.full_name}</p>
                {r.is_trainer && (
                  <p className="text-[9px] uppercase tracking-widest text-brand-red">Trainer</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Select
                  value={r.status}
                  onValueChange={(v) =>
                    updateDraft(r.profile_id, { status: v as AttendanceStatus })
                  }
                  disabled={!canManage || training.closed}
                >
                  <SelectTrigger className="h-8 w-[130px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABELS) as AttendanceStatus[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {STATUS_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {r.status === "verspaetet" && (
                  <div className="flex items-center gap-1">
                    <ClockAlert className="size-3 text-orange-600" />
                    <Input
                      type="number"
                      min={0}
                      value={r.late_minutes}
                      onChange={(e) =>
                        updateDraft(r.profile_id, {
                          late_minutes: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      disabled={!canManage || training.closed}
                      className="h-8 w-14 text-xs"
                    />
                    <span className="text-[10px] text-black/50">min</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {effective.length === 0 && (
            <p className="p-4 text-sm text-black/40 text-center">
              Keine aktiven Spieler in dieser Mannschaft.
            </p>
          )}
        </div>

        {training.closed && (
          <p className="text-xs text-black/50 flex items-center gap-2">
            <Lock className="size-3" /> Dieses Training ist abgeschlossen. Buchungen wurden erstellt.
          </p>
        )}

        {canManage && !training.closed && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={save} disabled={draft.size === 0}>
              Speichern
            </Button>
            <Button onClick={closeTraining} className="bg-brand-red hover:bg-brand-red/90">
              Abschließen & buchen
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}