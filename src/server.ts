import "./lib/error-capture";

import { createClient } from "@supabase/supabase-js";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import type { Database } from "./integrations/supabase/types";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      attachRuntimeEnv(env);
      const apiResponse = await handleApiRequest(request, env);
      if (apiResponse) return apiResponse;

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};

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

async function handleApiRequest(request: Request, env: unknown) {
  const url = new URL(request.url);
  if (url.pathname !== "/api/estimate-meal-macros") return null;
  if (request.method !== "POST") {
    return Response.json({ error: "Metodo nao permitido" }, { status: 405 });
  }

  try {
    const runtimeEnv = getRuntimeEnv(env);
    await requireAuthenticatedUser(request, runtimeEnv);

    const apiKey = runtimeEnv.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "GEMINI_API_KEY nao configurada" }, { status: 500 });
    }
    const model = runtimeEnv.GEMINI_MODEL || "gemini-3.5-flash";

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

    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
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
    });

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
}

async function requireAuthenticatedUser(request: Request, runtimeEnv: Record<string, string>) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Nao autenticado");

  const supabaseUrl = runtimeEnv.SUPABASE_URL || runtimeEnv.VITE_SUPABASE_URL;
  const supabaseKey =
    runtimeEnv.SUPABASE_PUBLISHABLE_KEY ||
    runtimeEnv.SUPABASE_ANON_KEY ||
    runtimeEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
    runtimeEnv.VITE_SUPABASE_ANON_KEY ||
    runtimeEnv.VITE_SUPABASE_KEY;
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

function getRuntimeEnv(env: unknown) {
  const runtimeEnv: Record<string, string> = {};
  if (env && typeof env === "object") {
    for (const [key, value] of Object.entries(env as Record<string, unknown>)) {
      if (typeof value === "string") runtimeEnv[key] = value;
    }
  }
  if ("process" in globalThis) {
    Object.assign(runtimeEnv, process.env);
  }
  return runtimeEnv;
}

function attachRuntimeEnv(env: unknown) {
  if (!env || typeof env !== "object" || !("process" in globalThis)) return;

  const runtimeEnv = env as Record<string, unknown>;
  for (const [key, value] of Object.entries(runtimeEnv)) {
    if (typeof value === "string" && process.env[key] == null) {
      process.env[key] = value;
    }
  }
}
