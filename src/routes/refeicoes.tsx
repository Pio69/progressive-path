import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { MEALS_TODAY, USER, TODAY } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Clock, Flame, Beef, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/refeicoes")({
  head: () => ({ meta: [{ title: "Refeições do dia — Cutting Tracker" }] }),
  component: Refeicoes,
});

function Refeicoes() {
  const [meals, setMeals] = useState(MEALS_TODAY);
  const [open, setOpen] = useState(false);
  const totalCal = meals.reduce((a, b) => a + b.calories, 0);
  const totalProt = meals.reduce((a, b) => a + b.protein, 0);

  return (
    <AppShell>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Refeições</h1>
          <p className="text-sm text-muted-foreground">{new Date(TODAY.date).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl"><Plus className="mr-2 h-4 w-4" />Nova refeição</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova refeição</DialogTitle></DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                setMeals([...meals, {
                  id: Date.now(),
                  name: String(f.get("name")),
                  time: String(f.get("time")),
                  foods: String(f.get("foods")),
                  calories: Number(f.get("calories")),
                  protein: Number(f.get("protein")),
                  notes: String(f.get("notes") || ""),
                }]);
                setOpen(false);
                toast.success("Refeição adicionada");
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Nome</Label><Input name="name" required defaultValue="Lanche" /></div>
                <div><Label className="text-xs">Horário</Label><Input name="time" type="time" required defaultValue="15:00" /></div>
              </div>
              <div><Label className="text-xs">Alimentos</Label><Input name="foods" required placeholder="Ex: 2 ovos, pão, queijo" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Calorias</Label><Input name="calories" type="number" required defaultValue={300} /></div>
                <div><Label className="text-xs">Proteína (g)</Label><Input name="protein" type="number" required defaultValue={20} /></div>
              </div>
              <div><Label className="text-xs">Observações</Label><Textarea name="notes" rows={2} /></div>
              <Button type="submit" className="w-full">Adicionar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <section className="mb-6 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Flame className="h-3.5 w-3.5" />Calorias</span>
            <span>{totalCal} / {USER.calorieGoal} kcal</span>
          </div>
          <Progress value={Math.min(100, (totalCal / USER.calorieGoal) * 100)} className="mt-3 h-2.5" />
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Beef className="h-3.5 w-3.5" />Proteína</span>
            <span>{totalProt} / {USER.proteinGoal} g</span>
          </div>
          <Progress value={Math.min(100, (totalProt / USER.proteinGoal) * 100)} className="mt-3 h-2.5" />
        </div>
      </section>

      <section className="space-y-3">
        {meals.map((m) => (
          <article key={m.id} className="group flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-card p-5 hover:border-primary/40">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-semibold">{m.name}</h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"><Clock className="h-3 w-3" />{m.time}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{m.foods}</p>
              {m.notes && <p className="mt-1 text-xs text-muted-foreground/70 italic">"{m.notes}"</p>}
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs text-muted-foreground">kcal</div>
                <div className="text-lg font-semibold text-warning">{m.calories}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">prot</div>
                <div className="text-lg font-semibold text-accent">{m.protein}g</div>
              </div>
              <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100"><Pencil className="h-4 w-4" /></Button>
            </div>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
