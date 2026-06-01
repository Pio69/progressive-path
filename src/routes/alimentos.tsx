import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Food } from "@/lib/dallas";

export const Route = createFileRoute("/alimentos")({
  head: () => ({ meta: [{ title: "Alimentos - Projeto Dallas" }] }),
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

const empty: FormState = { name: "", calories_per_100g: 0, protein_per_100g: 0, carbs_per_100g: 0, fat_per_100g: 0 };

function Alimentos() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);

  const { data: foods = [], isLoading } = useQuery({
    queryKey: ["foods", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("foods").select("*").order("name");
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
        const { error } = await supabase.from("foods").update(payload).eq("id", f.id);
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
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("foods").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["foods"] });
      toast.success("Alimento excluido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openNew() { setForm(empty); setOpen(true); }
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

  return (
    <AppShell>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Alimentos</h1>
          <p className="text-sm text-muted-foreground">Catalogo pessoal com valores por 100g.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="rounded-xl"><Plus className="mr-2 h-4 w-4" />Novo alimento</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{form.id ? "Editar alimento" : "Novo alimento"}</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); save.mutate(form); }} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label className="text-xs">Nome</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label className="text-xs">Kcal / 100g</Label><Input type="number" step="0.1" required value={form.calories_per_100g} onChange={(e) => setForm({ ...form, calories_per_100g: +e.target.value })} /></div>
                <div><Label className="text-xs">Proteina / 100g</Label><Input type="number" step="0.1" required value={form.protein_per_100g} onChange={(e) => setForm({ ...form, protein_per_100g: +e.target.value })} /></div>
                <div><Label className="text-xs">Carbo / 100g</Label><Input type="number" step="0.1" required value={form.carbs_per_100g} onChange={(e) => setForm({ ...form, carbs_per_100g: +e.target.value })} /></div>
                <div><Label className="text-xs">Gordura / 100g</Label><Input type="number" step="0.1" required value={form.fat_per_100g} onChange={(e) => setForm({ ...form, fat_per_100g: +e.target.value })} /></div>
              </div>
              <Button type="submit" className="w-full" disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar"}</Button>
            </form>
          </DialogContent>
        </Dialog>
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
                  <Button size="icon" variant="ghost" onClick={() => openEdit(f)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir alimento?")) del.mutate(f.id); }}>
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
              <div className="mt-2 text-center text-[10px] uppercase tracking-wide text-muted-foreground">por 100g</div>
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
