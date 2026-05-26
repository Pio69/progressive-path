export const USER = {
  name: "Lucas",
  age: 23,
  height: 1.83,
  startWeight: 110,
  currentWeight: 108.4,
  goalWeight: 98,
  calorieGoal: 2000,
  proteinGoal: 175,
  waterGoal: 3.8,
  startDate: "2026-04-20",
};

// Daily logs (last 30 days)
function genDays() {
  const out = [];
  const today = new Date("2026-05-26");
  let weight = 110;
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    weight -= 0.05 + Math.random() * 0.08;
    const noise = (Math.random() - 0.5) * 0.6;
    out.push({
      date: d.toISOString().slice(0, 10),
      weight: +(weight + noise).toFixed(1),
      calories: Math.round(1750 + Math.random() * 700),
      protein: Math.round(130 + Math.random() * 70),
      water: +(2.8 + Math.random() * 1.6).toFixed(1),
      trained: Math.random() > 0.35,
      cardio: Math.random() > 0.65,
      sleep: +(6 + Math.random() * 2.5).toFixed(1),
      alcohol: Math.random() > 0.85,
      freeMeal: Math.random() > 0.8,
    });
  }
  return out;
}

export const DAILY_LOGS = genDays();
export const TODAY = DAILY_LOGS[DAILY_LOGS.length - 1];

export const MEALS_TODAY = [
  { id: 1, name: "Almoço", time: "12:30", foods: "Arroz, frango grelhado, salada, feijão", calories: 720, protein: 55, notes: "" },
  { id: 2, name: "Lanche pós-treino", time: "16:45", foods: "Whey + banana + pasta de amendoim", calories: 380, protein: 38, notes: "Após treino de costas" },
  { id: 3, name: "Jantar", time: "20:00", foods: "Patinho moído, batata doce, brócolis", calories: 640, protein: 52, notes: "" },
  { id: 4, name: "Ceia", time: "22:30", foods: "Ovos mexidos + iogurte natural", calories: 280, protein: 28, notes: "" },
];

export const MEASUREMENTS = [
  { date: "2026-04-20", waist: 104, chest: 112, arm: 39, thigh: 64 },
  { date: "2026-05-04", waist: 102, chest: 111, arm: 39.5, thigh: 63.5 },
  { date: "2026-05-18", waist: 100, chest: 110.5, arm: 39.5, thigh: 63 },
];

export const INSIGHTS = [
  { type: "success", title: "Média calórica dentro da meta", text: "Você fechou a semana com média de 2.040 kcal/dia. Mantém o ritmo." },
  { type: "warning", title: "Proteína abaixo do ideal", text: "Em 3 dos últimos 7 dias você ficou abaixo de 160g. Reforce em refeições principais." },
  { type: "info", title: "Possível retenção", text: "Peso subiu 0,4 kg ontem — provavelmente carboidrato + treino pesado de pernas." },
  { type: "success", title: "Consistência de treino", text: "4 treinos + 2 cardios na semana. Exatamente o planejado." },
  { type: "warning", title: "Sono curto", text: "Média de 6h12 nos últimos dias. Pode comprometer recuperação e fome." },
];

export function weeklyAvgWeight() {
  const out = [];
  for (let i = 0; i < DAILY_LOGS.length; i += 7) {
    const slice = DAILY_LOGS.slice(i, i + 7);
    const avg = slice.reduce((a, b) => a + b.weight, 0) / slice.length;
    out.push({ week: `S${Math.floor(i / 7) + 1}`, weight: +avg.toFixed(2) });
  }
  return out;
}
