import { NextRequest, NextResponse } from "next/server";
import { CreateUser } from "@/lib/actions/user";

export async function POST(request: NextRequest) {
    const data = await request.json();
    const result = await CreateUser(data);
    return NextResponse.json(result);
}