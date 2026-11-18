# Progressive Path

Aplicação web para acompanhar alimentação, hábitos e evolução corporal. O Progressive Path reúne refeições, metas nutricionais e registros diários em um painel para ajudar a visualizar o progresso ao longo do tempo.

## Funcionalidades

- Cadastro, login e recuperação de senha.
- Perfil e metas diárias de calorias e macronutrientes.
- Cadastro de alimentos e registro de refeições, com cálculo de calorias, proteínas, carboidratos e gorduras.
- Registro de peso, água, sono, treinos, cardio e outros hábitos.
- Acompanhamento de peso e medidas corporais.
- Resumos e insights automáticos baseados nos registros recentes.

## Tecnologias

- React e TypeScript
- TanStack Start, TanStack Router e TanStack Query
- Vite e Tailwind CSS
- Supabase para autenticação e banco de dados
- Radix UI, Lucide e Recharts

## Como executar

### Pré-requisitos

- [Node.js](https://nodejs.org/) e [Bun](https://bun.sh/)
- Um projeto no [Supabase](https://supabase.com/)

### Instalação

```bash
git clone https://github.com/Pio69/progressive-path.git
cd progressive-path
bun install
```

Crie um arquivo `.env.local` na raiz do projeto com a URL e a chave publicável do seu projeto Supabase:

```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_PUBLISHABLE_KEY=sua_chave_publicavel
```

Aplique, em ordem, as migrations da pasta `supabase/migrations` ao banco do seu projeto Supabase, usando a CLI ou o editor SQL do Supabase. Configure também a autenticação por e-mail no painel do Supabase e as URLs de redirecionamento adequadas ao seu ambiente.

Inicie o servidor de desenvolvimento:

```bash
bun run dev
```

Abra no navegador o endereço exibido no terminal.

## Comandos disponíveis

```bash
bun run dev        # servidor de desenvolvimento
bun run build      # build de produção
bun run preview    # prévia do build
bun run lint       # análise do código
bun run format     # formatação com Prettier
```

## Estrutura do projeto

```text
src/
├── components/             # componentes da interface
├── hooks/                  # autenticação e perfil
├── integrations/supabase/  # clientes e tipos do Supabase
├── lib/                    # tipos e funções auxiliares
└── routes/                 # páginas da aplicação
supabase/
└── migrations/             # alterações do banco de dados
```

Os insights são calculados a partir dos registros e metas do usuário. Eles servem para acompanhar hábitos e não substituem orientação profissional individualizada.
