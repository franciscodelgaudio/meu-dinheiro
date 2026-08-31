import { z } from "zod";
import { Users } from "@/lib/models/user";
import type { IUser } from "@/lib/models/user";

export interface CreateUserInput {
    id: string;
    name: string;
    email?: string;
    avatarUrl?: string;
}

export async function CreateUser(input: CreateUserInput) {
    try {
        await Users.create(input);
        return { success: true as const, message: "User created successfully" };
    } catch (error: any) {
        if (error.code === 11000) {
            return { success: false as const, message: "User already exists", code: "CONFLICT" as const };
        }
        return { success: false as const, message: "Error creating user", code: "INTERNAL_SERVER_ERROR" as const };
    }
}

const ListUsersSchema = z.object({
    offset: z.number().int().min(0).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    search: z.string().optional(),
});

export type ListUsersInput = z.infer<typeof ListUsersSchema>;

type ListUsersResult =
    | { success: true; data: IUser[]; total: number; page: number; totalPages: number; code?: undefined }
    | { success: false; message: string; code: "VALIDATION_ERROR" | "INTERNAL_SERVER_ERROR" };

function escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function ListUsers(input: ListUsersInput = {}): Promise<ListUsersResult> {
    const parsedData = ListUsersSchema.safeParse(input);
    if (!parsedData.success) {
        return { success: false, message: "Invalid query params", code: "VALIDATION_ERROR" };
    }

    const { offset = 0, limit = 10, search } = parsedData.data;

    const match = search
        ? {
            $or: [
                { name: { $regex: escapeRegex(search), $options: "i" } },
                { email: { $regex: escapeRegex(search), $options: "i" } },
            ],
        }
        : {};

    try {
        const [result] = await Users.aggregate([
            { $match: match },
            {
                $facet: {
                    data: [
                        { $sort: { createdAt: -1 } },
                        { $skip: offset },
                        { $limit: limit },
                    ],
                    totalCount: [{ $count: "count" }],
                },
            },
        ]);

        const total = result?.totalCount?.[0]?.count ?? 0;

        return {
            success: true,
            data: result?.data ?? [],
            total,
            page: Math.floor(offset / limit) + 1,
            totalPages: Math.ceil(total / limit),
        };
    } catch {
        return { success: false, message: "Error listing users", code: "INTERNAL_SERVER_ERROR" };
    }
}