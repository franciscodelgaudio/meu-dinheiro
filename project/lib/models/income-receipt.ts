import mongoose, { Schema } from "mongoose";

const incomeReceiptSchema = new Schema(
  {
    userId: { type: String, required: true },
    referenceMonth: { type: String, required: true },
    receivedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: "incomeReceipts",
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

incomeReceiptSchema.index(
  { userId: 1, referenceMonth: 1 },
  { unique: true },
);

export const IncomeReceipt =
  mongoose.models.IncomeReceipt ??
  mongoose.model("IncomeReceipt", incomeReceiptSchema, "incomeReceipts");
