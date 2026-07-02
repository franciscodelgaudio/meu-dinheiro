---
name: frontend
description: Padrão para recriar/refatorar telas no codebase real (Next.js/React + TailwindCSS + shadcn/ui) a partir de um protótipo de design (arquivo .dc.html) e/ou um README.md de handoff. Use sempre que o usuário entregar uma referência visual (protótipo, handoff, print de Figma descrito em texto) para implementar ou redesenhar uma tela existente — não use para mudanças de lógica de negócio sem referência visual associada.
---

# Recriar telas a partir de protótipo de design (handoff)

Um `*.dc.html` é uma **referência de design**, não código de produção: mostra o
visual e o comportamento pretendidos (às vezes em múltiplos frames — desktop,
mobile — e com seções de exploração de opções tipo `.opts`/ids `1a`/`1b`/`2a`
que **não fazem parte da tela final**, apenas material de decisão a ignorar,
a menos que o README de handoff diga o contrário). O `README.md` que acompanha
o protótipo é a fonte de verdade sobre tokens, estados, layout e qual variante
foi escolhida. A tarefa é **recriar o design no codebase real**, reaproveitando
os componentes e padrões já existentes — nunca copiar HTML/CSS do protótipo
literalmente.

## Regras obrigatórias

- **Preservar toda a lógica de dados**: chamadas de API/DB, server actions,
  mutations, validações e tipos existentes continuam os mesmos. Redesenhar é
  trabalho de camada visual, não de reescrever a lógica.
- **Não alterar o backend nem os models** em `project/lib/models/*.ts`. Não
  inventar campos que não existem no schema — se o protótipo mostra um dado
  que não existe no model (ex.: uma flag nova), perguntar antes de assumir.
- **Não adicionar bibliotecas novas** sem necessidade. Preferir sempre
  TailwindCSS + shadcn/ui já instalados no projeto.
- **Não quebrar funcionalidades existentes** (fluxos de criar/editar/excluir,
  paginação, navegação por mês, etc.).
- Refatorar em componentes menores e reutilizáveis, seguindo a estrutura já
  usada no restante do app (ver abaixo), não criar um padrão paralelo.

## Estrutura de arquivos (App Router)

Páginas ficam em `project/app/dashboard/<rota>/`, com o padrão:

- **`page.tsx`** — Server Component. Faz o fetch dos dados (sessão, Mongoose
  `lean()` queries), resolve o período/mês (`getEffectiveCurrentMonth()`,
  `getPaydayMonthRange()` em `lib/date-utils.ts`) e passa dados já serializados
  (IDs como `string`, nunca `ObjectId` cru) para o client component.
- **`<algo>-manager.tsx`** (ex.: `ExpensesManager.tsx`) — Client Component
  (`"use client"`). Recebe os dados via props, contém os dialogs, os
  formulários (`useActionState()` para server actions existentes) e o estado
  de UI local (`useState()` para abrir/fechar dialog, tab ativa, collapse de
  captura rápida etc.). Subcomponentes de uso único (ex.: `ExpenseDialog`,
  `QuickExpenseCapture`, `ExpenseActionsDropdown`) ficam como funções internas
  no mesmo arquivo, não em arquivos separados, a menos que sejam reutilizados
  em mais de uma tela.
- Nomes de componente em PascalCase (`ExpensesManager.tsx`), utilitários em
  kebab-case (`date-utils.ts`).

## Mapeando tokens do protótipo para o projeto real

O projeto **não usa** os tokens nomeados do protótipo (`--bg`, `--ink`,
`--brand`, `--warn`, `--crit` etc.) — esses existem só no HTML de referência.
No codebase real:

- Cores base vêm das variáveis shadcn em `app/globals.css` (OKLCH):
  `bg-background`, `text-foreground`, `bg-primary`, `bg-destructive`,
  `border`, etc.
- Estados e cores específicas do domínio financeiro usam classes Tailwind
  diretas já em uso no app: `text-emerald-600`/`bg-emerald-50` (positivo/brand),
  `text-red-700`/`text-red-600` (crítico/despesa), `text-zinc-400/500/600/800`
  (hierarquia de texto). Ao traduzir um token do protótipo, procure primeiro
  se uma cor equivalente já é usada em alguma tela existente antes de escolher
  um tom novo.
- **Nunca depender só de cor para estado** (regra do próprio design): todo
  badge/pill de status crítico/atenção/ok deve ter rótulo em texto junto,
  igual ao protótipo especifica.
- Ícones: sempre `lucide-react`, nunca inline SVG copiado do protótipo.

## Componentes shadcn disponíveis

Antes de montar qualquer elemento do zero, verificar `project/components/ui/`:
`button`, `card`, `input`, `label`, `dialog`, `dropdown-menu`, `popover`,
`command`, `table`, `pagination`, `calendar`, `select`, `checkbox`,
`separator`, `sheet`, `avatar`, `progress`, além de componentes já
customizados no projeto como `currency-input.tsx` (input de valor monetário)
e `nav-progress.tsx`. Só criar um componente novo em `components/ui/` quando
nenhum existente cobrir o caso, seguindo o mesmo estilo (Radix + `cva` +
`cn()`).

## Formatação (sempre via `Intl`, nunca manual)

- Moeda: `new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`.
- Data: `new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })`.
- Isso vale tanto para desktop quanto mobile — não reimplementar formatação
  específica por frame.

## Responsividade — uma única árvore de componentes, não dois frames

O protótipo mostra desktop e mobile como dois frames separados, mas no
codebase **não duplicar componente por breakpoint**. Usar utilitários
Tailwind responsivos no mesmo JSX:

- `md:hidden` / `hidden md:block` para alternar sidebar (desktop) vs.
  bottom nav (mobile) — ver `app/dashboard/mobile-nav.tsx` e
  `app/dashboard/layout.tsx` (`SidebarProvider`/`SidebarInset`).
- `sm:hidden` / `hidden sm:table-cell` para esconder colunas de tabela em
  telas pequenas e mostrar um layout alternativo (ex.: subtítulo com a data
  abaixo do título) em vez de tabela espremida.
- `lg:grid-cols-[1fr_380px]` (ou proporção equivalente do protótipo) para
  layouts de duas colunas que colapsam para uma coluna em telas menores.
- Padding mobile (`pb-16 md:pb-0` etc.) para não ficar atrás da bottom nav
  fixa.

## Checklist ao terminar

- Os campos usados existem de fato nos models (`project/lib/models/*.ts`) —
  não inventados a partir do protótipo.
- Nenhuma seção de exploração de opções do protótipo (`.opts`, ids tipo
  `1a`/`2b`) foi implementada — só a tela final indicada no README.
- `page.tsx` continua Server Component fazendo o fetch; nada de mover fetch
  de dados para o client sem necessidade.
- Rodar type-check/lint do projeto antes de considerar concluído.
