import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocka o model do Mongoose para que o teste seja uma unidade isolada,
// sem conexão real com o banco (dbConnect nunca é chamado).
vi.mock("@/lib/models/group", () => ({
    Groups: {
        findOneAndUpdate: vi.fn(),
        findOneAndDelete: vi.fn(),
    },
}));

import { Groups } from "@/lib/models/group";
import { DeleteGroup, UpdateGroup } from "@/lib/actions/group.actions";

const mockFindOneAndUpdate = vi.mocked(Groups.findOneAndUpdate);
const mockFindOneAndDelete = vi.mocked(Groups.findOneAndDelete);

const VALID_ID = "665f1c2e2f8b9a0012345679";
const VALID_USER_ID = "665f1c2e2f8b9a0012345677";

describe("UpdateGroup", () => {
    beforeEach(() => {
        mockFindOneAndUpdate.mockReset();
    });

    it("retorna VALIDATION_ERROR quando o id do grupo é inválido", async () => {
        const result = await UpdateGroup({ id: "id-invalido", userId: VALID_USER_ID, total: 100 });

        expect(result).toEqual({ success: false, message: "Invalid user data", code: "VALIDATION_ERROR" });
        expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
    });

    it("retorna VALIDATION_ERROR quando o userId é inválido", async () => {
        const result = await UpdateGroup({ id: VALID_ID, userId: "user-invalido", total: 100 });

        expect(result.success).toBe(false);
        expect(result.code).toBe("VALIDATION_ERROR");
        expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
    });

    it("retorna VALIDATION_ERROR quando o total é menor que 1", async () => {
        const result = await UpdateGroup({ id: VALID_ID, userId: VALID_USER_ID, total: 0 });

        expect(result.success).toBe(false);
        expect(result.code).toBe("VALIDATION_ERROR");
        expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
    });

    it("atualiza os campos informados, filtrando por id e userId, sem permitir alterar o userId", async () => {
        mockFindOneAndUpdate.mockResolvedValue({ _id: VALID_ID, userId: VALID_USER_ID, total: 2000 });

        const result = await UpdateGroup({
            id: VALID_ID,
            userId: VALID_USER_ID,
            name: "Viagem revisada",
            total: 2000,
        });

        expect(result).toEqual({ success: true, message: "Group updated successfully" });
        expect(mockFindOneAndUpdate).toHaveBeenCalledTimes(1);

        const [filter, updateFields] = mockFindOneAndUpdate.mock.calls[0] as unknown as [Record<string, unknown>, Record<string, unknown>];
        expect(filter).toEqual({ _id: VALID_ID, userId: VALID_USER_ID });
        expect(updateFields).toEqual({ name: "Viagem revisada", total: 2000 });
        expect(updateFields).not.toHaveProperty("userId");
        expect(updateFields).not.toHaveProperty("id");
    });

    it("permite atualização parcial de apenas um campo (ex: color)", async () => {
        mockFindOneAndUpdate.mockResolvedValue({ _id: VALID_ID });

        await UpdateGroup({ id: VALID_ID, userId: VALID_USER_ID, color: "#ff0000" });

        const [, updateFields] = mockFindOneAndUpdate.mock.calls[0] as unknown as [Record<string, unknown>, Record<string, unknown>];
        expect(updateFields).toEqual({ color: "#ff0000" });
    });

    it("retorna NOT_FOUND quando nenhum grupo é encontrado para o id/userId informados", async () => {
        mockFindOneAndUpdate.mockResolvedValue(null);

        const result = await UpdateGroup({ id: VALID_ID, userId: VALID_USER_ID, total: 100 });

        expect(result).toEqual({ success: false, message: "Group not found", code: "NOT_FOUND" });
    });

    it("retorna CONFLICT quando o banco lança um erro de chave duplicada (11000)", async () => {
        mockFindOneAndUpdate.mockRejectedValue({ code: 11000 });

        const result = await UpdateGroup({ id: VALID_ID, userId: VALID_USER_ID, total: 100 });

        expect(result.success).toBe(false);
        expect(result.code).toBe("CONFLICT");
    });

    it("retorna INTERNAL_SERVER_ERROR quando o banco lança um erro inesperado", async () => {
        mockFindOneAndUpdate.mockRejectedValue(new Error("connection lost"));

        const result = await UpdateGroup({ id: VALID_ID, userId: VALID_USER_ID, total: 100 });

        expect(result.success).toBe(false);
        expect(result.code).toBe("INTERNAL_SERVER_ERROR");
    });
});

describe("DeleteGroup", () => {
    beforeEach(() => {
        mockFindOneAndDelete.mockReset();
    });

    it("retorna VALIDATION_ERROR quando o id do group é inválido", async () => {
        const result = await DeleteGroup({ id: "id-invalido", userId: VALID_USER_ID });

        expect(result).toEqual({ success: false, message: "Invalid user data", code: "VALIDATION_ERROR" });
        expect(mockFindOneAndDelete).not.toHaveBeenCalled();
    });

    it("retorna VALIDATION_ERROR quando o userId é inválido", async () => {
        const result = await DeleteGroup({ id: VALID_ID, userId: "user-invalido" });

        expect(result.success).toBe(false);
        expect(result.code).toBe("VALIDATION_ERROR");
        expect(mockFindOneAndDelete).not.toHaveBeenCalled();
    });

    it("remove o group filtrando por id e userId", async () => {
        mockFindOneAndDelete.mockResolvedValue({ _id: VALID_ID, userId: VALID_USER_ID });

        const result = await DeleteGroup({ id: VALID_ID, userId: VALID_USER_ID });

        expect(result).toEqual({ success: true, message: "Group deleted successfully" });
        expect(mockFindOneAndDelete).toHaveBeenCalledTimes(1);

        const [filter] = mockFindOneAndDelete.mock.calls[0] as unknown as [Record<string, unknown>];
        expect(filter).toEqual({ _id: VALID_ID, userId: VALID_USER_ID });
    });

    it("retorna NOT_FOUND quando nenhum group é encontrado para o id/userId informados", async () => {
        mockFindOneAndDelete.mockResolvedValue(null);

        const result = await DeleteGroup({ id: VALID_ID, userId: VALID_USER_ID });

        expect(result).toEqual({ success: false, message: "Group not found", code: "NOT_FOUND" });
    });

    it("retorna INTERNAL_SERVER_ERROR quando o banco lança um erro inesperado", async () => {
        mockFindOneAndDelete.mockRejectedValue(new Error("connection lost"));

        const result = await DeleteGroup({ id: VALID_ID, userId: VALID_USER_ID });

        expect(result.success).toBe(false);
        expect(result.code).toBe("INTERNAL_SERVER_ERROR");
    });
});
