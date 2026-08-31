import "zod-openapi";
import { z } from "zod";

export const ActionSuccessResponseV1 = z.object({
    success: z.literal(true),
    message: z.string(),
}).meta({
    id: "ActionSuccessResponse",
    description: "Operação concluída com sucesso.",
});

export const ActionErrorResponseV1 = z.object({
    success: z.literal(false),
    message: z.string(),
    code: z.enum(["VALIDATION_ERROR", "CONFLICT", "NOT_FOUND", "TOO_MANY_REQUESTS", "INTERNAL_SERVER_ERROR"]),
}).meta({
    id: "ActionErrorResponse",
    description: "Erro ao processar a requisição.",
});

export const IdempotencyKeyHeaderV1 = z.object({
    "Idempotency-Key": z.string().min(1).meta({
        description: "Chave única fornecida pelo cliente para tornar a requisição idempotente. Reenviar a mesma chave dentro da janela de TTL devolve a resposta original em vez de duplicar a operação.",
        example: "b3f2b1a0-6e9e-4d3b-9a3b-2f6f1a6f0b31",
    }),
});
