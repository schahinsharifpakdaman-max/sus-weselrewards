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
  const [requestedRole, setRequestedRole] = useState<"spieler" | "trainer">("spieler");
  const [signupDone, setSignupDone] = useState(false);
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
        data: { full_name: fullName, requested_role: requestedRole },
      },
    });
    setBusy(false);
    if (error) {
      toast.error("Registrierung fehlgeschlagen", { description: error.message });
      return;
    }
    setSignupDone(true);
    toast.success("Registrierung eingereicht", {
      description: "Die Abteilungsleitung wird dich in Kürze freischalten.",
    });
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
              {signupDone ? (
                <div className="space-y-3 text-sm">
                  <p className="font-bold">Danke für deine Registrierung!</p>
                  <p className="text-black/60">
                    Die Abteilungsleitung wurde informiert und schaltet dich in Kürze frei
                    und ordnet dich einer Mannschaft zu. Anschließend kannst du dich anmelden.
                  </p>
                  <p className="text-black/40 text-xs">
                    Bitte bestätige ggf. deine E-Mail-Adresse über den Link, den wir dir
                    zugeschickt haben.
                  </p>
                </div>
              ) : (
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
                <div>
                  <Label>Ich bin…</Label>
                  <div className="flex gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setRequestedRole("spieler")}
                      className={`flex-1 h-10 rounded-md border text-sm font-bold uppercase tracking-wide ${
                        requestedRole === "spieler"
                          ? "bg-brand-red text-white border-brand-red"
                          : "bg-white text-brand-dark border-black/20"
                      }`}
                    >
                      Spieler
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestedRole("trainer")}
                      className={`flex-1 h-10 rounded-md border text-sm font-bold uppercase tracking-wide ${
                        requestedRole === "trainer"
                          ? "bg-brand-red text-white border-brand-red"
                          : "bg-white text-brand-dark border-black/20"
                      }`}
                    >
                      Trainer
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full h-12 font-bold uppercase tracking-wide" disabled={busy}>
                  {busy ? "Moment…" : "Konto erstellen"}
                </Button>
                <p className="text-[11px] text-black/50 text-center">
                  Neue Konten werden erst nach Freischaltung durch die Abteilungsleitung aktiviert.
                  Anschließend wirst du einer Mannschaft zugeordnet.
                </p>
              </form>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}