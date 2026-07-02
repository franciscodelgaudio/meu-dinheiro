import { dbConnect } from "@/lib/mongoose";
import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    expenseGroupId: { type: String, required: true },
    creditCardPurchaseId: { type: String, required: false, default: null },
    installmentNumber: { type: Number, required: false, default: null },
    installmentCount: { type: Number, required: false, default: null },
    spentAt: { type: Date, required: true },
    title: { type: String, required: true },
    amount: { type: Number, required: false, default: 0 },
  },
  { timestamps: true },
);

expenseSchema.index({ userId: 1, spentAt: 1 });
expenseSchema.index({ expenseGroupId: 1 });
expenseSchema.index({ creditCardPurchaseId: 1 });

await dbConnect();

export const Expense = mongoose.models.expense || mongoose.model("expense", expenseSchema);
