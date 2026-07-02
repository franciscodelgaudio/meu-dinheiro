---
name: mongoose-model
description: Padrão para criar novos models/schemas do Mongoose neste projeto. Use sempre que for criar um novo model, uma nova collection, ou adicionar/alterar um schema Mongoose — não use para os models já existentes em project/lib/models a menos que o usuário peça explicitamente para migrá-los.
---

# Padrão de model Mongoose

Este é o formato oficial para novos arquivos de model em `project/lib/models/*.ts`. Modelos existentes não devem ser reescritos automaticamente para este padrão — ele vale para models novos ou quando o usuário pedir a migração de um model específico.

## Estrutura do arquivo

```ts
import { dbConnect } from "@/lib/mongoose";
import mongoose from "mongoose";

// Sub-schema: extraia para uma constante própria sempre que a estrutura for
// reutilizada em mais de um lugar, ou complexa o suficiente para merecer nome.
const SubSchema = new mongoose.Schema({
  campo: {
    type: String,
    required: true,
  },
});

const NomeSchema = new mongoose.Schema({
  outroModeloId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    ref: "outromodelo",
  },
  status: {
    type: String,
    enum: ["open", "closed", "pending"],
    default: "open",
  },
  sub: {
    type: [SubSchema],
    default: [],
  },
});

await dbConnect();

export const Nome = mongoose.models.nome || mongoose.model("nome", NomeSchema);
```

## Regras

- **Import de conexão**: sempre `import { dbConnect } from "@/lib/mongoose";` (helper já existente no projeto), nunca criar um novo helper de conexão.
- **`await dbConnect()` no topo do arquivo**, logo antes do `export const`, para garantir que o model só é registrado com a conexão ativa.
- **Nome do model e da collection em minúsculo** (ex.: `"nome"`, `"planejamentos"`), sem terceiro argumento de collection explícito — o próprio nome passado a `mongoose.model()` já deve estar na forma final desejada.
- **Registro idempotente**: sempre `mongoose.models.nome || mongoose.model("nome", NomeSchema)`, nunca registrar direto com `mongoose.model(...)` sozinho (evita erro de "model já compilado" em hot reload).
- **Sub-schemas nomeados**: quando um campo tem uma estrutura com mais de 1-2 propriedades ou é reutilizada, extraia para `const XSchema = new mongoose.Schema({...})` antes do schema principal, em vez de inline.
- **Todo campo declara `type` explicitamente**, mesmo quando o mongoose conseguiria inferir.
- **`required` explícito em todo campo** (`true` ou `false`), não deixar implícito.
- **`default` explícito quando o campo é opcional** (`null`, `[]`, `0`, etc. conforme o tipo).
- **`enum` para qualquer campo string com conjunto fixo de valores possíveis** (status, tipo, unidade, etc.).
- **Referências usam `mongoose.Schema.Types.ObjectId` com `ref` apontando para o nome (minúsculo) do outro model**, quando o campo referencia outra collection.
- **Comentários só quando explicam uma regra de negócio não óbvia** (ex.: por que um campo pode ser `null` para compatibilidade retroativa, por que uma data não é recalculada automaticamente). Não comentar o óbvio (ex.: não escrever `// nome do usuário` acima de `name: { type: String }`).

## Exemplo de referência completo

O schema abaixo (domínio de planejamento/ações) é o exemplo canônico que define o padrão acima — use-o como referência de estilo ao criar um novo model, não como algo a copiar literalmente:

```ts
import { dbConnect } from "@/lib/mongoose";
import mongoose from "mongoose";

const DependenciesSchema = new mongoose.Schema({
  actionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  position: {
    type: String,
    enum: ["start", "end"],
    required: true,
  },
  offset: {
    type: Number,
    required: true,
  },
  unit: {
    type: String,
    enum: ["day", "week", "month", "year", "hour"],
    required: true,
  },
});

const ProgressSchema = new mongoose.Schema({
  totalPercent: {
    type: Number,
    required: true,
  },
  milestone: [
    {
      percent: {
        type: Number,
        required: true,
      },
      date: {
        type: Date,
        required: true,
      },
    },
  ],
});

const ActionsSchema = new mongoose.Schema({
  planningId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    ref: "plannings",
  },
  name: {
    type: String,
  },
  status: {
    type: String,
    enum: ["open", "closed", "pending", "canceled", "paused", "draft"],
    default: "open",
  },
  duration: {
    type: Number,
    required: true,
  },
  unit: {
    type: String,
    enum: ["day", "week", "month", "year", "hour"],
    required: true,
  },
  dependencies: {
    type: [DependenciesSchema],
    default: [],
  },
  progress: {
    type: ProgressSchema,
    default: null,
  },
});

await dbConnect();

export const Actions =
  mongoose.models.actions || mongoose.model("actions", ActionsSchema);
```
