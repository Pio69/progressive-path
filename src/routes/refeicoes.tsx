import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { calcMacros, sumMacros, todayIso, type Food, type Meal, type MealItem } from "@/lib/dallas";

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
        .select("*, meal_items(*, foods(*))")
        .eq("meal_date", date)
        .order("meal_type", { ascending: true });
      if (error) throw error;
      return data as (Meal & { meal_items: (MealItem & { foods: Food })[] })[];
    },
  });

  const { data: foods = [] } = useQuery({
    queryKey: ["foods", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("foods").select("*").order("name");
      if (error) throw error;
      return data as Food[];
    },
  });

  const createMeal = useMutation({
    mutationFn: async (m: { meal_type: string }) => {
      const { error } = await supabase.from("meals").insert({ user_id: user!.id, meal_date: date, meal_type: m.meal_type });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meals"] }); setNewMealOpen(false); toast.success("Refeicao criada"); },
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
    mutationFn: async (i: { meal_id: string; food_id: string; grams: number }) => {
      const food = foods.find((f) => f.id === i.food_id);
      if (!food) throw new Error("Alimento nao encontrado");
      const { error } = await supabase.from("meal_items").insert({
        user_id: user!.id,
        meal_id: i.meal_id,
        food_id: i.food_id,
        quantity_g: i.grams,
        food_name: food.name,
        calories_per_100g: food.calories_per_100g,
        protein_per_100g: food.protein_per_100g,
        carbs_per_100g: food.carbs_per_100g,
        fat_per_100g: food.fat_per_100g,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meals"] }); setAddItemMealId(null); toast.success("Item adicionado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("meal_items").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meals"] }),
  });

  const totals = sumMacros(
    meals.flatMap((m) => m.meal_items.map((it) => calcMacros(it.foods, Number(it.quantity_g))))
  );

  return (
    <AppShell>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Refeicoes</h1>
          <p className="text-sm text-muted-foreground">Registre os alimentos consumidos no dia.</p>
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
                createMeal.mutate({ meal_type: String(f.get("meal_type")) });
              }} className="space-y-3">
                <div><Label className="text-xs">Nome</Label><Input name="meal_type" required defaultValue="Cafe da manha" /></div>
                <Button type="submit" className="w-full" disabled={createMeal.isPending}>Criar</Button>
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

      {foods.length === 0 && (
        <div className="mb-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Voce ainda nao tem alimentos cadastrados. <Link to="/alimentos" className="text-primary underline">Cadastre seus alimentos</Link> para adiciona-los as refeicoes.
        </div>
      )}

      <section className="space-y-3">
        {meals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Nenhuma refeicao registrada nesta data.
          </div>
        ) : meals.map((m) => {
          const mealMacros = sumMacros(m.meal_items.map((it) => calcMacros(it.foods, Number(it.quantity_g))));
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
                  <Button size="icon" variant="ghost" onClick={() => deleteMeal.mutate(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>

              <ul className="mt-3 space-y-1.5">
                {m.meal_items.map((it) => {
                  const macros = calcMacros(it.foods, Number(it.quantity_g));
                  return (
                    <li key={it.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{it.foods.name}</div>
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
                  <Button variant="outline" size="sm" className="mt-3 rounded-lg" disabled={foods.length === 0}>
                    <Plus className="mr-1 h-3.5 w-3.5" />Adicionar alimento
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Adicionar alimento</DialogTitle></DialogHeader>
                  <AddItemForm foods={foods} onSubmit={(food_id, grams) => addItem.mutate({ meal_id: m.id, food_id, grams })} pending={addItem.isPending} />
                </DialogContent>
              </Dialog>
            </article>
          );
        })}
      </section>
    </AppShell>
  );
}

function AddItemForm({ foods, onSubmit, pending }: { foods: Food[]; onSubmit: (food_id: string, grams: number) => void; pending: boolean }) {
  const [foodId, setFoodId] = useState(foods[0]?.id ?? "");
  const [grams, setGrams] = useState(100);
  const food = foods.find((f) => f.id === foodId);
  const macros = food ? calcMacros(food, grams) : null;

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (foodId) onSubmit(foodId, grams); }} className="space-y-3">
      <div>
        <Label className="text-xs">Alimento</Label>
        <Select value={foodId} onValueChange={setFoodId}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            {foods.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Quantidade (g)</Label>
        <Input type="number" min="1" value={grams} onChange={(e) => setGrams(+e.target.value)} />
      </div>
      {macros && (
        <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div><div className="font-semibold text-foreground">{macros.kcal}</div>kcal</div>
            <div><div className="font-semibold text-foreground">{macros.protein}g</div>P</div>
            <div><div className="font-semibold text-foreground">{macros.carbs}g</div>C</div>
            <div><div className="font-semibold text-foreground">{macros.fat}g</div>G</div>
          </div>
        </div>
      )}
      <Button type="submit" className="w-full" disabled={pending || !foodId}>Adicionar</Button>
    </form>
  );
}

function Total({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value} <span className="text-sm font-normal text-muted-foreground">{unit}</span></div>
    </div>
  );
}
