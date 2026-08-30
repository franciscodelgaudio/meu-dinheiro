import { NextResponse } from "next/server";
import { openApiDocumentV1 } from "@/lib/openapi/v1";

export function GET() {
    return NextResponse.json(openApiDocumentV1);
}
