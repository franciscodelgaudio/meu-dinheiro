---
name: teste-unitario
description: Fluxo TDD de duas etapas para criar testes unitários de uma função que ainda não existe (ou não foi implementada). Primeiro cria só o teste e avisa o usuário para rodar (esperado falhar). Depois cria apenas um stub (placeholder, sem lógica real) e avisa o usuário para rodar de novo. Use quando o usuário pedir para "criar um teste", "escrever o teste de X", ou pedir explicitamente um "stub" — nunca implemente a lógica real nesta skill.
---

# Teste (TDD em duas etapas)

Fluxo obrigatório ao criar teste para uma função ainda não implementada (ou só parcialmente implementada) neste projeto. A skill tem exatamente duas etapas, nesta ordem, e para em cada uma delas antes de seguir.

## O que torna um teste unitário legítimo

Todo teste criado por esta skill precisa ser um teste de unidade de verdade, seguindo a definição de Michael Feathers. Um teste **não** é um teste unitário — e portanto não pode ser escrito assim nesta skill — se ele:

1. Interage com um banco de dados (real ou de teste/local).
2. Se comunica através da rede.
3. Interage com o sistema de arquivos.
4. Não pode ser executado em paralelo com os outros testes unitários (estado global compartilhado, ordem de execução importa, etc.).
5. Exige etapas especiais ou modificações no ambiente para rodar (editar arquivos de configuração, variáveis de ambiente específicas, serviços externos de pé, etc.).

Na prática, neste projeto isso significa:

- **Sempre** mockar `lib/models/*.ts` (e qualquer outro módulo que fale com o Mongo, com uma API externa ou com o sistema de arquivos) via `vi.mock`. Nunca deixar um teste chamar `dbConnect()` de verdade, nem que seja "só para ler".
- O teste tem que rodar isoladamente e em qualquer ordem: sem depender de estado deixado por outro teste, sem depender de dados pré-existentes em um banco, sem depender da ordem em que os `it` aparecem no arquivo. Use `beforeEach` para resetar mocks (`mockReset`/`mockClear`), nunca dados que persistem entre testes.
- O teste não pode exigir nenhum setup manual (subir um container, criar um `.env`, rodar uma migration) para passar — se rodar `npx vitest run <arquivo>` do zero, sem nenhum passo a mais, tem que funcionar.
- Se a função sendo testada depende de algo que só pode ser exercitado via banco/rede/filesystem (ex. uma query real), isso é sinal de que o teste correto aqui é testar a lógica isolável (validação, transformação, decisão de qual código de erro retornar) mockando a dependência externa — não abrir uma exceção e "testar de verdade" contra um banco.

## Etapa 1 — Escrever o teste

1. Descubra (pelo pedido do usuário, pelo código vizinho, ou perguntando se for ambíguo) a assinatura esperada da função: nome, parâmetros, formato de retorno.
2. Escreva o arquivo de teste seguindo as convenções já usadas no projeto:
   - `vitest` (`describe`/`it`/`expect`/`vi`).
   - Local: `lib/tests/<entidade>/<arquivo>.test.ts`, espelhando o nome do arquivo de origem (ex. `cashflow.actions.ts` → `lib/tests/cashflow/cashflow.actions.test.ts`).
   - **Nunca importe um model do Mongoose (`lib/models/*.ts`) sem mockar.** Esses arquivos fazem `await dbConnect()` no top-level e tentam conectar num banco real ao serem importados. Sempre use `vi.mock("@/lib/models/<nome>", () => ({ ... }))` com um objeto plano contendo só os métodos usados (`vi.fn()`), e importe o mock antes da action que está sendo testada.
   - Cubra: validação de entrada (casos inválidos), caminho de sucesso, "não encontrado" (quando aplicável), conflito de chave duplicada (`error.code === 11000`, quando aplicável), erro genérico, e qualquer regra específica que o usuário tenha pedido.
   - Não teste integração com outras entidades (ex. recálculo de total em outro model) a menos que o usuário peça explicitamente — mantenha o teste isolado na função em questão.
3. Rode o teste você mesmo (via Bash/`npx vitest run <arquivo>`) só para confirmar que a falha é a esperada (ex. "X is not a function" ou erro de import) — não para "corrigir" nada.
4. Avise o usuário: o teste foi criado, ele deve rodar (`npm test` ou o comando equivalente) e é esperado que falhe agora, porque a função ainda não existe. **Pare aqui.** Não crie o stub ainda nesta mensagem — deixe claro que a etapa 2 (stub) vem a seguir.

## Etapa 2 — Criar o stub

Só depois de sinalizar a etapa 1:

1. Crie a função com a assinatura exata usada no teste (mesmo nome exportado, mesmos parâmetros e tipos, mesmo formato de retorno declarado no tipo).
2. O corpo deve ser o mínimo possível para o arquivo compilar e o teste poder rodar — **não implemente a lógica de negócio real.** Exemplos aceitáveis de corpo de stub:
   - `throw new Error("Not implemented");`
   - retornar um valor placeholder fixo compatível com o tipo de retorno.
   - Isso é diferente de implementar validação real com zod, chamadas reais ao model, tratamento de erro por código, etc. — tudo isso é lógica real e **não** pertence ao stub.
3. Rode o teste você mesmo só para confirmar que ele agora executa (ainda pode falhar nas asserções — isso é esperado, um stub não faz o teste passar).
4. Avise o usuário: o stub foi criado, ele deve rodar o teste de novo. Deixe explícito que o stub não implementa a lógica real — isso fica para uma etapa seguinte, só se o usuário pedir.

## Regras críticas

- **Nunca pule direto para a implementação completa** "para o teste passar". Se o usuário pedir só o teste, pare na etapa 1. Se pedir um stub, pare na etapa 2. Só implemente a lógica real se isso for pedido explicitamente, fora desta skill.
- Se o usuário já tiver dito que quer as duas etapas de uma vez (como o pedido original desta skill), execute a etapa 1, avise, execute a etapa 2 na mesma resposta, avise de novo — mas ainda assim mantenha o stub sem lógica real.
- Se não estiver claro qual é a assinatura esperada (parâmetros, formato de retorno, regras de negócio específicas), pergunte antes de escrever o teste — não invente uma assinatura arbitrária quando há ambiguidade real (ex. quais campos são editáveis, se há efeito colateral em outra entidade).
