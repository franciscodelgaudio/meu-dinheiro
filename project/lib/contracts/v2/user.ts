import { z } from "zod";
import type { CreateUserInput } from "@/lib/actions/user";

export const CreateUserRequestV2 = z.object({
    id: z.string().min(1),
    firstName: z.string().max(255),
    lastName: z.string().max(255),
    email: z.string().email().optional(),
    avatarUrl: z.string().url().optional(),
});

export type CreateUserRequestV2 = z.infer<typeof CreateUserRequestV2>;

export function toCreateUserInput(request: CreateUserRequestV2): CreateUserInput {
    return {
        id: request.id,
        firstName: request.firstName,
        lastName: request.lastName,
        email: request.email,
        avatarUrl: request.avatarUrl,
    };
}