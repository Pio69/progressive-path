import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { todayIso } from "@/lib/dallas";

export const Route = createFileRoute("/evolucao")({
  head: () => ({ meta: [{ title: "Evolucao - Projeto Dallas" }] }),
  component: Evolucao,
});

type WH = { id: string; measured_at: string; weight_kg: number };

function Evolucao() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const qc = useQueryClient();
  const [date, setDate] = useState(todayIso());
  const [weight, setWeight] = useState<number>(0);

  useEffect(() => {
    if (profile?.weight_kg != null) setWeight(Number(profile.weight_kg));
  }, [profile?.weight_kg]);

  const { data: history = [] } = useQuery({
    queryKey: ["weight_history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("weight_history").select("*").order("measured_at", { ascending: false });
      if (error) throw error;
      return data as WH[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("weight_history")
        .insert({ user_id: user!.id, measured_at: date, weight_kg: weight });
      if (error) throw error;
      const { error: profileError } = await supabase.from("profiles").update({ weight_kg: weight }).eq("id", user!.id);
      if (profileError) throw profileError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weight_history"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Pesagem registrada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("weight_history").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weight_history"] }),
  });

  const max = Math.max(...history.map((h) => Number(h.weight_kg)), 0);
  const min = Math.min(...history.map((h) => Number(h.weight_kg)), max);
  const range = Math.max(1, max - min);

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Evolucao</h1>
        <p className="text-sm text-muted-foreground">Historico de pesagens.</p>
      </header>

      <section className="mb-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold">Registrar pesagem</h2>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="flex flex-wrap items-end gap-3">
          <div><Label className="text-xs">Data</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><Label className="text-xs">Peso (kg)</Label><Input type="number" step="0.1" value={weight} onChange={(e) => setWeight(+e.target.value)} required /></div>
          <Button type="submit" disabled={save.isPending}>Salvar</Button>
        </form>
      </section>

      {history.length > 0 && (
        <section className="mb-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">Tendencia</h2>
          <div className="flex h-32 items-end gap-1">
            {[...history].reverse().map((h) => {
              const v = Number(h.weight_kg);
              const pct = ((v - min) / range) * 100;
              return (
                <div key={h.id} className="flex flex-1 flex-col items-center justify-end" title={`${h.measured_at}: ${v}kg`}>
                  <div className="w-full rounded-t bg-primary/70" style={{ height: `${20 + pct * 0.8}%` }} />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>{min} kg</span><span>{max} kg</span>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Registros</h2>
        {history.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Sem pesagens registradas.</div>
        ) : (
          history.map((h) => (
            <div key={h.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
              <div className="text-sm">{new Date(h.measured_at + "T00:00").toLocaleDateString("pt-BR")}</div>
              <div className="flex items-center gap-3">
                <div className="text-lg font-semibold">{Number(h.weight_kg)} kg</div>
                <Button size="sm" variant="ghost" onClick={() => del.mutate(h.id)}>Excluir</Button>
              </div>
            </div>
          ))
        )}
      </section>
    </AppShell>
  );
}
