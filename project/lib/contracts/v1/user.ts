import "zod-openapi";
import { z } from "zod";
import type { CreateUserInput } from "@/lib/actions/user.actions";

export const CreateUserRequestV1 = z.object({
    id: z.string().min(1).meta({ description: "Identificador externo do usuário.", example: "usr_123" }),
    name: z.string().max(255).meta({ example: "Ada Lovelace" }),
    email: z.string().email().optional().meta({ example: "ada@example.com" }),
    avatarUrl: z.string().url().optional().meta({ example: "https://example.com/avatar.png" }),
}).meta({ id: "CreateUserRequest" });

export type CreateUserRequestV1 = z.infer<typeof CreateUserRequestV1>;

export function toCreateUserInput(request: CreateUserRequestV1): CreateUserInput {
    return {
        id: request.id,
        name: request.name,
        email: request.email,
        avatarUrl: request.avatarUrl,
    };
}

export const UserQueryParamsV1 = z.object({
    page: z.coerce.number().int().min(1).optional().meta({ description: "Página retornada (1-indexada).", example: 1 }),
    limit: z.coerce.number().int().min(1).max(100).optional().meta({ description: "Quantidade de itens por página (máx. 100).", example: 10 }),
    search: z.string().optional().meta({ description: "Filtra usuários cujo nome contenha este texto (case-insensitive)." }),
    userId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional().meta({ description: "Filtra por um _id de usuário específico (ObjectId do Mongo)." }),
});

export type UserQueryParamsV1 = z.infer<typeof UserQueryParamsV1>;

export const UserEntityV1 = z.object({
    _id: z.string().meta({ example: "665f1c2e2f8b9a0012345678" }),
    id: z.string().meta({ example: "usr_123" }),
    name: z.string().meta({ example: "Ada Lovelace" }),
    email: z.string().nullable().meta({ example: "ada@example.com" }),
    avatarUrl: z.string().nullable().meta({ example: "https://example.com/avatar.png" }),
    createdAt: z.string().meta({ example: "2026-01-15T12:00:00.000Z" }),
    updatedAt: z.string().meta({ example: "2026-01-15T12:00:00.000Z" }),
}).meta({ id: "User" });

export const UserListResponseV1 = z.object({
    data: z.array(UserEntityV1),
    total: z.number().int(),
    page: z.number().int(),
    totalPages: z.number().int(),
}).meta({ id: "UserListResponse" });

