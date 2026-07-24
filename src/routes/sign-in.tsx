import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/sign-in")({
  head: () => ({
    meta: [
      { title: "Sign in · Linsiq" },
      { name: "description", content: "Sign in to Linsiq to manage your AI cost optimizations." },
      { property: "og:title", content: "Sign in · Linsiq" },
      { property: "og:description", content: "Sign in to Linsiq to manage your AI cost optimizations." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted && data.user) navigate({ to: "/", replace: true });
      if (mounted) setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") navigate({ to: "/", replace: true });
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "sign-up") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name || undefined },
          },
        });
        if (error) throw error;
        toast.success("Account created", { description: "You're signed in." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Link to="/">
            <Logo />
          </Link>
        </div>
        <Card className="p-6 gap-5">
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight">
              {mode === "sign-in" ? "Sign in" : "Create your account"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "sign-in"
                ? "Access your optimizations and audit log."
                : "Get your own workspace to track savings."}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogle}
            disabled={loading}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.2s2.7-6.2 6-6.2c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.2 14.7 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.6 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z" />
            </svg>
            Continue with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-3">
            {mode === "sign-up" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {mode === "sign-in" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            {mode === "sign-in" ? (
              <>
                No account?{" "}
                <button className="font-medium text-foreground underline-offset-4 hover:underline" onClick={() => setMode("sign-up")}>
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already registered?{" "}
                <button className="font-medium text-foreground underline-offset-4 hover:underline" onClick={() => setMode("sign-in")}>
                  Sign in
                </button>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
