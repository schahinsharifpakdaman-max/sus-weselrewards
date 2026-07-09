import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { session, loading } = useSession();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-gray">
        <div className="font-display text-2xl text-brand-dark/40">SUS WESEL</div>
      </div>
    );
  }
  return <Navigate to={session ? "/dashboard" : "/auth"} replace />;
}
