import { z } from "zod";
import { Users } from "@/lib/models/user";

const UserSchema = z.object({
    id: z.string().uuid(),
    name: z.string().max(255),
    email: z.string().email().optional(),
    avatarUrl: z.string().url().optional(),
});

export async function CreateUser(data: z.infer<typeof UserSchema>) {

    const parsedData = UserSchema.safeParse(data);
    if (!parsedData.success) {
        return { success: false, message: "Invalid user data" };
    }

    const { name, email, avatarUrl } = parsedData.data;

    const newUser = {
        name,
        email,
        avatarUrl,
    }

    try {
        await Users.create({ newUser });
        return { success: true, message: "User created successfully" };
    } catch (error) {
        return { success: false, message: "Error creating user" };
    }
}