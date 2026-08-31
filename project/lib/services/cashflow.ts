import mongoose from "mongoose";
import { z } from "zod";
import { Cashflows } from "@/lib/models/cashflow";
import { Groups } from "@/lib/models/group";
import type { ICashflow } from "@/lib/models/cashflow";

type CashflowInput = Pick<ICashflow, "type" | "total">;

export function applyCashflowToTotal(total: number, cashflow: CashflowInput): number {
    switch (cashflow.type) {
        case "income":
            return total + cashflow.total;
        case "expense":
            return total - cashflow.total;
        default:
            throw new Error(`Invalid cashflow type: ${cashflow.type}`);
    }
}

export type CashflowGroupSnapshot = {
    groupId: string | null;
    type: "income" | "expense";
    total: number;
};

type SyncGroupTotalResult =
    | { success: true; code?: undefined }
    | { success: false; message: string; code: "NOT_FOUND" | "INTERNAL_SERVER_ERROR" };

export async function syncGroupTotalOnCashflowChange(
    previous: CashflowGroupSnapshot | null,
    next: CashflowGroupSnapshot | null,
): Promise<SyncGroupTotalResult> {
    throw new Error("Not implemented");
}

type ComputeCashflowBalanceResult =
    | { success: true; income: number; expense: number; balance: number }
    | { success: false; message: string; code: "VALIDATION_ERROR" | "INTERNAL_SERVER_ERROR" };

const ComputeCashflowBalanceSchema = z.object({
    userId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid userId"),
});

export async function computeCashflowBalance(userId: string): Promise<ComputeCashflowBalanceResult> {
    const parsedData = ComputeCashflowBalanceSchema.safeParse({ userId });
    if (!parsedData.success) {
        return { success: false, message: "Invalid userId", code: "VALIDATION_ERROR" };
    }

    try {
        const [result] = await Cashflows.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(parsedData.data.userId) } },
            {
                $group: {
                    _id: null,
                    income: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$total", 0] } },
                    expense: { $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$total", 0] } },
                },
            },
        ]);

        const income = result?.income ?? 0;
        const expense = result?.expense ?? 0;

        return { success: true, income, expense, balance: income - expense };
    } catch {
        return { success: false, message: "Error computing cashflow balance", code: "INTERNAL_SERVER_ERROR" };
    }
}
