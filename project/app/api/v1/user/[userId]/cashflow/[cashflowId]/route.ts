import { NextRequest, NextResponse } from "next/server";
import { UpdateCashflow } from "@/lib/actions/cashflow.actions";
import { UpdateCashflowRequestV1, toUpdateCashflowInput } from "@/lib/contracts/v1/cashflow";
import { STATUS_CODES } from "@/lib/utils/statusCode";

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string; cashflowId: string }> }) {

    const { userId, cashflowId } = await params;
    const body = await request.json();
    const parsedBody = UpdateCashflowRequestV1.safeParse(body);

    if (!parsedBody.success) {
        return NextResponse.json(
            { success: false, message: "Invalid cashflow data", code: "VALIDATION_ERROR" },
            { status: STATUS_CODES.VALIDATION_ERROR },
        );
    }

    const result = await UpdateCashflow(toUpdateCashflowInput(userId, cashflowId, parsedBody.data));

    if (!result.success) {
        return NextResponse.json(result, { status: STATUS_CODES[result.code] });
    }

    return NextResponse.json(result, { status: 200 });
}
