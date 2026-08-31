import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocka o model do Mongoose para que o teste seja uma unidade isolada,
// sem conexão real com o banco (dbConnect nunca é chamado).
vi.mock("@/lib/models/cashflow", () => ({
    Cashflows: {
        create: vi.fn(),
        findOne: vi.fn(),
        findOneAndUpdate: vi.fn(),
        findOneAndDelete: vi.fn(),
    },
}));

vi.mock("@/lib/models/group", () => ({
    Groups: {
        findByIdAndUpdate: vi.fn(),
    },
}));

import { Cashflows } from "@/lib/models/cashflow";
import type { ICashflow } from "@/lib/models/cashflow";
import { Groups } from "@/lib/models/group";
import { CreateCashflow, DeleteCashflow, UpdateCashflow } from "@/lib/actions/cashflow.actions";

const mockCreate = vi.mocked(Cashflows.create) as unknown as {
    mockReset: () => void;
    mockResolvedValue: (value: Partial<Record<keyof ICashflow, unknown>> & { _id: string }) => void;
};
const mockFindOne = vi.mocked(Cashflows.findOne);
const mockFindOneAndUpdate = vi.mocked(Cashflows.findOneAndUpdate);
const mockFindOneAndDelete = vi.mocked(Cashflows.findOneAndDelete);
const mockGroupFindByIdAndUpdate = vi.mocked(Groups.findByIdAndUpdate);

const VALID_ID = "665f1c2e2f8b9a0012345679";
const VALID_USER_ID = "665f1c2e2f8b9a0012345677";
const VALID_GROUP_ID = "665f1c2e2f8b9a0012345678";

