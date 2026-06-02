import { createFileRoute, Link } from "@tanstack/react-router";
import type { ComponentType, ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Beef, Flame, Moon, PieChart, Utensils } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import type { DailyLog } from "@/lib/dallas";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard - Progressive Path" }] }),
  component: Dashboard,
});

const PERIODS = [7, 14, 30] as const;

const caloriesConfig = {
  calories: { label: "Calorias", color: "var(--chart-1)" },
} satisfies ChartConfig;

const sleepConfig = {
  sleep: { label: "Sono", color: "var(--chart-2)" },
} satisfies ChartConfig;

const macrosConfig = {
  protein: { label: "Proteina", color: "var(--chart-2)" },
  carbs: { label: "Carboidratos", color: "var(--chart-3)" },
  fat: { label: "Gordura", color: "var(--chart-5)" },
} satisfies ChartConfig;

function Dashboard() {
  const { user } = useAuth();
  const { goals } = useProfile();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(14);

  const {
    data: logs = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["daily_logs", user?.id, "dashboard"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_logs")
        .select("*")
        .eq("user_id", user!.id)
        .order("log_date", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data as DailyLog[];
    },
  });

  const data = useMemo(() => {
    return logs
      .slice(0, period)
      .reverse()
      .map((log) => ({
        date: log.log_date,
        label: formatShortDate(log.log_date),
        calories: toNumber(log.calories),
        protein: toNumber(log.protein_g),
        carbs: toNumber(log.carbs_g),
        fat: toNumber(log.fat_g),
        sleep: toNumber(log.sleep_hours),
      }));
  }, [logs, period]);

  const summary = useMemo(() => {
    const calories = sum(data.map((d) => d.calories));
    const protein = sum(data.map((d) => d.protein));
    const carbs = sum(data.map((d) => d.carbs));
    const fat = sum(data.map((d) => d.fat));
    const sleepAvg = average(data.map((d) => d.sleep));
    const loggedDays = data.filter(
      (d) => d.calories != null || d.protein != null || d.sleep != null,
    ).length;

    return { calories, protein, carbs, fat, sleepAvg, loggedDays };
  }, [data]);

  return (
    <AppShell>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <BarChart3 className="h-6 w-6 text-primary" />
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Sono, calorias e macros dos registros diarios.
          </p>
        </div>
        <div className="flex rounded-xl border border-border bg-card p-1">
          {PERIODS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setPeriod(days)}
              className={`min-w-14 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                period === days
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {days}d
            </button>
          ))}
        </div>
      </header>

      {error ? (
        <section className="rounded-2xl border border-warning/30 bg-warning/10 p-6 text-sm">
          <h2 className="font-semibold text-warning">Nao deu para carregar os registros</h2>
          <p className="mt-2 text-muted-foreground">
            Confira se a migration de macros do daily_logs foi aplicada no Supabase.
          </p>
        </section>
      ) : isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : data.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Salve alguns dias em Registro e Refeicoes para montar os graficos.
          </p>
          <Button asChild className="mt-4 rounded-xl">
            <Link to="/registro">Abrir Registro</Link>
          </Button>
        </section>
      ) : (
        <div className="space-y-6">
          <section className="grid gap-3 md:grid-cols-5">
            <MetricCard
              label="Calorias"
              value={formatNumber(summary.calories, 0)}
              unit="kcal"
              icon={Flame}
            />
            <MetricCard
              label="Proteina"
              value={formatNumber(summary.protein, 0)}
              unit="g"
              icon={Beef}
            />
            <MetricCard
              label="Carboidratos"
              value={formatNumber(summary.carbs, 0)}
              unit="g"
              icon={Utensils}
            />
            <MetricCard label="Gordura" value={formatNumber(summary.fat, 0)} unit="g" icon={PieChart} />
            <MetricCard
              label="Sono medio"
              value={summary.sleepAvg == null ? "-" : summary.sleepAvg.toFixed(1)}
              unit="h"
              icon={Moon}
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <Panel
              title="Calorias por dia"
              hint={
                goals
                  ? `Meta diaria: ${Number(goals.calories).toFixed(0)} kcal`
                  : `${summary.loggedDays} dia(s) com dados`
              }
            >
              <ChartContainer config={caloriesConfig} className="h-72 w-full">
                <BarChart data={data} margin={{ left: 4, right: 12, top: 16, bottom: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="4 6" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tickLine={false} axisLine={false} width={42} />
                  <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                  {goals && (
                    <ReferenceLine
                      y={Number(goals.calories)}
                      stroke="var(--warning)"
                      strokeDasharray="6 6"
                    />
                  )}
                  <Bar dataKey="calories" fill="var(--color-calories)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </Panel>

            <Panel
              title="Sono"
              hint={
                summary.sleepAvg == null
                  ? "Sem sono registrado no periodo"
                  : `Media: ${summary.sleepAvg.toFixed(1)} h`
              }
            >
              <ChartContainer config={sleepConfig} className="h-72 w-full">
                <LineChart data={data} margin={{ left: 4, right: 12, top: 16, bottom: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="4 6" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tickLine={false} axisLine={false} width={34} domain={[0, "dataMax + 1"]} />
                  <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                  <ReferenceLine y={7} stroke="var(--accent)" strokeDasharray="6 6" />
                  <Line
                    type="monotone"
                    dataKey="sleep"
                    stroke="var(--color-sleep)"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "var(--background)" }}
                    connectNulls
                  />
                </LineChart>
              </ChartContainer>
            </Panel>
          </section>

          <Panel
            title="Macros no mesmo grafico"
            hint={
              goals
                ? `Metas: ${goals.protein_g}g prot, ${goals.carbs_g}g carb, ${goals.fat_g}g gord`
                : "Proteina, carboidrato e gordura por dia"
            }
          >
            <ChartContainer config={macrosConfig} className="h-80 w-full">
              <BarChart data={data} margin={{ left: 4, right: 12, top: 16, bottom: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="4 6" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} width={38} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend content={<ChartLegendContent />} />
                <Bar dataKey="protein" fill="var(--color-protein)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="carbs" fill="var(--color-carbs)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="fat" fill="var(--color-fat)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </Panel>
        </div>
      )}
    </AppShell>
  );
}

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  unit,
  icon: Icon,
}: {
  label: string;
  value: string;
  unit: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

function toNumber(value: number | null | undefined) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sum(values: Array<number | null>) {
  return values.reduce((total, value) => total + (value ?? 0), 0);
}

function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value != null);
  if (valid.length === 0) return null;
  return sum(valid) / valid.length;
}

function formatNumber(value: number, digits: number) {
  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatShortDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
    new Date(year, month - 1, day),
  );
}
