import { NextRequest, NextResponse } from "next/server";
import { CreateUser, ListUsers } from "@/lib/actions/user.actions";
import { CreateUserRequestV1, toCreateUserInput, UserQueryParamsV1 } from "@/lib/contracts/v1/user";
import { getRateLimiter, getClientIp } from "@/lib/rateLimit";
import { STATUS_CODES } from "@/lib/utils/statusCode";

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

export async function GET(request: NextRequest) {
    const pageAux = request.nextUrl.searchParams.get("page");
    const limitAux = request.nextUrl.searchParams.get("limit");
    const searchAux = request.nextUrl.searchParams.get("search");

    // searchParams.get() devolve null quando ausente; z.optional() só aceita
    // undefined, então precisa normalizar antes do parse.
    const { data: parsedParams } = UserQueryParamsV1.safeParse({
        page: pageAux ?? undefined,
        limit: limitAux ?? undefined,
        search: searchAux ?? undefined,
    });

    const page = parsedParams?.page ?? 1;
    const limit = parsedParams?.limit ?? 10;

    const result = await ListUsers({
        offset: (page - 1) * limit,
        limit,
        search: parsedParams?.search,
    });

    if (!result.success) {
        return NextResponse.json(result, { status: STATUS_CODES[result.code] });
    }

    return NextResponse.json({
        data: JSON.parse(JSON.stringify(result.data)),
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
    });
}