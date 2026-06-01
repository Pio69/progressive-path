import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Flame, Beef, Plus, Apple, Utensils, LineChart, ClipboardList, Moon, Droplets, Dumbbell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { calcMacros, sumMacros, todayIso, type DailyLog, type Food, type Meal, type MealItem } from "@/lib/dallas";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Projeto Dallas - Dashboard" },
      { name: "description", content: "Acompanhe calorias, macros e evolucao do seu cutting." },
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
        .select("*, meal_items(*, foods(*))")
        .eq("meal_date", today);
      if (error) throw error;
      return data as (Meal & { meal_items: (MealItem & { foods: Food })[] })[];
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

  const totals = sumMacros(meals.flatMap((m) => m.meal_items.map((it) => calcMacros(it.foods, Number(it.quantity_g)))));
  const weight = profile?.weight_kg == null ? null : Number(profile.weight_kg);

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-card to-accent/10 p-6 md:p-8">
          <div className="text-sm text-muted-foreground">{greet}, {profile?.name}</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
            {weight ? `Peso atual: ${weight.toFixed(1)} kg` : "Acompanhe suas metas do dia."}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Objetivo: {profile?.goal ?? "cutting"}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-xl"><Link to="/refeicoes"><Plus className="mr-2 h-4 w-4" />Adicionar refeicao</Link></Button>
            <Button asChild size="lg" variant="secondary" className="rounded-xl"><Link to="/alimentos"><Apple className="mr-2 h-4 w-4" />Meus alimentos</Link></Button>
          </div>
        </section>

        {goals ? (
          <section className="grid gap-3 md:grid-cols-2">
            <MacroCard label="Calorias" current={totals.kcal} goal={goals.calories} unit="kcal" icon={Flame} />
            <MacroCard label="Proteina" current={totals.protein} goal={goals.protein_g} unit="g" icon={Beef} />
            <MacroCard label="Carboidratos" current={totals.carbs} goal={goals.carbs_g} unit="g" />
            <MacroCard label="Gorduras" current={totals.fat} goal={goals.fat_g} unit="g" />
          </section>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">Configure suas metas em <Link to="/metas" className="text-primary underline">Metas</Link>.</div>
        )}

        <section className="grid gap-3 md:grid-cols-4">
          <DailyCard label="Registro" value={todayLog ? "feito" : "pendente"} icon={ClipboardList} to="/registro" />
          <DailyCard label="Agua" value={todayLog?.water_l ? `${Number(todayLog.water_l).toFixed(1)} L` : "-"} icon={Droplets} to="/registro" />
          <DailyCard label="Sono" value={todayLog?.sleep_hours ? `${Number(todayLog.sleep_hours).toFixed(1)} h` : "-"} icon={Moon} to="/registro" />
          <DailyCard label="Treino" value={todayLog?.trained ? "sim" : "nao"} icon={Dumbbell} to="/registro" />
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <QuickLink to="/refeicoes" icon={Utensils} label="Refeicoes do dia" hint={`${meals.length} registrada${meals.length === 1 ? "" : "s"}`} />
          <QuickLink to="/alimentos" icon={Apple} label="Alimentos" hint="Catalogo pessoal" />
          <QuickLink to="/evolucao" icon={LineChart} label="Evolucao" hint="Historico de peso" />
        </section>
      </div>
    </AppShell>
  );
}

function DailyCard({ label, value, icon: Icon, to }: { label: string; value: string; icon: any; to: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent"><Icon className="h-5 w-5" /></div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </Link>
  );
}

function MacroCard({ label, current, goal, unit, icon: Icon }: { label: string; current: number; goal: number; unit: string; icon?: any }) {
  const pct = goal > 0 ? Math.min(100, (current / goal) * 100) : 0;
  const remaining = Math.max(0, goal - current);
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">{Icon && <Icon className="h-3.5 w-3.5" />}{label}</span>
        <span>{current} / {goal} {unit}</span>
      </div>
      <Progress value={pct} className="mt-3 h-2.5" />
      <div className="mt-2 text-xs text-muted-foreground">{remaining > 0 ? `Faltam ${remaining.toFixed(1)} ${unit}` : "Meta atingida"}</div>
    </div>
  );
}

function QuickLink({ to, icon: Icon, label, hint }: { to: string; icon: any; label: string; hint: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><Icon className="h-5 w-5" /></div>
      <div>
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
    </Link>
  );
}
