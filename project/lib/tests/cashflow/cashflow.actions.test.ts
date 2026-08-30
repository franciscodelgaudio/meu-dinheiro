import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocka o model do Mongoose para que o teste seja uma unidade isolada,
// sem conexão real com o banco (dbConnect nunca é chamado).
vi.mock("@/lib/models/cashflow", () => ({
    Cashflows: {
        findOneAndUpdate: vi.fn(),
    },
}));

import { Cashflows } from "@/lib/models/cashflow";
import { UpdateCashflow } from "@/lib/actions/cashflow.actions";

const mockFindOneAndUpdate = vi.mocked(Cashflows.findOneAndUpdate);

const VALID_ID = "665f1c2e2f8b9a0012345679";
const VALID_USER_ID = "665f1c2e2f8b9a0012345677";
const VALID_GROUP_ID = "665f1c2e2f8b9a0012345678";

describe("UpdateCashflow", () => {
    beforeEach(() => {
        mockFindOneAndUpdate.mockReset();
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
        mockFindOneAndUpdate.mockResolvedValue({ _id: VALID_ID, userId: VALID_USER_ID, total: 750 });

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
        mockFindOneAndUpdate.mockResolvedValue({ _id: VALID_ID });

        await UpdateCashflow({ id: VALID_ID, userId: VALID_USER_ID, groupId: VALID_GROUP_ID });

        const [, updateFields] = mockFindOneAndUpdate.mock.calls[0] as unknown as [Record<string, unknown>, Record<string, unknown>];
        expect(updateFields).toEqual({ groupId: VALID_GROUP_ID });
    });

    it("retorna NOT_FOUND quando nenhum cashflow é encontrado para o id/userId informados", async () => {
        mockFindOneAndUpdate.mockResolvedValue(null);

        const result = await UpdateCashflow({ id: VALID_ID, userId: VALID_USER_ID, total: 100 });

        expect(result).toEqual({ success: false, message: "Cashflow not found", code: "NOT_FOUND" });
    });

    it("retorna CONFLICT quando o banco lança um erro de chave duplicada (11000)", async () => {
        mockFindOneAndUpdate.mockRejectedValue({ code: 11000 });

        const result = await UpdateCashflow({ id: VALID_ID, userId: VALID_USER_ID, total: 100 });

        expect(result.success).toBe(false);
        expect(result.code).toBe("CONFLICT");
    });

    it("retorna INTERNAL_SERVER_ERROR quando o banco lança um erro inesperado", async () => {
        mockFindOneAndUpdate.mockRejectedValue(new Error("connection lost"));

        const result = await UpdateCashflow({ id: VALID_ID, userId: VALID_USER_ID, total: 100 });

        expect(result.success).toBe(false);
        expect(result.code).toBe("INTERNAL_SERVER_ERROR");
    });
});
