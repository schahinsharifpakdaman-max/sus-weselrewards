import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Dumbbell } from "lucide-react";

export const Route = createFileRoute("/_authenticated/training")({
  head: () => ({ meta: [{ title: "Training — SuS Wesel Prämien" }] }),
  component: TrainingPage,
});

function TrainingPage() {
  return (
    <AppShell title="Training">
      <div className="bg-white rounded-2xl border border-black/5 p-8 text-center">
        <div className="mx-auto size-16 rounded-full bg-brand-red/10 flex items-center justify-center mb-4">
          <Dumbbell className="size-8 text-brand-red" />
        </div>
        <h2 className="font-display uppercase text-2xl">Trainings-Modul</h2>
        <p className="text-sm text-black/50 mt-2">
          Wird in Etappe 2 gebaut: Terminserien (2×/Woche), Anwesenheits-Erfassung,
          automatische Punktbuchungen (−15 unentschuldigt, −1 pro Verspätungs-Minute).
        </p>
      </div>
    </AppShell>
  );
}