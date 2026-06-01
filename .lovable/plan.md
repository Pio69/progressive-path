# Plano — MVP Funcional Projeto Dallas

Vou transformar o protótipo atual (mockado) em uma aplicação funcional integrada ao Supabase, com persistência real por usuário.

## 1. Banco de dados (migração Supabase)

Criar 6 tabelas no schema `public` com RLS escopada por `auth.uid()`:

- **profiles** — `user_id` (uk), `name`, `height_cm`, `current_weight_kg`, `goal_weight_kg`, `goal` (cutting/manutencao/bulking), `created_at`, `updated_at`
- **daily_goals** — `user_id` (uk), `calories`, `protein_g`, `carbs_g`, `fat_g`
- **foods** — `id`, `user_id`, `name`, `brand`, `kcal_100g`, `protein_100g`, `carbs_100g`, `fat_100g`
- **meals** — `id`, `user_id`, `date`, `name` (café, almoço…), `time`, `notes`
- **meal_items** — `id`, `meal_id`, `food_id`, `grams`
- **weight_history** — `id`, `user_id`, `date`, `weight_kg`

Todas com `GRANT` para `authenticated`/`service_role` e políticas RLS `auth.uid() = user_id` (meal_items via join com meals). Trigger `updated_at`.

## 2. Camada de acesso

- `src/hooks/use-profile.tsx` — busca profile do usuário, expõe `profile`, `loading`, `hasProfile`.
- Componente guard que redireciona para `/onboarding` se `!hasProfile`.

## 3. Telas (rotas)

| Rota | Função |
|------|--------|
| `/onboarding` | Form inicial: nome, altura, peso atual, peso meta, objetivo, metas (kcal/P/C/G). Cria `profiles` + `daily_goals` + primeiro `weight_history`. |
| `/` (dashboard) | Mostra consumo do dia (soma de `meal_items` de hoje) vs metas — barras de kcal, P, C, G com semáforo. |
| `/alimentos` | CRUD de `foods` (lista + dialog criar/editar + excluir). |
| `/refeicoes` | Lista refeições do dia, dialog para criar refeição e adicionar itens (food + gramas). Calcula macros em tempo real. |
| `/evolucao` | Histórico de peso (gráfico simples + form para adicionar registro). |

## 4. Cálculo de macros

Helper `calcMacros(food, grams)`:
```ts
{ kcal: food.kcal_100g * grams / 100, protein: ..., carbs: ..., fat: ... }
```
Agregação por refeição e por dia.

## 5. Ajustes nas telas existentes

- `index.tsx`, `refeicoes.tsx`, `registro.tsx`, `medidas.tsx`, `metas.tsx` — trocar `MOCK_DATA` por queries reais (Supabase via `@/integrations/supabase/client`).
- Remover/aposentar `src/lib/mock-data.ts` gradualmente (manter só o que ainda não tem tabela, como insights).
- AppShell já tem guard de auth; adicionar guard de profile.

## 6. Estratégia de dados

Usar `@tanstack/react-query` (já instalado) com `supabase.from(...)` diretamente no client (RLS protege). Sem server functions nesta fase — mais simples e suficiente para o MVP.

## Escopo fora desta entrega
- Resumo semanal automático e insights avançados continuam mockados.
- Sem busca de alimentos em base pública (TACO/USDA) — só catálogo do próprio usuário.
- Sem upload de fotos.

Posso prosseguir?