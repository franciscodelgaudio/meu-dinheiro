import mongoose, { Schema } from "mongoose";

const savingsAllocationSchema = new Schema(
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
    collection: "savingsAllocations",
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

savingsAllocationSchema.index(
  { userId: 1, referenceMonth: 1 },
  { unique: true },
);

export const SavingsAllocation =
  mongoose.models.SavingsAllocation ??
  mongoose.model(
    "SavingsAllocation",
    savingsAllocationSchema,
    "savingsAllocations",
  );
