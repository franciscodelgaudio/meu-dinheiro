import { NextRequest, NextResponse } from "next/server";
import { Cashflows } from "@/lib/models/cashflow";
import { CreateCashflow } from "@/lib/actions/cashflow.actions";
import { withIdempotency } from "@/lib/idempotency";
import { CashflowQueryParamsV1, CreateCashflowRequestV1, toCreateCashflowInput } from "@/lib/contracts/v1/cashflow";
import mongoose from "mongoose";
import { z } from "zod";

const IDEMPOTENCY_KEY_TTL_SECONDS = 60; // 1 minute in seconds

function escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Cursor por nome precisa carregar nome + _id (empate no nome é
// desfeito pelo _id).
const nameCursorSchema = z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/),
    name: z.string(),
});

function parseNameCursor(cursor: string): { id: string; name: string } | null {
    try {
        const parsed = nameCursorSchema.safeParse(JSON.parse(cursor));
        return parsed.success ? parsed.data : null;
    } catch {
        return null;
    }
}

// Idem para groupId, que também pode ser null (cashflow sem grupo).
const groupCursorSchema = z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/),
    groupId: z.string().regex(/^[0-9a-fA-F]{24}$/).nullable(),
});

function parseGroupCursor(cursor: string): { id: string; groupId: string | null } | null {
    try {
        const parsed = groupCursorSchema.safeParse(JSON.parse(cursor));
        return parsed.success ? parsed.data : null;
    } catch {
        return null;
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }) {

    return withIdempotency({
        request,
        resource: "cashflow",
        ttlSeconds: IDEMPOTENCY_KEY_TTL_SECONDS,
        handler: async () => {
            const { userId } = await params;
            const body = await request.json();
            const parsedBody = CreateCashflowRequestV1.safeParse(body);

            if (!parsedBody.success) {
                return { success: false as const, message: "Invalid cashflow data", code: "VALIDATION_ERROR" as const };
            }

            return CreateCashflow(toCreateCashflowInput(userId, parsedBody.data));
        },
    });
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }) {

    const cursor = request.nextUrl.searchParams.get("cursor");

    const limitAux = request.nextUrl.searchParams.get("limit");
    const typeAux = request.nextUrl.searchParams.get("type");
    const searchAux = request.nextUrl.searchParams.get("search");
    const sortAux = request.nextUrl.searchParams.get("sort");
    const sortByAux = request.nextUrl.searchParams.get("sortBy");

    // searchParams.get() devolve null quando ausente; z.optional() só aceita
    // undefined, então precisa normalizar antes do parse.
    const { data: parsedParams } = CashflowQueryParamsV1.safeParse({
        limit: limitAux ?? undefined,
        type: typeAux ?? undefined,
        search: searchAux ?? undefined,
        sort: sortAux ?? undefined,
        sortBy: sortByAux ?? undefined,
    });

    const limit = parsedParams?.limit ?? 10;

    // Direção do sort também define o operador do cursor: em ordem crescente
    // a próxima página tem valor maior, em decrescente tem valor menor.
    const sortDirection: 1 | -1 = parsedParams?.sort === "asc" ? 1 : -1;
    const cursorOp = sortDirection === 1 ? "$gt" : "$lt";
    const sortByName = parsedParams?.sortBy === "name";
    const sortByGroup = parsedParams?.sortBy === "groupId";

    const filters: Record<string, unknown>[] = [
        { userId: new mongoose.Types.ObjectId((await params).userId) },
    ];

    if (parsedParams?.type) {
        filters.push({ type: parsedParams.type });
    }

    if (parsedParams?.search) {
        filters.push({ name: { $regex: escapeRegex(parsedParams.search), $options: "i" } });
    }

    if (cursor) {
        if (sortByName) {
            const decoded = parseNameCursor(cursor);
            if (decoded) {
                // Empate no nome é desfeito pelo _id, senão registros com o
                // mesmo nome ficam repetidos ou somem entre páginas.
                filters.push({
                    $or: [
                        { name: { [cursorOp]: decoded.name } },
                        { name: decoded.name, _id: { [cursorOp]: new mongoose.Types.ObjectId(decoded.id) } },
                    ],
                });
            }
        } else if (sortByGroup) {
            const decoded = parseGroupCursor(cursor);
            if (decoded) {
                const decodedGroupId = decoded.groupId ? new mongoose.Types.ObjectId(decoded.groupId) : null;
                // Empate no groupId é desfeito pelo _id; null é o menor valor
                // possível na ordem do BSON, então itens sem grupo já ficam
                // corretamente de um lado sem tratamento especial.
                filters.push({
                    $or: [
                        { groupId: { [cursorOp]: decodedGroupId } },
                        { groupId: decodedGroupId, _id: { [cursorOp]: new mongoose.Types.ObjectId(decoded.id) } },
                    ],
                });
            }
        } else {
            filters.push({ _id: { [cursorOp]: new mongoose.Types.ObjectId(cursor) } });
        }
    }

    const sortStage: Record<string, 1 | -1> = sortByName
        ? { name: sortDirection, _id: sortDirection }
        : sortByGroup
            ? { groupId: sortDirection, _id: sortDirection }
            : { _id: sortDirection };

    const cashflows = await Cashflows.aggregate([
        { $match: { $and: filters } },
        { $sort: sortStage },
        { $limit: limit + 1 }
    ])

    const hasNextPage = cashflows.length > limit;
    const data = hasNextPage ? cashflows.slice(0, limit) : cashflows;
    const last = data[data.length - 1];
    const nextCursor = hasNextPage
        ? sortByName
            ? JSON.stringify({ id: String(last._id), name: last.name })
            : sortByGroup
                ? JSON.stringify({ id: String(last._id), groupId: last.groupId ? String(last.groupId) : null })
                : last._id
        : null;

    return NextResponse.json({
        data: JSON.parse(JSON.stringify(data)),
        hasNextPage,
        nextCursor,
    });
}