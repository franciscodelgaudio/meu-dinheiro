import mongoose, { Schema } from "mongoose";

const creditCardPurchaseSchema = new Schema(
  {
    userId: { type: String, required: true },
    expenseGroupId: { type: String, required: true },
    kind: { type: String, default: "credit_card" },
    source: { type: String, default: "Cartao de credito" },
    purchasedAt: { type: Date, required: true },
    firstInstallmentMonth: { type: String, required: true },
    title: { type: String, required: true },
    totalAmount: { type: Number, default: 0 },
    installmentAmount: { type: Number, default: 0 },
    installmentCount: { type: Number, default: 1 },
    description: { type: String, default: null },
    paymentDay: { type: Number, default: null },
  },
  {
    timestamps: true,
    collection: "creditCardPurchases",
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

creditCardPurchaseSchema.index({ userId: 1, firstInstallmentMonth: 1 });
creditCardPurchaseSchema.index({ userId: 1, kind: 1, firstInstallmentMonth: 1 });
creditCardPurchaseSchema.index({ expenseGroupId: 1 });

export const CreditCardPurchase =
  mongoose.models.CreditCardPurchase ??
  mongoose.model(
    "CreditCardPurchase",
    creditCardPurchaseSchema,
    "creditCardPurchases",
  );
