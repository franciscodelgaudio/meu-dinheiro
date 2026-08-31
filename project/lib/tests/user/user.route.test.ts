import { beforeEach, describe, expect, it, vi } from "vitest";

// Teste de integração: exercita o handler GET real da rota junto com a
// ListUsers real (nenhuma delas é mockada). Só a fronteira externa é
// mockada: o model do Mongoose (sem conexão real com o banco) e o
// rate limiter (que dependeria de credenciais reais do Redis/Upstash
// só usadas pelo POST desta mesma rota).
vi.mock("server-only", () => ({}));

vi.mock("@/lib/rateLimit", () => ({
    getRateLimiter: vi.fn(),
    getClientIp: vi.fn(),
}));

vi.mock("@/lib/models/user", () => ({
    Users: {
        aggregate: vi.fn(),
    },
}));

import { NextRequest } from "next/server";
import { Users } from "@/lib/models/user";
import { GET } from "@/app/api/v1/user/route";

const mockAggregate = vi.mocked(Users.aggregate);

function makeAggregateResult(data: unknown[], count: number) {
    return [{ data, totalCount: count > 0 ? [{ count }] : [] }];
}

function makeRequest(query: string) {
    return new NextRequest(`http://localhost/api/v1/user${query}`);
}

describe("GET /api/v1/user", () => {
    beforeEach(() => {
        mockAggregate.mockReset();
    });

    it("retorna a primeira página com os defaults (page=1, limit=10) quando nenhum query param é informado", async () => {
        const users = [{ id: "usr_1", name: "Ada Lovelace" }];
        mockAggregate.mockResolvedValue(makeAggregateResult(users, 1));

        const response = await GET(makeRequest(""));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ data: users, total: 1, page: 1, totalPages: 1 });

        const [pipeline] = mockAggregate.mock.calls[0] as unknown as [Record<string, unknown>[]];
        const facetStage = pipeline[1].$facet as { data: Record<string, unknown>[] };
        expect(facetStage.data).toContainEqual({ $skip: 0 });
        expect(facetStage.data).toContainEqual({ $limit: 10 });
        expect(facetStage.data).toContainEqual({ $sort: { createdAt: -1 } });
    });

    it("converte page e limit da query string em offset para a ListUsers", async () => {
        mockAggregate.mockResolvedValue(makeAggregateResult([], 0));

        await GET(makeRequest("?page=3&limit=5"));

        const [pipeline] = mockAggregate.mock.calls[0] as unknown as [Record<string, unknown>[]];
        const facetStage = pipeline[1].$facet as { data: Record<string, unknown>[] };
        expect(facetStage.data).toContainEqual({ $skip: 10 });
        expect(facetStage.data).toContainEqual({ $limit: 5 });
    });

    it("repassa o search da query string para o filtro de nome/email da aggregation", async () => {
        mockAggregate.mockResolvedValue(makeAggregateResult([], 0));

        await GET(makeRequest("?search=ada"));

        const [pipeline] = mockAggregate.mock.calls[0] as unknown as [Record<string, unknown>[]];
        const matchStage = pipeline[0].$match as { $or: Record<string, unknown>[] };
        expect(matchStage.$or).toEqual([
            { name: { $regex: "ada", $options: "i" } },
            { email: { $regex: "ada", $options: "i" } },
        ]);
    });

    it("retorna lista vazia com status 200 quando não há usuários", async () => {
        mockAggregate.mockResolvedValue(makeAggregateResult([], 0));

        const response = await GET(makeRequest(""));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ data: [], total: 0, page: 1, totalPages: 0 });
    });

    it("retorna 500 com o código INTERNAL_SERVER_ERROR quando a aggregation falha", async () => {
        mockAggregate.mockRejectedValue(new Error("connection lost"));

        const response = await GET(makeRequest(""));
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body).toEqual({ success: false, message: "Error listing users", code: "INTERNAL_SERVER_ERROR" });
    });

    it("ignora limit inválido (fora do range) e usa o default 10", async () => {
        mockAggregate.mockResolvedValue(makeAggregateResult([], 0));

        await GET(makeRequest("?limit=1000"));

        const [pipeline] = mockAggregate.mock.calls[0] as unknown as [Record<string, unknown>[]];
        const facetStage = pipeline[1].$facet as { data: Record<string, unknown>[] };
        expect(facetStage.data).toContainEqual({ $limit: 10 });
    });
});
