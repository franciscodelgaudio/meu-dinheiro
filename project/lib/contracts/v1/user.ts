import { z } from "zod";
import type { CreateUserInput } from "@/lib/actions/user";

export const CreateUserRequestV1 = z.object({
    id: z.string().min(1),
    name: z.string().max(255),
    email: z.string().email().optional(),
    avatarUrl: z.string().url().optional(),
});

export type CreateUserRequestV1 = z.infer<typeof CreateUserRequestV1>;

export function toCreateUserInput(request: CreateUserRequestV1): CreateUserInput {
    return {
        id: request.id,
        name: request.name,
        email: request.email,
        avatarUrl: request.avatarUrl,
    };
}

