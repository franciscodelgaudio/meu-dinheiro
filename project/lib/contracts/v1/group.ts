import "zod-openapi";
import { z } from "zod";

export const CreateGroupRequestV1 = z.object({
    name: z.string().max(255).meta({ example: "Viagem para a praia" }),
    description: z.string().max(500).optional().meta({ example: "Gastos da viagem de férias" }),
    total: z.number().min(1).meta({ description: "Valor total planejado para o grupo.", example: 1500 }),
    color: z.string().optional().meta({ description: "Cor de exibição do grupo (hex).", example: "#18181b" }),
}).meta({ id: "CreateGroupRequest" });

export type CreateGroupRequestV1 = z.infer<typeof CreateGroupRequestV1>;

export function toCreateGroupInput(userId: string, request: CreateGroupRequestV1) {
    return {
        ...request,
        userId,
    };
}

export const UpdateGroupRequestV1 = CreateGroupRequestV1.partial().meta({ id: "UpdateGroupRequest" });

export type UpdateGroupRequestV1 = z.infer<typeof UpdateGroupRequestV1>;

export function toUpdateGroupInput(userId: string, groupId: string, request: UpdateGroupRequestV1) {
    return {
        ...request,
        id: groupId,
        userId,
    };
}

export const GroupQueryParamsV1 = z.object({
    page: z.coerce.number().int().min(1).optional().meta({ description: "Página retornada (1-indexada).", example: 1 }),
    limit: z.coerce.number().int().min(1).max(100).optional().meta({ description: "Quantidade de itens por página (máx. 100).", example: 10 }),
    search: z.string().optional().meta({ description: "Filtra grupos cujo nome contenha este texto (case-insensitive)." }),
    id: z.string().regex(/^[0-9a-fA-F]{24}$/).optional().meta({ description: "Filtra por um _id de grupo específico." }),
    sort: z.enum(["asc", "desc"]).optional().meta({ description: "Direção da ordenação. Padrão: desc.", example: "desc" }),
    sortBy: z.enum(["name", "total", "createdAt"]).optional().meta({ description: "Campo usado para ordenar. Padrão: createdAt.", example: "createdAt" }),
}).meta({ id: "GroupQueryParams" });

export type GroupQueryParamsV1 = z.infer<typeof GroupQueryParamsV1>;

export const GroupEntityV1 = z.object({
    _id: z.string().meta({ example: "665f1c2e2f8b9a0012345678" }),
    name: z.string().meta({ example: "Viagem para a praia" }),
    description: z.string().nullable().meta({ example: "Gastos da viagem de férias" }),
    total: z.number().meta({ example: 1500 }),
    color: z.string().nullable().meta({ example: "#18181b" }),
    userId: z.string().meta({ example: "665f1c2e2f8b9a0012345677" }),
    createdAt: z.string().meta({ example: "2026-01-15T12:00:00.000Z" }),
    updatedAt: z.string().meta({ example: "2026-01-15T12:00:00.000Z" }),
}).meta({ id: "Group" });

export const GroupListResponseV1 = z.object({
    data: z.array(GroupEntityV1),
    total: z.number().int(),
    page: z.number().int(),
    totalPages: z.number().int(),
}).meta({ id: "GroupListResponse" });
