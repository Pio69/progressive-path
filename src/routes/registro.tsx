import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { syncDailyLogNutrition } from "@/lib/dallas-data";
import { todayIso, type DailyLog } from "@/lib/dallas";

export const Route = createFileRoute("/registro")({
  head: () => ({ meta: [{ title: "Registro diario - Progressive Path" }] }),
  component: Registro,
});

const TAGS = [
  "Fome alta",
  "Pouca fome",
  "Compulsao",
  "Retencao",
  "Treino forte",
  "Treino ruim",
  "Muito sono",
  "Dia fora da rotina",
  "Evento social",
];

function Registro() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    date: todayIso(),
    weight: 0,
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
        .or(
          "routine_logged.eq.true,weight_kg.not.is.null,water_l.not.is.null,sleep_hours.not.is.null,notes.not.is.null,trained.eq.true,cardio.eq.true,alcohol.eq.true,free_meal.eq.true",
        )
        .order("log_date", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data as DailyLog[];
    },
  });

  useEffect(() => {
    if (log) {
      setForm((current) => ({
        ...current,
        weight: Number(log.weight_kg ?? profile?.weight_kg ?? 0),
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
  }, [log, profile?.weight_kg]);

  function toggleTag(t: string) {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: user!.id,
        log_date: form.date,
        routine_logged: true,
        weight_kg: form.weight || null,
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

      await syncDailyLogNutrition(user!.id, form.date);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily_log"] });
      qc.invalidateQueries({ queryKey: ["daily_logs"] });
      qc.invalidateQueries({ queryKey: ["weight_history"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Registro salvo");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Registro diario</h1>
        <p className="text-sm text-muted-foreground">
          Peso, rotina e sinais do dia. Refeicoes ficam na aba propria.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="grid gap-6 lg:grid-cols-3"
      >
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Registro rapido</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data">
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </Field>
            <Field label="Peso (kg)">
              <Input
                type="number"
                step="0.1"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: +e.target.value })}
              />
            </Field>
            <Field label="Agua (L)">
              <Input
                type="number"
                step="0.1"
                value={form.water}
                onChange={(e) => setForm({ ...form, water: +e.target.value })}
              />
            </Field>
            <Field label="Horas de sono">
              <Input
                type="number"
                step="0.1"
                value={form.sleep}
                onChange={(e) => setForm({ ...form, sleep: +e.target.value })}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ToggleRow
              label="Treinou musculacao"
              value={form.trained}
              onChange={(v) => setForm({ ...form, trained: v })}
            />
            <ToggleRow
              label="Fez cardio"
              value={form.cardio}
              onChange={(v) => setForm({ ...form, cardio: v })}
            />
            <ToggleRow
              label="Consumiu alcool"
              value={form.alcohol}
              onChange={(v) => setForm({ ...form, alcohol: v })}
            />
            <ToggleRow
              label="Refeicao livre"
              value={form.freeMeal}
              onChange={(v) => setForm({ ...form, freeMeal: v })}
            />
          </div>

          {form.trained && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Inicio treino">
                <Input
                  type="time"
                  value={form.trainingStart}
                  onChange={(e) => setForm({ ...form, trainingStart: e.target.value })}
                />
              </Field>
              <Field label="Fim treino">
                <Input
                  type="time"
                  value={form.trainingEnd}
                  onChange={(e) => setForm({ ...form, trainingEnd: e.target.value })}
                />
              </Field>
              <Field label="Intensidade">
                <Select
                  value={form.intensity}
                  onValueChange={(v) => setForm({ ...form, intensity: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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

          <Field label="Observacoes">
            <Textarea
              rows={4}
              placeholder="Como foi a fome, energia, treino, rotina..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
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
                    onClick={() => setForm((current) => ({ ...current, date: item.log_date }))}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition-colors hover:bg-muted/60 ${
                      item.log_date === form.date
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{formatLogDate(item.log_date)}</span>
                      {item.log_date === todayIso() && <Badge className="rounded-full">Hoje</Badge>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {item.weight_kg && <span>{Number(item.weight_kg)} kg</span>}
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
          <Button
            type="submit"
            className="w-full rounded-xl"
            size="lg"
            disabled={save.isPending || isLoading}
          >
            {save.isPending ? "Salvando..." : "Salvar registro"}
          </Button>
        </section>
      </form>
    </AppShell>
  );
}

function formatLogDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    weekday: "short",
  }).format(new Date(year, month - 1, day));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-4 py-3">
      <span className="text-sm">{label}</span>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}
