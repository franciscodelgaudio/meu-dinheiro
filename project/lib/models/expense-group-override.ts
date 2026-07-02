import { dbConnect } from "@/lib/mongoose";
import mongoose from "mongoose";

const expenseGroupOverrideSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    expenseGroupId: { type: String, required: true },
    referenceMonth: { type: String, required: true },
    name: { type: String, required: true },
    monthlyAmount: { type: Number, required: false, default: 0 },
    color: { type: String, required: false, default: "#18181b" },
    description: { type: String, required: false, default: null },
  },
  { timestamps: true },
);

expenseGroupOverrideSchema.index(
  { expenseGroupId: 1, referenceMonth: 1 },
  { unique: true },
);
expenseGroupOverrideSchema.index({ userId: 1, referenceMonth: 1 });

await dbConnect();

export const ExpenseGroupOverride =
  mongoose.models.expensegroupoverride ||
  mongoose.model("expensegroupoverride", expenseGroupOverrideSchema);
