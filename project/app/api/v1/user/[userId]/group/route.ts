import { NextRequest, NextResponse } from "next/server";
import { CreateGroup } from "@/lib/actions/group.actions";
import { withIdempotency } from "@/lib/idempotency";
import { CreateGroupRequestV1, GroupQueryParamsV1, toCreateGroupInput } from "@/lib/contracts/v1/group";
import { Groups } from "@/lib/models/group";
import mongoose from "mongoose";

const IDEMPOTENCY_KEY_TTL_SECONDS = 60; // 1 minute in seconds

function escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }) {

    return withIdempotency({
        request,
        resource: "group",
        ttlSeconds: IDEMPOTENCY_KEY_TTL_SECONDS,
        handler: async () => {
            const { userId } = await params;
            const body = await request.json();
            const parsedBody = CreateGroupRequestV1.safeParse(body);

            if (!parsedBody.success) {
                return { success: false as const, message: "Invalid group data", code: "VALIDATION_ERROR" as const };
            }

            return CreateGroup(toCreateGroupInput(userId, parsedBody.data));
        },
    });
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }) {

    const { userId } = await params;

    const pageAux = request.nextUrl.searchParams.get("page");
    const limitAux = request.nextUrl.searchParams.get("limit");
    const searchAux = request.nextUrl.searchParams.get("search");
    const sortAux = request.nextUrl.searchParams.get("sort");
    const sortByAux = request.nextUrl.searchParams.get("sortBy");

    // searchParams.get() devolve null quando ausente; z.optional() só aceita
    // undefined, então precisa normalizar antes do parse.
    const { data: parsedParams } = GroupQueryParamsV1.safeParse({
        page: pageAux ?? undefined,
        limit: limitAux ?? undefined,
        search: searchAux ?? undefined,
        sort: sortAux ?? undefined,
        sortBy: sortByAux ?? undefined,
    });

    const page = parsedParams?.page ?? 1;
    const limit = parsedParams?.limit ?? 10;
    const sortDirection: 1 | -1 = parsedParams?.sort === "asc" ? 1 : -1;
    const sortBy = parsedParams?.sortBy ?? "createdAt";

    const filters: Record<string, unknown>[] = [
        { userId: new mongoose.Types.ObjectId(userId) },
    ];

    if (parsedParams?.search) {
        filters.push({ name: { $regex: escapeRegex(parsedParams.search), $options: "i" } });
    }

    const [result] = await Groups.aggregate([
        { $match: { $and: filters } },
        {
            $facet: {
                data: [
                    { $sort: { [sortBy]: sortDirection, _id: sortDirection } },
                    { $skip: (page - 1) * limit },
                    { $limit: limit },
                ],
                totalCount: [{ $count: "count" }],
            },
        },
    ]);

    const total = result.totalCount[0]?.count ?? 0;

    return NextResponse.json({
        data: JSON.parse(JSON.stringify(result.data)),
        total,
        page,
        totalPages: Math.ceil(total / limit),
    });
}
