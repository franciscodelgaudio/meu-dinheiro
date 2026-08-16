import { dbConnect } from "@/lib/handler/db";
import mongoose from "mongoose";

export interface IUser {
    name: string;
    email: string | null;
    avatarUrl: string | null;
}

const userSchema = new mongoose.Schema<IUser>(
    {
        name: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: false,
            default: null,
        },
        avatarUrl: {
            type: String,
            required: false,
            default: null,
        },
    },
    { timestamps: true },
);

await dbConnect();

export const Users =
    mongoose.models.users || mongoose.model<IUser>("users", userSchema);
