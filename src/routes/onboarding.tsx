import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
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
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { todayIso } from "@/lib/dallas";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Configuração inicial — Projeto Dallas" }] }),
  component: Onboarding,
});

function Onboarding() {
  const { user, loading: authLoading } = useAuth();
  const { hasProfile, loading: profileLoading } = useProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    name: "",
    height_cm: 183,
    weight_kg: 109,
    goal: "cutting",
    calories: 2200,
    protein_g: 180,
    carbs_g: 200,
    fat_g: 70,
  });
  const [saving, setSaving] = useState(false);

  if (authLoading || profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  if (hasProfile) return <Navigate to="/" />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const { error: pErr } = await supabase.from("profiles").insert({
        id: user.id,
        name: form.name,
        height_cm: form.height_cm,
        weight_kg: form.weight_kg,
        goal: form.goal,
      });
      if (pErr) throw pErr;

      const { error: gErr } = await supabase.from("daily_goals").insert({
        user_id: user.id,
        calories: form.calories,
        protein_g: form.protein_g,
        carbs_g: form.carbs_g,
        fat_g: form.fat_g,
      });
      if (gErr) throw gErr;

      const { error: weightError } = await supabase.from("weight_history").insert({
        user_id: user.id,
        measured_at: todayIso(),
        weight_kg: form.weight_kg,
      });
      if (weightError) throw weightError;

      await qc.invalidateQueries();
      toast.success("Perfil configurado!");
      navigate({ to: "/" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Bem-vindo ao Projeto Dallas</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Vamos configurar seu perfil e metas para começar.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border border-border bg-card p-6"
        >
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground">Dados pessoais</h2>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Seu nome"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Altura (cm)</Label>
                <Input
                  type="number"
                  step="0.1"
                  required
                  value={form.height_cm}
                  onChange={(e) => setForm({ ...form, height_cm: +e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Peso atual (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  required
                  value={form.weight_kg}
                  onChange={(e) => setForm({ ...form, weight_kg: +e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Objetivo</Label>
              <Select value={form.goal} onValueChange={(v) => setForm({ ...form, goal: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cutting">Cutting (perder gordura)</SelectItem>
                  <SelectItem value="manutencao">Manutenção</SelectItem>
                  <SelectItem value="bulking">Bulking (ganhar massa)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="space-y-4 border-t border-border pt-6">
            <h2 className="text-sm font-semibold text-muted-foreground">Metas diárias</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Calorias (kcal)</Label>
                <Input
                  type="number"
                  required
                  value={form.calories}
                  onChange={(e) => setForm({ ...form, calories: +e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Proteína (g)</Label>
                <Input
                  type="number"
                  required
                  value={form.protein_g}
                  onChange={(e) => setForm({ ...form, protein_g: +e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Carboidratos (g)</Label>
                <Input
                  type="number"
                  required
                  value={form.carbs_g}
                  onChange={(e) => setForm({ ...form, carbs_g: +e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Gorduras (g)</Label>
                <Input
                  type="number"
                  required
                  value={form.fat_g}
                  onChange={(e) => setForm({ ...form, fat_g: +e.target.value })}
                />
              </div>
            </div>
          </section>

          <Button type="submit" size="lg" className="w-full" disabled={saving}>
            {saving ? "Salvando..." : "Começar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
