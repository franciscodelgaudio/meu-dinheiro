import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocka o model do Mongoose para que o teste seja uma unidade isolada,
// sem conexão real com o banco (dbConnect nunca é chamado).
vi.mock("@/lib/models/cashflow", () => ({
    Cashflows: {
        aggregate: vi.fn(),
    },
}));

vi.mock("@/lib/models/group", () => ({
    Groups: {
        findByIdAndUpdate: vi.fn(),
    },
}));

import { Cashflows } from "@/lib/models/cashflow";
import { Groups } from "@/lib/models/group";
import {
    applyCashflowToTotal,
    computeCashflowBalance,
    syncGroupTotalOnCashflowChange,
} from "@/lib/services/cashflow";
import type { ICashflow } from "@/lib/models/cashflow";
import type { CashflowGroupSnapshot } from "@/lib/services/cashflow";

const mockAggregate = vi.mocked(Cashflows.aggregate);
const mockFindByIdAndUpdate = vi.mocked(Groups.findByIdAndUpdate);

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

describe("syncGroupTotalOnCashflowChange", () => {
    const GROUP_ID = "665f1c2e2f8b9a0012345678";
    const OTHER_GROUP_ID = "665f1c2e2f8b9a001234567a";

    beforeEach(() => {
        mockFindByIdAndUpdate.mockReset();
    });

    function makeSnapshot(overrides: Partial<CashflowGroupSnapshot> = {}): CashflowGroupSnapshot {
        return {
            groupId: null,
            type: "income",
            total: 0,
            ...overrides,
        };
    }

    it("não chama o banco quando não há cashflow anterior nem novo", async () => {
        const result = await syncGroupTotalOnCashflowChange(null, null);

        expect(result).toEqual({ success: true });
        expect(mockFindByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("não chama o banco na criação de um cashflow sem group", async () => {
        const next = makeSnapshot({ groupId: null, type: "income", total: 100 });

        const result = await syncGroupTotalOnCashflowChange(null, next);

        expect(result).toEqual({ success: true });
        expect(mockFindByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("soma o total ao group na criação de um cashflow do tipo income", async () => {
        mockFindByIdAndUpdate.mockResolvedValue({ _id: GROUP_ID, total: 600 });
        const next = makeSnapshot({ groupId: GROUP_ID, type: "income", total: 500 });

        const result = await syncGroupTotalOnCashflowChange(null, next);

        expect(result).toEqual({ success: true });
        expect(mockFindByIdAndUpdate).toHaveBeenCalledTimes(1);
        expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(GROUP_ID, { $inc: { total: 500 } });
    });

    it("subtrai o total do group na criação de um cashflow do tipo expense", async () => {
        mockFindByIdAndUpdate.mockResolvedValue({ _id: GROUP_ID, total: 700 });
        const next = makeSnapshot({ groupId: GROUP_ID, type: "expense", total: 300 });

        const result = await syncGroupTotalOnCashflowChange(null, next);

        expect(result).toEqual({ success: true });
        expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(GROUP_ID, { $inc: { total: -300 } });
    });

    it("reverte (subtrai) o total do group ao deletar um cashflow que era income", async () => {
        mockFindByIdAndUpdate.mockResolvedValue({ _id: GROUP_ID, total: 100 });
        const previous = makeSnapshot({ groupId: GROUP_ID, type: "income", total: 500 });

        const result = await syncGroupTotalOnCashflowChange(previous, null);

        expect(result).toEqual({ success: true });
        expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(GROUP_ID, { $inc: { total: -500 } });
    });

    it("reverte (soma) o total do group ao deletar um cashflow que era expense", async () => {
        mockFindByIdAndUpdate.mockResolvedValue({ _id: GROUP_ID, total: 400 });
        const previous = makeSnapshot({ groupId: GROUP_ID, type: "expense", total: 300 });

        const result = await syncGroupTotalOnCashflowChange(previous, null);

        expect(result).toEqual({ success: true });
        expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(GROUP_ID, { $inc: { total: 300 } });
    });

    it("não chama o banco ao deletar um cashflow que não pertencia a nenhum group", async () => {
        const previous = makeSnapshot({ groupId: null, type: "expense", total: 300 });

        const result = await syncGroupTotalOnCashflowChange(previous, null);

        expect(result).toEqual({ success: true });
        expect(mockFindByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("aplica um único $inc líquido quando o group não muda na edição", async () => {
        mockFindByIdAndUpdate.mockResolvedValue({ _id: GROUP_ID, total: 300 });
        const previous = makeSnapshot({ groupId: GROUP_ID, type: "income", total: 500 });
        const next = makeSnapshot({ groupId: GROUP_ID, type: "expense", total: 200 });

        const result = await syncGroupTotalOnCashflowChange(previous, next);

        expect(result).toEqual({ success: true });
        expect(mockFindByIdAndUpdate).toHaveBeenCalledTimes(1);
        expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(GROUP_ID, { $inc: { total: -700 } });
    });

    it("ajusta os dois groups quando o cashflow é movido de um group para outro", async () => {
        mockFindByIdAndUpdate.mockResolvedValue({ _id: GROUP_ID, total: 0 });
        const previous = makeSnapshot({ groupId: GROUP_ID, type: "income", total: 500 });
        const next = makeSnapshot({ groupId: OTHER_GROUP_ID, type: "income", total: 500 });

        const result = await syncGroupTotalOnCashflowChange(previous, next);

        expect(result).toEqual({ success: true });
        expect(mockFindByIdAndUpdate).toHaveBeenCalledTimes(2);
        expect(mockFindByIdAndUpdate).toHaveBeenNthCalledWith(1, GROUP_ID, { $inc: { total: -500 } });
        expect(mockFindByIdAndUpdate).toHaveBeenNthCalledWith(2, OTHER_GROUP_ID, { $inc: { total: 500 } });
    });

    it("remove o efeito do group antigo quando o cashflow deixa de pertencer a um group", async () => {
        mockFindByIdAndUpdate.mockResolvedValue({ _id: GROUP_ID, total: 0 });
        const previous = makeSnapshot({ groupId: GROUP_ID, type: "income", total: 500 });
        const next = makeSnapshot({ groupId: null, type: "income", total: 500 });

        const result = await syncGroupTotalOnCashflowChange(previous, next);

        expect(result).toEqual({ success: true });
        expect(mockFindByIdAndUpdate).toHaveBeenCalledTimes(1);
        expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(GROUP_ID, { $inc: { total: -500 } });
    });

    it("aplica o efeito no novo group quando o cashflow passa a pertencer a um group", async () => {
        mockFindByIdAndUpdate.mockResolvedValue({ _id: GROUP_ID, total: 0 });
        const previous = makeSnapshot({ groupId: null, type: "expense", total: 300 });
        const next = makeSnapshot({ groupId: GROUP_ID, type: "expense", total: 300 });

        const result = await syncGroupTotalOnCashflowChange(previous, next);

        expect(result).toEqual({ success: true });
        expect(mockFindByIdAndUpdate).toHaveBeenCalledTimes(1);
        expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(GROUP_ID, { $inc: { total: -300 } });
    });

    it("retorna NOT_FOUND quando o group não é encontrado", async () => {
        mockFindByIdAndUpdate.mockResolvedValue(null);
        const next = makeSnapshot({ groupId: GROUP_ID, type: "income", total: 500 });

        const result = await syncGroupTotalOnCashflowChange(null, next);

        expect(result).toEqual({ success: false, message: "Group not found", code: "NOT_FOUND" });
    });

    it("retorna INTERNAL_SERVER_ERROR quando o banco lança um erro inesperado", async () => {
        mockFindByIdAndUpdate.mockRejectedValue(new Error("connection lost"));
        const next = makeSnapshot({ groupId: GROUP_ID, type: "income", total: 500 });

        const result = await syncGroupTotalOnCashflowChange(null, next);

        expect(result.success).toBe(false);
        expect(result.code).toBe("INTERNAL_SERVER_ERROR");
    });

    it("não tenta ajustar o novo group se a reversão no group antigo já falhar", async () => {
        mockFindByIdAndUpdate.mockRejectedValueOnce(new Error("connection lost"));
        const previous = makeSnapshot({ groupId: GROUP_ID, type: "income", total: 500 });
        const next = makeSnapshot({ groupId: OTHER_GROUP_ID, type: "income", total: 500 });

        const result = await syncGroupTotalOnCashflowChange(previous, next);

        expect(result.success).toBe(false);
        expect(mockFindByIdAndUpdate).toHaveBeenCalledTimes(1);
    });
});
