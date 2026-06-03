import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Sparkles, Trash2, Pencil, Apple } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { syncDailyLogNutrition } from "@/lib/dallas-data";
import {
  calcMacros,
  effectiveMealItemQuantityG,
  sumMacros,
  todayIso,
  type Food,
  type Meal,
  type MealItem,
} from "@/lib/dallas";

export const Route = createFileRoute("/refeicoes")({
  head: () => ({ meta: [{ title: "Refeicoes - Progressive Path" }] }),
  component: Refeicoes,
});

function Refeicoes() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [date, setDate] = useState(todayIso());
  const [newMealOpen, setNewMealOpen] = useState(false);
  const [addTextMealId, setAddTextMealId] = useState<string | null>(null);
  const [addFoodMealId, setAddFoodMealId] = useState<string | null>(null);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [editingItem, setEditingItem] = useState<MealItem | null>(null);

  const { data: meals = [] } = useQuery({
    queryKey: ["meals", user?.id, date],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meals")
        .select("*, meal_items(*)")
        .eq("user_id", user!.id)
        .eq("meal_date", date)
        .order("meal_type", { ascending: true });
      if (error) throw error;
      return data as (Meal & { meal_items: MealItem[] })[];
    },
  });

  const { data: foods = [] } = useQuery({
    queryKey: ["foods", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("foods")
        .select("*")
        .eq("user_id", user!.id)
        .order("name");
      if (error) throw error;
      return data as Food[];
    },
  });

  async function invalidateDay() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["meals"] }),
      qc.invalidateQueries({ queryKey: ["daily_log"] }),
      qc.invalidateQueries({ queryKey: ["daily_logs"] }),
    ]);
  }

  const createMeal = useMutation({
    mutationFn: async (meal: { meal_type: string; itemsText: string }) => {
      const { data, error } = await supabase
        .from("meals")
        .insert({ user_id: user!.id, meal_date: date, meal_type: meal.meal_type })
        .select("id")
        .single();
      if (error) throw error;

      const items = parseMealItems(meal.itemsText);
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

      await syncDailyLogNutrition(user!.id, date);
    },
    onSuccess: () => {
      invalidateDay();
      setNewMealOpen(false);
      toast.success("Refeicao registrada");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const updateMeal = useMutation({
    mutationFn: async (meal: { id: string; meal_type: string }) => {
      const { error } = await supabase
        .from("meals")
        .update({ meal_type: meal.meal_type })
        .eq("user_id", user!.id)
        .eq("id", meal.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateDay();
      setEditingMeal(null);
      toast.success("Refeicao atualizada");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const deleteMeal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meals").delete().eq("user_id", user!.id).eq("id", id);
      if (error) throw error;
      await syncDailyLogNutrition(user!.id, date);
    },
    onSuccess: () => {
      invalidateDay();
      toast.success("Refeicao excluida");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const addTextItems = useMutation({
    mutationFn: async (input: { meal_id: string; itemsText: string }) => {
      const items = parseMealItems(input.itemsText);
      if (items.length === 0) throw new Error("Digite pelo menos um item");

      const { error } = await supabase.from("meal_items").insert(
        items.map((item) => ({
          user_id: user!.id,
          meal_id: input.meal_id,
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
      await syncDailyLogNutrition(user!.id, date);
    },
    onSuccess: () => {
      invalidateDay();
      setAddTextMealId(null);
      toast.success("Itens adicionados");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const addFoodItem = useMutation({
    mutationFn: async (input: { meal_id: string; food_id: string; grams: number }) => {
      const food = foods.find((item) => item.id === input.food_id);
      if (!food) throw new Error("Alimento nao encontrado");
      if (!Number.isFinite(input.grams) || input.grams <= 0) {
        throw new Error("Informe uma quantidade maior que zero");
      }

      const { error } = await supabase.from("meal_items").insert({
        user_id: user!.id,
        meal_id: input.meal_id,
        food_id: food.id,
        quantity_g: input.grams,
        food_name: food.name,
        calories_per_100g: food.calories_per_100g,
        protein_per_100g: food.protein_per_100g,
        carbs_per_100g: food.carbs_per_100g,
        fat_per_100g: food.fat_per_100g,
      });
      if (error) throw error;
      await syncDailyLogNutrition(user!.id, date);
    },
    onSuccess: () => {
      invalidateDay();
      setAddFoodMealId(null);
      toast.success("Alimento adicionado");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const updateItem = useMutation({
    mutationFn: async (input: { id: string; food_name: string; quantity_g: number }) => {
      if (!input.food_name.trim()) throw new Error("Informe o nome do item");
      if (!Number.isFinite(input.quantity_g) || input.quantity_g < 0) {
        throw new Error("A quantidade nao pode ser negativa");
      }

      const { error } = await supabase
        .from("meal_items")
        .update({ food_name: input.food_name.trim(), quantity_g: input.quantity_g })
        .eq("user_id", user!.id)
        .eq("id", input.id);
      if (error) throw error;
      await syncDailyLogNutrition(user!.id, date);
    },
    onSuccess: () => {
      invalidateDay();
      setEditingItem(null);
      toast.success("Item atualizado");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("meal_items")
        .delete()
        .eq("user_id", user!.id)
        .eq("id", id);
      if (error) throw error;
      await syncDailyLogNutrition(user!.id, date);
    },
    onSuccess: () => {
      invalidateDay();
      toast.success("Item excluido");
    },
    onError: (error) => toast.error(errorMessage(error)),
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
          "x-supabase-key":
            import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          mealName: meal.meal_type,
          items: meal.meal_items.map((item) => ({
            id: item.id,
            name: item.food_name,
            grams: Number(item.quantity_g),
            quantityText: mealItemQuantityText(item),
          })),
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Falha ao calcular macros");

      const estimates = (payload.items ?? []) as MacroEstimate[];
      await Promise.all(
        estimates.map((item) => {
          const original = meal.meal_items.find((mealItem) => mealItem.id === item.id);
          const grams = Number(original?.quantity_g ?? 0);
          if (!original) return Promise.resolve();

          const hasGrams = Number.isFinite(grams) && grams > 0;
          const factor = hasGrams ? 100 / grams : 1;
          return supabase
            .from("meal_items")
            .update({
              calories_per_100g: +(item.calories * factor).toFixed(1),
              protein_per_100g: +(item.protein_g * factor).toFixed(1),
              carbs_per_100g: +(item.carbs_g * factor).toFixed(1),
              fat_per_100g: +(item.fat_g * factor).toFixed(1),
            })
            .eq("user_id", user!.id)
            .eq("id", item.id)
            .then(({ error }) => {
              if (error) throw error;
            });
        }),
      );

      await syncDailyLogNutrition(user!.id, date);
      return estimates;
    },
    onSuccess: (items) => {
      invalidateDay();
      const lowConfidence = items.filter((item) => item.confidence === "baixa").length;
      toast.success(
        lowConfidence > 0
          ? `Macros calculados. ${lowConfidence} item(ns) com baixa confianca.`
          : "Macros calculados",
      );
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const totals = sumMacros(
    meals.flatMap((meal) =>
      meal.meal_items.map((item) => calcMacros(item, effectiveMealItemQuantityG(item))),
    ),
  );

  return (
    <AppShell>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Refeicoes</h1>
          <p className="text-sm text-muted-foreground">
            Registre por texto livre, catalogo ou estimativa com IA.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="w-auto"
          />
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/alimentos">
              <Apple className="mr-2 h-4 w-4" />
              Alimentos
            </Link>
          </Button>
          <Dialog open={newMealOpen} onOpenChange={setNewMealOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl">
                <Plus className="mr-2 h-4 w-4" />
                Nova refeicao
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova refeicao</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  createMeal.mutate({
                    meal_type: String(form.get("meal_type")),
                    itemsText: String(form.get("items")),
                  });
                }}
                className="space-y-3"
              >
                <div>
                  <Label className="text-xs">Nome da refeicao</Label>
                  <Input name="meal_type" required defaultValue={`Refeicao ${meals.length + 1}`} />
                </div>
                <div>
                  <Label className="text-xs">Itens por texto livre</Label>
                  <Textarea
                    name="items"
                    className="min-h-36"
                    placeholder={"1 fatia pao de forma\n80g frango\n200ml leite"}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createMeal.isPending}>
                  {createMeal.isPending ? "Registrando..." : "Registrar refeicao"}
                </Button>
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
        ) : (
          meals.map((meal) => {
            const mealMacros = sumMacros(
              meal.meal_items.map((item) => calcMacros(item, effectiveMealItemQuantityG(item))),
            );
            return (
              <article key={meal.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold">{meal.meal_type}</h3>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {meal.meal_items.length} item(ns)
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-warning">{mealMacros.kcal} kcal</span>
                    <span className="font-semibold text-accent">P {mealMacros.protein}g</span>
                    <span className="text-muted-foreground">
                      C {mealMacros.carbs}g / G {mealMacros.fat}g
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg"
                      disabled={estimateMeal.isPending || meal.meal_items.length === 0}
                      onClick={() => estimateMeal.mutate(meal)}
                    >
                      <Sparkles className="mr-1 h-3.5 w-3.5" />
                      {estimateMeal.isPending && estimateMeal.variables?.id === meal.id
                        ? "Calculando..."
                        : "Calcular"}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditingMeal(meal)}
                      aria-label="Editar refeicao"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMeal.mutate(meal.id)}
                      aria-label="Excluir refeicao"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <ul className="mt-3 space-y-1.5">
                  {meal.meal_items.map((item) => {
                    const macros = calcMacros(item, effectiveMealItemQuantityG(item));
                    return (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">{item.food_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {mealItemQuantityLabel(item)}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 text-xs">
                          <span>{macros.kcal} kcal</span>
                          <span className="text-accent">P {macros.protein}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setEditingItem(item)}
                            aria-label="Editar item"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteItem.mutate(item.id)}
                            aria-label="Excluir item"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Dialog
                    open={addFoodMealId === meal.id}
                    onOpenChange={(open) => setAddFoodMealId(open ? meal.id : null)}
                  >
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="rounded-lg">
                        <Apple className="mr-1 h-3.5 w-3.5" />
                        Do catalogo
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Adicionar do catalogo</DialogTitle>
                      </DialogHeader>
                      <AddFoodForm
                        foods={foods}
                        pending={addFoodItem.isPending}
                        onSubmit={(food_id, grams) =>
                          addFoodItem.mutate({ meal_id: meal.id, food_id, grams })
                        }
                      />
                    </DialogContent>
                  </Dialog>

                  <Dialog
                    open={addTextMealId === meal.id}
                    onOpenChange={(open) => setAddTextMealId(open ? meal.id : null)}
                  >
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="rounded-lg">
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Texto livre
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Adicionar por texto livre</DialogTitle>
                      </DialogHeader>
                      <AddTextItemsForm
                        onSubmit={(itemsText) =>
                          addTextItems.mutate({ meal_id: meal.id, itemsText })
                        }
                        pending={addTextItems.isPending}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              </article>
            );
          })
        )}
      </section>

      <Dialog open={Boolean(editingMeal)} onOpenChange={(open) => !open && setEditingMeal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar refeicao</DialogTitle>
          </DialogHeader>
          {editingMeal && (
            <EditMealForm
              meal={editingMeal}
              pending={updateMeal.isPending}
              onSubmit={(meal_type) => updateMeal.mutate({ id: editingMeal.id, meal_type })}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingItem)} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar item</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <EditItemForm
              item={editingItem}
              pending={updateItem.isPending}
              onSubmit={(food_name, quantity_g) =>
                updateItem.mutate({ id: editingItem.id, food_name, quantity_g })
              }
            />
          )}
        </DialogContent>
      </Dialog>
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

function AddFoodForm({
  foods,
  onSubmit,
  pending,
}: {
  foods: Food[];
  onSubmit: (foodId: string, grams: number) => void;
  pending: boolean;
}) {
  const [foodId, setFoodId] = useState(foods[0]?.id ?? "");
  const [grams, setGrams] = useState(100);
  const selected = foods.find((food) => food.id === foodId);

  useEffect(() => {
    if (!foodId && foods[0]) setFoodId(foods[0].id);
  }, [foodId, foods]);

  if (foods.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Cadastre alimentos para usar o catalogo sem depender da IA.
        </div>
        <Button asChild className="w-full">
          <Link to="/alimentos">Abrir alimentos</Link>
        </Button>
      </div>
    );
  }

  const preview = selected ? calcMacros(selected, grams) : null;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(foodId, grams);
      }}
      className="space-y-3"
    >
      <div>
        <Label className="text-xs">Alimento</Label>
        <Select value={foodId} onValueChange={setFoodId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {foods.map((food) => (
              <SelectItem key={food.id} value={food.id}>
                {food.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Quantidade (g)</Label>
        <Input
          type="number"
          step="0.1"
          min="0.1"
          value={grams}
          onChange={(event) => setGrams(Number(event.target.value))}
        />
      </div>
      {preview && (
        <div className="grid grid-cols-4 gap-2 rounded-xl bg-muted/30 p-3 text-center text-xs">
          <PreviewStat label="kcal" value={preview.kcal} />
          <PreviewStat label="P" value={preview.protein} />
          <PreviewStat label="C" value={preview.carbs} />
          <PreviewStat label="G" value={preview.fat} />
        </div>
      )}
      <Button type="submit" className="w-full" disabled={pending || !foodId || grams <= 0}>
        {pending ? "Adicionando..." : "Adicionar alimento"}
      </Button>
    </form>
  );
}

function AddTextItemsForm({
  onSubmit,
  pending,
}: {
  onSubmit: (itemsText: string) => void;
  pending: boolean;
}) {
  const [itemsText, setItemsText] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(itemsText);
      }}
      className="space-y-3"
    >
      <div>
        <Label className="text-xs">Itens</Label>
        <Textarea
          value={itemsText}
          onChange={(event) => setItemsText(event.target.value)}
          className="min-h-36"
          placeholder={"1 fatia pao de forma\n80g frango\n200ml leite"}
        />
      </div>
      <Button
        type="submit"
        className="w-full"
        disabled={pending || parseMealItems(itemsText).length === 0}
      >
        {pending ? "Adicionando..." : "Adicionar itens"}
      </Button>
    </form>
  );
}

function EditMealForm({
  meal,
  pending,
  onSubmit,
}: {
  meal: Meal;
  pending: boolean;
  onSubmit: (mealType: string) => void;
}) {
  const [mealType, setMealType] = useState(meal.meal_type);

  useEffect(() => {
    setMealType(meal.meal_type);
  }, [meal]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(mealType.trim());
      }}
      className="space-y-3"
    >
      <div>
        <Label className="text-xs">Nome da refeicao</Label>
        <Input required value={mealType} onChange={(event) => setMealType(event.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={pending || !mealType.trim()}>
        {pending ? "Salvando..." : "Salvar refeicao"}
      </Button>
    </form>
  );
}

function EditItemForm({
  item,
  pending,
  onSubmit,
}: {
  item: MealItem;
  pending: boolean;
  onSubmit: (foodName: string, quantityG: number) => void;
}) {
  const [foodName, setFoodName] = useState(item.food_name);
  const [quantityG, setQuantityG] = useState(Number(item.quantity_g));
  const preview = calcMacros(item, quantityG);

  useEffect(() => {
    setFoodName(item.food_name);
    setQuantityG(Number(item.quantity_g));
  }, [item]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(foodName, quantityG);
      }}
      className="space-y-3"
    >
      <div>
        <Label className="text-xs">Item</Label>
        <Input required value={foodName} onChange={(event) => setFoodName(event.target.value)} />
      </div>
      <div>
        <Label className="text-xs">Quantidade (g)</Label>
        <Input
          type="number"
          step="0.1"
          min="0"
          value={quantityG}
          onChange={(event) => setQuantityG(Number(event.target.value))}
        />
      </div>
      <div className="grid grid-cols-4 gap-2 rounded-xl bg-muted/30 p-3 text-center text-xs">
        <PreviewStat label="kcal" value={preview.kcal} />
        <PreviewStat label="P" value={preview.protein} />
        <PreviewStat label="C" value={preview.carbs} />
        <PreviewStat label="G" value={preview.fat} />
      </div>
      <Button type="submit" className="w-full" disabled={pending || !foodName.trim()}>
        {pending ? "Salvando..." : "Salvar item"}
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

function mealItemQuantityText(item: Pick<MealItem, "food_name" | "quantity_g" | "food_id">) {
  const grams = Number(item.quantity_g);
  return Number.isFinite(grams) && grams > 0 ? `${grams}g` : item.food_name;
}

function mealItemQuantityLabel(
  item: Pick<
    MealItem,
    | "quantity_g"
    | "calories_per_100g"
    | "protein_per_100g"
    | "carbs_per_100g"
    | "fat_per_100g"
  >,
) {
  const grams = Number(item.quantity_g);
  if (Number.isFinite(grams) && grams > 0) return `${grams}g`;

  return effectiveMealItemQuantityG(item) > 0 ? "Porcao estimada" : "Quantidade a estimar";
}

function Total({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">
        {value} <span className="text-sm font-normal text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-semibold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado";
}
