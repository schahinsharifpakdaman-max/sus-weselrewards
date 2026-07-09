import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Dumbbell, Calendar, Trophy, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, balanceColor } from "@/components/app-shell";
import { useMyProfile } from "@/hooks/use-session";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — SuS Wesel Prämien" },
      { name: "description", content: "Persönliches Dashboard mit aktuellem Punktestand, letzten Buchungen und Schnellzugriff auf Training, Spieltag und Aufstiegstopf." },
      { property: "og:title", content: "Dashboard — SuS Wesel Prämien" },
      { property: "og:description", content: "Persönliches Dashboard mit aktuellem Punktestand, letzten Buchungen und Schnellzugriff auf Training, Spieltag und Aufstiegstopf." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

export function txLabel(kind: string) {
  switch (kind) {
    case "training_unentschuldigt": return "Unentschuldigt gefehlt";
    case "training_verspaetung": return "Verspätung Training";
    case "spiel_verspaetung": return "Verspätung Spieltag";
    case "spiel_gelb": return "Gelbe Karte (Meckern)";
    case "spiel_gelbrot": return "Gelb-Rot (Meckern)";
    case "spiel_rot": return "Rote Karte (Meckern)";
    case "bonus": return "Bonus";
    case "strafe": return "Strafe";
    case "storno": return "Storno";
    case "manuell": return "Manuelle Buchung";
    default: return kind;
  }
}

function DashboardPage() {
  const { data: profile } = useMyProfile();

  const { data: account } = useQuery({
    queryKey: ["account", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("point_accounts")
        .select("balance")
        .eq("profile_id", profile!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: ranking } = useQuery({
    queryKey: ["ranking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("point_accounts")
        .select("balance, profiles!inner(id, full_name, is_trainer)")
        .order("balance", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const { data: myTx } = useQuery({
    queryKey: ["my-tx", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("point_transactions")
        .select("id, occurred_at, kind, delta, applied_delta, comment")
        .eq("profile_id", profile!.id)
        .order("occurred_at", { ascending: false })
        .limit(4);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["active-settings"],
    queryFn: async () => {
      const { data: s } = await supabase.from("seasons").select("id").eq("is_active", true).maybeSingle();
      if (!s) return null;
      const { data } = await supabase.from("season_settings").select("*").eq("season_id", s.id).maybeSingle();
      return data;
    },
  });

  const balance = account?.balance ?? 150;
  const cap = settings?.point_account_cap ?? 150;
  const premiumPer = settings?.premium_per_ligapunkt ?? 5;
  const seasonPremium = 0;

  return (
    <AppShell title="Dashboard">
      <div className="space-y-6">
        <section className="bg-brand-dark rounded-3xl p-6 text-white shadow-xl shadow-brand-red/10 relative overflow-hidden">
          <div className="relative z-10 flex justify-between items-end gap-4">
            <div className="space-y-1">
              <p className="text-white/60 text-xs font-medium uppercase tracking-widest">Punktekonto</p>
              <div className="flex items-baseline gap-2">
                <span className={`text-7xl font-display leading-none ${balanceColor(balance, cap)}`}>
                  {balance}
                </span>
                <span className="text-white/40 font-display text-2xl">/ {cap}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white/60 text-[10px] uppercase tracking-widest mb-1">Saison-Prämie</p>
              <p className="text-3xl font-display text-brand-red">
                {seasonPremium.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
              </p>
              <p className="text-[10px] text-white/40 mt-1">{premiumPer} € / Ligapunkt</p>
            </div>
          </div>
          <div className="mt-6">
            <Progress
              value={(balance / cap) * 100}
              className="h-2 bg-white/10 [&>div]:bg-brand-red"
            />
          </div>
          <div className="absolute -right-8 -bottom-8 size-40 bg-brand-red/10 rounded-full blur-3xl" />
        </section>

        <section className="grid grid-cols-4 gap-3">
          {[
            { to: "/training" as const, label: "Training", Icon: Dumbbell },
            { to: "/spieltag" as const, label: "Spieltag", Icon: Calendar },
            { to: "/aufstiegstopf" as const, label: "Aufstieg", Icon: Trophy },
            { to: "/kader" as const, label: "Kader", Icon: Users },
          ].map(({ to, label, Icon }) => (
            <Link key={to} to={to} className="flex flex-col items-center gap-2">
              <div className="size-14 bg-white rounded-2xl shadow-sm flex items-center justify-center border border-black/5">
                <Icon className="size-6 text-brand-red" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
            </Link>
          ))}
        </section>

        <section className="bg-white rounded-2xl p-5 border border-black/5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-display text-lg uppercase">Team-Ranking</h3>
            <Link to="/kader" className="text-xs font-bold text-brand-red">Alle ansehen</Link>
          </div>
          <div className="space-y-3">
            {(ranking ?? []).map((row, i) => {
              const p = row.profiles as { id: string; full_name: string; is_trainer: boolean };
              const isMe = profile?.id === p.id;
              return (
                <div key={p.id} className={`flex items-center justify-between ${isMe ? "" : "opacity-80"}`}>
                  <div className="flex items-center gap-3">
                    <span className={`w-5 font-display text-lg ${i === 0 ? "text-brand-red" : ""}`}>
                      {i + 1}.
                    </span>
                    <span className={`text-sm ${isMe ? "font-bold" : ""}`}>
                      {p.full_name}
                      {isMe && <span className="text-brand-red text-[10px] ml-1">(DU)</span>}
                    </span>
                  </div>
                  <span className={`font-display text-lg ${balanceColor(row.balance)}`}>
                    {row.balance} Pkt
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="font-display text-lg uppercase px-1">Letzte Aktivitäten</h3>
          {(myTx ?? []).length === 0 ? (
            <p className="text-sm text-black/40 px-1">Noch keine Buchungen.</p>
          ) : (
            <div className="space-y-2">
              {myTx!.map((t) => {
                const delta = t.applied_delta || t.delta;
                return (
                  <div
                    key={t.id}
                    className="bg-white p-4 rounded-xl border border-black/5 flex justify-between items-center"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-sm">{txLabel(t.kind)}</p>
                      <p className="text-xs text-black/40 truncate">
                        {new Date(t.occurred_at).toLocaleDateString("de-DE")}
                        {t.comment ? ` · ${t.comment}` : ""}
                      </p>
                    </div>
                    <div className={`font-display text-lg shrink-0 ${delta > 0 ? "text-status-success" : "text-brand-red"}`}>
                      {delta > 0 ? "+" : ""}{delta}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-brand-red/5 border border-brand-red/10 rounded-2xl p-5">
          <h3 className="font-display text-lg uppercase text-brand-red mb-1">Nächste Termine</h3>
          <p className="text-xs text-black/50">
            Werden ab Etappe 2 (Trainings-Modul) automatisch angezeigt.
          </p>
        </section>
      </div>
    </AppShell>
  );
}