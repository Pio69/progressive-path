import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Camera, TrendingDown, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { todayIso, type BodyMeasurement } from "@/lib/dallas";

export const Route = createFileRoute("/medidas")({
  head: () => ({ meta: [{ title: "Medidas corporais - Progressive Path" }] }),
  component: Medidas,
});

type FormState = {
  date: string;
  waist_cm: number;
  chest_cm: number;
  arm_cm: number;
  thigh_cm: number;
  notes: string;
};

const emptyForm: FormState = {
  date: todayIso(),
  waist_cm: 0,
  chest_cm: 0,
  arm_cm: 0,
  thigh_cm: 0,
  notes: "",
};

function Medidas() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["body_measurements", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("body_measurements")
        .select("*")
        .eq("user_id", user!.id)
        .order("measured_at", { ascending: false });
      if (error) throw error;
      return data as BodyMeasurement[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("body_measurements").upsert(
        {
          user_id: user!.id,
          measured_at: form.date,
          waist_cm: positiveOrNull(form.waist_cm),
          chest_cm: positiveOrNull(form.chest_cm),
          arm_cm: positiveOrNull(form.arm_cm),
          thigh_cm: positiveOrNull(form.thigh_cm),
          notes: form.notes.trim() || null,
        },
        { onConflict: "user_id,measured_at" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["body_measurements"] });
      toast.success("Medidas salvas");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("body_measurements")
        .delete()
        .eq("user_id", user!.id)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["body_measurements"] });
      toast.success("Medicao excluida");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const ordered = [...history].sort((a, b) => a.measured_at.localeCompare(b.measured_at));
  const first = ordered[0] ?? null;
  const latest = ordered[ordered.length - 1] ?? null;

  function loadMeasurement(measurement: BodyMeasurement) {
    setForm({
      date: measurement.measured_at,
      waist_cm: Number(measurement.waist_cm ?? 0),
      chest_cm: Number(measurement.chest_cm ?? 0),
      arm_cm: Number(measurement.arm_cm ?? 0),
      thigh_cm: Number(measurement.thigh_cm ?? 0),
      notes: measurement.notes ?? "",
    });
  }

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Medidas corporais</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe alem da balanca com historico real por data.
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <MeasureCard
          label="Cintura"
          value={latest?.waist_cm}
          diff={diff(first?.waist_cm, latest?.waist_cm)}
        />
        <MeasureCard
          label="Peito"
          value={latest?.chest_cm}
          diff={diff(first?.chest_cm, latest?.chest_cm)}
        />
        <MeasureCard
          label="Braco"
          value={latest?.arm_cm}
          diff={diff(first?.arm_cm, latest?.arm_cm)}
        />
        <MeasureCard
          label="Coxa"
          value={latest?.thigh_cm}
          diff={diff(first?.thigh_cm, latest?.thigh_cm)}
        />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
          className="space-y-4 rounded-2xl border border-border bg-card p-5 lg:col-span-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground">Nova medicao</h2>
            <Button type="button" variant="outline" size="sm" onClick={() => setForm(emptyForm)}>
              Limpar
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5">
            <Field label="Data">
              <Input
                type="date"
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
              />
            </Field>
            <Field label="Cintura">
              <Input
                type="number"
                step="0.5"
                value={form.waist_cm}
                onChange={(event) => setForm({ ...form, waist_cm: Number(event.target.value) })}
              />
            </Field>
            <Field label="Peito">
              <Input
                type="number"
                step="0.5"
                value={form.chest_cm}
                onChange={(event) => setForm({ ...form, chest_cm: Number(event.target.value) })}
              />
            </Field>
            <Field label="Braco">
              <Input
                type="number"
                step="0.5"
                value={form.arm_cm}
                onChange={(event) => setForm({ ...form, arm_cm: Number(event.target.value) })}
              />
            </Field>
            <Field label="Coxa">
              <Input
                type="number"
                step="0.5"
                value={form.thigh_cm}
                onChange={(event) => setForm({ ...form, thigh_cm: Number(event.target.value) })}
              />
            </Field>
          </div>
          <Field label="Observacoes">
            <Textarea
              rows={2}
              placeholder="Jejum, pump pos treino, horario, fita usada..."
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </Field>
          <Button className="rounded-xl" disabled={save.isPending}>
            <Plus className="mr-2 h-4 w-4" />
            {save.isPending ? "Salvando..." : "Salvar medicao"}
          </Button>
        </form>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-muted-foreground">Fotos de progresso</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div
                key={item}
                className="flex aspect-[3/4] items-center justify-center rounded-xl border border-dashed border-border bg-background/40 text-muted-foreground"
              >
                <Camera className="h-5 w-5" />
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Uploads ficam para uma proxima etapa; as medidas numericas ja estao persistidas.
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Historico</h2>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando...</div>
        ) : history.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhuma medicao salva ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 text-left">Data</th>
                  <th className="py-2 text-right">Cintura</th>
                  <th className="py-2 text-right">Peito</th>
                  <th className="py-2 text-right">Braco</th>
                  <th className="py-2 text-right">Coxa</th>
                  <th className="py-2 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {history.map((measurement) => (
                  <tr key={measurement.id} className="border-b border-border/50">
                    <td className="py-3">{formatDate(measurement.measured_at)}</td>
                    <td className="py-3 text-right">{formatCm(measurement.waist_cm)}</td>
                    <td className="py-3 text-right">{formatCm(measurement.chest_cm)}</td>
                    <td className="py-3 text-right">{formatCm(measurement.arm_cm)}</td>
                    <td className="py-3 text-right">{formatCm(measurement.thigh_cm)}</td>
                    <td className="py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => loadMeasurement(measurement)}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("Excluir medicao?")) del.mutate(measurement.id);
                          }}
                          aria-label="Excluir medicao"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}

function MeasureCard({
  label,
  value,
  diff,
}: {
  label: string;
  value: number | null | undefined;
  diff: number | null;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">
        {value == null ? "-" : Number(value).toFixed(1)}{" "}
        <span className="text-sm text-muted-foreground">cm</span>
      </div>
      <div
        className={`mt-1 inline-flex items-center gap-1 text-xs ${diff == null ? "text-muted-foreground" : diff < 0 ? "text-success" : diff > 0 ? "text-warning" : "text-muted-foreground"}`}
      >
        <TrendingDown className="h-3 w-3" />{" "}
        {diff == null
          ? "Sem comparativo"
          : `${diff > 0 ? "+" : ""}${diff.toFixed(1)} cm desde o inicio`}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function diff(first: number | null | undefined, latest: number | null | undefined) {
  if (first == null || latest == null) return null;
  return +(Number(latest) - Number(first)).toFixed(1);
}

function positiveOrNull(value: number) {
  return Number.isFinite(value) && value > 0 ? value : null;
}

function formatCm(value: number | null) {
  return value == null ? "-" : `${Number(value).toFixed(1)} cm`;
}

function formatDate(value: string) {
  return new Date(`${value}T00:00`).toLocaleDateString("pt-BR");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado";
}
