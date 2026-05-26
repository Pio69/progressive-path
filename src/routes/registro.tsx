import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TODAY, USER } from "@/lib/mock-data";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/registro")({
  head: () => ({ meta: [{ title: "Registro diário — Cutting Tracker" }] }),
  component: Registro,
});

function Registro() {
  const [form, setForm] = useState({
    date: TODAY.date,
    weight: TODAY.weight,
    calories: TODAY.calories,
    protein: TODAY.protein,
    water: TODAY.water,
    trained: TODAY.trained,
    cardio: TODAY.cardio,
    sleep: TODAY.sleep,
    alcohol: TODAY.alcohol,
    freeMeal: TODAY.freeMeal,
    notes: "",
  });
  const [tags, setTags] = useState<string[]>([]);
  const TAGS = ["Fome alta", "Compulsão", "Retenção", "Treino ruim", "Energia alta", "Estresse"];

  function toggleTag(t: string) {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Registro diário</h1>
        <p className="text-sm text-muted-foreground">Preencha como foi seu dia. Leva menos de 1 minuto.</p>
      </header>

      <form
        onSubmit={(e) => { e.preventDefault(); toast.success("Registro salvo (mock)"); }}
        className="grid gap-6 lg:grid-cols-3"
      >
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Métricas do dia</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Peso (kg)"><Input type="number" step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: +e.target.value })} /></Field>
            <Field label={`Calorias (meta ${USER.calorieGoal})`}><Input type="number" value={form.calories} onChange={(e) => setForm({ ...form, calories: +e.target.value })} /></Field>
            <Field label={`Proteína g (meta ${USER.proteinGoal})`}><Input type="number" value={form.protein} onChange={(e) => setForm({ ...form, protein: +e.target.value })} /></Field>
            <Field label={`Água L (meta ${USER.waterGoal})`}><Input type="number" step="0.1" value={form.water} onChange={(e) => setForm({ ...form, water: +e.target.value })} /></Field>
            <Field label="Horas de sono"><Input type="number" step="0.1" value={form.sleep} onChange={(e) => setForm({ ...form, sleep: +e.target.value })} /></Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ToggleRow label="Treinou musculação" value={form.trained} onChange={(v) => setForm({ ...form, trained: v })} />
            <ToggleRow label="Fez cardio" value={form.cardio} onChange={(v) => setForm({ ...form, cardio: v })} />
            <ToggleRow label="Consumiu álcool" value={form.alcohol} onChange={(v) => setForm({ ...form, alcohol: v })} />
            <ToggleRow label="Refeição livre" value={form.freeMeal} onChange={(v) => setForm({ ...form, freeMeal: v })} />
          </div>

          <Field label="Observações">
            <Textarea rows={3} placeholder="Como foi a fome, energia, treino..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </section>

        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-muted-foreground">Marcadores rápidos</h2>
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
            Use os marcadores para correlacionar dias ruins com peso, sono e dieta nos insights.
          </div>
          <Button type="submit" className="w-full rounded-xl" size="lg">Salvar registro</Button>
        </section>
      </form>
    </AppShell>
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

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-4 py-3">
      <span className="text-sm">{label}</span>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}
