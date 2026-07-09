import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useMyRole } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Trophy, Lock } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/aufstiegstopf")({
  head: () => ({ meta: [{ title: "Aufstiegstopf — SuS Wesel Prämien" }] }),
  component: AufstiegPage,
});

function fmtEuro(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
}

function AufstiegPage() {
  const qc = useQueryClient();
  const { data: role } = useMyRole();
  const isAdmin = role === "admin";

  const { data: season } = useQuery({
    queryKey: ["season-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("seasons")
        .select("id, name, is_active")
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["settings-aufstieg", season?.id],
    enabled: !!season,
    queryFn: async () => {
      const { data } = await supabase
        .from("season_settings")
        .select("aufstiegstopf_euro, point_account_cap, premium_min_euro")
        .eq("season_id", season!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: people } = useQuery({
    queryKey: ["aufstieg-people"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, aufstieg_beteiligt, is_trainer, point_accounts(balance)")
        .eq("is_trainer", false)
        .eq("aufstieg_beteiligt", true)
        .order("full_name");
      return (data ?? []).map((p) => ({
        id: p.id as string,
        full_name: p.full_name as string,
        balance: (Array.isArray(p.point_accounts)
          ? p.point_accounts[0]?.balance
          : (p.point_accounts as { balance: number } | null)?.balance) ?? 150,
      }));
    },
  });

  const cap = settings?.point_account_cap ?? 150;
  const pot = Number(settings?.aufstiegstopf_euro ?? 0);
  const minPayout = Number(settings?.premium_min_euro ?? 0);

  const sim = useMemo(() => {
    const list = people ?? [];
    if (list.length === 0) return { rows: [], base: 0, distributed: 0, rest: pot };
    const base = pot / list.length;
    const rows = list
      .map((p) => {
        const ratio = Math.min(p.balance / cap, 1);
        const raw = base * ratio;
        const payout = Math.max(raw, raw > 0 ? minPayout : 0);
        return { ...p, ratio, payout: Math.round(payout * 100) / 100 };
      })
      .sort((a, b) => b.payout - a.payout);
    const distributed = rows.reduce((s, r) => s + r.payout, 0);
    return { rows, base, distributed, rest: Math.max(pot - distributed, 0) };
  }, [people, pot, cap, minPayout]);

  const { data: settlements } = useQuery({
    queryKey: ["settlements", season?.id],
    enabled: !!season,
    queryFn: async () => {
      const { data } = await supabase
        .from("premium_settlements")
        .select("*, profiles(full_name)")
        .eq("season_id", season!.id)
        .order("total_euro", { ascending: false });
      return data ?? [];
    },
  });

  const [closing, setClosing] = useState(false);
  async function closeSeason() {
    if (!season) return;
    if (!confirm(`Saison "${season.name}" wirklich abschließen? Anteile werden verbindlich verbucht.`)) return;
    setClosing(true);
    const { error } = await supabase.rpc("close_season", { _season_id: season.id });
    setClosing(false);
    if (error) return toast.error("Abschluss fehlgeschlagen", { description: error.message });
    toast.success("Saison abgeschlossen – Abrechnung liegt vor.");
    qc.invalidateQueries();
  }

  return (
    <AppShell title="Aufstiegstopf">
      <div className="space-y-5">
        <section className="bg-brand-dark rounded-3xl p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-brand-red flex items-center justify-center">
              <Trophy className="size-5" />
            </div>
            <div>
              <p className="text-white/60 text-xs uppercase tracking-widest">
                {season?.name ?? "Keine aktive Saison"}
              </p>
              <p className="font-display text-4xl leading-tight">{fmtEuro(pot)}</p>
            </div>
          </div>
          <p className="text-white/50 text-xs mt-3">
            Basis-Anteil je Spieler ({sim.rows.length}): <span className="text-white">{fmtEuro(sim.base)}</span>
          </p>
          <div className="mt-3">
            <Progress value={pot > 0 ? (sim.distributed / pot) * 100 : 0} className="h-2" />
            <div className="flex justify-between text-[11px] mt-1 text-white/60">
              <span>Verteilt: {fmtEuro(sim.distributed)}</span>
              <span>Rest im Topf: {fmtEuro(sim.rest)}</span>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-black/5 overflow-hidden">
          <header className="px-4 py-3 flex items-center justify-between">
            <h3 className="font-display uppercase text-lg">Simulation</h3>
            <span className="text-[10px] uppercase tracking-widest text-black/40">
              voller Anteil bei {cap} Pkt
            </span>
          </header>
          <div className="divide-y divide-black/5">
            {sim.rows.length === 0 && (
              <p className="p-4 text-sm text-black/40">
                Keine berechtigten Spieler. In der Kaderverwaltung „Aufstiegstopf" aktivieren.
              </p>
            )}
            {sim.rows.map((r) => (
              <div key={r.id} className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{r.full_name}</p>
                  <div className="mt-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className="h-full bg-brand-red"
                      style={{ width: `${Math.round(r.ratio * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display text-lg leading-none">{fmtEuro(r.payout)}</p>
                  <p className="text-[10px] text-black/40">
                    {r.balance} Pkt · {Math.round(r.ratio * 100)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {(settlements?.length ?? 0) > 0 && (
          <section className="bg-white rounded-2xl border border-black/5 overflow-hidden">
            <header className="px-4 py-3 bg-black/5">
              <h3 className="font-display uppercase text-lg flex items-center gap-2">
                <Lock className="size-4" /> Abrechnung (verbindlich)
              </h3>
            </header>
            <div className="divide-y divide-black/5">
              {(settlements ?? []).map((s: any) => (
                <div key={s.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{s.profiles?.full_name}</p>
                    <p className="text-[10px] text-black/40">
                      Aufstieg {fmtEuro(Number(s.payout_euro))} · Spieltage {fmtEuro(Number(s.matchday_premium_euro))}
                    </p>
                  </div>
                  <p className="font-display text-lg">{fmtEuro(Number(s.total_euro))}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {isAdmin && season && (
          <Button
            onClick={closeSeason}
            disabled={closing || sim.rows.length === 0}
            variant="destructive"
            className="w-full h-12 font-bold uppercase"
          >
            {closing ? "Rechne ab…" : "Saison abschließen & auszahlen"}
          </Button>
        )}
      </div>
    </AppShell>
  );
}