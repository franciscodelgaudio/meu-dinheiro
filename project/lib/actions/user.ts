import { z } from "zod";
import { Users } from "@/lib/models/user";

const UserSchema = z.object({
    id: z.string().min(1),
    name: z.string().max(255),
    email: z.string().email().optional(),
    avatarUrl: z.string().url().optional(),
});

export async function CreateUser(data: z.infer<typeof UserSchema>) {

    const parsedData = UserSchema.safeParse(data);
    if (!parsedData.success) {
        return { success: false as const, message: "Invalid user data", code: "VALIDATION_ERROR" as const };
    }

    const { id, name, email, avatarUrl } = parsedData.data;

    const newUser = {
        id,
        name,
        email,
        avatarUrl,
    }

    try {
        await Users.create(newUser);
        return { success: true as const, message: "User created successfully" };
    } catch (error: any) {
        if (error.code === 11000) {
            return { success: false as const, message: "User already exists", code: "CONFLICT" as const };
        }
        return { success: false as const, message: "Error creating user", code: "INTERNAL_SERVER_ERROR" as const };
    }
}