import type { ICashflow } from "@/lib/models/cashflow";

type CashflowInput = Pick<ICashflow, "type" | "total">;

export function applyCashflowToTotal(total: number, cashflow: CashflowInput): number {
    return 0;
}
