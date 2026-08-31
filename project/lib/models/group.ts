import { dbConnect } from "@/lib/handler/db";
import mongoose from "mongoose";

export interface IGroup {
  name: string;
  description: string | null;
  date: {
    month: string;
    year: number;
  }[];
  total: number;
  color: string | null;
  userId: mongoose.Types.ObjectId;
}

const groupSchema = new mongoose.Schema<IGroup>(
  {
    name: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      required: false,
      default: null,
    },

    total: {
      type: Number,
      required: true,
    },

    color: {
      type: String,
      required: false,
      default: "#18181b",
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },

  },
  { timestamps: true },
);

groupSchema.index({ userId: 1 });

await dbConnect();

export const Groups =
  mongoose.models.groups || mongoose.model<IGroup>("groups", groupSchema);
