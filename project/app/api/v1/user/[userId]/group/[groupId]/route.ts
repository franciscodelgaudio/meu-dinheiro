import { NextRequest, NextResponse } from "next/server";
import { DeleteGroup, UpdateGroup } from "@/lib/actions/group.actions";
import { UpdateGroupRequestV1, toUpdateGroupInput } from "@/lib/contracts/v1/group";
import { STATUS_CODES } from "@/lib/utils/statusCode";

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string; groupId: string }> }) {

    const { userId, groupId } = await params;
    const body = await request.json();
    const parsedBody = UpdateGroupRequestV1.safeParse(body);

    if (!parsedBody.success) {
        return NextResponse.json(
            { success: false, message: "Invalid group data", code: "VALIDATION_ERROR" },
            { status: STATUS_CODES.VALIDATION_ERROR },
        );
    }

    const result = await UpdateGroup(toUpdateGroupInput(userId, groupId, parsedBody.data));

    if (!result.success) {
        return NextResponse.json(result, { status: STATUS_CODES[result.code] });
    }

    return NextResponse.json(result, { status: 200 });
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string; groupId: string }> }) {

    const { userId, groupId } = await params;

    const result = await DeleteGroup({ id: groupId, userId });

    if (!result.success) {
        return NextResponse.json(result, { status: STATUS_CODES[result.code] });
    }

    return NextResponse.json(result, { status: 200 });
}
