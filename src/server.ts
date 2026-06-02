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
      (m) => (m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry),
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

type FoodNutritionResult = {
  code: string;
  name: string;
  brand: string;
  quantity: string;
  imageUrl: string;
  sourceUrl: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  confidence: "baixa" | "media" | "alta";
};

type OpenFoodFactsProduct = {
  code?: string | number;
  product_name?: string;
  product_name_pt?: string;
  product_name_br?: string;
  brands?: string;
  quantity?: string;
  image_front_small_url?: string;
  nutriments?: Record<string, unknown>;
};

async function handleApiRequest(request: Request, env: unknown) {
  const url = new URL(request.url);
  if (url.pathname === "/api/env-check") {
    const runtimeEnv = getRuntimeEnv(env);
    if (runtimeEnv.ENABLE_ENV_CHECK !== "true") {
      return Response.json({ error: "Nao encontrado" }, { status: 404 });
    }
    if (request.method !== "GET") {
      return Response.json({ error: "Metodo nao permitido" }, { status: 405 });
    }

    return Response.json({
      hasGeminiApiKey: Boolean(runtimeEnv.GEMINI_API_KEY),
      hasSupabaseUrl: Boolean(runtimeEnv.SUPABASE_URL || runtimeEnv.VITE_SUPABASE_URL),
      hasSupabaseKey: Boolean(
        runtimeEnv.SUPABASE_PUBLISHABLE_KEY ||
        runtimeEnv.SUPABASE_ANON_KEY ||
        runtimeEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
        runtimeEnv.VITE_SUPABASE_ANON_KEY ||
        runtimeEnv.VITE_SUPABASE_KEY,
      ),
      knownNames: Object.keys(runtimeEnv)
        .filter((key) => /GEMINI|SUPABASE/i.test(key))
        .sort(),
    });
  }

  if (url.pathname === "/api/search-food-nutrition") {
    return await handleFoodNutritionSearch(request, env);
  }

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
    const model = runtimeEnv.GEMINI_MODEL || "gemini-2.5-flash";

    const body = (await request.json()) as EstimateRequest;
    const items = Array.isArray(body.items)
      ? body.items.filter((item) => item.id && item.name)
      : [];
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
      ...items.map(
        (item) =>
          `- id=${item.id}; quantidade=${item.grams || "nao informada"}g; alimento=${item.name}`,
      ),
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
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                items: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      id: { type: "STRING" },
                      calories: { type: "NUMBER" },
                      protein_g: { type: "NUMBER" },
                      carbs_g: { type: "NUMBER" },
                      fat_g: { type: "NUMBER" },
                      confidence: { type: "STRING", enum: ["baixa", "media", "alta"] },
                      note: { type: "STRING" },
                    },
                    required: ["id", "calories", "protein_g", "carbs_g", "fat_g", "confidence"],
                  },
                },
              },
              required: ["items"],
            },
          },
        }),
      },
    );

    if (!geminiResponse.ok) {
      const text = await geminiResponse.text();
      console.error("[Gemini] estimate error", text);
      return Response.json({ error: parseGeminiError(text) }, { status: 502 });
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

async function handleFoodNutritionSearch(request: Request, env: unknown) {
  if (request.method !== "GET") {
    return Response.json({ error: "Metodo nao permitido" }, { status: 405 });
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  if (query.length < 3) {
    return Response.json({ error: "Digite pelo menos 3 caracteres" }, { status: 400 });
  }

  try {
    const runtimeEnv = getRuntimeEnv(env);
    await requireAuthenticatedUser(request, runtimeEnv);

    const searchUrl = new URL("https://world.openfoodfacts.org/cgi/search.pl");
    searchUrl.searchParams.set("search_terms", query);
    searchUrl.searchParams.set("search_simple", "1");
    searchUrl.searchParams.set("action", "process");
    searchUrl.searchParams.set("json", "1");
    searchUrl.searchParams.set("page_size", "8");
    searchUrl.searchParams.set("sort_by", "unique_scans_n");
    searchUrl.searchParams.set("lc", "pt");
    searchUrl.searchParams.set("cc", "br");
    searchUrl.searchParams.set(
      "fields",
      [
        "code",
        "product_name",
        "product_name_pt",
        "product_name_br",
        "brands",
        "quantity",
        "image_front_small_url",
        "nutriments",
      ].join(","),
    );

    const response = await fetch(searchUrl, {
      headers: {
        accept: "application/json",
        "user-agent": "ProgressivePath/0.1 (https://example.local)",
      },
    });

    if (!response.ok) {
      return Response.json(
        { error: `Open Food Facts retornou HTTP ${response.status}` },
        { status: 502 },
      );
    }

    const payload = (await response.json()) as { products?: OpenFoodFactsProduct[] };
    const results = normalizeFoodNutritionResults(payload.products ?? [], query);
    return Response.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    const status = message === "Nao autenticado" ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}

async function requireAuthenticatedUser(request: Request, runtimeEnv: Record<string, string>) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Nao autenticado");

  const supabaseUrl =
    runtimeEnv.SUPABASE_URL ||
    runtimeEnv.VITE_SUPABASE_URL ||
    request.headers.get("x-supabase-url") ||
    getSupabaseUrlFromToken(token);
  const supabaseKey =
    runtimeEnv.SUPABASE_PUBLISHABLE_KEY ||
    runtimeEnv.SUPABASE_ANON_KEY ||
    runtimeEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
    runtimeEnv.VITE_SUPABASE_ANON_KEY ||
    runtimeEnv.VITE_SUPABASE_KEY ||
    request.headers.get("x-supabase-key");
  if (!supabaseUrl || !supabaseKey) {
    const missing = [
      ...(!supabaseUrl ? ["SUPABASE_URL ou VITE_SUPABASE_URL"] : []),
      ...(!supabaseKey
        ? [
            "SUPABASE_PUBLISHABLE_KEY, SUPABASE_ANON_KEY, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_ANON_KEY ou VITE_SUPABASE_KEY",
          ]
        : []),
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

function getSupabaseUrlFromToken(token: string) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as {
      iss?: string;
    };
    return payload.iss?.replace(/\/auth\/v1\/?$/, "") ?? "";
  } catch {
    return "";
  }
}

function normalizeEstimates(
  estimates: EstimateResponse["items"],
  originalItems: EstimateRequest["items"],
) {
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

function parseGeminiError(body: string) {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string; status?: string } };
    const message = parsed.error?.message;
    const status = parsed.error?.status;
    if (message && status) return `Gemini: ${status} - ${message}`;
    if (message) return `Gemini: ${message}`;
  } catch {
    // Fall through to generic body handling.
  }

  return body
    ? `Gemini retornou erro: ${body.slice(0, 300)}`
    : "Falha ao calcular macros com Gemini";
}

function normalizeFoodNutritionResults(
  products: OpenFoodFactsProduct[],
  query: string,
): FoodNutritionResult[] {
  return products
    .map((product) => normalizeFoodNutritionResult(product, query))
    .filter((result): result is FoodNutritionResult => Boolean(result))
    .sort((a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence))
    .slice(0, 6);
}

function normalizeFoodNutritionResult(
  product: OpenFoodFactsProduct,
  query: string,
): FoodNutritionResult | null {
  const nutriments = product.nutriments ?? {};
  const calories =
    parseNutriment(nutriments["energy-kcal_100g"]) ??
    parseNutriment(nutriments["energy-kcal"]) ??
    kjToKcal(parseNutriment(nutriments.energy_100g));
  const protein = parseNutriment(nutriments.proteins_100g);
  const carbs = parseNutriment(nutriments.carbohydrates_100g);
  const fat = parseNutriment(nutriments.fat_100g);
  const code = product.code == null ? "" : String(product.code);
  const name = product.product_name_pt || product.product_name_br || product.product_name || "";

  if (!code || !name || calories == null || protein == null || carbs == null || fat == null) {
    return null;
  }

  return {
    code,
    name,
    brand: product.brands ?? "",
    quantity: product.quantity ?? "",
    imageUrl: product.image_front_small_url ?? "",
    sourceUrl: `https://world.openfoodfacts.org/product/${encodeURIComponent(code)}`,
    calories_per_100g: clampNumber(calories),
    protein_per_100g: clampNumber(protein),
    carbs_per_100g: clampNumber(carbs),
    fat_per_100g: clampNumber(fat),
    confidence: estimateFoodSearchConfidence(query, name, product.brands ?? ""),
  };
}

function parseNutriment(value: unknown) {
  const number = typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function kjToKcal(value: number | null) {
  return value == null ? null : value / 4.184;
}

function estimateFoodSearchConfidence(query: string, name: string, brand: string) {
  const haystack = normalizeSearchText(`${name} ${brand}`);
  const queryWords = normalizeSearchText(query).split(" ").filter(Boolean);
  if (queryWords.length === 0) return "baixa";

  const matched = queryWords.filter((word) => haystack.includes(word)).length;
  if (matched === queryWords.length) return "alta";
  if (matched >= Math.ceil(queryWords.length / 2)) return "media";
  return "baixa";
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function confidenceRank(confidence: FoodNutritionResult["confidence"]) {
  return { baixa: 0, media: 1, alta: 2 }[confidence];
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
