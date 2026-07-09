import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, balanceColor } from "@/components/app-shell";
import { useMyProfile, useMyRole, useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Undo2, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { txLabel } from "./dashboard";

export const Route = createFileRoute("/_authenticated/konto")({
  head: () => ({ meta: [{ title: "Punktekonto — SuS Wesel Prämien" }] }),
  component: KontoPage,
});

function KontoPage() {
  const { data: myProfile } = useMyProfile();
  const { data: role } = useMyRole();
  const isPrivileged = role === "admin" || role === "trainer";
  const [personId, setPersonId] = useState<string | null>(null);

  const { data: people } = useQuery({
    queryKey: ["people-basic"],
    enabled: isPrivileged,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, is_trainer")
        .order("full_name");
      return data ?? [];
    },
  });

  const activeId = isPrivileged ? (personId ?? myProfile?.id ?? null) : myProfile?.id ?? null;

  return (
    <AppShell title="Punktekonto">
      <div className="space-y-6">
        {isPrivileged && (
          <div className="flex items-center gap-2">
            <Select value={activeId ?? undefined} onValueChange={(v) => setPersonId(v)}>
              <SelectTrigger className="bg-white flex-1">
                <SelectValue placeholder="Person auswählen" />
              </SelectTrigger>
              <SelectContent>
                {(people ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}{p.is_trainer ? " (Trainer)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <BulkBookingDialog adminOnly={role === "admin"} />
          </div>
        )}

        {activeId && (
          <AccountView
            profileId={activeId}
            canBook={isPrivileged}
            adminOnly={role === "admin"}
          />
        )}
      </div>
    </AppShell>
  );
}

function BulkBookingDialog({ adminOnly }: { adminOnly: boolean }) {
  const qc = useQueryClient();
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [ruleId, setRuleId] = useState<string | null>(null);
  const [customDelta, setCustomDelta] = useState<string>("");
  const [customLabel, setCustomLabel] = useState<string>("");
  const [comment, setComment] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const { data: rules } = useQuery({
    queryKey: ["rules"],
    queryFn: async () => {
      const { data } = await supabase.from("rule_catalog").select("*").eq("active", true).order("sort_order");
      return data ?? [];
    },
  });
  const { data: people } = useQuery({
    queryKey: ["people-bulk"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, is_trainer, status")
        .order("full_name");
      return data ?? [];
    },
  });

  const visibleRules = useMemo(
    () => (rules ?? []).filter((r) => adminOnly || !r.admin_only),
    [rules, adminOnly],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }
  function selectAll(filter: (p: { is_trainer: boolean }) => boolean) {
    setSelected(new Set((people ?? []).filter(filter).map((p) => p.id)));
  }

  async function submit() {
    if (selected.size === 0) return toast.error("Keine Person ausgewählt");
    let delta = 0;
    let label = "";
    let kind: "bonus" | "strafe" | "manuell" = "manuell";
    let ruleRef: string | null = null;
    if (ruleId === "__custom__") {
      delta = Number(customDelta);
      if (!delta) return toast.error("Punkte (≠ 0) erforderlich");
      label = customLabel || "Manuelle Buchung";
      kind = delta > 0 ? "bonus" : "strafe";
    } else {
      const r = (rules ?? []).find((x) => x.id === ruleId);
      if (!r) return toast.error("Regel auswählen");
      delta = r.delta;
      label = r.label;
      kind = r.delta > 0 ? "bonus" : "strafe";
      ruleRef = r.id;
    }

    setBusy(true);
    const rows = Array.from(selected).map((profile_id) => ({
      profile_id,
      kind,
      delta,
      comment: comment || label,
      rule_id: ruleRef,
      booked_by: user?.id,
    }));
    const { error } = await supabase.from("point_transactions").insert(rows);
    setBusy(false);
    if (error) return toast.error("Sammelbuchung fehlgeschlagen", { description: error.message });
    toast.success(`Gebucht: ${label} × ${rows.length}`);
    setSelected(new Set());
    setComment("");
    setRuleId(null);
    setCustomDelta("");
    setCustomLabel("");
    setOpen(false);
    qc.invalidateQueries();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="font-bold uppercase gap-1">
          <Users className="size-4" /> Sammel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display uppercase">Sammelbuchung</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wide">Regel</label>
            <Select value={ruleId ?? undefined} onValueChange={setRuleId}>
              <SelectTrigger><SelectValue placeholder="Regel auswählen…" /></SelectTrigger>
              <SelectContent>
                {visibleRules.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    <span className={`font-display mr-2 ${r.delta > 0 ? "text-status-success" : "text-brand-red"}`}>
                      {r.delta > 0 ? "+" : ""}{r.delta}
                    </span>
                    {r.label}
                  </SelectItem>
                ))}
                {adminOnly && <SelectItem value="__custom__">Freie Buchung…</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {ruleId === "__custom__" && (
            <div className="grid grid-cols-[1fr_100px] gap-2">
              <Input
                placeholder="Bezeichnung"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
              />
              <Input
                type="number"
                placeholder="±Pkt"
                value={customDelta}
                onChange={(e) => setCustomDelta(e.target.value)}
              />
            </div>
          )}

          <Textarea
            placeholder="Kommentar (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wide">
                Personen ({selected.size})
              </label>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => selectAll(() => true)}>Alle</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => selectAll((p) => !p.is_trainer)}>Spieler</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => selectAll((p) => p.is_trainer)}>Trainer</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Keine</Button>
              </div>
            </div>
            <div className="border border-black/10 rounded-xl divide-y divide-black/5 max-h-64 overflow-y-auto">
              {(people ?? []).map((p) => (
                <label key={p.id} className="p-2 flex items-center gap-2 cursor-pointer hover:bg-black/5">
                  <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                  <span className="flex-1 text-sm">{p.full_name}</span>
                  {p.is_trainer && <span className="text-[10px] uppercase text-brand-red font-bold">Trainer</span>}
                </label>
              ))}
            </div>
          </div>

          <Button onClick={submit} disabled={busy || selected.size === 0 || !ruleId} className="w-full font-bold uppercase">
            {busy ? "Buche…" : `Buchen für ${selected.size} Person${selected.size === 1 ? "" : "en"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AccountView({
  profileId,
  canBook,
  adminOnly,
}: {
  profileId: string;
  canBook: boolean;
  adminOnly: boolean;
}) {
  const qc = useQueryClient();
  const { user } = useSession();

  const { data: acc } = useQuery({
    queryKey: ["acc", profileId],
    queryFn: async () => {
      const { data } = await supabase.from("point_accounts").select("balance").eq("profile_id", profileId).maybeSingle();
      return data;
    },
  });

  const { data: tx } = useQuery({
    queryKey: ["tx", profileId],
    queryFn: async () => {
      const { data } = await supabase
        .from("point_transactions")
        .select("id, occurred_at, kind, delta, applied_delta, comment, booked_by")
        .eq("profile_id", profileId)
        .order("occurred_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["p", profileId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name, is_trainer").eq("id", profileId).maybeSingle();
      return data;
    },
  });

  async function storno(t: { id: string; kind: string; applied_delta: number; comment: string | null }) {
    if (!adminOnly) return;
    if (!confirm("Diese Buchung stornieren? Es wird eine Gegenbuchung erzeugt.")) return;
    const { error } = await supabase.from("point_transactions").insert({
      profile_id: profileId,
      kind: "storno",
      delta: -t.applied_delta,
      comment: `Storno von: ${txLabel(t.kind)}${t.comment ? " – " + t.comment : ""}`,
      booked_by: user?.id,
    });
    if (error) return toast.error("Storno fehlgeschlagen", { description: error.message });
    toast.success("Storno gebucht");
    qc.invalidateQueries();
  }

  const balance = acc?.balance ?? 150;

  return (
    <div className="space-y-6">
      <section className="bg-brand-dark rounded-3xl p-6 text-white">
        <p className="text-white/60 text-xs uppercase tracking-widest">{profile?.full_name}</p>
        <div className="flex items-baseline gap-2 mt-1">
          <span className={`text-7xl font-display leading-none ${balanceColor(balance)}`}>{balance}</span>
          <span className="text-white/40 font-display text-2xl">/ 150</span>
        </div>
      </section>

      {canBook && <BookingForm profileId={profileId} adminOnly={adminOnly} />}

      <section className="space-y-2">
        <h3 className="font-display text-lg uppercase px-1">Buchungsjournal</h3>
        {(tx ?? []).length === 0 ? (
          <p className="text-sm text-black/40 px-1">Noch keine Buchungen.</p>
        ) : (
          <div className="bg-white rounded-2xl border border-black/5 divide-y divide-black/5 overflow-hidden">
            {tx!.map((t) => {
              const delta = t.applied_delta || t.delta;
              return (
                <div key={t.id} className="p-4 flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-sm">{txLabel(t.kind)}</p>
                    <p className="text-[11px] text-black/40 truncate">
                      {new Date(t.occurred_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
                      {t.comment ? ` · ${t.comment}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className={`font-display text-xl ${delta > 0 ? "text-status-success" : "text-brand-red"}`}>
                      {delta > 0 ? "+" : ""}{delta}
                    </div>
                    {adminOnly && t.kind !== "storno" && (
                      <Button variant="ghost" size="icon" onClick={() => storno(t)} title="Stornieren">
                        <Undo2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function BookingForm({ profileId, adminOnly }: { profileId: string; adminOnly: boolean }) {
  const qc = useQueryClient();
  const { user } = useSession();
  const [ruleId, setRuleId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: rules } = useQuery({
    queryKey: ["rules"],
    queryFn: async () => {
      const { data } = await supabase.from("rule_catalog").select("*").eq("active", true).order("sort_order");
      return data ?? [];
    },
  });

  const visible = useMemo(
    () => (rules ?? []).filter((r) => adminOnly || !r.admin_only),
    [rules, adminOnly],
  );

  async function book(e: React.FormEvent) {
    e.preventDefault();
    if (!ruleId) return;
    const rule = (rules ?? []).find((r) => r.id === ruleId);
    if (!rule) return;
    setBusy(true);
    const { error } = await supabase.from("point_transactions").insert({
      profile_id: profileId,
      kind: rule.delta > 0 ? "bonus" : "strafe",
      delta: rule.delta,
      comment: comment || rule.label,
      rule_id: rule.id,
      booked_by: user?.id,
    });
    setBusy(false);
    if (error) return toast.error("Buchung fehlgeschlagen", { description: error.message });
    toast.success(`Gebucht: ${rule.label}`);
    setComment("");
    setRuleId(null);
    qc.invalidateQueries();
  }

  return (
    <form onSubmit={book} className="bg-white rounded-2xl border border-black/5 p-4 space-y-3">
      <h3 className="font-display text-lg uppercase">Buchung aus Katalog</h3>
      <Select value={ruleId ?? undefined} onValueChange={setRuleId}>
        <SelectTrigger>
          <SelectValue placeholder="Regel auswählen…" />
        </SelectTrigger>
        <SelectContent>
          {visible.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              <span className="flex items-center gap-2">
                <span className={`font-display ${r.delta > 0 ? "text-status-success" : "text-brand-red"}`}>
                  {r.delta > 0 ? "+" : ""}{r.delta}
                </span>
                <span>{r.label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Textarea
        placeholder="Kommentar (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <Button type="submit" disabled={!ruleId || busy} className="w-full font-bold uppercase">
        {busy ? "Buche…" : "Buchen"}
      </Button>
    </form>
  );
}