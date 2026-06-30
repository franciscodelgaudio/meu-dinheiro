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

plannedIncomeSchema.index({ userId: 1, referenceMonth: 1 }, { unique: true });

export const PlannedIncome =
  mongoose.models.PlannedIncome ??
  mongoose.model("PlannedIncome", plannedIncomeSchema, "plannedIncomes");
