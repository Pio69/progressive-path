import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { MANUAL_MEAL_ITEM_FOOD_NAME, type Food } from "@/lib/dallas";

export const Route = createFileRoute("/alimentos")({
  head: () => ({ meta: [{ title: "Alimentos - Progressive Path" }] }),
  component: Alimentos,
});

type FormState = {
  id?: string;
  name: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
};

type FoodNutritionResult = {
  code: string;
  name: string;
  brand: string;
  quantity: string;
  imageUrl: string;
  sourceUrl: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  confidence: "baixa" | "media" | "alta";
};

const empty: FormState = {
  name: "",
  calories_per_100g: 0,
  protein_per_100g: 0,
  carbs_per_100g: 0,
  fat_per_100g: 0,
};

function Alimentos() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupTerm, setLookupTerm] = useState("");
  const [lookupResults, setLookupResults] = useState<FoodNutritionResult[]>([]);

  const { data: foods = [], isLoading } = useQuery({
    queryKey: ["foods", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("foods")
        .select("*")
        .eq("user_id", user!.id)
        .neq("name", MANUAL_MEAL_ITEM_FOOD_NAME)
        .order("name");
      if (error) throw error;
      return data as Food[];
    },
  });

  const save = useMutation({
    mutationFn: async (f: FormState) => {
      if (!user) throw new Error("not auth");
      const payload = {
        user_id: user.id,
        name: f.name,
        calories_per_100g: f.calories_per_100g,
        protein_per_100g: f.protein_per_100g,
        carbs_per_100g: f.carbs_per_100g,
        fat_per_100g: f.fat_per_100g,
      };
      if (f.id) {
        const { error } = await supabase
          .from("foods")
          .update(payload)
          .eq("user_id", user.id)
          .eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("foods").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["foods"] });
      setOpen(false);
      setForm(empty);
      toast.success("Alimento salvo");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("foods").delete().eq("user_id", user!.id).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["foods"] });
      toast.success("Alimento excluido");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const lookupNutrition = useMutation({
    mutationFn: async (query: string) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessao expirada. Entre novamente.");

      const response = await fetch(
        `/api/search-food-nutrition?q=${encodeURIComponent(query.trim())}`,
        {
          headers: {
            authorization: `Bearer ${token}`,
            "x-supabase-url": import.meta.env.VITE_SUPABASE_URL,
            "x-supabase-key":
              import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
              import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
        },
      );

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Falha ao buscar alimento");
      return (payload.results ?? []) as FoodNutritionResult[];
    },
    onSuccess: (results) => {
      setLookupResults(results);
      if (results.length === 0) {
        toast.info("Nenhum produto com macros completos foi encontrado.");
      }
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function openNew() {
    setForm(empty);
    setOpen(true);
  }

  function openEdit(f: Food) {
    setForm({
      id: f.id,
      name: f.name,
      calories_per_100g: Number(f.calories_per_100g),
      protein_per_100g: Number(f.protein_per_100g),
      carbs_per_100g: Number(f.carbs_per_100g),
      fat_per_100g: Number(f.fat_per_100g),
    });
    setOpen(true);
  }

  function openLookup() {
    setLookupTerm(form.name);
    setLookupResults([]);
    setLookupOpen(true);
  }

  function applyLookupResult(result: FoodNutritionResult) {
    setForm({
      name: formatFoodName(result),
      calories_per_100g: result.calories_per_100g,
      protein_per_100g: result.protein_per_100g,
      carbs_per_100g: result.carbs_per_100g,
      fat_per_100g: result.fat_per_100g,
    });
    setLookupOpen(false);
    setOpen(true);
    toast.success("Tabela preenchida. Confira antes de salvar.");
  }

  return (
    <AppShell>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Alimentos</h1>
          <p className="text-sm text-muted-foreground">Catalogo pessoal com valores por 100g.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={lookupOpen} onOpenChange={setLookupOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={openLookup} className="rounded-xl">
                <Search className="mr-2 h-4 w-4" />
                Buscar tabela
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Buscar tabela nutricional</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  lookupNutrition.mutate(lookupTerm);
                }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome do produto</Label>
                  <div className="flex gap-2">
                    <Input
                      value={lookupTerm}
                      onChange={(event) => setLookupTerm(event.target.value)}
                      placeholder="Nome do alimento ou produto"
                    />
                    <Button
                      type="submit"
                      disabled={lookupNutrition.isPending || lookupTerm.trim().length < 3}
                    >
                      <Search className="mr-2 h-4 w-4" />
                      {lookupNutrition.isPending ? "Buscando..." : "Buscar"}
                    </Button>
                  </div>
                </div>

                {lookupResults.length > 0 && (
                  <div className="space-y-2">
                    {lookupResults.map((result) => (
                      <div
                        key={result.code}
                        className="rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/50"
                      >
                        <div className="flex gap-3">
                          {result.imageUrl ? (
                            <img
                              src={result.imageUrl}
                              alt=""
                              className="h-16 w-16 shrink-0 rounded-lg border border-border object-cover"
                            />
                          ) : (
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
                              <Search className="h-5 w-5" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h3 className="truncate text-sm font-semibold">{result.name}</h3>
                                <p className="text-xs text-muted-foreground">
                                  {[result.brand, result.quantity].filter(Boolean).join(" - ") ||
                                    "Open Food Facts"}
                                </p>
                              </div>
                              <span className="rounded-full bg-muted px-2 py-1 text-[10px] uppercase text-muted-foreground">
                                {result.confidence}
                              </span>
                            </div>
                            <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                              <Stat label="kcal" value={result.calories_per_100g} />
                              <Stat label="P" value={result.protein_per_100g} />
                              <Stat label="C" value={result.carbs_per_100g} />
                              <Stat label="G" value={result.fat_per_100g} />
                            </div>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                              <a
                                href={result.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
                              >
                                Ver fonte
                                <ExternalLink className="h-3 w-3" />
                              </a>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => applyLookupResult(result)}
                              >
                                Usar dados
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew} className="rounded-xl">
                <Plus className="mr-2 h-4 w-4" />
                Novo alimento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{form.id ? "Editar alimento" : "Novo alimento"}</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  save.mutate(form);
                }}
                className="space-y-3"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs">Nome</Label>
                    <Input
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Kcal / 100g</Label>
                    <Input
                      type="number"
                      step="0.1"
                      required
                      value={form.calories_per_100g}
                      onChange={(e) => setForm({ ...form, calories_per_100g: +e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Proteina / 100g</Label>
                    <Input
                      type="number"
                      step="0.1"
                      required
                      value={form.protein_per_100g}
                      onChange={(e) => setForm({ ...form, protein_per_100g: +e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Carbo / 100g</Label>
                    <Input
                      type="number"
                      step="0.1"
                      required
                      value={form.carbs_per_100g}
                      onChange={(e) => setForm({ ...form, carbs_per_100g: +e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Gordura / 100g</Label>
                    <Input
                      type="number"
                      step="0.1"
                      required
                      value={form.fat_per_100g}
                      onChange={(e) => setForm({ ...form, fat_per_100g: +e.target.value })}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={save.isPending}>
                  {save.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : foods.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhum alimento cadastrado ainda. Clique em "Novo alimento" para comecar.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {foods.map((f) => (
            <article key={f.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{f.name}</h3>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(f)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm("Excluir alimento?")) del.mutate(f.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                <Stat label="kcal" value={f.calories_per_100g} />
                <Stat label="P" value={f.protein_per_100g} />
                <Stat label="C" value={f.carbs_per_100g} />
                <Stat label="G" value={f.fat_per_100g} />
              </div>
              <div className="mt-2 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
                por 100g
              </div>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-muted/40 px-1 py-1.5">
      <div className="font-semibold">{Number(value)}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado";
}

function formatFoodName(result: FoodNutritionResult) {
  const normalizedName = normalizeText(result.name);
  const brand = result.brand
    .split(",")
    .map((item) => item.trim())
    .find(Boolean);

  if (!brand || normalizedName.includes(normalizeText(brand))) {
    return result.name;
  }

  return `${result.name} - ${brand}`;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
