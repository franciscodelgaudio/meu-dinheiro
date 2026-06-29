import mongoose, { Schema } from "mongoose";

const extraIncomeSchema = new Schema(
  {
    userId: { type: String, required: true },
    referenceMonth: { type: String, required: true },
    name: { type: String, required: true },
    amount: { type: Number, default: 0 },
    receivedDay: { type: Number, default: null },
    description: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: "extraIncomes",
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

extraIncomeSchema.index({ userId: 1, referenceMonth: 1 });

export const ExtraIncome =
  mongoose.models.ExtraIncome ??
  mongoose.model("ExtraIncome", extraIncomeSchema, "extraIncomes");
