import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import type { DailyLog } from "@/lib/dallas";
import { CheckCircle2, AlertTriangle, Info, Sparkles } from "lucide-react";

export const Route = createFileRoute("/insights")({
  head: () => ({ meta: [{ title: "Insights - Projeto Dallas" }] }),
  component: Insights,
});

function Insights() {
  const { user } = useAuth();
  const { goals } = useProfile();

  const {
    data: logs = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["daily_logs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_logs")
        .select("*")
        .eq("user_id", user!.id)
        .order("log_date", { ascending: false })
        .limit(14);
      if (error) throw error;
      return data as DailyLog[];
    },
  });

  const week = [...logs].slice(0, 7).reverse();
  const avgCal = average(week.map((d) => d.calories));
  const avgProt = average(week.map((d) => d.protein_g));
  const avgWater = average(week.map((d) => d.water_l));
  const avgSleep = average(week.map((d) => d.sleep_hours));
  const trains = week.filter((d) => d.trained).length;
  const cardios = week.filter((d) => d.cardio).length;
  const freeMeals = week.filter((d) => d.free_meal).length;
  const alcohol = week.filter((d) => d.alcohol).length;
  const insights = buildInsights(week, goals);

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Sparkles className="h-6 w-6 text-accent" /> Insights automaticos
        </h1>
        <p className="text-sm text-muted-foreground">Analise dos ultimos registros diarios</p>
      </header>

      {error ? (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-6 text-sm">
          <h2 className="font-semibold text-warning">
            Tabela daily_logs ainda nao existe no Supabase
          </h2>
          <p className="mt-2 text-muted-foreground">
            Aplique a migration <span className="font-mono">20260601033000_add_daily_logs.sql</span>{" "}
            no Supabase e recarregue a pagina.
          </p>
        </div>
      ) : isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : week.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Salve alguns dias em{" "}
          <Link to="/registro" className="text-primary underline">
            Registro
          </Link>{" "}
          para gerar insights.
        </div>
      ) : (
        <>
          <section className="mb-6 rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold text-muted-foreground">Resumo semanal</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
              <Stat label="Calorias" value={formatStat(avgCal, 0)} unit="kcal/dia" />
              <Stat label="Proteina" value={formatStat(avgProt, 0)} unit="g/dia" />
              <Stat label="Agua" value={formatStat(avgWater, 1)} unit="L/dia" />
              <Stat label="Sono" value={formatStat(avgSleep, 1)} unit="h/dia" />
              <Stat label="Treinos" value={`${trains}`} unit="na semana" />
              <Stat label="Cardios" value={`${cardios}`} unit="na semana" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-muted px-3 py-1">Refeicoes livres: {freeMeals}</span>
              <span className="rounded-full bg-muted px-3 py-1">Alcool: {alcohol}</span>
              <span className="rounded-full bg-muted px-3 py-1">
                Dias registrados: {week.length}
              </span>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            {insights.map((i, idx) => {
              const cfg = {
                success: {
                  Icon: CheckCircle2,
                  color: "text-success",
                  bg: "bg-success/10",
                  border: "border-success/30",
                },
                warning: {
                  Icon: AlertTriangle,
                  color: "text-warning",
                  bg: "bg-warning/10",
                  border: "border-warning/30",
                },
                info: {
                  Icon: Info,
                  color: "text-primary",
                  bg: "bg-primary/10",
                  border: "border-primary/30",
                },
              }[i.type];
              const Icon = cfg.Icon;
              return (
                <article key={idx} className={`rounded-2xl border ${cfg.border} ${cfg.bg} p-5`}>
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card ${cfg.color}`}
                    >
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
        </>
      )}
    </AppShell>
  );
}

function average(values: Array<number | null>) {
  const valid = values
    .filter((v) => v != null)
    .map((v) => Number(v))
    .filter(Number.isFinite);
  if (valid.length === 0) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function formatStat(value: number | null, digits: number) {
  if (value == null) return "-";
  return value.toFixed(digits);
}

function buildInsights(logs: DailyLog[], goals: { calories: number; protein_g: number } | null) {
  const insights: Array<{ type: "success" | "warning" | "info"; title: string; text: string }> = [];
  const avgCal = average(logs.map((d) => d.calories));
  const avgProt = average(logs.map((d) => d.protein_g));
  const avgSleep = average(logs.map((d) => d.sleep_hours));
  const trained = logs.filter((d) => d.trained).length;
  const freeMeals = logs.filter((d) => d.free_meal).length;
  const alcohol = logs.filter((d) => d.alcohol).length;
  const weights = logs
    .filter((d) => d.weight_kg != null)
    .map((d) => Number(d.weight_kg))
    .filter(Number.isFinite);

  if (goals && avgCal != null) {
    const delta = avgCal - Number(goals.calories);
    insights.push(
      delta <= 100
        ? {
            type: "success",
            title: "Calorias sob controle",
            text: `Media de ${Math.round(avgCal)} kcal/dia, bem perto da meta de ${goals.calories}.`,
          }
        : {
            type: "warning",
            title: "Calorias acima da meta",
            text: `Media de ${Math.round(avgCal)} kcal/dia, cerca de ${Math.round(delta)} kcal acima da meta.`,
          },
    );
  }

  if (goals && avgProt != null) {
    insights.push(
      avgProt >= Number(goals.protein_g) * 0.9
        ? {
            type: "success",
            title: "Proteina consistente",
            text: `Media de ${Math.round(avgProt)} g/dia. Bom sinal para preservar massa magra.`,
          }
        : {
            type: "warning",
            title: "Proteina pode subir",
            text: `Media de ${Math.round(avgProt)} g/dia, abaixo da meta de ${goals.protein_g} g.`,
          },
    );
  }

  if (avgSleep != null && avgSleep < 6.5) {
    insights.push({
      type: "warning",
      title: "Sono baixo",
      text: `Media de ${avgSleep.toFixed(1)}h. Isso pode aumentar fome, retencao e queda de performance.`,
    });
  } else if (avgSleep != null) {
    insights.push({
      type: "success",
      title: "Sono razoavel",
      text: `Media de ${avgSleep.toFixed(1)}h nos dias registrados.`,
    });
  }

  insights.push(
    trained >= 4
      ? {
          type: "success",
          title: "Treino na rota",
          text: `${trained} treinos registrados na semana. Isso conversa bem com a meta da planilha.`,
        }
      : {
          type: "info",
          title: "Espaco para mais treino",
          text: `${trained} treinos registrados. Se a semana ainda nao fechou, da para buscar os 4 treinos.`,
        },
  );

  if (freeMeals > 0 || alcohol > 0) {
    insights.push({
      type: "info",
      title: "Contexto para oscilacao de peso",
      text: `${freeMeals} refeicao livre e ${alcohol} dia(s) com alcool. Se o peso subiu, pode ser retencao e nao gordura.`,
    });
  }

  if (weights.length >= 2) {
    const delta = weights[weights.length - 1] - weights[0];
    insights.push(
      delta <= 0
        ? {
            type: "success",
            title: "Peso em queda",
            text: `Variacao de ${delta.toFixed(1)} kg nos registros analisados.`,
          }
        : {
            type: "info",
            title: "Peso oscilando",
            text: `Variacao de +${delta.toFixed(1)} kg. Confira sono, sal, alcool e refeicoes livres antes de ajustar calorias.`,
          },
    );
  }

  return insights.length > 0
    ? insights
    : [
        {
          type: "info",
          title: "Pouco dado ainda",
          text: "Continue registrando por alguns dias para gerar leituras melhores.",
        },
      ];
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
