@AGENTS.md

# Produto e UI

## Navegacao

- A area autenticada deve usar a sidebar do shadcn como navegacao principal.
- A sidebar deve ser o shell padrao das rotas em `/dashboard`.
- O menu principal deve manter, no minimo:
  - `Dashboard`: resumo financeiro consolidado.
  - `Planejamento`: ganhos, renda recorrente, mes de referencia e rendas extras.
  - `Gastos`: grupos de despesas e recorrencia para proximos meses.
- O perfil do usuario deve ficar acessivel pelo menu de usuario dentro da sidebar.

## Responsabilidade das paginas

- `/dashboard` deve ser apenas um resumo financeiro. Evite colocar CRUDs principais aqui.
- `/dashboard/planning` deve concentrar configuracoes de ganhos e planejamento mensal:
  - renda base recorrente;
  - intervalo mensal de recebimento;
  - rendas extras do mes selecionado;
  - resumo do mes de referencia.
- `/dashboard/expenses` deve concentrar gastos:
  - grupos de despesas;
  - valor planejado por grupo no mes;
  - opcao de afetar ou nao os proximos meses;
  - impacto de cada grupo na renda disponivel.

## Mes de referencia

- Qualquer selecao de mes de referencia deve usar componentes shadcn, especialmente `Calendar` com `Popover`.
- Nao usar input `type="month"` como padrao de UI.
- Se precisar escolher mes em mais de um lugar, componentizar o seletor e reutilizar.
- O formato interno do mes de referencia deve ser `YYYY-MM`.

## Padrao de componentes

- Priorizar shadcn para estruturas de UI: `Sidebar`, `Card`, `Dialog`, `Popover`, `Calendar`, `Table`, `Button`, `Input`, `Checkbox`, `Badge`, `Progress` e `DropdownMenu`.
- Acoes de CRUD devem retornar feedback com `toast.success` ou `toast.error`.
- Fluxos financeiros devem mostrar valores em BRL por padrao, usando `Intl.NumberFormat`.
