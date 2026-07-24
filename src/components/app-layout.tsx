import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Sparkles, Settings, Search, Bell, History, LogOut } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "./logo";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/optimizations", label: "Optimizations", icon: Sparkles },
  { to: "/audit", label: "Audit log", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

interface ProfileInfo {
  email: string;
  displayName: string;
  orgName: string;
}

function useProfile() {
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("email, display_name, orgs(name)")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (!mounted || !data) return;
      const orgs = data.orgs as unknown as { name: string } | { name: string }[] | null;
      const orgName = Array.isArray(orgs) ? orgs[0]?.name : orgs?.name;
      setProfile({
        email: data.email ?? userData.user.email ?? "",
        displayName: data.display_name ?? (data.email ?? userData.user.email ?? "").split("@")[0],
        orgName: orgName ?? "Your workspace",
      });
    })();
    return () => {
      mounted = false;
    };
  }, []);
  return profile;
}

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profile = useProfile();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Failed to sign out");
      return;
    }
    navigate({ to: "/sign-in", replace: true });
  }

  const initials = (profile?.displayName ?? profile?.email ?? "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "?";

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex h-16 items-center border-b border-sidebar-border px-5">
          <Link to="/" className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-lg -ml-1 p-1">
            <Logo />
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-6">
          {nav.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors " +
                  (active
                    ? "bg-sidebar-accent text-sidebar-foreground"
                    : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground")
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 shrink-0 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-semibold">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{profile?.orgName ?? "…"}</div>
              <div className="truncate text-xs text-sidebar-muted">{profile?.email ?? ""}</div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-8">
          <div className="relative w-80 max-w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search resources, services…"
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="relative flex h-9 w-9 items-center justify-center rounded-md border border-input bg-card hover:bg-accent">
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-spend" />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
