import "zod-openapi";
import { z } from "zod";

export const CreateGroupRequestV1 = z.object({
    name: z.string().max(255).meta({ example: "Viagem para a praia" }),
    description: z.string().max(500).optional().meta({ example: "Gastos da viagem de férias" }),
    date: z.array(
        z.object({
            month: z.string().min(1).meta({ example: "01" }),
            year: z.string().min(1).meta({ example: "2026" }),
        }),
    ).min(1).meta({ description: "Meses/anos cobertos por este grupo. Precisa ter ao menos um item." }),
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
