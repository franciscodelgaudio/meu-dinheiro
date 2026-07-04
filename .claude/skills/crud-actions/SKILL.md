---
name: crud-actions
description: Cria server actions de CRUD (create/update/delete) seguindo o padrão do projeto — arquivo em src/lib/actions, "use server" no topo, schema Zod, checagem de dono do workspace e retorno { success, message } consumido no client via react-hook-form. Use quando o usuário pedir para criar/adicionar ações de servidor, CRUD ou mutações de um recurso.
user-invocable: true
---

# CRUD Actions

Cria as server actions de mutação (create, update, delete) de um recurso seguindo exatamente o padrão já estabelecido no projeto. As actions ficam separadas das páginas, retornam `{ success, message }` e são consumidas por um Client Component com `react-hook-form` (a UI trata o feedback, a action não navega).

## Convenções do projeto

- **Local do arquivo:** `src/lib/actions/<recurso>.js` — nome em minúsculo singular (ex. `client.js`, `work.js`, `quote.js`).
- **Um arquivo por recurso:** todas as actions de CRUD daquele recurso vivem no mesmo arquivo.
- **Nome das funções:** `create<Recurso>`, `update<Recurso>`, `delete<Recurso>` (ex. `createClient`, `updateClient`, `deleteClient`).
- **Assinatura:** `workspaceId` sempre primeiro; para update/delete o(s) `id`(s) do documento vêm em seguida; o objeto `values` (quando existe) vem por último.
  - `create<Recurso>(workspaceId, values)`
  - `update<Recurso>(workspaceId, <recurso>Id, values)`
  - `delete<Recurso>(workspaceId, <recurso>Id)`
- **Schema Zod:** definido uma vez no topo do módulo e reutilizado por create e update.

## Estrutura obrigatória (o padrão)

Cada action segue esta ordem:

1. `"use server"` na **primeira linha do arquivo** (todas as exports do arquivo são server actions).
2. Imports: `z` do `zod`, `mongoose`, `notFound`/`redirect` de `next/navigation`, `auth` de `@/auth`, o model do recurso e `Workspaces`.
3. Schema Zod no topo do módulo.
4. **Sessão:** `const session = await auth();` → `if (!session?.user) redirect("/login");`
5. **Dono do workspace:** carrega o workspace escopado ao usuário autenticado; `if (!workspace) notFound();` — é isso que garante o controle de acesso, **nunca pule**.
6. **Validação (create/update):** `const parsed = schema.safeParse(values);` → em falha, `return { success: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos" };`
7. **Mutação em `try/catch`:** dentro do `try`, executa a operação no Mongo e retorna `{ success: true, message: "..." }`; no `catch`, retorna `{ success: false, message: "..." }`.

## Regras

1. A action recebe um **objeto simples** `values` (não `FormData`) — quem monta o envio é o `react-hook-form` no client.
2. Em **sucesso não use `redirect` nem `revalidatePath`** — quem decide a UX (mostrar feedback, resetar o form, dar `router.refresh()` numa lista) é o Client Component. `redirect` só para sessão ausente; `notFound` só para workspace inexistente/sem permissão.
3. O `return` de **sucesso fica dentro do `try`**, logo após a operação no banco. O `catch` retorna o erro genérico.
4. **Toda mutação é escopada pelo workspace** no filtro (`workspaceId: workspace._id`), inclusive update e delete — isso impede um usuário de alterar/remover documento de outro workspace.
5. Em update/delete, verifique o resultado do Mongo (`matchedCount` / `deletedCount`) e retorne `{ success: false, ... }` quando não achar o documento.
6. `workspaceId` vem de um route param já validado com `mongoose.Types.ObjectId.isValid(...)` na página, então pode ser convertido fora do `try`. Já o `id` do recurso é convertido **dentro do `try`** (no filtro), para que um id malformado caia no `catch`.
7. Mensagens em pt-BR (ou no idioma do recurso), curtas e voltadas ao usuário.
8. Não adicione logging, telemetria, transações ou revalidação que não foram pedidos — siga só o padrão e o pedido.

## Exemplo de referência (padrão real do projeto)

`src/lib/actions/client.js`:

