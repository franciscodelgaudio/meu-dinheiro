import mongoose, { Schema } from "mongoose";

const expenseSchema = new Schema(
  {
    userId: { type: String, required: true },
    expenseGroupId: { type: String, required: true },
    creditCardPurchaseId: { type: String, default: null },
    installmentNumber: { type: Number, default: null },
    installmentCount: { type: Number, default: null },
    spentAt: { type: Date, required: true },
    title: { type: String, required: true },
    amount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: "expenses",
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

expenseSchema.index({ userId: 1, spentAt: 1 });
expenseSchema.index({ expenseGroupId: 1 });
expenseSchema.index({ creditCardPurchaseId: 1 });

export const Expense =
  mongoose.models.Expense ??
  mongoose.model("Expense", expenseSchema, "expenses");
