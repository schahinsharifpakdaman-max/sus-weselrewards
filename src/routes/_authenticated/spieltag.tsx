import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/spieltag")({
  head: () => ({ meta: [{ title: "Spieltag — SuS Wesel Prämien" }] }),
  component: SpieltagPage,
});

function SpieltagPage() {
  return (
    <AppShell title="Spieltag">
      <div className="bg-white rounded-2xl border border-black/5 p-8 text-center">
        <div className="mx-auto size-16 rounded-full bg-brand-red/10 flex items-center justify-center mb-4">
          <Calendar className="size-8 text-brand-red" />
        </div>
        <h2 className="font-display uppercase text-2xl">Spieltag-Modul</h2>
        <p className="text-sm text-black/50 mt-2">
          Wird in Etappe 3 gebaut: Einsatzliste mit hartem 16er-Limit,
          Karten & Verspätung, Prämienberechnung, CSV-Export.
        </p>
      </div>
    </AppShell>
  );
}