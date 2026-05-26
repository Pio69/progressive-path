import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { USER, TODAY, DAILY_LOGS } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Flame, Beef, Droplets, Dumbbell, Plus, ClipboardEdit, Target, TrendingDown, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cutting Tracker — Acompanhamento de perda de peso" },
      { name: "description", content: "Acompanhe peso, calorias, proteína, água e treinos durante seu cutting." },
    ],
  }),
  component: Home,
});

function calorieTone(c: number) {
  if (c <= 2100) return "success" as const;
  if (c <= 2400) return "warning" as const;
  return "destructive" as const;
}
function proteinTone(p: number) {
  if (p >= 160) return "success" as const;
  if (p >= 130) return "warning" as const;
  return "destructive" as const;
}

function Home() {
  const lost = +(USER.startWeight - TODAY.weight).toFixed(1);
  const remaining = +(TODAY.weight - USER.goalWeight).toFixed(1);
  const totalToLose = USER.startWeight - USER.goalWeight;
  const progress = Math.min(100, Math.round((lost / totalToLose) * 100));
  const lastWeek = DAILY_LOGS.slice(-7);
  const avgWeek = +(lastWeek.reduce((a, b) => a + b.weight, 0) / lastWeek.length).toFixed(1);
  const weeklyRate = +(DAILY_LOGS[DAILY_LOGS.length - 8].weight - TODAY.weight).toFixed(1);
  const daysToGoal = weeklyRate > 0 ? Math.ceil((remaining / weeklyRate) * 7) : 120;
  const cTone = calorieTone(TODAY.calories);
  const pTone = proteinTone(TODAY.protein);
  const onTarget = cTone === "success" && pTone !== "destructive";

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-card to-accent/10 p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground">{greet}, {USER.name}</div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
                Mais {remaining.toFixed(1)} kg até a meta.
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Você já perdeu <span className="text-accent">{lost} kg</span> desde o início. Continue firme.
              </p>
            </div>
            {onTarget && (
              <div className="inline-flex items-center gap-2 rounded-full border border-success/40 bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
                <CheckCircle2 className="h-4 w-4" /> Dia dentro da meta
              </div>
            )}
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{USER.startWeight} kg</span>
              <span>{progress}% rumo a {USER.goalWeight} kg</span>
              <span>{USER.goalWeight} kg</span>
            </div>
            <Progress value={progress} className="mt-2 h-3" />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-xl">
              <Link to="/registro"><ClipboardEdit className="mr-2 h-4 w-4" />Registrar hoje</Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="rounded-xl">
              <Link to="/refeicoes"><Plus className="mr-2 h-4 w-4" />Adicionar refeição</Link>
            </Button>
          </div>
        </section>

        {/* Stats grid */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Peso atual" value={TODAY.weight} unit="kg" icon={TrendingDown} tone="primary" hint={`Meta ${USER.goalWeight} kg`} />
          <StatCard label="Perdido" value={`-${lost}`} unit="kg" icon={TrendingDown} tone="accent" hint={`em ${DAILY_LOGS.length} dias`} />
          <StatCard label="Calorias hoje" value={TODAY.calories} unit="kcal" icon={Flame} tone={cTone} hint={`Meta ${USER.calorieGoal}`} />
          <StatCard label="Proteína hoje" value={TODAY.protein} unit="g" icon={Beef} tone={pTone} hint={`Meta ${USER.proteinGoal}g`} />
          <StatCard label="Água" value={TODAY.water} unit="L" icon={Droplets} tone="primary" hint={`Meta ${USER.waterGoal}L`} />
          <StatCard label="Treino hoje" value={TODAY.trained ? "Sim" : "Não"} icon={Dumbbell} tone={TODAY.trained ? "success" : "warning"} hint={TODAY.cardio ? "+ cardio" : "sem cardio"} />
          <StatCard label="Média semanal" value={avgWeek} unit="kg" icon={TrendingDown} hint={`${weeklyRate > 0 ? "-" : "+"}${Math.abs(weeklyRate)}kg na semana`} />
          <StatCard label="Dias p/ meta" value={Math.max(daysToGoal, 0)} unit="dias" icon={Target} tone="accent" hint="estimativa" />
        </section>

        {/* Semáforos */}
        <section className="grid gap-3 md:grid-cols-3">
          <SemaphoreCard
            title="Semáforo calorias"
            value={`${TODAY.calories} kcal`}
            zones={[
              { label: "≤ 2100", color: "success", active: cTone === "success" },
              { label: "2100–2400", color: "warning", active: cTone === "warning" },
              { label: "> 2400", color: "destructive", active: cTone === "destructive" },
            ]}
          />
          <SemaphoreCard
            title="Semáforo proteína"
            value={`${TODAY.protein} g`}
            zones={[
              { label: "≥ 160g", color: "success", active: pTone === "success" },
              { label: "130–160g", color: "warning", active: pTone === "warning" },
              { label: "< 130g", color: "destructive", active: pTone === "destructive" },
            ]}
          />
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Streak semanal</div>
            <div className="mt-3 flex items-end gap-1.5">
              {lastWeek.map((d, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-md ${d.trained ? "bg-primary" : "bg-muted"}`}
                    style={{ height: `${d.trained ? 56 : 18}px` }}
                  />
                  <span className="text-[10px] text-muted-foreground">{["D","S","T","Q","Q","S","S"][new Date(d.date).getDay()]}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              {lastWeek.filter(d => d.trained).length} treinos · {lastWeek.filter(d => d.cardio).length} cardios
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function SemaphoreCard({ title, value, zones }: { title: string; value: string; zones: { label: string; color: string; active: boolean }[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
      <div className="mt-4 space-y-2">
        {zones.map((z) => (
          <div key={z.label} className="flex items-center gap-3">
            <div className={`h-2.5 w-2.5 rounded-full bg-${z.color} ${z.active ? "ring-4 ring-offset-0" : "opacity-40"}`}
              style={{ ['--tw-ring-color' as never]: `var(--${z.color})`, opacity: z.active ? 1 : 0.3 }} />
            <span className={`text-sm ${z.active ? "text-foreground font-medium" : "text-muted-foreground"}`}>{z.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
