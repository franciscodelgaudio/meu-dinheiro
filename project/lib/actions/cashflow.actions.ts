import { z } from "zod";
import { Cashflows } from "@/lib/models/cashflow";
import { CreateCashflowRequestV1 } from "@/lib/contracts/v1/cashflow";

const CashflowSchema = CreateCashflowRequestV1.extend({
    userId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid userId"),
});

export async function CreateCashflow(data: z.infer<typeof CashflowSchema>) {

    const parsedData = CashflowSchema.safeParse(data);
    if (!parsedData.success) {
        return { success: false as const, message: "Invalid user data", code: "VALIDATION_ERROR" as const };
    }

    const { name, description, date, total, type, groupId, userId } = parsedData.data;

    const newGroup = {
        name,
        description,
        date,
        total,
        type,
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

const UpdateCashflowSchema = CreateCashflowRequestV1.partial().extend({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id"),
    userId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid userId"),
});

export async function UpdateCashflow(data: z.infer<typeof UpdateCashflowSchema>) {

    const parsedData = UpdateCashflowSchema.safeParse(data);
    if (!parsedData.success) {
        return { success: false as const, message: "Invalid user data", code: "VALIDATION_ERROR" as const };
    }

    const { id, userId, ...updateFields } = parsedData.data;

    try {
        const updated = await Cashflows.findOneAndUpdate({ _id: id, userId }, updateFields, { new: true });

        if (!updated) {
            return { success: false as const, message: "Cashflow not found", code: "NOT_FOUND" as const };
        }

        return { success: true as const, message: "Cashflow updated successfully" };
    } catch (error: any) {
        if (error.code === 11000) {
            return { success: false as const, message: "Cashflow already exists", code: "CONFLICT" as const };
        }
        return { success: false as const, message: "Error updating cashflow", code: "INTERNAL_SERVER_ERROR" as const };
    }
}