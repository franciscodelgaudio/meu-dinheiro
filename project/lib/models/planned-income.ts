import { dbConnect } from "@/lib/mongoose";
import mongoose from "mongoose";

const plannedIncomeSchema = new mongoose.Schema(
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

plannedIncomeSchema.index({ userId: 1, referenceMonth: 1 });

await dbConnect();

export const PlannedIncome =
  mongoose.models.plannedincome || mongoose.model("plannedincome", plannedIncomeSchema);

// Drop the old unique index that previously existed on userId+referenceMonth.
// Multiple planned incomes per month are now allowed.
PlannedIncome.collection.dropIndex("userId_1_referenceMonth_1").catch(() => {});
