import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/aufstiegstopf")({
  head: () => ({ meta: [{ title: "Aufstiegstopf — SuS Wesel Prämien" }] }),
  component: AufstiegPage,
});

function AufstiegPage() {
  return (
    <AppShell title="Aufstiegstopf">
      <div className="bg-white rounded-2xl border border-black/5 p-8 text-center">
        <div className="mx-auto size-16 rounded-full bg-brand-red/10 flex items-center justify-center mb-4">
          <Trophy className="size-8 text-brand-red" />
        </div>
        <h2 className="font-display uppercase text-2xl">Aufstiegstopf</h2>
        <p className="text-sm text-black/50 mt-2">
          Wird in Etappe 5 gebaut: Live-Simulation der Verteilung
          (voller Anteil bei 150 Pkt, sonst anteilig), Saisonabschluss.
        </p>
      </div>
    </AppShell>
  );
}