import { dbConnect } from "@/lib/mongoose";
import mongoose from "mongoose";

const incomeReceiptSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    referenceMonth: { type: String, required: true },
    receivedAt: { type: Date, required: false, default: Date.now },
  },
  { timestamps: true },
);

incomeReceiptSchema.index({ userId: 1, referenceMonth: 1 }, { unique: true });

await dbConnect();

export const IncomeReceipt =
  mongoose.models.incomereceipt || mongoose.model("incomereceipt", incomeReceiptSchema);
