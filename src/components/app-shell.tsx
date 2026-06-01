import { Link, useLocation, Navigate } from "@tanstack/react-router";
import { Activity, Home, Utensils, LineChart, Target, Ruler, Sparkles, ClipboardEdit, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/registro", label: "Registro", icon: ClipboardEdit },
  { to: "/refeicoes", label: "Refeições", icon: Utensils },
  { to: "/evolucao", label: "Evolução", icon: LineChart },
  { to: "/metas", label: "Metas", icon: Target },
  { to: "/medidas", label: "Medidas", icon: Ruler },
  { to: "/insights", label: "Insights", icon: Sparkles },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-card/40 px-4 py-6 lg:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-none">Cutting Tracker</div>
            <div className="mt-1 text-xs text-muted-foreground">Foco em 98kg</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = pathname === n.to;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">Streak</div>
            <div className="mt-1 text-2xl font-semibold">12 dias</div>
            <div className="mt-1 text-xs text-accent">Mantém o foco 🔥</div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border bg-card/40 px-3 py-2">
            <div className="truncate text-xs text-muted-foreground" title={user.email ?? ""}>
              {user.email}
            </div>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-1 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Activity className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold">Cutting Tracker</span>
        </div>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-1 rounded-md p-1.5 text-xs text-muted-foreground hover:text-foreground"
          aria-label="Sair"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      <main className="pb-24 lg:ml-64 lg:pb-8">
        <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border bg-card/95 px-2 py-2 backdrop-blur lg:hidden">
        {NAV.slice(0, 5).map((n) => {
          const Icon = n.icon;
          const active = pathname === n.to;
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[10px]",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
