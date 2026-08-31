---
name: ciclo-tdd
description: Fluxo estrito de TDD (Red -> Green -> Refactor) para qualquer teste — unitário ou de integração, função nova ou já existente (bugfix, refactor, wiring entre módulos). Cada etapa exige um pedido explícito e separado do usuário antes de avançar para a próxima; nunca implementa lógica real nem refatora sem essa autorização, mesmo que o pedido original já descreva a feature inteira. Na etapa Red, verifica ativamente se cada teste falha pelo motivo certo, para evitar falsos positivos (testes que passariam mesmo com implementação errada). Use quando o usuário disser que está "fazendo TDD", pedir para seguir "red/green/refactor", ou disser explicitamente para não implementar nada até ele pedir.
---

# Ciclo TDD (Red → Green → Refactor)

Este é o fluxo a seguir sempre que o usuário estiver conduzindo o próprio ciclo de TDD e quiser controlar cada etapa manualmente. Diferença central em relação a outras skills de teste deste projeto: aqui **nenhuma etapa avança sozinha**. Cada uma das três etapas (Red, Green, Refactor) só começa depois de um pedido novo e explícito do usuário nesta conversa — mesmo que o pedido original já descreva a funcionalidade completa, ou que pareça óbvio que "o próximo passo" é implementar.

Regra crítica, sem exceção: **nunca escrever lógica de produção real (Green) nem alterar comportamento (Refactor) por iniciativa própria.** Se terminar uma etapa e não houver um pedido explícito para a próxima, pare e espere.

## Etapa RED — escrever o(s) teste(s) e provar que falham pelo motivo certo

1. Descubra a assinatura/contrato esperado (função nova) ou o comportamento novo/corrigido esperado (função existente) a partir do pedido do usuário, do código vizinho, ou perguntando se for ambiguo. Não invente regra de negócio não especificada.
2. Escreva o(s) teste(s) seguindo as convenções do projeto: `vitest` (`describe`/`it`/`expect`/`vi`), local em `lib/tests/<entidade>/<arquivo>.test.ts`.
3. **Escopo do teste — decida unitário ou integração conforme o que o usuário pediu:**
   - **Unitário:** isola uma única função. Mocka com `vi.mock` qualquer módulo que fale com banco (`lib/models/*.ts`), rede ou sistema de arquivos.
   - **Integração:** exercita duas ou mais camadas reais juntas (ex.: rota + action, action + service), sem mockar a integração entre elas. Mesmo assim, mocka a fronteira externa real (banco via `lib/models/*.ts`; e qualquer módulo que dependa de credenciais externas só para poder importar o arquivo, como `server-only` ou um rate limiter baseado em Redis, quando não fizer parte do que está sendo testado).
   - Em ambos os casos, o teste tem que valer como teste de unidade de verdade no sentido amplo (Michael Feathers): sem banco/rede/filesystem reais, sem depender de ordem de execução ou estado global compartilhado, sem setup manual (subir serviço, editar `.env`, rodar migration) para passar.
4. Rode o teste (`npx vitest run <arquivo>`).
5. **Verificação ativa contra falso positivo — não pule este passo.** Para cada teste novo, confirme que:
   - Ele de fato **falhou** (não passou por acidente).
   - A causa da falha é a esperada: para função inexistente, algo como "X is not a function" ou erro de import; para função existente sendo corrigida/estendida, a asserção específica que captura o comportamento novo/errado — não um erro incidental (typo de import, mock apontando para o módulo errado, exception não relacionada mascarando a asserção real).
   - Revise o próprio teste em busca de armadilhas clássicas que o fariam passar mesmo com implementação errada ou ausente: `await` faltando em chamada assíncrona (asserção nunca roda), asserção dentro de callback/`.then()` sem ser aguardada, matcher fraco demais (`toBeTruthy()`/`toBeDefined()` quando o caso pede um valor exato), mock que resolve `undefined` silenciosamente e deixa o código seguir por um caminho que "funciona" sem checar nada, snapshot novo sendo gravado na primeira execução (sempre passa, nunca é red de verdade).
   - Se o teste rodar contra um arquivo já existente (bugfix/refactor), rode a suíte inteira do arquivo, não só o teste novo — confirme que os testes antigos continuam verdes e só os novos/alterados estão red. Isso descarta regressão introduzida sem querer ao mexer em mocks ou fixtures compartilhadas.
   - Rode `npx tsc --noEmit` — o build roda type-check sobre o repo inteiro, incluindo arquivos de teste.
6. Reporte ao usuário, por teste (ou em grupo se forem homogêneos): o que foi escrito, que ele está red, e **por qual motivo especificamente** — deixando claro que essa é a causa esperada, não um erro acidental.
7. **Pare aqui.** Não escreva stub, não escreva implementação, não sugira a implementação "só para ilustrar". Diga explicitamente que está aguardando o pedido para avançar ao Green.

## Etapa GREEN — só ao ser explicitamente pedido

Só inicie esta etapa quando o usuário pedir isso nesta conversa, com um pedido novo (ex.: "implementa", "pode fazer o green", "bora fazer passar", "resolve os reds"). Descrever a feature no pedido original **não** conta como esse pedido.

1. Implemente o mínimo de lógica real necessário para os testes atualmente red passarem — nada além disso. Sem tratar casos que os testes não cobrem, sem abstração especulativa, sem features extras.
2. Rode a suíte inteira (não só o arquivo novo) e `npx tsc --noEmit`.
3. Se algum teste continuar red ou algum outro teste (pré-existente) quebrar, corrija e rode de novo antes de reportar.
4. Reporte: quais testes ficaram verdes, e se algo do pedido original ficou de fora por não ter teste cobrindo (para o usuário decidir se quer cobrir antes de seguir).
5. **Pare aqui.** Não entre em refactor por conta própria.

## Etapa REFACTOR — só ao ser explicitamente pedido

Só inicie quando o usuário pedir explicitamente (ex.: "refatora", "limpa isso", "melhora a implementação").

1. Só mexa em estrutura, nomes, duplicação — nunca em comportamento observável.
2. Rode a suíte depois de cada mudança não-trivial, não só no final. Se um teste virar red durante o refactor, reverta esse passo específico ou corrija antes de continuar — o objetivo é nunca ficar red nesta etapa.
3. Rode `npx tsc --noEmit` ao final.
4. Reporte o que foi limpo e confirme que a suíte inteira segue verde.

## Resumo das diferenças em relação à skill `teste-unitario`

- `teste-unitario` é para função **nova/não implementada**, sempre unitária, e permite Etapa 1 (teste) + Etapa 2 (stub sem lógica real) na mesma resposta se o usuário já pediu isso de antemão — mas nunca implementa lógica real.
- `ciclo-tdd` cobre função nova **ou** existente, unitário **ou** integração, e vai até a lógica real (Green) e o refactor — mas exige um pedido explícito e separado do usuário para cada etapa, sempre, sem exceção, mesmo que o pedido original já descreva tudo.
