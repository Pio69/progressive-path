import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/evolucao")({
  head: () => ({ meta: [{ title: "Evolucao - Projeto Dallas" }] }),
  component: Evolucao,
});

type WH = { id: string; measured_at: string; weight_kg: number };

function Evolucao() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: history = [] } = useQuery({
    queryKey: ["weight_history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weight_history")
        .select("*")
        .eq("user_id", user!.id)
        .order("measured_at", { ascending: false });
      if (error) throw error;
      return data as WH[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("weight_history")
        .delete()
        .eq("user_id", user!.id)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weight_history"] }),
  });

  const trendData = history
    .map((h) => ({
      ...h,
      weight: Number(h.weight_kg),
      timestamp: new Date(`${h.measured_at}T00:00`).getTime(),
    }))
    .filter((h) => Number.isFinite(h.weight) && Number.isFinite(h.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

  const maxWeight = Math.max(...trendData.map((h) => h.weight), 0);
  const minWeight = Math.min(...trendData.map((h) => h.weight), maxWeight);
  const padding = Math.max(0.5, (maxWeight - minWeight) * 0.15);
  const max = maxWeight + padding;
  const min = minWeight - padding;
  const range = Math.max(1, max - min);
  const chart = { width: 640, height: 220, left: 54, right: 22, top: 18, bottom: 42 };
  const plotWidth = chart.width - chart.left - chart.right;
  const plotHeight = chart.height - chart.top - chart.bottom;
  const points = trendData.map((h, index) => {
    const x =
      chart.left +
      (trendData.length === 1 ? plotWidth / 2 : (index / (trendData.length - 1)) * plotWidth);
    const y = chart.top + (1 - (h.weight - min) / range) * plotHeight;
    return { ...h, x, y };
  });
  const linePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPoints =
    points.length > 0
      ? `${chart.left},${chart.top + plotHeight} ${linePoints} ${chart.left + plotWidth},${chart.top + plotHeight}`
      : "";
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((value) => ({
    y: chart.top + value * plotHeight,
    label: max - value * range,
  }));

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Evolucao</h1>
        <p className="text-sm text-muted-foreground">
          Historico das pesagens salvas no Registro diario.
        </p>
      </header>

      <section className="mb-6 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Peso vem do Registro diario</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Para adicionar ou corrigir uma pesagem, abra o dia no Registro.
            </p>
          </div>
          <Button asChild>
            <Link to="/registro">Abrir Registro</Link>
          </Button>
        </div>
      </section>

      {points.length > 0 && (
        <section className="mb-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">Tendencia</h2>
          <div className="rounded-xl bg-muted/30 p-2 sm:p-4">
            <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="h-56 w-full">
              {gridLines.map((line) => (
                <g key={line.y}>
                  <line
                    x1={chart.left}
                    y1={line.y}
                    x2={chart.left + plotWidth}
                    y2={line.y}
                    className="stroke-border/70"
                    strokeWidth="1"
                    strokeDasharray="5 7"
                  />
                  <text
                    x={chart.left - 10}
                    y={line.y + 4}
                    textAnchor="end"
                    className="fill-muted-foreground text-[11px]"
                  >
                    {line.label.toFixed(1)}
                  </text>
                </g>
              ))}
              <line
                x1={chart.left}
                y1={chart.top}
                x2={chart.left}
                y2={chart.top + plotHeight}
                className="stroke-border"
                strokeWidth="1.5"
              />
              <line
                x1={chart.left}
                y1={chart.top + plotHeight}
                x2={chart.left + plotWidth}
                y2={chart.top + plotHeight}
                className="stroke-border"
                strokeWidth="1.5"
              />
              {areaPoints && <polygon points={areaPoints} className="fill-primary/10" />}
              {points.length === 1 ? (
                <line
                  x1={chart.left}
                  y1={points[0].y}
                  x2={chart.left + plotWidth}
                  y2={points[0].y}
                  className="stroke-primary"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              ) : (
                <polyline
                  points={linePoints}
                  fill="none"
                  className="stroke-primary"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {points.map((p) => (
                <g key={p.id}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="6"
                    className="fill-background stroke-primary"
                    strokeWidth="4"
                  />
                  <title>{`${new Date(p.measured_at + "T00:00").toLocaleDateString("pt-BR")} - ${p.weight.toFixed(1)} kg`}</title>
                </g>
              ))}
              {points[0] && (
                <text
                  x={points[0].x}
                  y={chart.height - 18}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[12px]"
                >
                  {new Date(points[0].measured_at + "T00:00").toLocaleDateString("pt-BR")}
                </text>
              )}
              {points.length > 1 && (
                <text
                  x={points[points.length - 1].x}
                  y={chart.height - 18}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[12px]"
                >
                  {new Date(points[points.length - 1].measured_at + "T00:00").toLocaleDateString(
                    "pt-BR",
                  )}
                </text>
              )}
            </svg>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Inicial: {points[0].weight.toFixed(1)} kg</span>
            <span>Atual: {points[points.length - 1].weight.toFixed(1)} kg</span>
            <span>
              Variação: {(points[points.length - 1].weight - points[0].weight).toFixed(1)} kg
            </span>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Registros</h2>
        {history.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Sem pesagens registradas.
          </div>
        ) : (
          history.map((h) => (
            <div
              key={h.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
            >
              <div className="text-sm">
                {new Date(h.measured_at + "T00:00").toLocaleDateString("pt-BR")}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-lg font-semibold">{Number(h.weight_kg)} kg</div>
                <Button size="sm" variant="ghost" onClick={() => del.mutate(h.id)}>
                  Excluir
                </Button>
              </div>
            </div>
          ))
        )}
      </section>
    </AppShell>
  );
}
