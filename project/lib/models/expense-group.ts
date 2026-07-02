import { dbConnect } from "@/lib/mongoose";
import mongoose from "mongoose";

const expenseGroupSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    referenceMonth: { type: String, required: true },
    name: { type: String, required: true },
    monthlyAmount: { type: Number, required: false, default: 0 },
    affectsFutureMonths: { type: Boolean, required: false, default: false },
    repeatMonths: { type: String, required: false, default: null },
    color: { type: String, required: false, default: "#18181b" },
    description: { type: String, required: false, default: null },
  },
  { timestamps: true },
);

expenseGroupSchema.index({ userId: 1, referenceMonth: 1 });

await dbConnect();

export const ExpenseGroup =
  mongoose.models.expensegroup || mongoose.model("expensegroup", expenseGroupSchema);
