import { Users } from "@/lib/models/user";

// Forma estável esperada pelo domínio, independente da versão da API que
// originou a chamada. Já reflete o banco (firstName/lastName); é cada
// contrato de versão que mapeia pra isso antes de chamar CreateUser — o
// split de "name" pra quem ainda fala v1 fica no mapper da v1, não aqui.
export interface CreateUserInput {
    id: string;
    firstName: string;
    lastName: string;
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