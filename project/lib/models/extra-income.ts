import { dbConnect } from "@/lib/mongoose";
import mongoose from "mongoose";

const extraIncomeSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    referenceMonth: { type: String, required: true },
    name: { type: String, required: true },
    amount: { type: Number, required: false, default: 0 },
    receivedDay: { type: Number, required: false, default: null },
    description: { type: String, required: false, default: null },
  },
  { timestamps: true },
);

extraIncomeSchema.index({ userId: 1, referenceMonth: 1 });

await dbConnect();

export const ExtraIncome =
  mongoose.models.extraincome || mongoose.model("extraincome", extraIncomeSchema);