describe("CreateCashflow", () => {
    beforeEach(() => {
        mockCreate.mockReset();
        mockGroupFindByIdAndUpdate.mockReset();
    });

    it("cria o cashflow sem sincronizar o group quando não há groupId", async () => {
        mockCreate.mockResolvedValue({ _id: VALID_ID, groupId: null, type: "income", total: 500 });

        const result = await CreateCashflow({
            name: "Salário",
            date: new Date("2026-01-15"),
            total: 500,
            type: "income",
            userId: VALID_USER_ID,
        });

        expect(result).toEqual({ success: true, message: "User created successfully" });
        expect(mockGroupFindByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("soma o total ao group quando o cashflow criado pertence a um group", async () => {
        mockCreate.mockResolvedValue({ _id: VALID_ID, groupId: VALID_GROUP_ID, type: "expense", total: 300 });
        mockGroupFindByIdAndUpdate.mockResolvedValue({ _id: VALID_GROUP_ID, total: -300 });

        const result = await CreateCashflow({
            name: "Aluguel",
            date: new Date("2026-01-15"),
            total: 300,
            type: "expense",
            groupId: VALID_GROUP_ID,
            userId: VALID_USER_ID,
        });

        expect(result).toEqual({ success: true, message: "User created successfully" });
        expect(mockGroupFindByIdAndUpdate).toHaveBeenCalledWith(VALID_GROUP_ID, { $inc: { total: -300 } });
    });

    it("retorna NOT_FOUND quando o group do cashflow criado não existe", async () => {
        mockCreate.mockResolvedValue({ _id: VALID_ID, groupId: VALID_GROUP_ID, type: "income", total: 500 });
        mockGroupFindByIdAndUpdate.mockResolvedValue(null);

        const result = await CreateCashflow({
            name: "Salário",
            date: new Date("2026-01-15"),
            total: 500,
            type: "income",
            groupId: VALID_GROUP_ID,
            userId: VALID_USER_ID,
        });

        expect(result).toEqual({ success: false, message: "Group not found", code: "NOT_FOUND" });
    });
});

describe("UpdateCashflow", () => {
    beforeEach(() => {
        mockFindOne.mockReset();
        mockFindOneAndUpdate.mockReset();
        mockGroupFindByIdAndUpdate.mockReset();
    });

    it("retorna VALIDATION_ERROR quando o id do cashflow é inválido", async () => {
        const result = await UpdateCashflow({ id: "id-invalido", userId: VALID_USER_ID, total: 100 });

        expect(result).toEqual({ success: false, message: "Invalid user data", code: "VALIDATION_ERROR" });
        expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
    });

    it("retorna VALIDATION_ERROR quando o userId é inválido", async () => {
        const result = await UpdateCashflow({ id: VALID_ID, userId: "user-invalido", total: 100 });

        expect(result.success).toBe(false);
        expect(result.code).toBe("VALIDATION_ERROR");
        expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
    });

    it("retorna VALIDATION_ERROR quando o type não é 'income' nem 'expense'", async () => {
        const result = await UpdateCashflow({ id: VALID_ID, userId: VALID_USER_ID, type: "invalido" as any });

        expect(result.success).toBe(false);
        expect(result.code).toBe("VALIDATION_ERROR");
        expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
    });

    it("retorna VALIDATION_ERROR quando o total é menor que 1", async () => {
        const result = await UpdateCashflow({ id: VALID_ID, userId: VALID_USER_ID, total: 0 });

        expect(result.success).toBe(false);
        expect(result.code).toBe("VALIDATION_ERROR");
        expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
    });

    it("atualiza os campos informados, filtrando por id e userId, sem permitir alterar o userId", async () => {
        mockFindOne.mockResolvedValue({ _id: VALID_ID, userId: VALID_USER_ID, groupId: null, type: "income", total: 500 });
        mockFindOneAndUpdate.mockResolvedValue({ _id: VALID_ID, userId: VALID_USER_ID, groupId: null, type: "income", total: 750 });

        const result = await UpdateCashflow({
            id: VALID_ID,
            userId: VALID_USER_ID,
            name: "Salário revisado",
            total: 750,
        });

        expect(result).toEqual({ success: true, message: "Cashflow updated successfully" });
        expect(mockFindOneAndUpdate).toHaveBeenCalledTimes(1);

        const [filter, updateFields] = mockFindOneAndUpdate.mock.calls[0] as unknown as [Record<string, unknown>, Record<string, unknown>];
        expect(filter).toEqual({ _id: VALID_ID, userId: VALID_USER_ID });
        expect(updateFields).toEqual({ name: "Salário revisado", total: 750 });
        expect(updateFields).not.toHaveProperty("userId");
        expect(updateFields).not.toHaveProperty("id");
    });

    it("permite atualização parcial de apenas um campo (ex: groupId)", async () => {
        mockFindOne.mockResolvedValue({ _id: VALID_ID, groupId: null, type: "income", total: 500 });
        mockFindOneAndUpdate.mockResolvedValue({ _id: VALID_ID, groupId: null, type: "income", total: 500 });

        await UpdateCashflow({ id: VALID_ID, userId: VALID_USER_ID, groupId: VALID_GROUP_ID });

        const [, updateFields] = mockFindOneAndUpdate.mock.calls[0] as unknown as [Record<string, unknown>, Record<string, unknown>];
        expect(updateFields).toEqual({ groupId: VALID_GROUP_ID });
    });

    it("retorna NOT_FOUND quando nenhum cashflow é encontrado para o id/userId informados", async () => {
        mockFindOne.mockResolvedValue({ _id: VALID_ID, groupId: null, type: "income", total: 500 });
        mockFindOneAndUpdate.mockResolvedValue(null);

        const result = await UpdateCashflow({ id: VALID_ID, userId: VALID_USER_ID, total: 100 });

        expect(result).toEqual({ success: false, message: "Cashflow not found", code: "NOT_FOUND" });
    });

    it("retorna CONFLICT quando o banco lança um erro de chave duplicada (11000)", async () => {
        mockFindOne.mockResolvedValue({ _id: VALID_ID, groupId: null, type: "income", total: 500 });
        mockFindOneAndUpdate.mockRejectedValue({ code: 11000 });

        const result = await UpdateCashflow({ id: VALID_ID, userId: VALID_USER_ID, total: 100 });

        expect(result.success).toBe(false);
        expect(result.code).toBe("CONFLICT");
    });

    it("retorna INTERNAL_SERVER_ERROR quando o banco lança um erro inesperado", async () => {
        mockFindOne.mockResolvedValue({ _id: VALID_ID, groupId: null, type: "income", total: 500 });
        mockFindOneAndUpdate.mockRejectedValue(new Error("connection lost"));

        const result = await UpdateCashflow({ id: VALID_ID, userId: VALID_USER_ID, total: 100 });

        expect(result.success).toBe(false);
        expect(result.code).toBe("INTERNAL_SERVER_ERROR");
    });

    it("sincroniza o total do group quando o cashflow atualizado pertence a um group", async () => {
        mockFindOne.mockResolvedValue({ _id: VALID_ID, groupId: VALID_GROUP_ID, type: "income", total: 500 });
        mockFindOneAndUpdate.mockResolvedValue({ _id: VALID_ID, groupId: VALID_GROUP_ID, type: "income", total: 800 });
        mockGroupFindByIdAndUpdate.mockResolvedValue({ _id: VALID_GROUP_ID, total: 300 });

        const result = await UpdateCashflow({ id: VALID_ID, userId: VALID_USER_ID, total: 800 });

        expect(result).toEqual({ success: true, message: "Cashflow updated successfully" });
        expect(mockGroupFindByIdAndUpdate).toHaveBeenCalledWith(VALID_GROUP_ID, { $inc: { total: 300 } });
    });

    it("retorna NOT_FOUND quando a sincronização do group falha por group inexistente", async () => {
        mockFindOne.mockResolvedValue({ _id: VALID_ID, groupId: VALID_GROUP_ID, type: "income", total: 500 });
        mockFindOneAndUpdate.mockResolvedValue({ _id: VALID_ID, groupId: VALID_GROUP_ID, type: "income", total: 800 });
        mockGroupFindByIdAndUpdate.mockResolvedValue(null);

        const result = await UpdateCashflow({ id: VALID_ID, userId: VALID_USER_ID, total: 800 });

        expect(result).toEqual({ success: false, message: "Group not found", code: "NOT_FOUND" });
    });
});

describe("DeleteCashflow", () => {
    beforeEach(() => {
        mockFindOneAndDelete.mockReset();
        mockGroupFindByIdAndUpdate.mockReset();
    });

    it("retorna VALIDATION_ERROR quando o id do cashflow é inválido", async () => {
        const result = await DeleteCashflow({ id: "id-invalido", userId: VALID_USER_ID });

        expect(result).toEqual({ success: false, message: "Invalid user data", code: "VALIDATION_ERROR" });
        expect(mockFindOneAndDelete).not.toHaveBeenCalled();
    });

    it("retorna VALIDATION_ERROR quando o userId é inválido", async () => {
        const result = await DeleteCashflow({ id: VALID_ID, userId: "user-invalido" });

        expect(result.success).toBe(false);
        expect(result.code).toBe("VALIDATION_ERROR");
        expect(mockFindOneAndDelete).not.toHaveBeenCalled();
    });

    it("remove o cashflow filtrando por id e userId", async () => {
        mockFindOneAndDelete.mockResolvedValue({ _id: VALID_ID, userId: VALID_USER_ID, groupId: null, type: "income", total: 100 });

        const result = await DeleteCashflow({ id: VALID_ID, userId: VALID_USER_ID });

        expect(result).toEqual({ success: true, message: "Cashflow deleted successfully" });
        expect(mockFindOneAndDelete).toHaveBeenCalledTimes(1);

        const [filter] = mockFindOneAndDelete.mock.calls[0] as unknown as [Record<string, unknown>];
        expect(filter).toEqual({ _id: VALID_ID, userId: VALID_USER_ID });
    });

    it("reverte o total do group ao remover um cashflow que pertencia a um group", async () => {
        mockFindOneAndDelete.mockResolvedValue({ _id: VALID_ID, userId: VALID_USER_ID, groupId: VALID_GROUP_ID, type: "expense", total: 300 });
        mockGroupFindByIdAndUpdate.mockResolvedValue({ _id: VALID_GROUP_ID, total: 0 });

        const result = await DeleteCashflow({ id: VALID_ID, userId: VALID_USER_ID });

        expect(result).toEqual({ success: true, message: "Cashflow deleted successfully" });
        expect(mockGroupFindByIdAndUpdate).toHaveBeenCalledWith(VALID_GROUP_ID, { $inc: { total: 300 } });
    });

    it("retorna NOT_FOUND quando nenhum cashflow é encontrado para o id/userId informados", async () => {
        mockFindOneAndDelete.mockResolvedValue(null);

        const result = await DeleteCashflow({ id: VALID_ID, userId: VALID_USER_ID });

        expect(result).toEqual({ success: false, message: "Cashflow not found", code: "NOT_FOUND" });
    });

    it("retorna INTERNAL_SERVER_ERROR quando o banco lança um erro inesperado", async () => {
        mockFindOneAndDelete.mockRejectedValue(new Error("connection lost"));

        const result = await DeleteCashflow({ id: VALID_ID, userId: VALID_USER_ID });

        expect(result.success).toBe(false);
        expect(result.code).toBe("INTERNAL_SERVER_ERROR");
    });
});
