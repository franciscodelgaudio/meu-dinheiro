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
