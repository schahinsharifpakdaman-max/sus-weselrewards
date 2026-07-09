import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Home, Users, Dumbbell, Trophy, Settings, LogOut, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile, useMyRole } from "@/hooks/use-session";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/dashboard", icon: Home, label: "Home" },
  { to: "/konto", icon: Wallet, label: "Konto" },
  { to: "/kader", icon: Users, label: "Kader" },
  { to: "/training", icon: Dumbbell, label: "Training" },
  { to: "/aufstiegstopf", icon: Trophy, label: "Aufstieg" },
] as const;

export function AppShell({ children, title }: { children: React.ReactNode; title?: string }) {
  const { data: profile } = useMyProfile();
  const { data: role } = useMyRole();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleLogout() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials = (profile?.full_name ?? "?")
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-brand-gray font-sans text-brand-dark pb-28">
      <header className="bg-white border-b border-black/5 p-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex justify-between items-center">
          <Link to="/dashboard" className="flex items-center gap-3 min-w-0">
            <div className="size-10 bg-brand-red rounded-full flex items-center justify-center text-white font-display text-xl shrink-0">
              W
            </div>
            <div className="min-w-0">
              <h1 className="text-[10px] uppercase tracking-widest font-bold text-black/40 leading-none">
                SuS Wesel 1920/75
              </h1>
              <p className="font-bold truncate text-sm leading-tight">{title ?? "Dashboard"}</p>
            </div>
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-[9px] uppercase tracking-widest text-black/40">Rolle</p>
              <p className="text-xs font-bold uppercase text-brand-red">{role ?? "…"}</p>
            </div>
            <div className="size-10 rounded-full bg-brand-dark text-white flex items-center justify-center font-display outline outline-2 outline-offset-2 outline-brand-red/20">
              {initials || "?"}
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Abmelden">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-black/5 px-2 py-2 flex justify-around items-center z-20">
        {NAV.map((item) => {
          const active =
            location.pathname === item.to ||
            (item.to !== "/dashboard" && location.pathname.startsWith(item.to));
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg transition-colors ${
                active ? "text-brand-red" : "text-black/40 hover:text-black/70"
              }`}
            >
              <Icon className="size-5" />
              <span className="text-[10px] font-bold uppercase tracking-tight">{item.label}</span>
            </Link>
          );
        })}
        {role === "admin" && (
          <Link
            to="/einstellungen"
            className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg transition-colors ${
              location.pathname.startsWith("/einstellungen")
                ? "text-brand-red"
                : "text-black/40 hover:text-black/70"
            }`}
          >
            <Settings className="size-5" />
            <span className="text-[10px] font-bold uppercase tracking-tight">Setup</span>
          </Link>
        )}
      </nav>
    </div>
  );
}

export function balanceColor(balance: number, cap = 150) {
  const ratio = balance / cap;
  if (balance >= cap) return "text-status-success";
  if (ratio >= 0.67) return "text-status-warning";
  return "text-brand-red";
}