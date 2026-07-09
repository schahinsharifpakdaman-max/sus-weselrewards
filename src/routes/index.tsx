import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SuS Wesel Prämien-System — Punkte- & Prämienverwaltung" },
      { name: "description", content: "Digitales Punkte- und Prämiensystem der Seniorenmannschaften von SuS Wesel 1920/75 e.V. — Training, Spieltag, Aufstiegstopf und Kader in einer App." },
      { property: "og:title", content: "SuS Wesel Prämien-System — Punkte- & Prämienverwaltung" },
      { property: "og:description", content: "Digitales Punkte- und Prämiensystem der Seniorenmannschaften von SuS Wesel 1920/75 e.V. — Training, Spieltag, Aufstiegstopf und Kader in einer App." },
      { property: "og:url", content: "https://sus-weselrewards.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://sus-weselrewards.lovable.app/" }],
  }),
  component: Index,
});

function Index() {
  const { session, loading } = useSession();
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-brand-gray">
        <h1 className="font-display text-2xl text-brand-dark/60">
          SuS Wesel Prämien-System
        </h1>
      </main>
    );
  }
  return <Navigate to={session ? "/dashboard" : "/auth"} replace />;
}
