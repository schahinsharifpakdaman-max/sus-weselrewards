import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Anmelden — SuS Wesel Prämien-System" },
      { name: "description", content: "Login und Registrierung für Spieler, Trainer und Abteilungsleitung im Prämien-System von SuS Wesel 1920/75 e.V." },
      { property: "og:title", content: "Anmelden — SuS Wesel Prämien-System" },
      { property: "og:description", content: "Login und Registrierung für Spieler, Trainer und Abteilungsleitung im Prämien-System von SuS Wesel 1920/75 e.V." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && session) {
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error("Anmeldung fehlgeschlagen", { description: error.message });
      return;
    }
    toast.success("Willkommen zurück!");
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: fullName },
      },
    });
    setBusy(false);
    if (error) {
      toast.error("Registrierung fehlgeschlagen", { description: error.message });
      return;
    }
    toast.success("Konto erstellt", { description: "Du bist eingeloggt." });
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen bg-brand-dark text-white flex flex-col">
      {/* Header */}
      <div className="p-6 flex items-center gap-3">
        <div className="size-12 rounded-full bg-brand-red flex items-center justify-center font-display text-2xl">
          W
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/50">SuS Wesel 1920/75 e.V.</p>
          <p className="font-display text-lg tracking-wide">Prämien-System</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md bg-white text-brand-dark rounded-3xl p-6 shadow-2xl shadow-brand-red/20">
          <h1 className="font-display text-3xl uppercase tracking-wide mb-1">Anmelden — SuS Wesel Prämien-System</h1>
          <p className="text-sm text-black/50 mb-6">Für Spieler, Trainer und Abteilungsleitung.</p>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="login">Anmelden</TabsTrigger>
              <TabsTrigger value="signup">Konto anlegen</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="l-email">E-Mail</Label>
                  <Input id="l-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="l-pw">Passwort</Label>
                  <Input id="l-pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full h-12 font-bold uppercase tracking-wide" disabled={busy}>
                  {busy ? "Moment…" : "Anmelden"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <Label htmlFor="s-name">Vor- und Nachname</Label>
                  <Input id="s-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="s-email">E-Mail</Label>
                  <Input id="s-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="s-pw">Passwort (min. 6 Zeichen)</Label>
                  <Input id="s-pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full h-12 font-bold uppercase tracking-wide" disabled={busy}>
                  {busy ? "Moment…" : "Konto erstellen"}
                </Button>
                <p className="text-[11px] text-black/50 text-center">
                  Neue Konten werden als Spieler mit reinen Leserechten angelegt.
                  Erweiterte Rechte (Trainer/Admin) vergibt die Vereinsleitung.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}