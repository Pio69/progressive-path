import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { DAILY_LOGS, weeklyAvgWeight } from "@/lib/mock-data";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";

export const Route = createFileRoute("/evolucao")({
  head: () => ({ meta: [{ title: "Evolução — Cutting Tracker" }] }),
  component: Evolucao,
});

const tooltipStyle = {
  contentStyle: { background: "oklch(0.21 0.02 240)", border: "1px solid oklch(0.3 0.02 240)", borderRadius: 12, fontSize: 12 },
  labelStyle: { color: "oklch(0.68 0.02 240)" },
};

function Evolucao() {
  const data = DAILY_LOGS.map((d) => ({ ...d, label: d.date.slice(5) }));
  const trainData = data.map((d) => ({ label: d.label, treino: d.trained ? 1 : 0, cardio: d.cardio ? 1 : 0 }));

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Evolução</h1>
        <p className="text-sm text-muted-foreground">Últimos 30 dias de acompanhamento</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title="Peso ao longo do tempo" subtitle="kg por dia">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.65 0.18 230)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="oklch(0.65 0.18 230)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="oklch(0.3 0.02 240)" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="oklch(0.68 0.02 240)" fontSize={11} />
              <YAxis stroke="oklch(0.68 0.02 240)" fontSize={11} domain={["dataMin - 1", "dataMax + 1"]} />
              <Tooltip {...tooltipStyle} />
              <Area type="monotone" dataKey="weight" stroke="oklch(0.65 0.18 230)" fill="url(#g1)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Média semanal" subtitle="tendência real do cutting">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={weeklyAvgWeight()}>
              <CartesianGrid stroke="oklch(0.3 0.02 240)" strokeDasharray="3 3" />
              <XAxis dataKey="week" stroke="oklch(0.68 0.02 240)" fontSize={11} />
              <YAxis stroke="oklch(0.68 0.02 240)" fontSize={11} domain={["dataMin - 0.5", "dataMax + 0.5"]} />
              <Tooltip {...tooltipStyle} />
              <Line type="monotone" dataKey="weight" stroke="oklch(0.72 0.17 160)" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Calorias por dia" subtitle="meta 2000 kcal">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data}>
              <CartesianGrid stroke="oklch(0.3 0.02 240)" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="oklch(0.68 0.02 240)" fontSize={11} />
              <YAxis stroke="oklch(0.68 0.02 240)" fontSize={11} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="calories" fill="oklch(0.78 0.16 75)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Proteína por dia" subtitle="meta 160–190g">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data}>
              <CartesianGrid stroke="oklch(0.3 0.02 240)" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="oklch(0.68 0.02 240)" fontSize={11} />
              <YAxis stroke="oklch(0.68 0.02 240)" fontSize={11} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="protein" fill="oklch(0.72 0.17 160)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Água por dia" subtitle="meta 3,5–4L">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data}>
              <CartesianGrid stroke="oklch(0.3 0.02 240)" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="oklch(0.68 0.02 240)" fontSize={11} />
              <YAxis stroke="oklch(0.68 0.02 240)" fontSize={11} />
              <Tooltip {...tooltipStyle} />
              <Area type="monotone" dataKey="water" stroke="oklch(0.65 0.18 230)" fill="oklch(0.65 0.18 230)" fillOpacity={0.3} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Frequência treino & cardio" subtitle="últimos 30 dias">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trainData}>
              <CartesianGrid stroke="oklch(0.3 0.02 240)" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="oklch(0.68 0.02 240)" fontSize={11} />
              <YAxis stroke="oklch(0.68 0.02 240)" fontSize={11} hide />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="treino" stackId="a" fill="oklch(0.65 0.18 230)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="cardio" stackId="a" fill="oklch(0.72 0.17 160)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </AppShell>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
