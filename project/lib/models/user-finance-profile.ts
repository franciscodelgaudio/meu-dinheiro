import mongoose, { Schema } from "mongoose";

const userFinanceProfileSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true },
    monthlyIncome: { type: Number, default: 0 },
    currency: { type: String, default: "BRL" },
    paydayStart: { type: Number, default: null },
    paydayEnd: { type: Number, default: null },
    notes: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: "userFinanceProfiles",
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

export const UserFinanceProfile =
  mongoose.models.UserFinanceProfile ??
  mongoose.model(
    "UserFinanceProfile",
    userFinanceProfileSchema,
    "userFinanceProfiles",
  );
