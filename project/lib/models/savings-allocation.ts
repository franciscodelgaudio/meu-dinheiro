import { dbConnect } from "@/lib/mongoose";
import mongoose from "mongoose";

const savingsAllocationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    referenceMonth: { type: String, required: true },
    amount: { type: Number, required: false, default: 0 },
    affectsFutureMonths: { type: Boolean, required: false, default: false },
    repeatMonths: { type: String, required: false, default: null },
    description: { type: String, required: false, default: null },
  },
  { timestamps: true },
);

savingsAllocationSchema.index({ userId: 1, referenceMonth: 1 }, { unique: true });

await dbConnect();

export const SavingsAllocation =
  mongoose.models.savingsallocation ||
  mongoose.model("savingsallocation", savingsAllocationSchema);
