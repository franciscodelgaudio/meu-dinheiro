import { z } from "zod";
import { Cashflows } from "@/lib/models/cashflow";

const CashflowSchema = z.object({
    name: z.string().max(255),
    description: z.string().max(500).optional(),
    date: z.date(),
    total: z.number().min(1),
    groupId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid groupId").optional(),
    userId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid userId"),
});

export async function CreateCashflow(data: z.infer<typeof CashflowSchema>) {

    const parsedData = CashflowSchema.safeParse(data);
    if (!parsedData.success) {
        return { success: false as const, message: "Invalid user data", code: "VALIDATION_ERROR" as const };
    }

    const { name, description, date, total, groupId, userId } = parsedData.data;

    const newGroup = {
        name,
        description,
        date,
        total,
        groupId,
        userId,
    };

    try {
        await Cashflows.create(newGroup);
        return { success: true as const, message: "User created successfully" };
    } catch (error: any) {
        if (error.code === 11000) {
            return { success: false as const, message: "User already exists", code: "CONFLICT" as const };
        }
        return { success: false as const, message: "Error creating user", code: "INTERNAL_SERVER_ERROR" as const };
    }
}