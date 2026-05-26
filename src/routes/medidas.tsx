import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { MEASUREMENTS } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Camera, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/medidas")({
  head: () => ({ meta: [{ title: "Medidas corporais — Cutting Tracker" }] }),
  component: Medidas,
});

function Medidas() {
  const latest = MEASUREMENTS[MEASUREMENTS.length - 1];
  const first = MEASUREMENTS[0];
  const diff = (k: keyof typeof latest) => +((+(latest[k] as number) - +(first[k] as number)).toFixed(1));

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Medidas corporais</h1>
        <p className="text-sm text-muted-foreground">Acompanhe além da balança</p>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        {[
          { label: "Cintura", v: latest.waist, d: diff("waist") },
          { label: "Peito", v: latest.chest, d: diff("chest") },
          { label: "Braço", v: latest.arm, d: diff("arm") },
          { label: "Coxa", v: latest.thigh, d: diff("thigh") },
        ].map((m) => (
          <div key={m.label} className="rounded-2xl border border-border bg-card p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</div>
            <div className="mt-2 text-2xl font-semibold">{m.v} <span className="text-sm text-muted-foreground">cm</span></div>
            <div className={`mt-1 inline-flex items-center gap-1 text-xs ${m.d < 0 ? "text-success" : m.d > 0 ? "text-warning" : "text-muted-foreground"}`}>
              <TrendingDown className="h-3 w-3" /> {m.d > 0 ? "+" : ""}{m.d} cm desde o início
            </div>
          </div>
        ))}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <form className="space-y-4 rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Nova medição</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div><Label className="text-xs">Cintura</Label><Input type="number" step="0.5" defaultValue={100} /></div>
            <div><Label className="text-xs">Peito</Label><Input type="number" step="0.5" defaultValue={110.5} /></div>
            <div><Label className="text-xs">Braço</Label><Input type="number" step="0.5" defaultValue={39.5} /></div>
            <div><Label className="text-xs">Coxa</Label><Input type="number" step="0.5" defaultValue={63} /></div>
          </div>
          <div><Label className="text-xs">Observações</Label><Textarea rows={2} placeholder="Pump pós treino, jejum, etc." /></div>
          <Button className="rounded-xl"><Plus className="mr-2 h-4 w-4" />Salvar medição</Button>
        </form>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-muted-foreground">Fotos de progresso</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-[3/4] flex items-center justify-center rounded-xl border border-dashed border-border bg-background/40 text-muted-foreground hover:border-primary/40">
                <Camera className="h-5 w-5" />
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Espaço visual — funcionalidade no MVP futuro.</p>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Histórico</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 text-left">Data</th>
                <th className="py-2 text-right">Cintura</th>
                <th className="py-2 text-right">Peito</th>
                <th className="py-2 text-right">Braço</th>
                <th className="py-2 text-right">Coxa</th>
              </tr>
            </thead>
            <tbody>
              {[...MEASUREMENTS].reverse().map((m) => (
                <tr key={m.date} className="border-b border-border/50">
                  <td className="py-3">{new Date(m.date).toLocaleDateString("pt-BR")}</td>
                  <td className="py-3 text-right">{m.waist} cm</td>
                  <td className="py-3 text-right">{m.chest} cm</td>
                  <td className="py-3 text-right">{m.arm} cm</td>
                  <td className="py-3 text-right">{m.thigh} cm</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
