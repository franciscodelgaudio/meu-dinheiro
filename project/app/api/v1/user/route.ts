import { NextRequest, NextResponse } from "next/server";
import { CreateUser } from "@/lib/actions/user";
import { CreateUserRequestV1, toCreateUserInput } from "@/lib/contracts/v1/user";
import { getRateLimiter, getClientIp } from "@/lib/rateLimit";
import { STATUS_CODES } from "@/lib/statusCode";

// Cria usuário é uma rota sem autenticação (ainda não temos auth), por isso
// o limite é por IP para conter abuso/flood de criação de contas.
const RATE_LIMIT = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60;

export async function POST(request: NextRequest) {
    const ratelimit = await getRateLimiter({
        key: "user:create",
        limit: RATE_LIMIT,
        windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    });

    const { success: allowed, reset } = await ratelimit.limit(getClientIp(request));

    if (!allowed) {
        const retryAfterSeconds = Math.max(0, Math.ceil((reset - Date.now()) / 1000));

        return NextResponse.json(
            { success: false, message: "Too many requests", code: "TOO_MANY_REQUESTS" },
            {
                status: STATUS_CODES.TOO_MANY_REQUESTS,
                headers: { "Retry-After": String(retryAfterSeconds) },
            },
        );
    }

    const body = await request.json();
    const parsedBody = CreateUserRequestV1.safeParse(body);

    if (!parsedBody.success) {
        return NextResponse.json(
            { success: false, message: "Invalid user data", code: "VALIDATION_ERROR" },
            { status: STATUS_CODES.VALIDATION_ERROR },
        );
    }

    const result = await CreateUser(toCreateUserInput(parsedBody.data));

    if (result.success) {
        return NextResponse.json(result, {
            status: STATUS_CODES.SUCCESS,
        });
    }

    return NextResponse.json(result, {
        status: STATUS_CODES[result.code],
    });
}