import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { todayIso, type DailyLog, type Meal, type MealItem } from "@/lib/dallas";

export const Route = createFileRoute("/registro")({
  head: () => ({ meta: [{ title: "Hoje - Projeto Dallas" }] }),
  component: Registro,
});

const TAGS = ["Fome alta", "Pouca fome", "Compulsao", "Retencao", "Treino forte", "Treino ruim", "Muito sono", "Dia fora da rotina", "Evento social"];

function Registro() {
  const { user } = useAuth();
  const { profile, goals } = useProfile();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    date: todayIso(),
    weight: 0,
    calories: 0,
    protein: 0,
    water: 0,
    trained: false,
    trainingStart: "",
    trainingEnd: "",
    intensity: "moderado",
    cardio: false,
    sleep: 0,
    alcohol: false,
    freeMeal: false,
    notes: "",
  });
  const [tags, setTags] = useState<string[]>([]);
  const [mealsText, setMealsText] = useState("");

  const { data: log, isLoading } = useQuery({
    queryKey: ["daily_log", user?.id, form.date],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_logs")
        .select("*")
        .eq("user_id", user!.id)
        .eq("log_date", form.date)
        .maybeSingle();
      if (error) throw error;
      return data as DailyLog | null;
    },
  });

  const { data: recentLogs = [] } = useQuery({
    queryKey: ["daily_logs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_logs")
        .select("*")
        .eq("user_id", user!.id)
        .order("log_date", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data as DailyLog[];
    },
  });

  const { data: meals = [], isLoading: mealsLoading } = useQuery({
    queryKey: ["meals", user?.id, form.date],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meals")
        .select("*, meal_items(*)")
        .eq("user_id", user!.id)
        .eq("meal_date", form.date)
        .order("meal_type", { ascending: true });
      if (error) throw error;
      return data as (Meal & { meal_items: MealItem[] })[];
    },
  });

  useEffect(() => {
    setMealsText(formatMealsText(meals));
  }, [meals]);

  useEffect(() => {
    if (log) {
      setForm((current) => ({
        ...current,
        weight: Number(log.weight_kg ?? profile?.weight_kg ?? 0),
        calories: Number(log.calories ?? goals?.calories ?? 0),
        protein: Number(log.protein_g ?? goals?.protein_g ?? 0),
        water: Number(log.water_l ?? 0),
        trained: log.trained,
        trainingStart: log.training_start ?? "",
        trainingEnd: log.training_end ?? "",
        intensity: log.training_intensity ?? "moderado",
        cardio: log.cardio,
        sleep: Number(log.sleep_hours ?? 0),
        alcohol: log.alcohol,
        freeMeal: log.free_meal,
        notes: log.notes ?? "",
      }));
      setTags(log.tags ?? []);
      return;
    }

    setForm((current) => ({
      ...current,
      weight: Number(profile?.weight_kg ?? 0),
      calories: Number(goals?.calories ?? 0),
      protein: Number(goals?.protein_g ?? 0),
      water: 0,
      trained: false,
      trainingStart: "",
      trainingEnd: "",
      intensity: "moderado",
      cardio: false,
      sleep: 0,
      alcohol: false,
      freeMeal: false,
      notes: "",
    }));
    setTags([]);
  }, [log, profile?.weight_kg, goals?.calories, goals?.protein_g]);

  function toggleTag(t: string) {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: user!.id,
        log_date: form.date,
        weight_kg: form.weight || null,
        calories: form.calories || null,
        protein_g: form.protein || null,
        water_l: form.water || null,
        trained: form.trained,
        training_start: form.trained && form.trainingStart ? form.trainingStart : null,
        training_end: form.trained && form.trainingEnd ? form.trainingEnd : null,
        training_intensity: form.trained ? form.intensity : null,
        cardio: form.cardio,
        sleep_hours: form.sleep || null,
        alcohol: form.alcohol,
        free_meal: form.freeMeal,
        tags,
        notes: form.notes || null,
      };

      const { error } = await supabase
        .from("daily_logs")
        .upsert(payload, { onConflict: "user_id,log_date" });
      if (error) throw error;

      await syncMeals(user!.id, form.date, mealsText);

      if (form.weight > 0) {
        const { error: deleteWeightError } = await supabase
          .from("weight_history")
          .delete()
          .eq("user_id", user!.id)
          .eq("measured_at", form.date);
        if (deleteWeightError) throw deleteWeightError;

        const { error: weightError } = await supabase
          .from("weight_history")
          .insert({ user_id: user!.id, measured_at: form.date, weight_kg: form.weight });
        if (weightError) throw weightError;

        const { error: profileError } = await supabase
          .from("profiles")
          .update({ weight_kg: form.weight })
          .eq("id", user!.id);
        if (profileError) throw profileError;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily_log"] });
      qc.invalidateQueries({ queryKey: ["daily_logs"] });
      qc.invalidateQueries({ queryKey: ["meals"] });
      qc.invalidateQueries({ queryKey: ["weight_history"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Registro salvo");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Hoje</h1>
        <p className="text-sm text-muted-foreground">Registre o essencial do dia em poucos segundos.</p>
      </header>

      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="grid gap-6 lg:grid-cols-3"
      >
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Registro rapido</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data"><Input type="date" value={form.date} onChange={(e) => { setMealsText(""); setForm({ ...form, date: e.target.value }); }} /></Field>
            <Field label="Peso (kg)"><Input type="number" step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: +e.target.value })} /></Field>
            <Field label="Agua (L)"><Input type="number" step="0.1" value={form.water} onChange={(e) => setForm({ ...form, water: +e.target.value })} /></Field>
            <Field label="Horas de sono"><Input type="number" step="0.1" value={form.sleep} onChange={(e) => setForm({ ...form, sleep: +e.target.value })} /></Field>
            <Field label={`Calorias${goals ? ` (meta ${goals.calories})` : ""}`}><Input type="number" value={form.calories} onChange={(e) => setForm({ ...form, calories: +e.target.value })} /></Field>
            <Field label={`Proteina g${goals ? ` (meta ${goals.protein_g})` : ""}`}><Input type="number" value={form.protein} onChange={(e) => setForm({ ...form, protein: +e.target.value })} /></Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ToggleRow label="Treinou musculacao" value={form.trained} onChange={(v) => setForm({ ...form, trained: v })} />
            <ToggleRow label="Fez cardio" value={form.cardio} onChange={(v) => setForm({ ...form, cardio: v })} />
            <ToggleRow label="Consumiu alcool" value={form.alcohol} onChange={(v) => setForm({ ...form, alcohol: v })} />
            <ToggleRow label="Refeicao livre" value={form.freeMeal} onChange={(v) => setForm({ ...form, freeMeal: v })} />
          </div>

          {form.trained && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Inicio treino"><Input type="time" value={form.trainingStart} onChange={(e) => setForm({ ...form, trainingStart: e.target.value })} /></Field>
              <Field label="Fim treino"><Input type="time" value={form.trainingEnd} onChange={(e) => setForm({ ...form, trainingEnd: e.target.value })} /></Field>
              <Field label="Intensidade">
                <Select value={form.intensity} onValueChange={(v) => setForm({ ...form, intensity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leve">Leve</SelectItem>
                    <SelectItem value="moderado">Moderado</SelectItem>
                    <SelectItem value="forte">Forte</SelectItem>
                    <SelectItem value="extremamente-pesado">Extremamente pesado</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}

          <Field label="Refeicoes">
            <Textarea
              className="min-h-64 font-mono text-sm"
              placeholder={"Ref 1\n200g iogurte tirol zero\n40g whey dux chocolate branco\n\nRef 2\n200g arroz branco\n200g frango desfiado"}
              value={mealsText}
              onChange={(e) => setMealsText(e.target.value)}
            />
          </Field>

          <Field label="Observacoes">
            <Textarea rows={4} placeholder="Como foi a fome, energia, treino, rotina..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </section>

        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground">Registros anteriores</h2>
            <div className="mt-3 space-y-2">
              {recentLogs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
                  Nenhum registro salvo ainda.
                </div>
              ) : (
                recentLogs.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { setMealsText(""); setForm((current) => ({ ...current, date: item.log_date })); }}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition-colors hover:bg-muted/60 ${
                      item.log_date === form.date ? "border-primary bg-primary/10" : "border-border bg-background/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{formatLogDate(item.log_date)}</span>
                      {item.log_date === todayIso() && <Badge className="rounded-full">Hoje</Badge>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {item.weight_kg && <span>{Number(item.weight_kg)} kg</span>}
                      {item.calories && <span>{Number(item.calories)} kcal</span>}
                      {item.trained && <span>Treino</span>}
                      {item.sleep_hours && <span>{Number(item.sleep_hours)}h sono</span>}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <h2 className="text-sm font-semibold text-muted-foreground">Marcadores rapidos</h2>
          <div className="flex flex-wrap gap-2">
            {TAGS.map((t) => (
              <Badge
                key={t}
                onClick={() => toggleTag(t)}
                className={`cursor-pointer rounded-full px-3 py-1.5 text-xs ${tags.includes(t) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
              >
                {t}
              </Badge>
            ))}
          </div>
          <div className="rounded-xl border border-border bg-background/40 p-3 text-xs text-muted-foreground">
            Esses sinais ajudam a futura IA a explicar peso, fome, performance e consistencia.
          </div>
          <Button type="submit" className="w-full rounded-xl" size="lg" disabled={save.isPending || isLoading || mealsLoading}>
            {save.isPending ? "Salvando..." : "Salvar registro"}
          </Button>
        </section>
      </form>
    </AppShell>
  );
}

function formatMealsText(meals: (Meal & { meal_items: MealItem[] })[]) {
  return meals
    .map((meal, index) => {
      const title = meal.meal_type || `Ref ${index + 1}`;
      const items = meal.meal_items
        .map((item) => {
          const grams = Number(item.quantity_g);
          return grams > 0 ? `${grams}g ${item.food_name}` : item.food_name;
        })
        .join("\n");
      return items ? `${title}\n${items}` : title;
    })
    .join("\n\n");
}

function parseMealsText(text: string) {
  const meals: { meal_type: string; items: { grams: number; name: string }[] }[] = [];
  let current: { meal_type: string; items: { grams: number; name: string }[] } | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (isMealHeader(line)) {
      current = { meal_type: line.replace(/:$/, ""), items: [] };
      meals.push(current);
      continue;
    }

    if (!current) {
      current = { meal_type: "Ref 1", items: [] };
      meals.push(current);
    }

    const match = line.match(/^(\d+(?:[,.]\d+)?)\s*(?:g|gramas?)\b\s*(.+)$/i);
    current.items.push({
      grams: match ? Number(match[1].replace(",", ".")) : 0,
      name: match ? match[2].trim() : line,
    });
  }

  return meals.filter((meal) => meal.items.length > 0);
}

function isMealHeader(line: string) {
  return /^(ref|refeicao)\s*\d*\b/i.test(line) || /^(cafe|almoco|jantar|lanche)\b/i.test(line) || line.endsWith(":");
}

async function syncMeals(userId: string, date: string, text: string) {
  const parsedMeals = parseMealsText(text);

  const { data: existingMeals, error: existingError } = await supabase
    .from("meals")
    .select("id")
    .eq("user_id", userId)
    .eq("meal_date", date);
  if (existingError) throw existingError;

  const existingIds = (existingMeals ?? []).map((meal) => meal.id);
  if (existingIds.length > 0) {
    const { error: itemsError } = await supabase.from("meal_items").delete().in("meal_id", existingIds);
    if (itemsError) throw itemsError;

    const { error: mealsError } = await supabase.from("meals").delete().in("id", existingIds);
    if (mealsError) throw mealsError;
  }

  for (const [index, meal] of parsedMeals.entries()) {
    const { data: createdMeal, error: mealError } = await supabase
      .from("meals")
      .insert({ user_id: userId, meal_date: date, meal_type: meal.meal_type || `Ref ${index + 1}` })
      .select("id")
      .single();
    if (mealError) throw mealError;

    const { error: itemsError } = await supabase.from("meal_items").insert(
      meal.items.map((item) => ({
        user_id: userId,
        meal_id: createdMeal.id,
        food_id: null,
        quantity_g: item.grams,
        food_name: item.name,
        calories_per_100g: 0,
        protein_per_100g: 0,
        carbs_per_100g: 0,
        fat_per_100g: 0,
      })),
    );
    if (itemsError) throw itemsError;
  }
}

function formatLogDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    weekday: "short",
  }).format(new Date(year, month - 1, day));
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-4 py-3">
      <span className="text-sm">{label}</span>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}
