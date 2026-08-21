import { dbConnect } from "@/lib/handler/db";
import mongoose from "mongoose";

export interface IUser {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    avatarUrl: string | null;
}

const userSchema = new mongoose.Schema<IUser>(
    {
        id: {
            type: String,
            required: true,
        },
        firstName: {
            type: String,
            required: true,
        },
        lastName: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: false,
            default: null,
            unique: true,
            sparse: true,
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
