import { dbConnect } from "@/lib/mongoose";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: false, default: null },
    email: { type: String, required: false, unique: true, sparse: true, default: null },
    emailVerified: { type: Date, required: false, default: null },
    image: { type: String, required: false, default: null },
    currency: { type: String, required: false, default: "BRL" },
    paydayStart: { type: Number, required: false, default: null },
    paydayEnd: { type: Number, required: false, default: null },
    notes: { type: String, required: false, default: null },
    // Marca quando o usuario concluiu o onboarding financeiro (first-access).
    // null = ainda nao configurou; usado para decidir o redirect em /dashboard.
    financeProfileCompletedAt: { type: Date, required: false, default: null },
  },
  { timestamps: true },
);

await dbConnect();

export const User = mongoose.models.user || mongoose.model("user", userSchema);
