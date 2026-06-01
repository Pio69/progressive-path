import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { calcMacros, sumMacros, todayIso, type Meal, type MealItem } from "@/lib/dallas";

export const Route = createFileRoute("/refeicoes")({
  head: () => ({ meta: [{ title: "Refeicoes - Projeto Dallas" }] }),
  component: Refeicoes,
});

function Refeicoes() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [date, setDate] = useState(todayIso());
  const [newMealOpen, setNewMealOpen] = useState(false);
  const [addItemMealId, setAddItemMealId] = useState<string | null>(null);

  const { data: meals = [] } = useQuery({
    queryKey: ["meals", user?.id, date],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meals")
        .select("*, meal_items(*)")
        .eq("meal_date", date)
        .order("meal_type", { ascending: true });
      if (error) throw error;
      return data as (Meal & { meal_items: MealItem[] })[];
    },
  });

  const createMeal = useMutation({
    mutationFn: async (m: { meal_type: string; itemsText: string }) => {
      const { data, error } = await supabase
        .from("meals")
        .insert({ user_id: user!.id, meal_date: date, meal_type: m.meal_type })
        .select("id")
        .single();
      if (error) throw error;

      const items = parseMealItems(m.itemsText);
      if (items.length > 0) {
        const { error: itemsError } = await supabase.from("meal_items").insert(
          items.map((item) => ({
            user_id: user!.id,
            meal_id: data.id,
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
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meals"] }); setNewMealOpen(false); toast.success("Refeicao registrada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMeal = useMutation({
    mutationFn: async (id: string) => {
      const { error: itemsError } = await supabase.from("meal_items").delete().eq("meal_id", id);
      if (itemsError) throw itemsError;
      const { error } = await supabase.from("meals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meals"] }); toast.success("Refeicao excluida"); },
  });

  const addItem = useMutation({
    mutationFn: async (i: { meal_id: string; itemsText: string }) => {
      const items = parseMealItems(i.itemsText);
      if (items.length === 0) throw new Error("Digite pelo menos um item");
      const { error } = await supabase.from("meal_items").insert(
        items.map((item) => ({
          user_id: user!.id,
          meal_id: i.meal_id,
          food_id: null,
          quantity_g: item.grams,
          food_name: item.name,
          calories_per_100g: 0,
          protein_per_100g: 0,
          carbs_per_100g: 0,
          fat_per_100g: 0,
        })),
      );
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meals"] }); setAddItemMealId(null); toast.success("Itens adicionados"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("meal_items").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meals"] }),
  });

  const estimateMeal = useMutation({
    mutationFn: async (meal: Meal & { meal_items: MealItem[] }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessao expirada. Entre novamente.");

      const response = await fetch("/api/estimate-meal-macros", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          "x-supabase-url": import.meta.env.VITE_SUPABASE_URL,
          "x-supabase-key": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          mealName: meal.meal_type,
          items: meal.meal_items.map((item) => ({
            id: item.id,
            name: item.food_name,
            grams: Number(item.quantity_g),
          })),
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Falha ao calcular macros");

      const estimates = (payload.items ?? []) as MacroEstimate[];
      const estimatesById = new Map(estimates.map((item) => [item.id, item]));

      await Promise.all(
        estimates.map((item) => {
          const original = meal.meal_items.find((mealItem) => mealItem.id === item.id);
          const grams = Number(original?.quantity_g ?? 0);
          if (!original || grams <= 0) return Promise.resolve();

          const factor = 100 / grams;
          return supabase
            .from("meal_items")
            .update({
              calories_per_100g: +(item.calories * factor).toFixed(1),
              protein_per_100g: +(item.protein_g * factor).toFixed(1),
              carbs_per_100g: +(item.carbs_g * factor).toFixed(1),
              fat_per_100g: +(item.fat_g * factor).toFixed(1),
            })
            .eq("id", item.id)
            .then(({ error }) => {
              if (error) throw error;
            });
        }),
      );

      const mealsWithEstimatedMacros = meals.map((existingMeal) => ({
        ...existingMeal,
        meal_items: existingMeal.id === meal.id
          ? existingMeal.meal_items.map((mealItem) => applyEstimateToMealItem(mealItem, estimatesById.get(mealItem.id)))
          : existingMeal.meal_items,
      }));
      const dayTotals = sumMacros(
        mealsWithEstimatedMacros.flatMap((existingMeal) => existingMeal.meal_items.map((item) => calcMacros(item, Number(item.quantity_g)))),
      );

      const { error: logError } = await supabase.from("daily_logs").upsert({
        user_id: user!.id,
        log_date: date,
        calories: dayTotals.kcal,
        protein_g: dayTotals.protein,
      }, { onConflict: "user_id,log_date" });
      if (logError) throw logError;

      return estimates;
    },
    onSuccess: (items) => {
      qc.invalidateQueries({ queryKey: ["meals"] });
      qc.invalidateQueries({ queryKey: ["daily_log"] });
      qc.invalidateQueries({ queryKey: ["daily_logs"] });
      const lowConfidence = items.filter((item) => item.confidence === "baixa").length;
      toast.success(lowConfidence > 0 ? `Macros calculados. ${lowConfidence} item(ns) com baixa confianca.` : "Macros calculados");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const totals = sumMacros(
    meals.flatMap((m) => m.meal_items.map((it) => calcMacros(it, Number(it.quantity_g))))
  );

  return (
    <AppShell>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Refeicoes</h1>
          <p className="text-sm text-muted-foreground">Digite o que comeu, uma linha por item.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
          <Dialog open={newMealOpen} onOpenChange={setNewMealOpen}>
            <DialogTrigger asChild><Button className="rounded-xl"><Plus className="mr-2 h-4 w-4" />Nova refeicao</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova refeicao</DialogTitle></DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                createMeal.mutate({ meal_type: String(f.get("meal_type")), itemsText: String(f.get("items")) });
              }} className="space-y-3">
                <div><Label className="text-xs">Nome da refeicao</Label><Input name="meal_type" required defaultValue={`Ref ${meals.length + 1}`} /></div>
                <div>
                  <Label className="text-xs">Itens</Label>
                  <Textarea
                    name="items"
                    className="min-h-36"
                    placeholder={"200g iogurte morango tirol zero\n40g whey dux chocolate branco"}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createMeal.isPending}>{createMeal.isPending ? "Registrando..." : "Registrar refeicao"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Total label="Calorias" value={totals.kcal} unit="kcal" />
        <Total label="Proteina" value={totals.protein} unit="g" />
        <Total label="Carbo" value={totals.carbs} unit="g" />
        <Total label="Gordura" value={totals.fat} unit="g" />
      </section>

      <section className="space-y-3">
        {meals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Nenhuma refeicao registrada nesta data.
          </div>
        ) : meals.map((m) => {
          const mealMacros = sumMacros(m.meal_items.map((it) => calcMacros(it, Number(it.quantity_g))));
          return (
            <article key={m.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold">{m.meal_type}</h3>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-warning font-semibold">{mealMacros.kcal} kcal</span>
                  <span className="text-accent font-semibold">P {mealMacros.protein}g</span>
                  <span className="text-muted-foreground">C {mealMacros.carbs}g / G {mealMacros.fat}g</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg"
                    disabled={estimateMeal.isPending || m.meal_items.length === 0}
                    onClick={() => estimateMeal.mutate(m)}
                  >
                    <Sparkles className="mr-1 h-3.5 w-3.5" />
                    {estimateMeal.isPending && estimateMeal.variables?.id === m.id ? "Calculando..." : "Calcular"}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteMeal.mutate(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>

              <ul className="mt-3 space-y-1.5">
                {m.meal_items.map((it) => {
                  const macros = calcMacros(it, Number(it.quantity_g));
                  return (
                    <li key={it.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{it.food_name}</div>
                        <div className="text-xs text-muted-foreground">{Number(it.quantity_g)}g</div>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span>{macros.kcal} kcal</span>
                        <span className="text-accent">P{macros.protein}</span>
                        <Button size="icon" variant="ghost" onClick={() => deleteItem.mutate(it.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <Dialog open={addItemMealId === m.id} onOpenChange={(o) => setAddItemMealId(o ? m.id : null)}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="mt-3 rounded-lg">
                    <Plus className="mr-1 h-3.5 w-3.5" />Adicionar itens
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Adicionar itens</DialogTitle></DialogHeader>
                  <AddItemsForm onSubmit={(itemsText) => addItem.mutate({ meal_id: m.id, itemsText })} pending={addItem.isPending} />
                </DialogContent>
              </Dialog>
            </article>
          );
        })}
      </section>
    </AppShell>
  );
}

type MacroEstimate = {
  id: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: "baixa" | "media" | "alta";
  note?: string;
};

function applyEstimateToMealItem(item: MealItem, estimate: MacroEstimate | undefined): MealItem {
  const grams = Number(item.quantity_g);
  if (!estimate || grams <= 0) return item;

  const factor = 100 / grams;
  return {
    ...item,
    calories_per_100g: +(estimate.calories * factor).toFixed(1),
    protein_per_100g: +(estimate.protein_g * factor).toFixed(1),
    carbs_per_100g: +(estimate.carbs_g * factor).toFixed(1),
    fat_per_100g: +(estimate.fat_g * factor).toFixed(1),
  };
}

function AddItemsForm({ onSubmit, pending }: { onSubmit: (itemsText: string) => void; pending: boolean }) {
  const [itemsText, setItemsText] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(itemsText); }} className="space-y-3">
      <div>
        <Label className="text-xs">Itens</Label>
        <Textarea
          value={itemsText}
          onChange={(e) => setItemsText(e.target.value)}
          className="min-h-36"
          placeholder={"200g arroz branco\n200g frango desfiado"}
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending || parseMealItems(itemsText).length === 0}>
        {pending ? "Adicionando..." : "Adicionar itens"}
      </Button>
    </form>
  );
}

function parseMealItems(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+(?:[,.]\d+)?)\s*g(?:ramas?)?\s+(.+)$/i);
      if (!match) return { grams: 0, name: line };
      return { grams: Number(match[1].replace(",", ".")), name: match[2].trim() };
    })
    .filter((item) => item.name.length > 0);
}

function Total({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value} <span className="text-sm font-normal text-muted-foreground">{unit}</span></div>
    </div>
  );
}
