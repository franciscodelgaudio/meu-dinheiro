import "zod-openapi";
import { createDocument } from "zod-openapi";
import { z } from "zod";
import { ActionErrorResponseV1, ActionSuccessResponseV1, IdempotencyKeyHeaderV1 } from "@/lib/contracts/v1/common";
import { CreateUserRequestV1, UserListResponseV1, UserQueryParamsV1 } from "@/lib/contracts/v1/user";
import { CreateGroupRequestV1 } from "@/lib/contracts/v1/group";
import { CashflowListResponseV1, CashflowQueryParamsV1, CreateCashflowRequestV1, UpdateCashflowRequestV1 } from "@/lib/contracts/v1/cashflow";

const userIdPathParam = z.object({
    userId: z.string().regex(/^[0-9a-fA-F]{24}$/).meta({
        description: "_id (ObjectId do Mongo) do usuário dono do recurso.",
        example: "665f1c2e2f8b9a0012345677",
    }),
});

const cashflowIdPathParam = userIdPathParam.extend({
    cashflowId: z.string().regex(/^[0-9a-fA-F]{24}$/).meta({
        description: "_id (ObjectId do Mongo) do lançamento.",
        example: "665f1c2e2f8b9a0012345679",
    }),
});

export const openApiDocumentV1 = createDocument({
    openapi: "3.1.0",
    info: {
        title: "Meu Dinheiro API",
        version: "1.0.0",
        description: "Especificação da API pública (v1) do Meu Dinheiro. Gerada a partir dos schemas Zod usados para validar as próprias requisições, então reflete o contrato real aplicado em runtime.",
    },
    servers: [{ url: "/api/v1" }],
    tags: [
        { name: "User", description: "Cadastro e consulta de usuários." },
        { name: "Group", description: "Grupos de orçamento de um usuário." },
        { name: "Cashflow", description: "Lançamentos financeiros (entradas/saídas) de um usuário." },
    ],
    paths: {
        "/user": {
            post: {
                tags: ["User"],
                summary: "Cria um usuário",
                requestBody: {
                    content: { "application/json": { schema: CreateUserRequestV1 } },
                },
                responses: {
                    "201": {
                        description: "Usuário criado com sucesso.",
                        content: { "application/json": { schema: ActionSuccessResponseV1 } },
                    },
                    "409": {
                        description: "Já existe um usuário com este id/email.",
                        content: { "application/json": { schema: ActionErrorResponseV1 } },
                    },
                    "422": {
                        description: "Corpo da requisição inválido.",
                        content: { "application/json": { schema: ActionErrorResponseV1 } },
                    },
                    "429": {
                        description: "Limite de criação de usuários por IP excedido (5 requisições/60s). O header `Retry-After` indica quantos segundos aguardar.",
                        content: { "application/json": { schema: ActionErrorResponseV1 } },
                    },
                    "500": {
                        description: "Erro interno ao criar o usuário.",
                        content: { "application/json": { schema: ActionErrorResponseV1 } },
                    },
                },
            },
            get: {
                tags: ["User"],
                summary: "Lista usuários",
                requestParams: { query: UserQueryParamsV1 },
                responses: {
                    "200": {
                        description: "Lista paginada de usuários.",
                        content: { "application/json": { schema: UserListResponseV1 } },
                    },
                },
            },
        },
        "/user/{userId}/group": {
            post: {
                tags: ["Group"],
                summary: "Cria um grupo para o usuário",
                requestParams: { path: userIdPathParam, header: IdempotencyKeyHeaderV1 },
                requestBody: {
                    content: { "application/json": { schema: CreateGroupRequestV1 } },
                },
                responses: {
                    "201": {
                        description: "Grupo criado com sucesso.",
                        content: { "application/json": { schema: ActionSuccessResponseV1 } },
                    },
                    "409": {
                        description: "Conflito ao criar o grupo, ou uma requisição com a mesma Idempotency-Key já está em andamento.",
                        content: { "application/json": { schema: ActionErrorResponseV1 } },
                    },
                    "422": {
                        description: "Corpo da requisição inválido, ou header `Idempotency-Key` ausente.",
                        content: { "application/json": { schema: ActionErrorResponseV1 } },
                    },
                    "500": {
                        description: "Erro interno ao criar o grupo.",
                        content: { "application/json": { schema: ActionErrorResponseV1 } },
                    },
                },
            },
        },
        "/user/{userId}/cashflow": {
            post: {
                tags: ["Cashflow"],
                summary: "Cria um lançamento para o usuário",
                requestParams: { path: userIdPathParam, header: IdempotencyKeyHeaderV1 },
                requestBody: {
                    content: { "application/json": { schema: CreateCashflowRequestV1 } },
                },
                responses: {
                    "201": {
                        description: "Lançamento criado com sucesso.",
                        content: { "application/json": { schema: ActionSuccessResponseV1 } },
                    },
                    "409": {
                        description: "Conflito ao criar o lançamento, ou uma requisição com a mesma Idempotency-Key já está em andamento.",
                        content: { "application/json": { schema: ActionErrorResponseV1 } },
                    },
                    "422": {
                        description: "Corpo da requisição inválido, ou header `Idempotency-Key` ausente.",
                        content: { "application/json": { schema: ActionErrorResponseV1 } },
                    },
                    "500": {
                        description: "Erro interno ao criar o lançamento.",
                        content: { "application/json": { schema: ActionErrorResponseV1 } },
                    },
                },
            },
            get: {
                tags: ["Cashflow"],
                summary: "Lista lançamentos do usuário (paginação por cursor)",
                requestParams: { path: userIdPathParam, query: CashflowQueryParamsV1 },
                responses: {
                    "200": {
                        description: "Página de lançamentos.",
                        content: { "application/json": { schema: CashflowListResponseV1 } },
                    },
                },
            },
        },
        "/user/{userId}/cashflow/{cashflowId}": {
            put: {
                tags: ["Cashflow"],
                summary: "Atualiza um lançamento do usuário",
                requestParams: { path: cashflowIdPathParam },
                requestBody: {
                    content: { "application/json": { schema: UpdateCashflowRequestV1 } },
                },
                responses: {
                    "200": {
                        description: "Lançamento atualizado com sucesso.",
                        content: { "application/json": { schema: ActionSuccessResponseV1 } },
                    },
                    "404": {
                        description: "Nenhum lançamento encontrado para o id/userId informados.",
                        content: { "application/json": { schema: ActionErrorResponseV1 } },
                    },
                    "409": {
                        description: "Conflito ao atualizar o lançamento.",
                        content: { "application/json": { schema: ActionErrorResponseV1 } },
                    },
                    "422": {
                        description: "Corpo da requisição inválido.",
                        content: { "application/json": { schema: ActionErrorResponseV1 } },
                    },
                    "500": {
                        description: "Erro interno ao atualizar o lançamento.",
                        content: { "application/json": { schema: ActionErrorResponseV1 } },
                    },
                },
            },
        },
    },
});
