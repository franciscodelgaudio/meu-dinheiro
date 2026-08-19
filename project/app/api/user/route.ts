import { NextRequest, NextResponse } from "next/server";
import { CreateUser } from "@/lib/actions/user";

const STATUS_CODES = {
    SUCCESS: 201,
    VALIDATION_ERROR: 422,
    CONFLICT: 409,
    INTERNAL_SERVER_ERROR: 500,
};

export async function POST(request: NextRequest) {
    const data = await request.json();

    const result = await CreateUser(data);

    if (result.success) {
        return NextResponse.json(result, {
            status: STATUS_CODES.SUCCESS,
        });
    }

    return NextResponse.json(result, {
        status: STATUS_CODES[result.code],
    });
}