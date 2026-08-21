import { z } from "zod";
import type { CreateUserInput } from "@/lib/actions/user";

export const CreateUserRequestV1 = z.object({
    id: z.string().min(1),
    name: z.string().max(255),
    email: z.string().email().optional(),
    avatarUrl: z.string().url().optional(),
});

export type CreateUserRequestV1 = z.infer<typeof CreateUserRequestV1>;

// v1 só tem "name" inteiro; o split pra firstName/lastName é uma perda de
// informação que só essa versão paga (ex: nomes com 3+ palavras ficam
// concatenados em lastName). v2 já manda os campos separados.
export function toCreateUserInput(request: CreateUserRequestV1): CreateUserInput {
    const [firstName, ...rest] = request.name.trim().split(/\s+/);
    const lastName = rest.join(" ") || firstName;

    return {
        id: request.id,
        firstName,
        lastName,
        email: request.email,
        avatarUrl: request.avatarUrl,
    };
}

