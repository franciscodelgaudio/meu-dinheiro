import { z } from "zod";
import { Groups } from "@/lib/models/group";
import { CreateGroupRequestV1 } from "@/lib/contracts/v1/group";

const GroupSchema = CreateGroupRequestV1.extend({
    userId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid userId"),
});

export async function CreateGroup(data: z.infer<typeof GroupSchema>) {

    const parsedData = GroupSchema.safeParse(data);
    if (!parsedData.success) {
        return { success: false as const, message: "Invalid user data", code: "VALIDATION_ERROR" as const };
    }

    const { name, description, date, total, color, userId } = parsedData.data;

    const newGroup = {
        name,
        description,
        date,
        total,
        color,
        userId,
    };

    try {
        await Groups.create(newGroup);
        return { success: true as const, message: "User created successfully" };
    } catch (error: any) {
        if (error.code === 11000) {
            return { success: false as const, message: "User already exists", code: "CONFLICT" as const };
        }
        return { success: false as const, message: "Error creating user", code: "INTERNAL_SERVER_ERROR" as const };
    }
}