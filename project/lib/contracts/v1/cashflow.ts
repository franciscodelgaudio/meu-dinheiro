import "zod-openapi";
import { z } from "zod";

export const CreateCashflowRequestV1 = z.object({
    name: z.string().max(255).meta({ example: "Salário" }),
    description: z.string().max(500).optional().meta({ example: "Pagamento mensal" }),
    date: z.coerce.date().meta({ description: "Data do lançamento.", example: "2026-01-15T00:00:00.000Z" }),
    total: z.number().min(1).meta({ example: 5000 }),
    type: z.enum(["income", "expense"]).meta({ description: "Se o lançamento é uma entrada (income) ou saída (expense)." }),
    groupId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid groupId").optional().meta({ description: "_id do grupo ao qual este lançamento pertence, se houver." }),
}).meta({ id: "CreateCashflowRequest" });

export type CreateCashflowRequestV1 = z.infer<typeof CreateCashflowRequestV1>;

export function toCreateCashflowInput(userId: string, request: CreateCashflowRequestV1) {
    return {
        ...request,
        userId,
    };
}

export const CashflowQueryParamsV1 = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().meta({ description: "Quantidade de itens por página (máx. 100).", example: 10 }),
    cursor: z.string().optional().meta({
        description: "Cursor opaco de paginação retornado como `nextCursor` na resposta anterior. Para `sortBy=name`/`groupId` é uma string JSON `{ id, name }`/`{ id, groupId }`; caso contrário é o `_id` do último item.",
    }),
    type: z.enum(["income", "expense"]).optional().meta({ description: "Filtra lançamentos por tipo." }),
    search: z.string().optional().meta({ description: "Filtra lançamentos cujo nome contenha este texto (case-insensitive)." }),
    sort: z.enum(["asc", "desc"]).optional().meta({ description: "Direção da ordenação. Padrão: desc.", example: "desc" }),
    sortBy: z.enum(["id", "name", "groupId"]).optional().meta({ description: "Campo usado para ordenar. Padrão: id (_id).", example: "id" }),
}).meta({ id: "CashflowQueryParams" });

export type CashflowQueryParamsV1 = z.infer<typeof CashflowQueryParamsV1>;

export const CashflowEntityV1 = z.object({
    _id: z.string().meta({ example: "665f1c2e2f8b9a0012345679" }),
    name: z.string().meta({ example: "Salário" }),
    description: z.string().nullable().meta({ example: "Pagamento mensal" }),
    date: z.string().meta({ example: "2026-01-15T00:00:00.000Z" }),
    total: z.number().meta({ example: 5000 }),
    type: z.enum(["income", "expense"]),
    groupId: z.string().nullable().meta({ example: "665f1c2e2f8b9a0012345678" }),
    userId: z.string().meta({ example: "665f1c2e2f8b9a0012345677" }),
    createdAt: z.string().meta({ example: "2026-01-15T12:00:00.000Z" }),
    updatedAt: z.string().meta({ example: "2026-01-15T12:00:00.000Z" }),
}).meta({ id: "Cashflow" });

export const CashflowListResponseV1 = z.object({
    data: z.array(CashflowEntityV1),
    hasNextPage: z.boolean(),
    nextCursor: z.union([z.string(), z.null()]).meta({
        description: "Cursor a ser usado no próximo request via `?cursor=`, ou null se não houver mais páginas.",
    }),
}).meta({ id: "CashflowListResponse" });
