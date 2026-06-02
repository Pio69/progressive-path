import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/metas")({
  head: () => ({ meta: [{ title: "Metas - Progressive Path" }] }),
  component: Metas,
});

function Metas() {
  const { user } = useAuth();
  const { profile, goals } = useProfile();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    name: "",
    height_cm: 0,
    goal: "manutencao",
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
  });

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name ?? "",
        height_cm: Number(profile.height_cm ?? 0),
        goal: normalizeGoal(profile.goal),
        calories: goals?.calories ?? 0,
        protein_g: goals?.protein_g ?? 0,
        carbs_g: goals?.carbs_g ?? 0,
        fat_g: goals?.fat_g ?? 0,
      });
    }
  }, [profile, goals]);

  const save = useMutation({
    mutationFn: async () => {
      const { error: pe } = await supabase.from("profiles").upsert({
        id: user!.id,
        name: form.name,
        height_cm: form.height_cm,
        goal: form.goal,
      });
      if (pe) throw pe;
      const { error: ge } = await supabase.from("daily_goals").upsert(
        {
          user_id: user!.id,
          calories: form.calories,
          protein_g: form.protein_g,
          carbs_g: form.carbs_g,
          fat_g: form.fat_g,
        },
        { onConflict: "user_id" },
      );
      if (ge) throw ge;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["daily_goals"] });
      toast.success("Metas atualizadas");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Metas</h1>
        <p className="text-sm text-muted-foreground">Atualize seus dados fixos e metas diarias.</p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="space-y-6"
      >
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-muted-foreground">Perfil</h2>
          <div>
            <Label className="text-xs">Nome</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Altura (cm)</Label>
            <Input
              type="number"
              step="0.1"
              value={form.height_cm}
              onChange={(e) => setForm({ ...form, height_cm: +e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Objetivo</Label>
            <Select value={form.goal} onValueChange={(v) => setForm({ ...form, goal: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="perda_gordura">Perda de gordura</SelectItem>
                <SelectItem value="manutencao">Manutencao</SelectItem>
                <SelectItem value="ganho_massa">Ganho de massa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-muted-foreground">Metas diarias</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Calorias</Label>
              <Input
                type="number"
                value={form.calories}
                onChange={(e) => setForm({ ...form, calories: +e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Proteina (g)</Label>
              <Input
                type="number"
                value={form.protein_g}
                onChange={(e) => setForm({ ...form, protein_g: +e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Carboidratos (g)</Label>
              <Input
                type="number"
                value={form.carbs_g}
                onChange={(e) => setForm({ ...form, carbs_g: +e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Gorduras (g)</Label>
              <Input
                type="number"
                value={form.fat_g}
                onChange={(e) => setForm({ ...form, fat_g: +e.target.value })}
              />
            </div>
          </div>
        </section>

        <Button type="submit" size="lg" disabled={save.isPending}>
          {save.isPending ? "Salvando..." : "Salvar alteracoes"}
        </Button>
      </form>
    </AppShell>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado";
}

function normalizeGoal(goal: string | null | undefined) {
  if (goal === "cutting") return "perda_gordura";
  if (goal === "bulking") return "ganho_massa";
  return goal ?? "manutencao";
}
