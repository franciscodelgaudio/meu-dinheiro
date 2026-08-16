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

    date: [
      {
        month: {
          type: String,
          required: true,
        },
        year: {
          type: Number,
          required: true,
        },
      },
    ],

    total: {
      type: Number,
      required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },

    color: {
      type: String,
      required: false,
      default: "#18181b",
    },
  },
  { timestamps: true },
);

groupSchema.index({ userId: 1, referenceMonth: 1 });

await dbConnect();

export const Groups =
  mongoose.models.groups || mongoose.model<IGroup>("groups", groupSchema);
