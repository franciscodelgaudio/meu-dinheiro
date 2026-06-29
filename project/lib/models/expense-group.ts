import mongoose, { Schema } from "mongoose";

const expenseGroupSchema = new Schema(
  {
    userId: { type: String, required: true },
    referenceMonth: { type: String, required: true },
    name: { type: String, required: true },
    monthlyAmount: { type: Number, default: 0 },
    affectsFutureMonths: { type: Boolean, default: false },
    repeatMonths: { type: String, default: null },
    color: { type: String, default: "#18181b" },
    description: { type: String, default: null },
    priority: { type: String, default: "medium" },
  },
  {
    timestamps: true,
    collection: "expenseGroups",
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

expenseGroupSchema.index({ userId: 1, referenceMonth: 1 });

export const ExpenseGroup =
  mongoose.models.ExpenseGroup ??
  mongoose.model("ExpenseGroup", expenseGroupSchema, "expenseGroups");
