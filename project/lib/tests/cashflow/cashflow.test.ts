import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocka o model do Mongoose para que o teste seja uma unidade isolada,
// sem conexão real com o banco (dbConnect nunca é chamado).
vi.mock("@/lib/models/cashflow", () => ({
    Cashflows: {
        aggregate: vi.fn(),
    },
}));

import { Cashflows } from "@/lib/models/cashflow";
import { applyCashflowToTotal, computeCashflowBalance } from "@/lib/services/cashflow";
import type { ICashflow } from "@/lib/models/cashflow";

const mockAggregate = vi.mocked(Cashflows.aggregate);

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

describe("computeCashflowBalance", () => {
    const VALID_USER_ID = "665f1c2e2f8b9a0012345677";

    beforeEach(() => {
        mockAggregate.mockReset();
    });

    it("retorna VALIDATION_ERROR quando o userId é inválido", async () => {
        const result = await computeCashflowBalance("id-invalido");

        expect(result).toEqual({ success: false, message: "Invalid userId", code: "VALIDATION_ERROR" });
        expect(mockAggregate).not.toHaveBeenCalled();
    });

    it("soma os lançamentos do tipo income e subtrai os do tipo expense", async () => {
        mockAggregate.mockResolvedValue([{ income: 1500, expense: 400 }]);

        const result = await computeCashflowBalance(VALID_USER_ID);

        expect(result).toEqual({ success: true, income: 1500, expense: 400, balance: 1100 });
    });

    it("retorna tudo zerado quando o usuário não possui nenhum cashflow", async () => {
        mockAggregate.mockResolvedValue([]);

        const result = await computeCashflowBalance(VALID_USER_ID);

        expect(result).toEqual({ success: true, income: 0, expense: 0, balance: 0 });
    });

    it("filtra a pipeline pelo userId informado", async () => {
        mockAggregate.mockResolvedValue([{ income: 100, expense: 50 }]);

        await computeCashflowBalance(VALID_USER_ID);

        expect(mockAggregate).toHaveBeenCalledTimes(1);

        const [pipeline] = mockAggregate.mock.calls[0] as unknown as [Record<string, Record<string, unknown>>[]];
        const matchStage = pipeline[0].$match as { userId: { toString(): string } };
        expect(matchStage.userId.toString()).toBe(VALID_USER_ID);
    });

    it("agrupa somando income e expense separadamente com base no campo type", async () => {
        mockAggregate.mockResolvedValue([{ income: 100, expense: 50 }]);

        await computeCashflowBalance(VALID_USER_ID);

        const [pipeline] = mockAggregate.mock.calls[0] as unknown as [Record<string, Record<string, unknown>>[]];
        const groupStage = pipeline[1].$group;

        expect(groupStage.income).toEqual({ $sum: { $cond: [{ $eq: ["$type", "income"] }, "$total", 0] } });
        expect(groupStage.expense).toEqual({ $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$total", 0] } });
    });

    it("retorna INTERNAL_SERVER_ERROR quando a aggregation lança um erro", async () => {
        mockAggregate.mockRejectedValue(new Error("connection lost"));

        const result = await computeCashflowBalance(VALID_USER_ID);

        expect(result).toEqual({ success: false, message: "Error computing cashflow balance", code: "INTERNAL_SERVER_ERROR" });
    });
});