```js
"use server";

import z from "zod";
import mongoose from "mongoose";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { Clients } from "@/lib/models/Client";
import { Workspaces } from "@/lib/models/Workspace";

const clientSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do cliente"),
  address: z.string().trim().min(1, "Informe o endereço"),
  cellphone: z.string().trim().min(1, "Informe o celular"),
});

export async function createClient(workspaceId, values) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const workspace = await Workspaces.findOne({
    _id: new mongoose.Types.ObjectId(workspaceId),
    owner: new mongoose.Types.ObjectId(session.user.id),
  }).lean();
  if (!workspace) notFound();

  const parsed = clientSchema.safeParse(values);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  try {
    await Clients.create({
      workspaceId: workspace._id,
      ...parsed.data,
    });
    return { success: true, message: "Cliente criado com sucesso." };
  } catch {
    return { success: false, message: "Não foi possível criar o cliente. Tente novamente." };
  }
}

export async function updateClient(workspaceId, clientId, values) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const workspace = await Workspaces.findOne({
    _id: new mongoose.Types.ObjectId(workspaceId),
    owner: new mongoose.Types.ObjectId(session.user.id),
  }).lean();
  if (!workspace) notFound();

  const parsed = clientSchema.safeParse(values);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  try {
    const result = await Clients.updateOne(
      { _id: new mongoose.Types.ObjectId(clientId), workspaceId: workspace._id },
      { $set: parsed.data },
    );
    if (result.matchedCount === 0) return { success: false, message: "Cliente não encontrado." };
    return { success: true, message: "Cliente atualizado com sucesso." };
  } catch {
    return { success: false, message: "Não foi possível atualizar o cliente. Tente novamente." };
  }
}

export async function deleteClient(workspaceId, clientId) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const workspace = await Workspaces.findOne({
    _id: new mongoose.Types.ObjectId(workspaceId),
    owner: new mongoose.Types.ObjectId(session.user.id),
  }).lean();
  if (!workspace) notFound();

  try {
    const result = await Clients.deleteOne({
      _id: new mongoose.Types.ObjectId(clientId),
      workspaceId: workspace._id,
    });
    if (result.deletedCount === 0) return { success: false, message: "Cliente não encontrado." };
    return { success: true, message: "Cliente removido com sucesso." };
  } catch {
    return { success: false, message: "Não foi possível remover o cliente. Tente novamente." };
  }
}
```

## Como ligar a action na página

A página (Server Component) faz auth/params/leitura do workspace e passa a action já com o `workspaceId` fixado via `.bind()`:

```js
import { createClient } from "@/lib/actions/client";

// dentro do componente da página, após validar o workspace:
<Display
  workspaceId={workspace._id.toString()}
  createClient={createClient.bind(null, workspaceId)}
  // para update/delete: updateClient.bind(null, workspaceId, clientId)
  locale={locale}
/>
```

## Como consumir no client (Display)

O `Display` é um Client Component com `react-hook-form`. Ele chama a action, lê `{ success, message }` e mostra o feedback — sem depender de redirect do servidor:

```jsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";

export default function Display({ workspaceId, createClient, locale = "pt" }) {
  const [feedback, setFeedback] = useState(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { name: "", address: "", cellphone: "" } });

  const onSubmit = async (values) => {
    setFeedback(null);
    const result = await createClient(values);
    if (!result.success) {
      setFeedback({ type: "error", message: result.message });
      return;
    }
    setFeedback({ type: "success", message: result.message });
    reset();
    // Numa lista/edição, após sucesso chame router.refresh() para reler os dados do servidor.
  };

  return <form onSubmit={handleSubmit(onSubmit)}>{/* campos com register(...) + isSubmitting no botão */}</form>;
}
```

Pontos do lado client:
- `register("campo", { required: ... })` para validação básica; a validação canônica continua no Zod da action.
- `isSubmitting` desabilita o botão e troca o texto (ex. "Salvar" → "Salvando...").
- Feedback de sucesso/erro vem de `result.message`. Em fluxos de lista (delete/edição inline), rode `router.refresh()` após o sucesso para atualizar os dados servidos.

## Fluxo ao criar as actions de um recurso

1. Confirme o nome do recurso, o model correspondente em `src/lib/models/` e os campos do schema (reaproveite o schema Zod da página se já existir).
2. Crie/edite `src/lib/actions/<recurso>.js` com `"use server"` no topo e as actions necessárias seguindo a "Estrutura obrigatória".
3. Escope toda mutação pelo `workspaceId` e trate `matchedCount`/`deletedCount` em update/delete.
4. Na página, importe a action e passe-a com `.bind(null, workspaceId[, id])` para o `Display`.
5. No `Display` (Client Component), consuma o retorno `{ success, message }` com `react-hook-form`.
6. Não crie testes, revalidação ou documentação extra a menos que pedido.
