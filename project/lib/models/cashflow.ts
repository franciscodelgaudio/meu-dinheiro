import { dbConnect } from "@/lib/handler/db";
import mongoose from "mongoose";

export interface ICashflow {
  name: string;
  description: string | null;
  date: Date;
  total: number;
  groupId: mongoose.Types.ObjectId | null;
  userId: mongoose.Types.ObjectId;
}

const cashflowSchema = new mongoose.Schema<ICashflow>(
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

    date: {
      type: Date,
      default: Date.now,
    },

    total: {
      type: Number,
      required: true,
    },

    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "groups",
      default: null,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },

  },
  { timestamps: true },
);

cashflowSchema.index({ groupId: 1, userId: 1 });

await dbConnect();

export const Cashflows =
  mongoose.models.cashflows || mongoose.model<ICashflow>("cashflows", cashflowSchema);
