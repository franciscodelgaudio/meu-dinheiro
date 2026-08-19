import { NextRequest, NextResponse } from "next/server";
import { getRedisClient } from "@/lib/redis";
import { STATUS_CODES } from "@/lib/statusCode";

type ErrorCode = Exclude<keyof typeof STATUS_CODES, "SUCCESS">;

export type ActionResult =
    | { success: true; message: string }
    | { success: false; message: string; code: ErrorCode };

type CachedResponse = "processing" | { status: number; body: unknown };

interface IdempotentPostOptions {
    request: NextRequest;
    resource: string;
    ttlSeconds: number;
    handler: () => Promise<ActionResult>;
}

export async function withIdempotency({
    request,
    resource,
    ttlSeconds,
    handler,
}: IdempotentPostOptions): Promise<NextResponse> {

    const idempotencyKey = request.headers.get("Idempotency-Key");

    if (!idempotencyKey) {
        return NextResponse.json(
            { success: false, message: "Idempotency-Key header is required", code: "VALIDATION_ERROR" },
            { status: STATUS_CODES.VALIDATION_ERROR },
        );
    }

    const cacheKey = `idempotency:${resource}:${idempotencyKey}`;
    const redis = await getRedisClient();

    const claimed = await redis.set(cacheKey, "processing", {
        nx: true,
        ex: ttlSeconds,
    });

    if (!claimed) {
        // If the key is already set, it means the request is already in progress
        const cached = await redis.get<CachedResponse>(cacheKey);

        if (cached === "processing") {
            return NextResponse.json(
                { success: false, message: "Request already in progress", code: "CONFLICT" },
                { status: STATUS_CODES.CONFLICT },
            );
        }

        const { status, body } = cached!;
        return NextResponse.json(body, { status });
    }

    try {
        const result = await handler();
        const status = result.success ? STATUS_CODES.SUCCESS : STATUS_CODES[result.code];

        await redis.set(cacheKey, { status, body: result }, {
            ex: ttlSeconds,
        });

        return NextResponse.json(result, { status });
    } catch (error) {
        await redis.del(cacheKey);
        return NextResponse.json(
            { success: false, message: `Error creating ${resource}`, code: "INTERNAL_SERVER_ERROR" },
            { status: STATUS_CODES.INTERNAL_SERVER_ERROR },
        );
    }
}
