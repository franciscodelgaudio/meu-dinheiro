import { NextRequest, NextResponse } from "next/server";
import { Cashflows } from "@/lib/models/cashflow";
import mongoose from "mongoose";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
    { searchParams }: { searchParams: URLSearchParams }) {

    const limitAux = searchParams.get("limit");
    const limit = limitAux ? parseInt(limitAux) + 1 : 10;
    const cursor = searchParams.get("cursor");

    const cashflows = await Cashflows.aggregate([{
        $match: {
            userId: new mongoose.Types.ObjectId((await params).id),
        },
        $sort: {
            _id: -1,
            createdAt: -1
        },
        $limit: limit,
    }])

    const hasNextPage = cashflows.length > limit;

    const data = hasNextPage
        ? cashflows.slice(0, 20)
        : cashflows;

    return NextResponse.json(JSON.parse(JSON.stringify(data)));
}