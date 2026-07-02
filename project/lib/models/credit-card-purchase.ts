import { dbConnect } from "@/lib/mongoose";
import mongoose from "mongoose";

const creditCardPurchaseSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    expenseGroupId: { type: String, required: true },
    kind: { type: String, enum: ["debt", "credit_card"], required: false, default: "credit_card" },
    source: { type: String, required: false, default: "Cartao de credito" },
    purchasedAt: { type: Date, required: true },
    firstInstallmentMonth: { type: String, required: true },
    title: { type: String, required: true },
    totalAmount: { type: Number, required: false, default: 0 },
    installmentAmount: { type: Number, required: false, default: 0 },
    installmentCount: { type: Number, required: false, default: 1 },
    description: { type: String, required: false, default: null },
    paymentDay: { type: Number, required: false, default: null },
  },
  { timestamps: true },
);

creditCardPurchaseSchema.index({ userId: 1, firstInstallmentMonth: 1 });
creditCardPurchaseSchema.index({ userId: 1, kind: 1, firstInstallmentMonth: 1 });
creditCardPurchaseSchema.index({ expenseGroupId: 1 });

await dbConnect();

export const CreditCardPurchase =
  mongoose.models.creditcardpurchase ||
  mongoose.model("creditcardpurchase", creditCardPurchaseSchema);
