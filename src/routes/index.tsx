import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Flame,
  Beef,
  Plus,
  Utensils,
  LineChart,
  ClipboardList,
  Moon,
  Droplets,
  Dumbbell,
  Ruler,
  CircleGauge,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import {
  calcMacros,
  sumMacros,
  todayIso,
  type DailyLog,
  type Meal,
  type MealItem,
} from "@/lib/dallas";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Progressive Path - Dashboard" },
      { name: "description", content: "Acompanhe calorias, macros e evolucao dos seus habitos." },
    ],
  }),
  component: Home,
});

function Home() {
  const { user } = useAuth();
  const { profile, goals } = useProfile();
  const today = todayIso();

  const { data: meals = [] } = useQuery({
    queryKey: ["meals", user?.id, today],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meals")
        .select("*, meal_items(*)")
        .eq("meal_date", today);
      if (error) throw error;
      return data as (Meal & { meal_items: MealItem[] })[];
    },
  });

  const { data: todayLog } = useQuery({
    queryKey: ["daily_log", user?.id, today],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_logs")
        .select("*")
        .eq("user_id", user!.id)
        .eq("log_date", today)
        .maybeSingle();
      if (error) throw error;
      return data as DailyLog | null;
    },
  });

  const [greet, setGreet] = useState("Ola");
  useEffect(() => {
    const h = new Date().getHours();
    setGreet(h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite");
  }, []);

  const totals = sumMacros(
    meals.flatMap((m) => m.meal_items.map((it) => calcMacros(it, Number(it.quantity_g)))),
  );
  const weight = profile?.weight_kg == null ? null : Number(profile.weight_kg);

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="h-1.5 bg-gradient-to-r from-warning via-accent to-primary" />
          <div className="p-6 md:p-8">
            <div className="text-sm text-muted-foreground">
              {greet}, {profile?.name}
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
              {weight ? `Peso atual: ${weight.toFixed(1)} kg` : "Acompanhe suas metas do dia."}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Objetivo: {formatGoal(profile?.goal)}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-xl">
                <Link to="/refeicoes">
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar refeicao
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {goals ? (
          <section className="grid gap-3 md:grid-cols-2">
            <MacroCard
              label="Calorias"
              current={totals.kcal}
              goal={goals.calories}
              unit="kcal"
              icon={Flame}
              tone="amber"
            />
            <MacroCard
              label="Proteina"
              current={totals.protein}
              goal={goals.protein_g}
              unit="g"
              icon={Beef}
              tone="fresh"
            />
            <MacroCard
              label="Carboidratos"
              current={totals.carbs}
              goal={goals.carbs_g}
              unit="g"
              icon={Utensils}
              tone="gold"
            />
            <MacroCard
              label="Gorduras"
              current={totals.fat}
              goal={goals.fat_g}
              unit="g"
              icon={CircleGauge}
              tone="violet"
            />
          </section>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            Configure suas metas em{" "}
            <Link to="/metas" className="text-primary underline">
              Metas
            </Link>
            .
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-4">
          <DailyCard
            label="Registro"
            value={todayLog?.routine_logged ? "feito" : "pendente"}
            icon={ClipboardList}
            to="/registro"
            tone="primary"
          />
          <DailyCard
            label="Agua"
            value={todayLog?.water_l ? `${Number(todayLog.water_l).toFixed(1)} L` : "-"}
            icon={Droplets}
            to="/registro"
            tone="fresh"
          />
          <DailyCard
            label="Sono"
            value={todayLog?.sleep_hours ? `${Number(todayLog.sleep_hours).toFixed(1)} h` : "-"}
            icon={Moon}
            to="/registro"
            tone="violet"
          />
          <DailyCard
            label="Treino"
            value={todayLog?.trained ? "sim" : "nao"}
            icon={Dumbbell}
            to="/registro"
            tone="primary"
          />
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <QuickLink
            to="/refeicoes"
            icon={Utensils}
            label="Refeicoes do dia"
            hint={`${meals.length} registrada${meals.length === 1 ? "" : "s"}`}
            tone="gold"
          />
          <QuickLink
            to="/evolucao"
            icon={LineChart}
            label="Evolucao"
            hint="Historico de peso"
            tone="primary"
          />
          <QuickLink
            to="/medidas"
            icon={Ruler}
            label="Medidas corporais"
            hint="Circunferencias e notas"
            tone="fresh"
          />
        </section>
      </div>
    </AppShell>
  );
}

function DailyCard({
  label,
  value,
  icon: Icon,
  to,
  tone,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  to: string;
  tone: Tone;
}) {
  const color = TONES[tone];
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors ${color.hover}`}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color.soft}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </Link>
  );
}

function MacroCard({
  label,
  current,
  goal,
  unit,
  icon: Icon,
  tone,
}: {
  label: string;
  current: number;
  goal: number;
  unit: string;
  icon?: LucideIcon;
  tone: Tone;
}) {
  const pct = goal > 0 ? Math.min(100, (current / goal) * 100) : 0;
  const remaining = Math.max(0, goal - current);
  const color = TONES[tone];
  return (
    <div className={`overflow-hidden rounded-2xl border border-border bg-card transition-colors ${color.hover}`}>
      <div className={`h-1 ${color.bar}`} />
      <div className="p-5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className={`inline-flex items-center gap-1.5 ${color.text}`}>
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {label}
          </span>
          <span>
            {current} / {goal} {unit}
          </span>
        </div>
        <Progress value={pct} className={`mt-3 h-2.5 ${color.progress}`} />
        <div className="mt-2 text-xs text-muted-foreground">
          {remaining > 0 ? `Faltam ${remaining.toFixed(1)} ${unit}` : "Meta atingida"}
        </div>
      </div>
    </div>
  );
}

function QuickLink({
  to,
  icon: Icon,
  label,
  hint,
  tone,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  hint: string;
  tone: Tone;
}) {
  const color = TONES[tone];
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors ${color.hover}`}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color.soft}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
    </Link>
  );
}

