import { NextRequest } from "next/server";
import { CreateGroup } from "@/lib/actions/group";
import { withIdempotency } from "@/lib/idempotency";

const IDEMPOTENCY_KEY_TTL_SECONDS = 60; // 1 minute in seconds

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }) {

    return withIdempotency({
        request,
        resource: "group",
        ttlSeconds: IDEMPOTENCY_KEY_TTL_SECONDS,
        handler: async () => {
            const { userId } = await params;
            const data = await request.json();
            return CreateGroup({ ...data, userId });
        },
    });
}
