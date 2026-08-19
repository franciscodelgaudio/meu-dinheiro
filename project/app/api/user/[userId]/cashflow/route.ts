import { NextRequest } from "next/server";
import { CreateCashflow } from "@/lib/actions/cashflow";
import { withIdempotency } from "@/lib/idempotency";

const IDEMPOTENCY_KEY_TTL_SECONDS = 60 * 60; // 1 hour in seconds

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }) {

    return withIdempotency({
        request,
        resource: "cashflow",
        ttlSeconds: IDEMPOTENCY_KEY_TTL_SECONDS,
        handler: async () => {
            const { id: userId } = await params;
            const data = await request.json();
            return CreateCashflow({ ...data, userId });
        },
    });
}
