---
name: mongoose-model
description: Cria arquivos de model do Mongoose seguindo o padrão do projeto (dbConnect, mongoose.models singleton, sub-schemas). Use quando o usuário pedir para criar/adicionar um novo model, schema ou coleção do Mongoose/MongoDB.
---

# Mongoose Model

Gera um novo arquivo de model do Mongoose seguindo exatamente o padrão já estabelecido no projeto.

## Convenções do projeto

- **Local do arquivo:** `src/lib/models/`
- **Nome do arquivo:** PascalCase singular, ex. `Action.js` para o model `actions`.
- **Nome do model/coleção:** minúsculo plural (ex. `"actions"`, `"plannings"`, `"tasks"`), usado tanto na string do `mongoose.model()` quanto em qualquer `ref` de outro schema.
- **Nome da const exportada:** PascalCase plural, ex. `export const Actions = ...`.

## Estrutura obrigatória do arquivo

```js
import { dbConnect } from "@/lib/handler/db";
import mongoose from "mongoose";

const NomeSchema = new mongoose.Schema({
    // campos
});

await dbConnect();

export const Nome = mongoose.models.nome || mongoose.model("nome", NomeSchema);
```

Regras:
1. Sempre importar `dbConnect` de `@/lib/handler/db` e `mongoose` — nesta ordem.
2. Sempre chamar `await dbConnect();` antes do `export const`.
3. Sempre registrar o model com o padrão `mongoose.models.<nome> || mongoose.model("<nome>", <Nome>Schema)` para evitar erro de "Cannot overwrite model" em hot reload.
4. Se o schema tiver sub-objetos repetidos, com validação própria, ou reutilizados em mais de um lugar, extraia-os em `mongoose.Schema` separados e definidos ANTES do schema principal (ex. `DependenciesSchema`, `ProgressSchema` abaixo). Sub-objetos simples e usados uma única vez podem ficar inline (ex. o campo `start` no exemplo).
5. Referências para outros documentos usam `type: mongoose.Schema.Types.ObjectId` + `ref: "<nome-plural-da-coleção>"`.
6. Campos com um conjunto fixo de valores usam `enum: [...]` com strings em minúsculo.
7. Comente apenas o que não é óbvio pelo nome do campo: uma regra de negócio, uma decisão de compatibilidade retroativa, um motivo pelo qual um valor não é recalculado, etc. Escreva o comentário em português, curto, acima do campo. Não descreva o óbvio (ex. não comente `required: true`).
8. Não adicione validação, defaults ou opções que não foram pedidos — siga só o que o pattern e o pedido do usuário exigem.

## Exemplo de referência (padrão real do projeto)

`src/lib/models/Action.js`:

```js
import { dbConnect } from "@/lib/handler/db";
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
})

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
            }
        }
    ],
});

const ActionsSchema = new mongoose.Schema({
    planningId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
        ref: "plannings"
    },
    itemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "items",
    },
    taskId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "tasks",
    },
    // Quando preenchido, a action vive em um PlanningNode (nível ≥ 4) — a folha
    // canônica deixa de ser o item e passa a ser esse nó. Quando null, a action
    // continua sendo folha direta do item (compatibilidade com plannings antigos).
    nodeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "planningNodes",
        default: null,
        required: false,
    },
    name: {
        type: String,
    },
    status: {
        type: String,
        enum: ["open", "closed", "pending", "canceled", "paused", "draft"],
        default: "open",
    },
    start: {
        condition: {
            type: String,
            enum: ["date", "action"],
        },
        triggerDate: {
            type: Date,
            default: null,
            required: false
        },
        triggerActionId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
            required: false
        },
        triggerPosition: {
            type: String,
            enum: ["start", "end"],
            required: false
        },
        offset: {
            type: Number,
            default: 0,
        },
        unit: {
            type: String,
            enum: ["day", "week", "month", "year", "hour"],
            required: false
        },
    },
    duration: {
        type: Number,
        required: true
    },
    unit: {
        type: String,
        enum: ["day", "week", "month", "year", "hour"],
        required: true
    },
    isPlanned: {
        type: Boolean,
        default: false
    },
    realStartDate: {
        type: Date,
        default: null,
        required: false,
    },
    realEndDate: {
        type: Date,
        default: null,
        required: false,
    },
    // Linha de base: cópia congelada das datas planejadas (início/fim) no
    // momento em que o usuário clica em "Definir linha de base". Servem de
    // referência histórica e NÃO são recalculadas no replanejamento — só
    // mudam quando a linha de base é redefinida explicitamente.
    baselineStartDate: {
        type: Date,
        default: null,
        required: false,
    },
    baselineEndDate: {
        type: Date,
        default: null,
        required: false,
    },
    index: {
        type: Number,
        required: false,
    },
    dependencies: {
        type: [DependenciesSchema],
        default: [],
    },
    progress: {
        type: ProgressSchema,
        default: null,
    },
})

await dbConnect();

export const Actions = mongoose.models.actions || mongoose.model("actions", ActionsSchema);
```

## Fluxo ao criar um novo model

1. Descubra com o usuário (ou pelo pedido) o nome da entidade e os campos/tipos/relações desejados. Se algo for ambíguo (nome de outra coleção referenciada, se um campo é obrigatório, se precisa de enum), pergunte antes de inventar.
2. Verifique se já existe um model com nome parecido em `src/lib/models/` para reaproveitar convenções de nomes de `ref` já usadas no projeto.
3. Monte o arquivo seguindo a "Estrutura obrigatória" e o exemplo acima.
4. Salve em `src/lib/models/<NomePascalSingular>.js`.
5. Não crie testes, index de re-export ou documentação extra a menos que pedido.
