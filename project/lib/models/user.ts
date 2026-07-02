import mongoose, { Schema } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, default: null },
    email: { type: String, unique: true, sparse: true, default: null },
    emailVerified: { type: Date, default: null },
    image: { type: String, default: null },
    currency: { type: String, default: "BRL" },
    paydayStart: { type: Number, default: null },
    paydayEnd: { type: Number, default: null },
    notes: { type: String, default: null },
    // Marca quando o usuario concluiu o onboarding financeiro (first-access).
    // null = ainda nao configurou; usado para decidir o redirect em /dashboard.
    financeProfileCompletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: "users",
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

export const User =
  mongoose.models.User ?? mongoose.model("User", userSchema, "users");
