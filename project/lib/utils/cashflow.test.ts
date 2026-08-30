import { describe, expect, it } from "vitest";
import { applyCashflowToTotal } from "@/lib/utils/cashflow";
import type { ICashflow } from "@/lib/models/cashflow";

type CashflowInput = Pick<ICashflow, "type" | "total">;

function makeCashflow(overrides: Partial<CashflowInput>): CashflowInput {
    return {
        type: "income",
        total: 0,
        ...overrides,
    };
}

describe("applyCashflowToTotal", () => {
    it("soma o valor ao total quando o tipo for income", () => {
        const cashflow = makeCashflow({ type: "income", total: 500 });

        expect(applyCashflowToTotal(1000, cashflow)).toBe(1500);
    });

    it("subtrai o valor do total quando o tipo for expense", () => {
        const cashflow = makeCashflow({ type: "expense", total: 300 });

        expect(applyCashflowToTotal(1000, cashflow)).toBe(700);
    });

    it("permite que o total resultante fique negativo quando a despesa for maior que o total atual", () => {
        const cashflow = makeCashflow({ type: "expense", total: 1500 });

        expect(applyCashflowToTotal(1000, cashflow)).toBe(-500);
    });

    it("lida com total inicial igual a zero", () => {
        const income = makeCashflow({ type: "income", total: 250 });
        const expense = makeCashflow({ type: "expense", total: 250 });

        expect(applyCashflowToTotal(0, income)).toBe(250);
        expect(applyCashflowToTotal(0, expense)).toBe(-250);
    });

    it("lida com valores decimais sem erro de arredondamento perceptível", () => {
        const cashflow = makeCashflow({ type: "expense", total: 19.99 });

        expect(applyCashflowToTotal(100, cashflow)).toBeCloseTo(80.01, 2);
    });

    it("acumula corretamente ao aplicar vários lançamentos em sequência", () => {
        const cashflows: CashflowInput[] = [
            makeCashflow({ type: "income", total: 1000 }),
            makeCashflow({ type: "expense", total: 200 }),
            makeCashflow({ type: "income", total: 50 }),
            makeCashflow({ type: "expense", total: 850 }),
        ];

        const finalTotal = cashflows.reduce(
            (total, cashflow) => applyCashflowToTotal(total, cashflow),
            0,
        );

        expect(finalTotal).toBe(0);
    });

    it("lança um erro quando o tipo do cashflow não for 'income' nem 'expense'", () => {
        const cashflow = makeCashflow({ type: "invalid" as ICashflow["type"], total: 100 });

        expect(() => applyCashflowToTotal(1000, cashflow)).toThrow();
    });
});
