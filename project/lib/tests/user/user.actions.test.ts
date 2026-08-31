import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocka o model do Mongoose para que o teste seja uma unidade isolada,
// sem conexão real com o banco (dbConnect nunca é chamado).
vi.mock("@/lib/models/user", () => ({
    Users: {
        aggregate: vi.fn(),
    },
}));

import { Users } from "@/lib/models/user";
import { ListUsers } from "@/lib/actions/user.actions";

const mockAggregate = vi.mocked(Users.aggregate);

function makeAggregateResult(data: unknown[], count: number) {
    return [{ data, totalCount: count > 0 ? [{ count }] : [] }];
}

describe("ListUsers", () => {
    beforeEach(() => {
        mockAggregate.mockReset();
    });

    it("retorna VALIDATION_ERROR quando offset é negativo", async () => {
        const result = await ListUsers({ offset: -1 });

        expect(result).toEqual({ success: false, message: "Invalid query params", code: "VALIDATION_ERROR" });
        expect(mockAggregate).not.toHaveBeenCalled();
    });

    it("retorna VALIDATION_ERROR quando limit é menor que 1", async () => {
        const result = await ListUsers({ limit: 0 });

        expect(result.success).toBe(false);
        expect(result.code).toBe("VALIDATION_ERROR");
        expect(mockAggregate).not.toHaveBeenCalled();
    });

    it("retorna VALIDATION_ERROR quando limit é maior que 100", async () => {
        const result = await ListUsers({ limit: 101 });

        expect(result.success).toBe(false);
        expect(result.code).toBe("VALIDATION_ERROR");
        expect(mockAggregate).not.toHaveBeenCalled();
    });

    it("usa offset 0 e limit 10 como padrão quando nenhum parâmetro é informado", async () => {
        mockAggregate.mockResolvedValue(makeAggregateResult([], 0));

        await ListUsers();

        const [pipeline] = mockAggregate.mock.calls[0] as unknown as [Record<string, unknown>[]];
        const facetStage = pipeline[1].$facet as { data: Record<string, unknown>[] };
        expect(facetStage.data).toContainEqual({ $skip: 0 });
        expect(facetStage.data).toContainEqual({ $limit: 10 });
    });

    it("aplica offset e limit informados na paginação", async () => {
        mockAggregate.mockResolvedValue(makeAggregateResult([], 0));

        await ListUsers({ offset: 20, limit: 5 });

        const [pipeline] = mockAggregate.mock.calls[0] as unknown as [Record<string, unknown>[]];
        const facetStage = pipeline[1].$facet as { data: Record<string, unknown>[] };
        expect(facetStage.data).toContainEqual({ $skip: 20 });
        expect(facetStage.data).toContainEqual({ $limit: 5 });
    });

    it("ordena por createdAt decrescente", async () => {
        mockAggregate.mockResolvedValue(makeAggregateResult([], 0));

        await ListUsers();

        const [pipeline] = mockAggregate.mock.calls[0] as unknown as [Record<string, unknown>[]];
        const facetStage = pipeline[1].$facet as { data: Record<string, unknown>[] };
        expect(facetStage.data).toContainEqual({ $sort: { createdAt: -1 } });
    });

    it("não aplica filtro de busca quando search não é informado", async () => {
        mockAggregate.mockResolvedValue(makeAggregateResult([], 0));

        await ListUsers();

        const [pipeline] = mockAggregate.mock.calls[0] as unknown as [Record<string, unknown>[]];
        const matchStage = pipeline[0].$match;
        expect(matchStage).toEqual({});
    });

    it("filtra por nome OU email (case-insensitive) quando search é informado", async () => {
        mockAggregate.mockResolvedValue(makeAggregateResult([], 0));

        await ListUsers({ search: "ada" });

        const [pipeline] = mockAggregate.mock.calls[0] as unknown as [Record<string, unknown>[]];
        const matchStage = pipeline[0].$match as { $or: Record<string, unknown>[] };
        expect(matchStage.$or).toEqual([
            { name: { $regex: "ada", $options: "i" } },
            { email: { $regex: "ada", $options: "i" } },
        ]);
    });

    it("escapa caracteres especiais de regex no termo de busca", async () => {
        mockAggregate.mockResolvedValue(makeAggregateResult([], 0));

        await ListUsers({ search: "a.d+a" });

        const [pipeline] = mockAggregate.mock.calls[0] as unknown as [Record<string, unknown>[]];
        const matchStage = pipeline[0].$match as { $or: { name: { $regex: string } }[] };
        expect(matchStage.$or[0].name.$regex).toBe("a\\.d\\+a");
    });

    it("retorna os usuários, total e cálculo de página/totalPages no caminho de sucesso", async () => {
        const users = [{ id: "usr_1", name: "Ada Lovelace" }, { id: "usr_2", name: "Alan Turing" }];
        mockAggregate.mockResolvedValue(makeAggregateResult(users, 42));

        const result = await ListUsers({ offset: 20, limit: 10 });

        expect(result).toEqual({
            success: true,
            data: users,
            total: 42,
            page: 3,
            totalPages: 5,
        });
    });

    it("retorna lista vazia, total 0 e página 1 quando não há usuários", async () => {
        mockAggregate.mockResolvedValue(makeAggregateResult([], 0));

        const result = await ListUsers();

        expect(result).toEqual({
            success: true,
            data: [],
            total: 0,
            page: 1,
            totalPages: 0,
        });
    });

    it("retorna INTERNAL_SERVER_ERROR quando a aggregation lança um erro", async () => {
        mockAggregate.mockRejectedValue(new Error("connection lost"));

        const result = await ListUsers();

        expect(result).toEqual({ success: false, message: "Error listing users", code: "INTERNAL_SERVER_ERROR" });
    });
});
