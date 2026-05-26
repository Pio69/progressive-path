import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { USER, DAILY_LOGS, TODAY } from "@/lib/mock-data";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingDown, Calendar, Gauge } from "lucide-react";

export const Route = createFileRoute("/metas")({
  head: () => ({ meta: [{ title: "Metas — Cutting Tracker" }] }),
  component: Metas,
});

function Metas() {
  const lost = +(USER.startWeight - TODAY.weight).toFixed(1);
  const remaining = +(TODAY.weight - USER.goalWeight).toFixed(1);
  const total = USER.startWeight - USER.goalWeight;
  const progress = Math.round((lost / total) * 100);
  const weeklyRate = +(DAILY_LOGS[DAILY_LOGS.length - 8].weight - TODAY.weight).toFixed(2);
  const weeksLeft = weeklyRate > 0 ? Math.ceil(remaining / weeklyRate) : 0;
  const eta = new Date();
  eta.setDate(eta.getDate() + weeksLeft * 7);

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Metas</h1>
        <p className="text-sm text-muted-foreground">Acompanhamento do cutting até {USER.goalWeight} kg</p>
      </header>

      <section className="rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-card to-accent/10 p-6 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Progresso total</div>
            <div className="mt-1 text-5xl font-semibold tracking-tight">{progress}%</div>
            <div className="mt-1 text-sm text-accent">{lost} kg de {total} kg</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Falta</div>
            <div className="text-3xl font-semibold text-primary">{remaining.toFixed(1)} kg</div>
          </div>
        </div>
        <Progress value={progress} className="mt-6 h-4" />
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{USER.startWeight} kg</span>
          <span>Hoje · {TODAY.weight} kg</span>
          <span>{USER.goalWeight} kg</span>
        </div>
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-4">
        <MetaCard icon={TrendingDown} label="Peso inicial" value={`${USER.startWeight} kg`} />
        <MetaCard icon={Gauge} label="Peso atual" value={`${TODAY.weight} kg`} tone="primary" />
        <MetaCard icon={Target} label="Meta" value={`${USER.goalWeight} kg`} tone="accent" />
        <MetaCard icon={Calendar} label="Ritmo semanal" value={`${weeklyRate > 0 ? "-" : "+"}${Math.abs(weeklyRate)} kg`} tone={weeklyRate > 0 ? "success" : "warning"} />
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-muted-foreground">Projeção</h2>
        <div className="mt-3 grid gap-6 md:grid-cols-3">
          <div>
            <div className="text-xs text-muted-foreground">Semanas restantes</div>
            <div className="mt-1 text-3xl font-semibold">{weeksLeft}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Data estimada</div>
            <div className="mt-1 text-3xl font-semibold text-primary">{eta.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Ritmo ideal</div>
            <div className="mt-1 text-3xl font-semibold text-accent">0,7 kg/sem</div>
            <div className="text-xs text-muted-foreground">para 120 dias</div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function MetaCard({ icon: Icon, label, value, tone = "default" }: any) {
  const toneClass = { default: "text-foreground", primary: "text-primary", accent: "text-accent", success: "text-success", warning: "text-warning" }[tone as string];
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${toneClass}`} />
      </div>
      <div className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
