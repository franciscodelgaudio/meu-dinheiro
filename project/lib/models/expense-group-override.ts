import mongoose, { Schema } from "mongoose";

const expenseGroupOverrideSchema = new Schema(
  {
    userId: { type: String, required: true },
    expenseGroupId: { type: String, required: true },
    referenceMonth: { type: String, required: true },
    name: { type: String, required: true },
    monthlyAmount: { type: Number, default: 0 },
    color: { type: String, default: "#18181b" },
    description: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: "expenseGroupOverrides",
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

expenseGroupOverrideSchema.index(
  { expenseGroupId: 1, referenceMonth: 1 },
  { unique: true },
);
expenseGroupOverrideSchema.index({ userId: 1, referenceMonth: 1 });

export const ExpenseGroupOverride =
  mongoose.models.ExpenseGroupOverride ??
  mongoose.model(
    "ExpenseGroupOverride",
    expenseGroupOverrideSchema,
    "expenseGroupOverrides",
  );
