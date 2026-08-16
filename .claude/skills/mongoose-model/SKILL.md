---
name: mongoose-model
description: Cria arquivos de model do Mongoose (e o zod schema de validação correspondente) seguindo o padrão do projeto (dbConnect, mongoose.models singleton, sub-schemas tipados). Use quando o usuário pedir para criar/adicionar um novo model, schema ou coleção do Mongoose/MongoDB.
---

# Mongoose Model

Gera um novo arquivo de model do Mongoose em TypeScript seguindo exatamente o padrão já estabelecido no projeto, junto com o schema de validação zod correspondente.

## Convenções do projeto

- **Local do model:** `lib/models/`
- **Local da validação:** `lib/validations/`
- **Nome do arquivo:** kebab-case singular, ex. `expense-group.ts` para o model `expensegroup`.
- **Nome do model/coleção:** minúsculo plural ou concatenado sem hífen (ex. `"groups"`, `"expensegroup"`), usado tanto na string do `mongoose.model()` quanto em qualquer `ref` de outro schema.
- **Nome da const exportada:** PascalCase plural, ex. `export const Groups = ...`.
- **Interface TypeScript:** `I<Nome>` exportada, usada em `mongoose.Schema<I<Nome>>` e `mongoose.model<I<Nome>>`.

## Estrutura obrigatória do model

```ts
import { dbConnect } from "@/lib/handler/db";
import mongoose from "mongoose";

export interface INome {
  // campos
}

const nomeSchema = new mongoose.Schema<INome>({
  // campos
});

await dbConnect();

export const Nome =
  mongoose.models.nome || mongoose.model<INome>("nome", nomeSchema);
```

Regras:

1. Sempre importar `dbConnect` de `@/lib/handler/db` e `mongoose` — nesta ordem.
2. Sempre exportar uma `interface I<Nome>` com os campos do documento, usada para tipar o `Schema` e o `model`.
3. Sempre chamar `await dbConnect();` antes do `export const` (top-level await, suportado pelo Next.js).
4. Sempre registrar o model com o padrão `mongoose.models.<nome> || mongoose.model<INome>("<nome>", <nome>Schema)` para evitar erro de "Cannot overwrite model" em hot reload.
5. Se o schema tiver sub-objetos repetidos, com validação própria, ou reutilizados em mais de um lugar, extraia-os em `mongoose.Schema` separados e definidos ANTES do schema principal. Sub-objetos simples e usados uma única vez podem ficar inline.
6. Referências para outros documentos usam `type: mongoose.Schema.Types.ObjectId` + `ref: "<nome-plural-da-coleção>"`.
7. Campos com um conjunto fixo de valores usam `enum: [...]` com strings em minúsculo.
8. Use `{ timestamps: true }` como segundo argumento do `mongoose.Schema` quando o model precisar de `createdAt`/`updatedAt` (padrão para entidades que o usuário cria/edita diretamente).
9. Comente apenas o que não é óbvio pelo nome do campo: uma regra de negócio, uma decisão de compatibilidade retroativa, um motivo pelo qual um valor não é recalculado, etc. Comentário curto, acima do campo. Não descreva o óbvio (ex. não comente `required: true`).
10. Não adicione validação, defaults ou opções que não foram pedidos — siga só o que o pattern e o pedido do usuário exigem.

## Estrutura obrigatória da validação zod

Para cada model, crie o schema de validação de entrada correspondente em `lib/validations/<nome-do-model>.ts`:

```ts
import { z } from "zod";

export const nomeSchema = z.object({
  // mesmos campos do model, validados na forma como chegam de um form/request
});

export type NomeInput = z.infer<typeof nomeSchema>;
```

Regras:

1. Os campos do zod schema devem espelhar os campos do model (mesmo nome, tipo compatível).
2. Use `.nullable()` para campos que podem ser `null`, `.default(...)` para os mesmos defaults do model.
3. IDs recebidos de fora (ex. `userId` vindo de um form) são validados como `z.string()` — a conversão para `ObjectId` acontece na camada que grava no banco, não na validação.
4. Exporte o tipo inferido (`z.infer<typeof nomeSchema>`) para reaproveitar em actions/handlers.

## Fluxo ao criar um novo model

1. Descubra com o usuário (ou pelo pedido) o nome da entidade e os campos/tipos/relações desejados. Se algo for ambíguo (nome de outra coleção referenciada, se um campo é obrigatório, se precisa de enum), pergunte antes de inventar.
2. Verifique se já existe um model com nome parecido em `lib/models/` para reaproveitar convenções de nomes de `ref` já usadas no projeto.
3. Monte o arquivo do model seguindo a "Estrutura obrigatória do model" acima.
4. Salve em `lib/models/<nome-kebab-case-singular>.ts`.
5. Monte o schema zod correspondente e salve em `lib/validations/<nome-kebab-case-singular>.ts`.
6. Não crie testes, index de re-export ou documentação extra a menos que pedido.
