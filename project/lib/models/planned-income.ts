import mongoose, { Schema } from "mongoose";

const plannedIncomeSchema = new Schema(
  {
    userId: { type: String, required: true },
    referenceMonth: { type: String, required: true },
    amount: { type: Number, default: 0 },
    affectsFutureMonths: { type: Boolean, default: false },
    repeatMonths: { type: String, default: null },
    description: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: "plannedIncomes",
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

plannedIncomeSchema.index({ userId: 1, referenceMonth: 1 });

export const PlannedIncome =
  mongoose.models.PlannedIncome ??
  mongoose.model("PlannedIncome", plannedIncomeSchema, "plannedIncomes");

// Drop the old unique index that previously existed on userId+referenceMonth.
// Multiple planned incomes per month are now allowed.
PlannedIncome.collection.dropIndex("userId_1_referenceMonth_1").catch(() => {});
