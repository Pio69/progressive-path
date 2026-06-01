import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type EstimateRequest = {
  mealName: string;
  items: { id: string; name: string; grams: number }[];
};

type EstimateResponse = {
  items: {
    id: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    confidence: "baixa" | "media" | "alta";
    note?: string;
  }[];
};

export const Route = createFileRoute("/api/estimate-meal-macros")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await requireAuthenticatedUser(request);

          const apiKey = process.env.GEMINI_API_KEY;
          if (!apiKey) {
            return Response.json({ error: "GEMINI_API_KEY nao configurada" }, { status: 500 });
          }
          const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";

          const body = (await request.json()) as EstimateRequest;
          const items = Array.isArray(body.items) ? body.items.filter((item) => item.id && item.name) : [];
          if (items.length === 0) {
            return Response.json({ error: "Nenhum item para calcular" }, { status: 400 });
          }

          const prompt = [
            "Voce e um nutricionista assistente especializado em estimar macros de refeicoes em portugues do Brasil.",
            "Estime calorias, proteina, carboidratos e gordura totais consumidos para cada item.",
            "Use a quantidade em gramas quando existir. Se a descricao for ambigua, estime pelo alimento comum mais provavel no Brasil.",
            "Retorne apenas dados compativeis com o schema. Nao invente ids.",
            "",
            `Refeicao: ${body.mealName || "Refeicao"}`,
            "Itens:",
            ...items.map((item) => `- id=${item.id}; quantidade=${item.grams || "nao informada"}g; alimento=${item.name}`),
          ].join("\n");

          const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
              method: "POST",
              headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                  temperature: 0.2,
                  responseFormat: {
                    text: {
                      mimeType: "application/json",
                      schema: {
                        type: "object",
                        properties: {
                          items: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                id: { type: "string" },
                                calories: { type: "number" },
                                protein_g: { type: "number" },
                                carbs_g: { type: "number" },
                                fat_g: { type: "number" },
                                confidence: { type: "string", enum: ["baixa", "media", "alta"] },
                                note: { type: "string" },
                              },
                              required: ["id", "calories", "protein_g", "carbs_g", "fat_g", "confidence"],
                            },
                          },
                        },
                        required: ["items"],
                      },
                    },
                  },
                },
              }),
            },
          );

          if (!geminiResponse.ok) {
            const text = await geminiResponse.text();
            console.error("[Gemini] estimate error", text);
            return Response.json({ error: "Falha ao calcular macros com Gemini" }, { status: 502 });
          }

          const geminiJson = await geminiResponse.json();
          const text = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (typeof text !== "string") {
            return Response.json({ error: "Resposta invalida do Gemini" }, { status: 502 });
          }

          const parsed = JSON.parse(text) as EstimateResponse;
          return Response.json({ items: normalizeEstimates(parsed.items, items) });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Erro inesperado";
          const status = message === "Nao autenticado" ? 401 : 500;
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});

async function requireAuthenticatedUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Nao autenticado");

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    const missing = [
      ...(!supabaseUrl ? ["SUPABASE_URL ou VITE_SUPABASE_URL"] : []),
      ...(!supabaseKey ? ["SUPABASE_PUBLISHABLE_KEY, SUPABASE_ANON_KEY, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_ANON_KEY ou VITE_SUPABASE_KEY"] : []),
    ];
    throw new Error(`Supabase env faltando: ${missing.join("; ")}`);
  }

  const client = createClient<Database>(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error("Nao autenticado");
  return data.user;
}

function normalizeEstimates(estimates: EstimateResponse["items"], originalItems: EstimateRequest["items"]) {
  const validIds = new Set(originalItems.map((item) => item.id));
  return (Array.isArray(estimates) ? estimates : [])
    .filter((item) => validIds.has(item.id))
    .map((item) => ({
      id: item.id,
      calories: clampNumber(item.calories),
      protein_g: clampNumber(item.protein_g),
      carbs_g: clampNumber(item.carbs_g),
      fat_g: clampNumber(item.fat_g),
      confidence: item.confidence,
      note: item.note ?? "",
    }));
}

function clampNumber(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return +number.toFixed(1);
}
