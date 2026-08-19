import { NextRequest, NextResponse } from "next/server";
import { CreateGroup } from "@/lib/actions/group";
import { getRedisClient } from "@/lib/redis";

const STATUS_CODES = {
    SUCCESS: 201,
    VALIDATION_ERROR: 422,
    CONFLICT: 409,
    INTERNAL_SERVER_ERROR: 500,
};

const IDEMPOTENCY_KEY_TTL_SECONDS = 60;

export async function POST(request: NextRequest) {
    const idempotencyKey = request.headers.get("Idempotency-Key");
    const cacheKey = idempotencyKey ? `idempotency:group:${idempotencyKey}` : null;
    const redis = cacheKey ? await getRedisClient() : null;

    if (redis && cacheKey) {
        const claimed = await redis.set(cacheKey, "pending", {
            nx: true,
            ex: IDEMPOTENCY_KEY_TTL_SECONDS,
        });

        if (!claimed) {
            const cached = await redis.get<"pending" | { status: number; body: unknown }>(cacheKey);

            if (cached === "pending") {
                return NextResponse.json(
                    { success: false, message: "Request already in progress", code: "CONFLICT" },
                    { status: STATUS_CODES.CONFLICT },
                );
            }

            const { status, body } = cached!;
            return NextResponse.json(body, { status });
        }
    }

    const data = await request.json();
    const result = await CreateGroup(data);
    const status = result.success ? STATUS_CODES.SUCCESS : STATUS_CODES[result.code];

    if (redis && cacheKey) {
        await redis.set(cacheKey, { status, body: result }, {
            ex: IDEMPOTENCY_KEY_TTL_SECONDS,
        });
    }

    return NextResponse.json(result, { status });
}