type Tone = "primary" | "fresh" | "gold" | "amber" | "violet";

const TONES: Record<
  Tone,
  { bar: string; hover: string; progress: string; soft: string; text: string }
> = {
  primary: {
    bar: "bg-primary",
    hover: "hover:border-primary/50",
    progress: "bg-primary/20 [&>div]:bg-primary",
    soft: "bg-primary/15 text-primary",
    text: "text-primary",
  },
  fresh: {
    bar: "bg-accent",
    hover: "hover:border-accent/50",
    progress: "bg-accent/20 [&>div]:bg-accent",
    soft: "bg-accent/15 text-accent",
    text: "text-accent",
  },
  gold: {
    bar: "bg-warning",
    hover: "hover:border-warning/50",
    progress: "bg-warning/20 [&>div]:bg-warning",
    soft: "bg-warning/15 text-warning",
    text: "text-warning",
  },
  amber: {
    bar: "bg-orange-400",
    hover: "hover:border-orange-400/50",
    progress: "bg-orange-400/20 [&>div]:bg-orange-400",
    soft: "bg-orange-400/15 text-orange-300",
    text: "text-orange-300",
  },
  violet: {
    bar: "bg-chart-5",
    hover: "hover:border-chart-5/50",
    progress: "bg-chart-5/20 [&>div]:bg-chart-5",
    soft: "bg-chart-5/15 text-chart-5",
    text: "text-chart-5",
  },
};

function formatGoal(goal: string | null | undefined) {
  const labels: Record<string, string> = {
    perda_gordura: "Perda de gordura",
    cutting: "Perda de gordura",
    manutencao: "Manutencao",
    ganho_massa: "Ganho de massa",
    bulking: "Ganho de massa",
  };

  return goal ? (labels[goal] ?? goal) : "Nao definido";
}
