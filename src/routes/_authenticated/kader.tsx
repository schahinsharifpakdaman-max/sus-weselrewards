import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, balanceColor } from "@/components/app-shell";
import { useMyRole } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/kader")({
  head: () => ({
    meta: [
      { title: "Kader — SuS Wesel Prämien" },
      { name: "description", content: "Kaderverwaltung der Seniorenmannschaften: Spieler und Trainer anlegen, Teams zuordnen und Aufstiegstopf-Beteiligung pflegen." },
      { property: "og:title", content: "Kader — SuS Wesel Prämien" },
      { property: "og:description", content: "Kaderverwaltung der Seniorenmannschaften: Spieler und Trainer anlegen, Teams zuordnen und Aufstiegstopf-Beteiligung pflegen." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: KaderPage,
});

type Person = {
  id: string;
  full_name: string;
  team_id: string | null;
  status: "aktiv" | "verletzt";
  is_trainer: boolean;
  aufstieg_beteiligt: boolean;
  point_accounts: { balance: number }[] | { balance: number } | null;
};

function KaderPage() {
  const { data: role } = useMyRole();
  const isAdmin = role === "admin";

  const { data: teams } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => (await supabase.from("teams").select("id, name").order("name")).data ?? [],
  });

  const { data: people } = useQuery<Person[]>({
    queryKey: ["people-with-acc"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, team_id, status, is_trainer, aufstieg_beteiligt, point_accounts(balance)")
        .order("full_name");
      return (data ?? []) as Person[];
    },
  });

  const grouped = new Map<string | null, Person[]>();
  (people ?? []).forEach((p) => {
    const list = grouped.get(p.team_id) ?? [];
    list.push(p);
    grouped.set(p.team_id, list);
  });

  return (
    <AppShell title="Kader">
      <div className="space-y-4">
        {isAdmin && (
          <div className="flex gap-2">
            <AddPersonDialog teams={teams ?? []} />
            <AddTeamDialog />
          </div>
        )}

        {(teams ?? []).map((t) => (
          <section key={t.id} className="bg-white rounded-2xl border border-black/5 overflow-hidden">
            <header className="px-4 py-3 bg-brand-dark text-white flex justify-between items-center">
              <h3 className="font-display uppercase text-lg">{t.name}</h3>
              <span className="text-[10px] uppercase tracking-widest text-white/60">
                {(grouped.get(t.id) ?? []).length} Personen
              </span>
            </header>
            <div className="divide-y divide-black/5">
              {(grouped.get(t.id) ?? []).map((p) => (
                <PersonRow key={p.id} p={p} isAdmin={isAdmin} teams={teams ?? []} />
              ))}
              {(grouped.get(t.id) ?? []).length === 0 && (
                <p className="p-4 text-sm text-black/40">Keine Personen.</p>
              )}
            </div>
          </section>
        ))}

        {(grouped.get(null) ?? []).length > 0 && (
          <section className="bg-white rounded-2xl border border-black/5 overflow-hidden">
            <header className="px-4 py-3 bg-black/5">
              <h3 className="font-display uppercase text-lg">Ohne Mannschaft</h3>
            </header>
            <div className="divide-y divide-black/5">
              {(grouped.get(null) ?? []).map((p) => (
                <PersonRow key={p.id} p={p} isAdmin={isAdmin} teams={teams ?? []} />
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function PersonRow({ p, isAdmin, teams }: { p: Person; isAdmin: boolean; teams: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const balance = Array.isArray(p.point_accounts)
    ? p.point_accounts[0]?.balance ?? 150
    : p.point_accounts?.balance ?? 150;

  async function update(patch: { status?: Person["status"]; team_id?: string | null; aufstieg_beteiligt?: boolean }) {
    const { error } = await supabase.from("profiles").update(patch).eq("id", p.id);
    if (error) return toast.error("Update fehlgeschlagen", { description: error.message });
    qc.invalidateQueries();
  }

  async function remove() {
    if (!confirm(
      `„${p.full_name}" wirklich aus dem Kader entfernen?\n` +
      `Punktekonto und alle Buchungen dieser Person werden ebenfalls gelöscht. ` +
      `Etwaige App-Anmeldung bleibt bestehen.`
    )) return;
    const { error } = await supabase.from("profiles").delete().eq("id", p.id);
    if (error) return toast.error("Löschen fehlgeschlagen", { description: error.message });
    toast.success("Person entfernt");
    qc.invalidateQueries();
  }

  return (
    <div className="p-4 flex justify-between items-center gap-3 flex-wrap">
      <div className="min-w-0">
        <p className="font-bold text-sm">
          {p.full_name}
          {p.is_trainer && <span className="ml-2 text-[10px] uppercase tracking-widest text-brand-red">Trainer</span>}
        </p>
        <p className="text-[11px] text-black/40">
          Status: {p.status}
          {p.aufstieg_beteiligt ? " · Aufstiegstopf" : ""}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className={`font-display text-lg ${balanceColor(balance)}`}>{balance}</span>
        {isAdmin && (
          <>
            <Select value={p.status} onValueChange={(v) => update({ status: v as Person["status"] })}>
              <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aktiv">aktiv</SelectItem>
                <SelectItem value="verletzt">verletzt</SelectItem>
              </SelectContent>
            </Select>
            <Select value={p.team_id ?? "none"} onValueChange={(v) => update({ team_id: v === "none" ? null : v })}>
              <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">(keine)</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={remove}
              title="Person entfernen"
              className="text-brand-red hover:bg-brand-red/10"
            >
              <Trash2 className="size-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function AddPersonDialog({ teams }: { teams: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState<string>(teams[0]?.id ?? "");
  const [isTrainer, setIsTrainer] = useState(false);

  async function add() {
    if (!name.trim()) return;
    const { error } = await supabase
      .from("profiles")
      .insert({ full_name: name.trim(), team_id: teamId || null, is_trainer: isTrainer });
    if (error) return toast.error("Anlegen fehlgeschlagen", { description: error.message });
    toast.success("Person angelegt (Konto = 150)");
    setOpen(false);
    setName("");
    qc.invalidateQueries();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="font-bold uppercase"><Plus className="size-4" /> Person</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Neue Person anlegen</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Vor- und Nachname" />
          </div>
          <div>
            <Label>Mannschaft</Label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
              <SelectContent>
                {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={isTrainer} onCheckedChange={setIsTrainer} />
            Ist Trainer
          </label>
        </div>
        <DialogFooter>
          <Button onClick={add}>Anlegen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddTeamDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  async function add() {
    if (!name.trim()) return;
    const { error } = await supabase.from("teams").insert({ name: name.trim() });
    if (error) return toast.error("Anlegen fehlgeschlagen", { description: error.message });
    toast.success("Mannschaft angelegt");
    setOpen(false);
    setName("");
    qc.invalidateQueries();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="font-bold uppercase">
          <Plus className="size-4" /> Mannschaft
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Neue Mannschaft</DialogTitle></DialogHeader>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. 2. Herren" />
        <DialogFooter>
          <Button onClick={add}>Anlegen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}