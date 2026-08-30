import { NextRequest } from "next/server";
import { CreateGroup } from "@/lib/actions/group.actions";
import { withIdempotency } from "@/lib/idempotency";
import { CreateGroupRequestV1, toCreateGroupInput } from "@/lib/contracts/v1/group";

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
            const body = await request.json();
            const parsedBody = CreateGroupRequestV1.safeParse(body);

            if (!parsedBody.success) {
                return { success: false as const, message: "Invalid group data", code: "VALIDATION_ERROR" as const };
            }

            return CreateGroup(toCreateGroupInput(userId, parsedBody.data));
        },
    });
}
