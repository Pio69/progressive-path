import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { INSIGHTS, DAILY_LOGS } from "@/lib/mock-data";
import { CheckCircle2, AlertTriangle, Info, Sparkles } from "lucide-react";

export const Route = createFileRoute("/insights")({
  head: () => ({ meta: [{ title: "Insights — Cutting Tracker" }] }),
  component: Insights,
});

function Insights() {
  const week = DAILY_LOGS.slice(-7);
  const avgCal = Math.round(week.reduce((a, b) => a + b.calories, 0) / 7);
  const avgProt = Math.round(week.reduce((a, b) => a + b.protein, 0) / 7);
  const avgWater = +(week.reduce((a, b) => a + b.water, 0) / 7).toFixed(1);
  const avgSleep = +(week.reduce((a, b) => a + b.sleep, 0) / 7).toFixed(1);
  const trains = week.filter((d) => d.trained).length;
  const cardios = week.filter((d) => d.cardio).length;

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Sparkles className="h-6 w-6 text-accent" /> Insights automáticos
        </h1>
        <p className="text-sm text-muted-foreground">Análise dos últimos 7 dias</p>
      </header>

      <section className="mb-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-muted-foreground">Resumo semanal</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
          <Stat label="Calorias" value={`${avgCal}`} unit="kcal/dia" />
          <Stat label="Proteína" value={`${avgProt}`} unit="g/dia" />
          <Stat label="Água" value={`${avgWater}`} unit="L/dia" />
          <Stat label="Sono" value={`${avgSleep}`} unit="h/dia" />
          <Stat label="Treinos" value={`${trains}`} unit="na semana" />
          <Stat label="Cardios" value={`${cardios}`} unit="na semana" />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {INSIGHTS.map((i, idx) => {
          const cfg = {
            success: { Icon: CheckCircle2, color: "text-success", bg: "bg-success/10", border: "border-success/30" },
            warning: { Icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10", border: "border-warning/30" },
            info: { Icon: Info, color: "text-primary", bg: "bg-primary/10", border: "border-primary/30" },
          }[i.type as "success" | "warning" | "info"];
          const Icon = cfg.Icon;
          return (
            <article key={idx} className={`rounded-2xl border ${cfg.border} ${cfg.bg} p-5`}>
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card ${cfg.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{i.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{i.text}</p>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </AppShell>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      <div className="text-[11px] text-muted-foreground">{unit}</div>
    </div>
  );
}
