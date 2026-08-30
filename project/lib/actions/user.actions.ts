import { Users } from "@/lib/models/user";

export interface CreateUserInput {
    id: string;
    name: string;
    email?: string;
    avatarUrl?: string;
}

export async function CreateUser(input: CreateUserInput) {
    try {
        await Users.create(input);
        return { success: true as const, message: "User created successfully" };
    } catch (error: any) {
        if (error.code === 11000) {
            return { success: false as const, message: "User already exists", code: "CONFLICT" as const };
        }
        return { success: false as const, message: "Error creating user", code: "INTERNAL_SERVER_ERROR" as const };
    }
}